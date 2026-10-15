import { NextResponse } from 'next/server';
import { authorize } from '@/server/auth/guards';
import { AuthRequiredError, ForbiddenError } from '@/server/auth/errors';
import { listAppointments, KIND_LABELS } from '@/server/pipeline/appointments';
import { berlinDayRange } from '@/lib/berlin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const H = { 'Cache-Control': 'no-store' };

/** Termine eines Monats (mit Randtagen des Kalenderrasters) für den Kalender in der Taskleiste. Rechte wie im ING Kalender (eigene bzw. alle). */
export async function GET(req: Request) {
  try {
    const user = await authorize('appointments.read.all', 'appointments.read.own');
    const m = new URL(req.url).searchParams.get('monat') ?? '';
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) return NextResponse.json({ error: 'invalid' }, { status: 400, headers: H });
    const first = `${m}-01`;
    const next = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5)), 1)).toISOString().slice(0, 10);
    const from = berlinDayRange(new Date(Date.parse(`${first}T12:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10))!.start;
    const to = berlinDayRange(new Date(Date.parse(`${next}T12:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10))!.start;
    const rows = await listAppointments(user, { from, to });
    return NextResponse.json({
      ok: true,
      appointments: rows.map((a) => ({
        id: a.id, startsAt: a.startsAt.toISOString(), endsAt: a.endsAt.toISOString(), kind: KIND_LABELS[a.kind] ?? 'Termin', status: a.status,
        caseNumber: a.case.caseNumber, who: a.case.customer.company || a.case.customer.lastName, expert: `${a.expert.firstName} ${a.expert.lastName}`,
        href: `/admin/faelle/${a.caseId}/`,
      })),
    }, { headers: H });
  } catch (e) {
    if (e instanceof AuthRequiredError) return NextResponse.json({ error: 'auth' }, { status: 401, headers: H });
    if (e instanceof ForbiddenError) return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: H });
    return NextResponse.json({ error: 'server' }, { status: 500, headers: H });
  }
}
