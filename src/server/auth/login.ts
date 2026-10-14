import 'server-only';
import { createHash } from 'node:crypto';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';
import { dummyHash, verifyPassword } from './password';
import { createSession } from './session';
import { LOGIN_LOCK_MINUTES, LOGIN_MAX_ATTEMPTS } from './login-limits';
import { createChallenge } from './mfa';

/**
 * Anmeldung mit Drosselung.
 *  - je E-Mail-Hash: 5 Fehlversuche / 15 min  → Konto-Sperre
 *  - je IP:          20 Fehlversuche / 15 min → IP-Sperre
 * Die Antwort ist bei jedem Fehler identisch („E-Mail oder Passwort stimmt nicht“),
 * und bei unbekannter E-Mail wird trotzdem ein Argon2-Hash berechnet (gleiche Laufzeit).
 */

export { LOGIN_LOCK_MINUTES, LOGIN_MAX_ATTEMPTS } from './login-limits';
const IP_MAX = 20;

export type LoginResult =
  | { ok: true; mfa: false; token: string; expiresAt: Date; userId: string; mustChangePassword: boolean }
  | { ok: true; mfa: true; challenge: string }
  | { ok: false; reason: 'invalid' | 'throttled' };

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
const emailHash = (email: string) => createHash('sha256').update(normalizeEmail(email)).digest('hex');

export async function authenticate(
  emailRaw: string,
  password: string,
  ctx: { ip: string; userAgent: string | null },
): Promise<LoginResult> {
  const email = normalizeEmail(emailRaw);
  const eh = emailHash(email);
  const since = new Date(Date.now() - LOGIN_LOCK_MINUTES * 60_000);

  const [byEmail, byIp] = await Promise.all([
    db.loginAttempt.count({ where: { emailHash: eh, success: false, createdAt: { gte: since } } }),
    db.loginAttempt.count({ where: { ip: ctx.ip, success: false, createdAt: { gte: since } } }),
  ]);
  if (byEmail >= LOGIN_MAX_ATTEMPTS || byIp >= IP_MAX) {
    await writeAudit({ action: 'auth.login_throttled', entityType: 'User', summary: 'Anmeldung gedrosselt', ip: ctx.ip, userAgent: ctx.userAgent });
    return { ok: false, reason: 'throttled' };
  }

  const user = await db.user.findUnique({ where: { email } });
  const usable = user && user.isActive && !user.deletedAt;
  const locked = Boolean(user?.lockedUntil && user.lockedUntil > new Date());

  const valid = await verifyPassword(usable ? user.passwordHash : await dummyHash(), password);

  if (!usable || locked || !valid) {
    await db.loginAttempt.create({ data: { ip: ctx.ip, emailHash: eh, success: false } });
    if (usable && !locked) {
      const failed = user.failedLogins + 1;
      await db.user.update({
        where: { id: user.id },
        data: { failedLogins: failed, ...(failed >= LOGIN_MAX_ATTEMPTS ? { lockedUntil: new Date(Date.now() + LOGIN_LOCK_MINUTES * 60_000) } : {}) },
      });
    }
    await writeAudit({
      actorId: user?.id ?? null,
      action: 'auth.login_failed',
      entityType: 'User',
      entityId: user?.id ?? null,
      summary: locked ? 'Anmeldung bei gesperrtem Konto' : 'Fehlgeschlagene Anmeldung',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return { ok: false, reason: 'invalid' };
  }

  // Zweiter Faktor aktiv: noch keine Sitzung – erst nach richtigem Code (Fehlversuche zählen weiter gegen die Sperre).
  if (user.mfaEnabledAt && user.mfaSecret) {
    return { ok: true, mfa: true, challenge: await createChallenge(user.id) };
  }

  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await db.loginAttempt.create({ data: { ip: ctx.ip, emailHash: eh, success: true } });
  const { token, expiresAt } = await createSession(user.id, ctx);
  await writeAudit({ actorId: user.id, action: 'auth.login', entityType: 'User', entityId: user.id, summary: 'Angemeldet', ip: ctx.ip, userAgent: ctx.userAgent });
  // Alte Versuche aufräumen (klein halten).
  await db.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 3600_000) } } });

  return { ok: true, mfa: false, token, expiresAt, userId: user.id, mustChangePassword: user.mustChangePassword };
}
