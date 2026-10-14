import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';
import { DomainError } from '@/server/errors';
import { ForbiddenError } from './errors';
import { LOGIN_LOCK_MINUTES, LOGIN_MAX_ATTEMPTS } from './login-limits';
import { verifyPassword } from './password';
import { createSession, revokeAllSessions } from './session';
import type { AuthUser } from './session-types';
import { normalizeRecovery, newRecoveryCode, newSecret, otpauthUri, verifyTotp } from '@/lib/totp';

/**
 * Zwei-Faktor-Anmeldung (TOTP, RFC 6238).
 *  - Geheimnis liegt verschlüsselt (AES-256-GCM, Schlüssel aus MFA_ENCRYPTION_KEY) in der Datenbank – ein Datenbank-Abzug allein verrät es nicht.
 *  - Ein Code gilt nur einmal (letzter Schritt wird gemerkt), Fenster ±30 s.
 *  - Nach dem Passwort entsteht eine einmalige Aufgabe (5 min, höchstens 5 Versuche); Fehlversuche zählen auch gegen die Konto-Sperre.
 *  - Wiederherstellungscodes: 8 Stück, nur als Hash gespeichert, jeder einmal verwendbar.
 */
const PROD = process.env.NODE_ENV === 'production';
export const CHALLENGE_MINUTES = 5;
export const CHALLENGE_MAX_ATTEMPTS = 5;
export const RECOVERY_CODES = 8;

export const mfaAvailable = () => !PROD || (process.env.MFA_ENCRYPTION_KEY ?? '').length >= 32;

function key(): Buffer {
  const k = process.env.MFA_ENCRYPTION_KEY;
  if (k && k.length >= 32) return createHash('sha256').update(k).digest();
  if (PROD) throw new DomainError('Die Zwei-Faktor-Anmeldung ist auf diesem Server noch nicht eingerichtet (MFA_ENCRYPTION_KEY fehlt).');
  return createHash('sha256').update('ing-dev-only-mfa-key').digest(); // nur lokale Entwicklung/Tests
}
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), ct.toString('base64url')].join(':');
}
export function decryptSecret(blob: string): string {
  const [v, iv, tag, ct] = blob.split(':');
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('Unbekanntes Format');
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
}

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
const hashRecovery = (userId: string, code: string) => createHash('sha256').update(`${userId}:${normalizeRecovery(code)}`).digest('hex');

/* ------------------------------------------------------------ Einrichten / Abschalten */

export async function mfaStatus(userId: string) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { mfaEnabledAt: true, mfaSecret: true } });
  const left = u.mfaEnabledAt ? await db.mfaRecoveryCode.count({ where: { userId, usedAt: null } }) : 0;
  return { enabled: Boolean(u.mfaEnabledAt), enabledAt: u.mfaEnabledAt, pending: Boolean(u.mfaSecret && !u.mfaEnabledAt), recoveryLeft: left };
}

/** Schritt 1: Geheimnis erzeugen (noch nicht aktiv). Der Klartext wird nur hier einmal zurückgegeben. */
export async function beginEnrollment(user: AuthUser) {
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { mfaEnabledAt: true } });
  if (row.mfaEnabledAt) throw new DomainError('Die Zwei-Faktor-Anmeldung ist bereits aktiv.', 'conflict');
  const secret = newSecret();
  await db.user.update({ where: { id: user.id }, data: { mfaSecret: encryptSecret(secret), mfaLastStep: null } });
  await writeAudit({ actorId: user.id, action: 'auth.mfa_setup_started', entityType: 'User', entityId: user.id, summary: 'Einrichtung der Zwei-Faktor-Anmeldung begonnen' });
  return { secret, uri: otpauthUri(user.email, secret) };
}

/** Schritt 2: mit einem Code aus der App bestätigen → aktiv, Wiederherstellungscodes werden einmalig angezeigt. */
export async function confirmEnrollment(user: AuthUser, code: string, now = Date.now()): Promise<{ recoveryCodes: string[] }> {
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { mfaSecret: true, mfaEnabledAt: true } });
  if (row.mfaEnabledAt) throw new DomainError('Die Zwei-Faktor-Anmeldung ist bereits aktiv.', 'conflict');
  if (!row.mfaSecret) throw new DomainError('Bitte zuerst die Einrichtung starten.');
  const step = verifyTotp(decryptSecret(row.mfaSecret), code, now, null);
  if (step === null) throw new DomainError('Der Code stimmt nicht. Bitte den aktuellen 6-stelligen Code aus der App eingeben.');
  const codes = Array.from({ length: RECOVERY_CODES }, () => newRecoveryCode());
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { mfaEnabledAt: new Date(now), mfaLastStep: step } });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
    await tx.mfaRecoveryCode.createMany({ data: codes.map((c) => ({ userId: user.id, codeHash: hashRecovery(user.id, c) })) });
    await writeAudit({ actorId: user.id, action: 'auth.mfa_enable', entityType: 'User', entityId: user.id, summary: 'Zwei-Faktor-Anmeldung aktiviert' }, tx);
  });
  return { recoveryCodes: codes };
}

