import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { listAppointments, APPT_LABELS, KIND_LABELS } from '@/server/pipeline/appointments';
import { listCases, listExperts } from '@/server/pipeline/cases';
import { berlinDayRange, berlinToday, toBerlinLocalInput } from '@/lib/berlin';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { AutoForm } from '@/components/admin/AutoForm';
import { DrawerHost, OpenDrawer } from '@/components/admin/Overlay';
import { AppointmentForm } from '@/components/admin/work';
import { Badge, EmptyState, PageHeader, hrefWith, qp } from '@/components/admin/ui';
import { createAppointmentAction } from '../faelle/work-actions';

export const metadata: Metadata = { title: 'Termine' };

const TZ = 'Europe/Berlin';
const HOUR_START = 7;
const HOUR_END = 20;
const HRS = HOUR_END - HOUR_START;

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const dow = (d: string) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7;
const weekStart = (d: string) => addDays(d, -dow(d));
const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('de-DE', { ...o, timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
const hm = (d: Date) => new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(d);
const minutesOfDay = (d: Date) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ }).formatToParts(d).map((x) => [x.type, x.value]));
  return Number(p.hour) * 60 + Number(p.minute);
};

type Appt = Awaited<ReturnType<typeof listAppointments>>[number];
const who = (a: Appt) => a.case.customer.company || a.case.customer.lastName;

