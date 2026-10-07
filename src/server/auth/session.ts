import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { db } from '@/server/db';
import { effectivePermissions } from './permissions';
import type { AuthUser } from './session-types';

export type { AuthUser } from './session-types';

/**
 * Sitzungen.
 *
 * Der Token (256 Bit Zufall) lebt nur im Cookie. In der Datenbank liegt ausschließlich
 * sein SHA-256-Hash – wer eine Sicherungskopie liest, kann sich damit nicht anmelden.
 * SHA-256 genügt hier (anders als bei Passwörtern), weil der Token nicht erratbar ist.
 *
 * Serverseitige Sitzung statt JWT: Sie lässt sich sofort beenden (Deaktivierung,
 * Rollenwechsel, Passwortänderung), ein JWT bliebe bis zum Ablauf gültig.
 */

const PROD = process.env.NODE_ENV === 'production';
/** `__Host-` verlangt Secure, Path=/ und verbietet Domain: das Cookie ist an genau diesen Host gebunden. */
export const SESSION_COOKIE = PROD ? '__Host-ing_session' : 'ing_session';
export const SESSION_COOKIE_NAMES = ['__Host-ing_session', 'ing_session'] as const;

const IDLE_HOURS = Number(process.env.SESSION_HOURS ?? 12);
const MAX_DAYS = Number(process.env.SESSION_MAX_DAYS ?? 7);

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string, meta: { ip?: string | null; userAgent?: string | null }) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + IDLE_HOURS * 3600_000);
  await db.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt, ip: meta.ip ?? null, userAgent: meta.userAgent?.slice(0, 500) ?? null },
  });
  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: PROD, sameSite: 'lax', path: '/', expires: expiresAt });
}

export async function clearSessionCookie() {
  // Gleiche Attribute wie beim Setzen: ein __Host--Cookie wird vom Browser nur gelöscht,
  // wenn auch die Löschanweisung Secure + Path=/ trägt.
  (await cookies()).set(SESSION_COOKIE, '', { httpOnly: true, secure: PROD, sameSite: 'lax', path: '/', maxAge: 0, expires: new Date(0) });
}

/**
 * Liest die Sitzung und prüft sie bei JEDEM Aufruf gegen die Datenbank:
 * abgelaufen, widerrufen, Konto deaktiviert oder gelöscht → null.
 * Pro Request nur einmal ausgeführt (React cache).
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const s = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { employee: true, permissions: true } } },
  });
  if (!s || s.revokedAt || s.expiresAt <= new Date()) return null;
  const u = s.user;
  if (!u.isActive || u.deletedAt) return null;

  // Harte Obergrenze ab Anlage – Aktivität verschiebt sie nicht.
  if (Date.now() - s.createdAt.getTime() > MAX_DAYS * 86400_000) return null;

  await maybeExtend(s.id, s.createdAt, s.expiresAt, s.lastSeenAt);

  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    isExpert: u.employee?.isExpert ?? u.role === 'EXPERT',
    mustChangePassword: u.mustChangePassword,
    permissions: effectivePermissions(u.role, u.permissions),
    sessionId: s.id,
  };
});

/** Verlängert erst, wenn weniger als die Hälfte der Laufzeit übrig ist (kein Schreibzugriff pro Aufruf). */
async function maybeExtend(id: string, createdAt: Date, expiresAt: Date, lastSeenAt: Date) {
  const now = Date.now();
  const idle = IDLE_HOURS * 3600_000;
  try {
    if (expiresAt.getTime() - now < idle / 2) {
      const cap = createdAt.getTime() + MAX_DAYS * 86400_000;
      await db.session.update({ where: { id }, data: { expiresAt: new Date(Math.min(now + idle, cap)), lastSeenAt: new Date() } });
    } else if (now - lastSeenAt.getTime() > 5 * 60_000) {
      await db.session.update({ where: { id }, data: { lastSeenAt: new Date() } });
    }
  } catch {
    /* Eine misslungene Verlängerung darf keine gültige Anfrage scheitern lassen. */
  }
}

export async function revokeSession(sessionId: string) {
  await db.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } }).catch(() => undefined);
}

/** Beendet alle Sitzungen eines Benutzers (optional außer der aktuellen). */
export async function revokeAllSessions(userId: string, exceptSessionId?: string) {
  await db.session.updateMany({
    where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
}
