'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';
import { getAuthUser, revokeAllSessions } from '@/server/auth/session';
import { hashPassword, validatePasswordPolicy, verifyPassword } from '@/server/auth/password';
import { requestMeta } from '@/server/http';
import { toFormState, type FormState } from '@/server/admin/form';

const schema = z.object({ current: z.string().min(1, 'Aktuelles Passwort fehlt.'), next: z.string().min(1, 'Neues Passwort fehlt.'), confirm: z.string() });

export async function changePasswordAction(_p: FormState, fd: FormData): Promise<FormState> {
  const user = await getAuthUser();
  if (!user) redirect('/admin/login');
  try {
    const data = schema.parse(Object.fromEntries(fd));
    if (data.next !== data.confirm) return { error: 'Bitte die Eingaben prüfen.', fields: { confirm: 'Die Passwörter stimmen nicht überein.' } };
    const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await verifyPassword(row.passwordHash, data.current))) return { error: 'Bitte die Eingaben prüfen.', fields: { current: 'Das aktuelle Passwort stimmt nicht.' } };
    if (await verifyPassword(row.passwordHash, data.next)) return { error: 'Bitte die Eingaben prüfen.', fields: { next: 'Das neue Passwort muss sich vom alten unterscheiden.' } };
    const policy = validatePasswordPolicy(data.next, row);
    if (policy) return { error: 'Bitte die Eingaben prüfen.', fields: { next: policy } };

    const passwordHash = await hashPassword(data.next);
    const meta = await requestMeta();
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false, failedLogins: 0, lockedUntil: null } });
      await writeAudit({ actorId: user.id, action: 'auth.password_change', entityType: 'User', entityId: user.id, summary: 'Passwort geändert', ...meta }, tx);
    });
    await revokeAllSessions(user.id, user.sessionId); // andere Geräte abmelden
  } catch (e) {
    return toFormState(e);
  }
  return { ok: true, message: 'Passwort geändert. Alle anderen Geräte wurden abgemeldet.' };
}

export async function revokeOtherSessionsAction(): Promise<void> {
  const user = await getAuthUser();
  if (!user) redirect('/admin/login');
  await revokeAllSessions(user.id, user.sessionId);
  await writeAudit({ actorId: user.id, action: 'auth.sessions_revoked', entityType: 'User', entityId: user.id, summary: 'Andere Sitzungen beendet', ...(await requestMeta()) });
  redirect('/admin/profil');
}

/* ------------------------------------------------------------ Zwei-Faktor-Anmeldung */
import { beginEnrollment, confirmEnrollment, disableMfa, regenerateRecoveryCodes } from '@/server/auth/mfa';
import { getSetting } from '@/server/settings';
import { groupSecret } from '@/lib/totp';

export type MfaResult = { ok: boolean; error?: string; secret?: string; uri?: string; codes?: string[] };
const fail = (e: unknown): MfaResult => ({ ok: false, error: e instanceof Error && 'code' in e ? e.message : e instanceof Error ? e.message : 'Das hat nicht geklappt.' });

async function me() {
  const user = await getAuthUser();
  if (!user) redirect('/admin/login');
  return user;
}

export async function startMfaAction(): Promise<MfaResult> {
  try { const r = await beginEnrollment(await me()); return { ok: true, secret: groupSecret(r.secret), uri: r.uri }; } catch (e) { return fail(e); }
}
export async function confirmMfaAction(code: string): Promise<MfaResult> {
  try { const r = await confirmEnrollment(await me(), String(code)); return { ok: true, codes: r.recoveryCodes }; } catch (e) { return fail(e); }
}
export async function disableMfaAction(password: string, code: string): Promise<MfaResult> {
  try {
    const user = await me();
    const enforced = (user.role === 'OWNER' || user.role === 'ADMIN') && (await getSetting('security')).requireMfaForAdmins;
    await disableMfa(user, String(password), String(code), enforced);
    return { ok: true };
  } catch (e) { return fail(e); }
}
export async function regenerateRecoveryAction(code: string): Promise<MfaResult> {
  try { return { ok: true, codes: await regenerateRecoveryCodes(await me(), String(code)) }; } catch (e) { return fail(e); }
}

/* ---------- Kalender-Synchronisierung (ICS-Abo) ---------- */
export type CalendarResult = { ok: boolean; error?: string; url?: string };

async function originOf(): Promise<string> {
  const { headers } = await import('next/headers');
  const h = await headers();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(',')[0].trim();
  const proto = (h.get('x-forwarded-proto') ?? 'https').split(',')[0].trim();
  return /^[a-z0-9.-]+(:\d+)?$/i.test(host) && /^https?$/.test(proto) ? `${proto}://${host}` : '';
}

/** Erzeugt (oder ersetzt) den privaten Abo-Link. Der Link wird nur in dieser Antwort angezeigt. */
export async function createCalendarFeedAction(showDetails: boolean): Promise<CalendarResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: 'Bitte erneut anmelden.' };
  try {
    const { createFeed, feedUrl } = await import('@/server/calendar/feed');
    const { token } = await createFeed(user, { showDetails: Boolean(showDetails) });
    return { ok: true, url: feedUrl(token, (await originOf()) || undefined) };
  } catch {
    return { ok: false, error: 'Für dieses Konto sind keine Termine freigegeben.' };
  }
}

export async function revokeCalendarFeedAction(): Promise<CalendarResult> {
  const user = await getAuthUser();
  if (!user) return { ok: false, error: 'Bitte erneut anmelden.' };
  const { revokeFeed } = await import('@/server/calendar/feed');
  await revokeFeed(user);
  return { ok: true };
}