/** Prüft TOTP oder Wiederherstellungscode für eine bereits angemeldete Person (Abschalten, neue Codes). */
async function verifySecondFactor(userId: string, codeRaw: string, now: number): Promise<'totp' | 'recovery' | null> {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { mfaSecret: true, mfaLastStep: true, mfaEnabledAt: true } });
  if (!u.mfaEnabledAt || !u.mfaSecret) return null;
  if (/^\d[\d\s]{4,}$/.test(codeRaw.trim())) {
    const step = verifyTotp(decryptSecret(u.mfaSecret), codeRaw, now, u.mfaLastStep);
    if (step === null) return null;
    await db.user.update({ where: { id: userId }, data: { mfaLastStep: step } });
    return 'totp';
  }
  const res = await db.mfaRecoveryCode.updateMany({ where: { userId, codeHash: hashRecovery(userId, codeRaw), usedAt: null }, data: { usedAt: new Date(now) } });
  return res.count === 1 ? 'recovery' : null;
}

export async function disableMfa(user: AuthUser, password: string, code: string, enforced: boolean, now = Date.now()) {
  if (enforced) throw new ForbiddenError('Für Ihre Rolle ist die Zwei-Faktor-Anmeldung verpflichtend und kann nicht abgeschaltet werden.');
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!row.mfaEnabledAt) throw new DomainError('Die Zwei-Faktor-Anmeldung ist nicht aktiv.', 'conflict');
  if (!(await verifyPassword(row.passwordHash, password))) throw new DomainError('Das Passwort stimmt nicht.');
  if (!(await verifySecondFactor(user.id, code, now))) throw new DomainError('Der Code stimmt nicht.');
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { mfaSecret: null, mfaEnabledAt: null, mfaLastStep: null } });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
    await writeAudit({ actorId: user.id, action: 'auth.mfa_disable', entityType: 'User', entityId: user.id, summary: 'Zwei-Faktor-Anmeldung abgeschaltet' }, tx);
  });
}

/** Neue Wiederherstellungscodes (die alten verfallen). Verlangt einen gültigen Code aus der App. */
export async function regenerateRecoveryCodes(user: AuthUser, code: string, now = Date.now()): Promise<string[]> {
  if (!(await verifySecondFactor(user.id, code, now))) throw new DomainError('Der Code stimmt nicht.');
  const codes = Array.from({ length: RECOVERY_CODES }, () => newRecoveryCode());
  await db.$transaction(async (tx) => {
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
    await tx.mfaRecoveryCode.createMany({ data: codes.map((c) => ({ userId: user.id, codeHash: hashRecovery(user.id, c) })) });
    await writeAudit({ actorId: user.id, action: 'auth.mfa_recovery_regenerated', entityType: 'User', entityId: user.id, summary: 'Neue Wiederherstellungscodes erzeugt' }, tx);
  });
  return codes;
}

/** Verlorenes Gerät: Leitung setzt den zweiten Faktor eines Kontos zurück (Sitzungen enden, Person richtet neu ein). */
export async function adminResetMfa(actor: AuthUser, targetId: string) {
  if (!actor.permissions.has('users.write')) throw new ForbiddenError();
  const t = await db.user.findFirst({ where: { id: targetId, deletedAt: null }, select: { id: true, role: true, mfaEnabledAt: true, mfaSecret: true } });
  if (!t) throw new DomainError('Benutzer nicht gefunden.', 'not_found');
  if (t.role === 'OWNER' && !actor.permissions.has('users.write.owner')) throw new ForbiddenError();
  if (!t.mfaEnabledAt && !t.mfaSecret) throw new DomainError('Für dieses Konto ist keine Zwei-Faktor-Anmeldung eingerichtet.', 'conflict');
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: t.id }, data: { mfaSecret: null, mfaEnabledAt: null, mfaLastStep: null } });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: t.id } });
    await tx.mfaChallenge.deleteMany({ where: { userId: t.id } });
    await writeAudit({ actorId: actor.id, action: 'auth.mfa_reset', entityType: 'User', entityId: t.id, summary: 'Zwei-Faktor-Anmeldung zurückgesetzt' }, tx);
  });
  await revokeAllSessions(t.id);
}

