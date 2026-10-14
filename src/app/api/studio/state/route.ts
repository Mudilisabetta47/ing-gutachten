import { NextResponse } from 'next/server';
import { authorize } from '@/server/auth/guards';
import { AuthRequiredError } from '@/server/auth/errors';
import { dashboardCounts } from '@/server/pipeline/today';
import { myNotifications } from '@/server/pipeline/tasks';
import { buildNotices } from '@/server/admin/notices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Aktuelle Hinweise und Benachrichtigungen für die Benachrichtigungszentrale (wird alle ~60 s abgefragt). */
export async function GET() {
  try {
    const user = await authorize();
    const [counts, notifications] = await Promise.all([dashboardCounts(user), myNotifications(user, 12)]);
    return NextResponse.json({ ok: true, notices: buildNotices(counts), notifications: notifications.map((n) => ({ id: n.id, text: n.text, href: n.href, read: n.read, at: n.createdAt })) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof AuthRequiredError) return NextResponse.json({ error: 'auth' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json({ error: 'server' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
