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