function layout(list: Appt[]) {
  // einfache Spurenzuteilung: überlappende Termine (verschiedene Gutachter) stehen nebeneinander
  const sorted = [...list].sort((x, y) => x.startsAt.getTime() - y.startsAt.getTime());
  const lanes: Date[] = [];
  const placed = sorted.map((a) => {
    let i = lanes.findIndex((end) => end <= a.startsAt);
    if (i === -1) { i = lanes.length; lanes.push(a.endsAt); } else lanes[i] = a.endsAt;
    return { a, lane: i };
  });
  return placed.map((p) => ({ ...p, lanes: Math.max(1, lanes.length) }));
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission('appointments.read.all', 'appointments.read.own');
  const sp = await searchParams;
  const today = berlinToday();
  const view = ['tag', 'woche', 'monat'].includes(qp(sp.ansicht) ?? '') ? (qp(sp.ansicht) as 'tag' | 'woche' | 'monat') : 'woche';
  const dateRaw = qp(sp.datum);
  const date = dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) && !Number.isNaN(Date.parse(dateRaw)) ? dateRaw : today;
  const canAll = user.permissions.has('appointments.read.all');
  const expertId = canAll ? qp(sp.sv) : undefined;

  let first: string, days: number;
  if (view === 'tag') { first = date; days = 1; }
  else if (view === 'woche') { first = weekStart(date); days = 7; }
  else { first = weekStart(`${date.slice(0, 8)}01`); days = 42; }
  const from = berlinDayRange(first)!.start;
  const to = berlinDayRange(addDays(first, days))!.start;

  const [appts, experts] = await Promise.all([listAppointments(user, { from, to, expertId }), canAll ? listExperts(user) : Promise.resolve([])]);
  const canWrite = user.permissions.has('appointments.write.all') || user.permissions.has('appointments.write.own');
  const cases = canWrite ? await listCases(user, { status: 'open', limit: 100 }).catch(() => null) : null;

  const base = '/admin/termine';
  const nav = (n: number) => addDays(date, view === 'tag' ? n : view === 'woche' ? 7 * n : n * 30);
  const link = (o: Record<string, string | undefined>) => hrefWith(base, { ansicht: view === 'woche' ? undefined : view, sv: expertId, ...o });
  const title = view === 'tag'
    ? fmt(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : view === 'woche'
      ? `${fmt(first, { day: 'numeric', month: 'short' })} – ${fmt(addDays(first, 6), { day: 'numeric', month: 'short', year: 'numeric' })}`
      : fmt(date, { month: 'long', year: 'numeric' });

  const byDay = new Map<string, Appt[]>();
  for (const a of appts) byDay.set(dayKey(a.startsAt), [...(byDay.get(dayKey(a.startsAt)) ?? []), a]);
  const colDays = Array.from({ length: view === 'tag' ? 1 : 7 }, (_, i) => addDays(first, i));
  const eventTitle = (a: Appt) => `${hm(a.startsAt)}–${hm(a.endsAt)} ${KIND_LABELS[a.kind]} · ${who(a)} · ${a.expert.firstName} ${a.expert.lastName}`;

  const drawers = canWrite ? [{
    id: 'appt-new',
    title: 'Termin anlegen',
    content: (
      <AppointmentForm
        action={createAppointmentAction}
        experts={experts.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))}
        canPickExpert={user.permissions.has('appointments.write.all')}
        currentExpertId={user.id}
        caseOptions={(cases?.rows ?? []).map((c) => ({ id: c.id, label: `${c.caseNumber} · ${c.customer.company || c.customer.lastName}${c.vehicle.licensePlate ? ` · ${c.vehicle.licensePlate}` : ''}` }))}
        initial={{ startsAt: toBerlinLocalInput(new Date(`${date}T08:00:00`)) }}
        submitLabel="Termin anlegen"
      />
    ),
  }] : [];

  return (
    <DrawerHost drawers={drawers}>
      <PageHeader title="Termine" intro={canAll ? undefined : 'Ihre Termine.'} actions={canWrite ? <OpenDrawer id="appt-new" icon="plus" className="adm-btn">Termin</OpenDrawer> : undefined} />

      <div className="cal-bar">
        <Link href={link({ datum: nav(-1) })} className="adm-btn adm-btn-secondary adm-btn-icon" aria-label="Zurück"><AdminIcon name="chevronRight" className="rotate-180" /></Link>
        <Link href={link({ datum: today })} className="adm-btn adm-btn-secondary">Heute</Link>
        <Link href={link({ datum: nav(1) })} className="adm-btn adm-btn-secondary adm-btn-icon" aria-label="Weiter"><AdminIcon name="chevronRight" /></Link>
        <h2 className="cal-title">{title}</h2>
        <nav className="adm-seg" style={{ margin: '0 0 0 auto' }} aria-label="Ansicht">
          {(['tag', 'woche', 'monat'] as const).map((v) => <Link key={v} href={hrefWith(base, { ansicht: v === 'woche' ? undefined : v, datum: date, sv: expertId })} aria-current={view === v ? 'page' : undefined}>{v === 'tag' ? 'Tag' : v === 'woche' ? 'Woche' : 'Monat'}</Link>)}
        </nav>
        {canAll && (
          <AutoForm action={base} className="">
            {view !== 'woche' && <input type="hidden" name="ansicht" value={view} />}
            <input type="hidden" name="datum" value={date} />
            <select name="sv" defaultValue={expertId ?? ''} className="adm-input" aria-label="Sachverständiger" style={{ width: 'auto', minWidth: 170 }}>
              <option value="">Alle Sachverständigen</option>
              {experts.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
            </select>
          </AutoForm>
        )}
      </div>

      {view !== 'monat' && (
        <div className="cal-week" style={{ ['--cols' as string]: colDays.length, ['--hrs' as string]: HRS }}>
          <div className="cal-head" />
          {colDays.map((d) => <div key={d} className="cal-head" data-today={d === today}>{fmt(d, { weekday: 'short' })}<small>{fmt(d, { day: 'numeric', month: 'numeric' })}</small></div>)}
          <div className="cal-hours" style={{ height: HRS * 56 }}>{Array.from({ length: HRS }, (_, i) => <span key={i} style={{ top: `${(i / HRS) * 100}%` }}>{String(HOUR_START + i).padStart(2, '0')}:00</span>)}</div>
          {colDays.map((d) => (
            <div key={d} className="cal-col" data-today={d === today} style={{ height: HRS * 56 }}>
              {layout(byDay.get(d) ?? []).map(({ a, lane, lanes }) => {
                const s = Math.max(minutesOfDay(a.startsAt) - HOUR_START * 60, 0);
                const e = Math.min(Math.max(minutesOfDay(a.endsAt), minutesOfDay(a.startsAt) + 20) - HOUR_START * 60, HRS * 60);
                return (
                  <Link key={a.id} href={`/admin/faelle/${a.case.caseNumber}/?tab=termine`} className="cal-ev" data-s={a.status} data-k={a.kind} title={eventTitle(a)}
                    style={{ top: `${(s / (HRS * 60)) * 100}%`, height: `${Math.max(((e - s) / (HRS * 60)) * 100, 3)}%`, left: `calc(${(lane / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)` }}>
                    <b>{hm(a.startsAt)} {who(a)}</b>
                    {a.case.vehicle.licensePlate ?? a.case.vehicle.model}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {view === 'monat' && (
        <div>
          <div className="cal-month" style={{ borderBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
            {Array.from({ length: 7 }, (_, i) => <div key={i} className="cal-head" style={{ borderLeft: i ? '1px solid rgb(var(--a-border) / .06)' : 0 }}>{fmt(addDays(first, i), { weekday: 'short' })}</div>)}
          </div>
          <div className="cal-month" style={{ borderTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
            {Array.from({ length: 42 }, (_, i) => {
              const d = addDays(first, i);
              const list = byDay.get(d) ?? [];
              return (
                <div key={d} className="cal-cell" data-out={d.slice(0, 7) !== date.slice(0, 7)} data-today={d === today}>
                  <Link href={link({ ansicht: 'tag', datum: d })} className="d">{Number(d.slice(8))}</Link>
                  {list.slice(0, 3).map((a) => <Link key={a.id} href={`/admin/faelle/${a.case.caseNumber}/?tab=termine`} className="cal-chip" data-s={a.status} title={eventTitle(a)}>{hm(a.startsAt)} {who(a)}</Link>)}
                  {list.length > 3 && <Link href={link({ ansicht: 'tag', datum: d })} className="t-3" style={{ fontSize: 11 }}>+{list.length - 3} weitere</Link>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Agenda (Mobil und als lesbare Liste): gruppiert nach Tag */}
      <div className="cal-agenda" aria-label="Agenda">
        {appts.length === 0 ? (
          <EmptyState icon="calendar" title="Keine Termine in diesem Zeitraum">{canWrite ? 'Über „Termin“ legen Sie einen neuen Termin an.' : 'Für diesen Zeitraum sind keine Termine eingetragen.'}</EmptyState>
        ) : (
          [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([d, list]) => (
            <section key={d}>
              <h3 className="cal-day-h" data-today={d === today}>{d === today ? 'Heute · ' : ''}{fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
              <ul className="adm-list">
                {list.map((a) => (
                  <li key={a.id}>
                    <span className="main">
                      <Link href={`/admin/faelle/${a.case.caseNumber}/?tab=termine`} className="stretch">{hm(a.startsAt)}–{hm(a.endsAt)} · {who(a)}</Link>
                      <span className="secondary">{KIND_LABELS[a.kind]} · {a.case.vehicle.licensePlate ?? a.case.vehicle.model} · {a.expert.firstName} {a.expert.lastName}{a.location ? ` · ${a.location}` : ''}</span>
                    </span>
                    <Badge tone={a.status === 'CONFIRMED' ? 'ok' : a.status === 'DONE' ? 'muted' : 'info'}>{APPT_LABELS[a.status]}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </DrawerHost>
  );
}