/* ------------------------------------------------------------ Anmelde-Aufgabe (zweiter Schritt) */

export async function createChallenge(userId: string, now = Date.now()): Promise<string> {
  await db.mfaChallenge.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date(now) } }, { userId }] } });
  const token = randomBytes(32).toString('base64url');
  await db.mfaChallenge.create({ data: { userId, tokenHash: hashToken(token), expiresAt: new Date(now + CHALLENGE_MINUTES * 60_000) } });
  return token;
}

export type ChallengeResult =
  | { ok: true; token: string; expiresAt: Date; userId: string; mustChangePassword: boolean; usedRecovery: boolean }
  | { ok: false; reason: 'expired' | 'invalid' | 'locked' };

export async function completeChallenge(rawToken: string, codeRaw: string, ctx: { ip: string; userAgent: string | null }, now = Date.now()): Promise<ChallengeResult> {
  const ch = await db.mfaChallenge.findUnique({ where: { tokenHash: hashToken(rawToken) }, include: { user: true } });
  if (!ch || ch.expiresAt.getTime() <= now) { if (ch) await db.mfaChallenge.delete({ where: { id: ch.id } }); return { ok: false, reason: 'expired' }; }
  const u = ch.user;
  if (!u.isActive || u.deletedAt || !u.mfaSecret || !u.mfaEnabledAt) { await db.mfaChallenge.delete({ where: { id: ch.id } }); return { ok: false, reason: 'expired' }; }
  if (u.lockedUntil && u.lockedUntil.getTime() > now) { await db.mfaChallenge.delete({ where: { id: ch.id } }); return { ok: false, reason: 'locked' }; }
  if (ch.attempts >= CHALLENGE_MAX_ATTEMPTS) { await db.mfaChallenge.delete({ where: { id: ch.id } }); return { ok: false, reason: 'expired' }; }

  let method: 'totp' | 'recovery' | null = null;
  let step: number | null = null;
  if (/^\d[\d\s]{4,}$/.test(codeRaw.trim())) {
    step = verifyTotp(decryptSecret(u.mfaSecret), codeRaw, now, u.mfaLastStep);
    if (step !== null) method = 'totp';
  } else if (codeRaw.trim()) {
    const r = await db.mfaRecoveryCode.updateMany({ where: { userId: u.id, codeHash: hashRecovery(u.id, codeRaw), usedAt: null }, data: { usedAt: new Date(now) } });
    if (r.count === 1) method = 'recovery';
  }

  if (!method) {
    const failed = u.failedLogins + 1;
    const lock = failed >= LOGIN_MAX_ATTEMPTS;
    await db.$transaction([
      db.mfaChallenge.update({ where: { id: ch.id }, data: { attempts: { increment: 1 } } }),
      db.user.update({ where: { id: u.id }, data: { failedLogins: failed, ...(lock ? { lockedUntil: new Date(now + LOGIN_LOCK_MINUTES * 60_000) } : {}) } }),
    ]);
    if (lock) await db.mfaChallenge.deleteMany({ where: { userId: u.id } });
    await writeAudit({ actorId: u.id, action: 'auth.mfa_failed', entityType: 'User', entityId: u.id, summary: 'Falscher Code beim zweiten Anmeldeschritt', ip: ctx.ip, userAgent: ctx.userAgent });
    return { ok: false, reason: lock ? 'locked' : 'invalid' };
  }

  await db.$transaction([
    db.mfaChallenge.deleteMany({ where: { userId: u.id } }),
    db.user.update({ where: { id: u.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date(now), ...(step !== null ? { mfaLastStep: step } : {}) } }),
  ]);
  const { token, expiresAt } = await createSession(u.id, ctx);
  await writeAudit({ actorId: u.id, action: 'auth.login', entityType: 'User', entityId: u.id, summary: method === 'recovery' ? 'Angemeldet (Wiederherstellungscode)' : 'Angemeldet (2. Faktor)', ip: ctx.ip, userAgent: ctx.userAgent });
  if (method === 'recovery') {
    const left = await db.mfaRecoveryCode.count({ where: { userId: u.id, usedAt: null } });
    await writeAudit({ actorId: u.id, action: 'auth.mfa_recovery_used', entityType: 'User', entityId: u.id, summary: `Wiederherstellungscode verwendet (${left} übrig)`, ip: ctx.ip, userAgent: ctx.userAgent });
  }
  return { ok: true, token, expiresAt, userId: u.id, mustChangePassword: u.mustChangePassword, usedRecovery: method === 'recovery' };
}

/** Pflicht für Inhaber/Administratoren? (Einstellung „Sicherheit“) */
export const ADMIN_ROLES = ['OWNER', 'ADMIN'] as const;
