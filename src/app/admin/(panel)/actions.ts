'use server';

import { redirect } from 'next/navigation';
import { writeAudit } from '@/server/audit';
import { getAuthUser, clearSessionCookie, revokeSession } from '@/server/auth/session';
import { requestMeta } from '@/server/http';

export async function logoutAction() {
  const user = await getAuthUser();
  if (user) {
    const meta = await requestMeta();
    await revokeSession(user.sessionId);
    await writeAudit({ actorId: user.id, action: 'auth.logout', entityType: 'User', entityId: user.id, summary: 'Abgemeldet', ...meta });
  }
  await clearSessionCookie();
  redirect('/admin/login');
}
