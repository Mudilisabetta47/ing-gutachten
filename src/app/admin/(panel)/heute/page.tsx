import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { todayOverview } from '@/server/pipeline/today';
import { CASE_LABELS, LEAD_LABELS } from '@/lib/workflow';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { Badge, EmptyState, PageHeader, Section, StatusPill, fmtWhen, mapsHref, phoneHref } from '@/components/admin/ui';
import { APPT_LABELS, KIND_LABELS } from '@/server/pipeline/appointments';

export const metadata: Metadata = { title: 'Heute' };

const dateLong = () => new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Berlin' }).format(new Date());

export default async function TodayPage() {
  const user = await requirePagePermission('leads.read', 'cases.read.all', 'cases.read.own');
  const t = await todayOverview(user);
  const canLeads = user.permissions.has('leads.read');
  const now = Date.now();
  const next = t.next;
  const who = (c: { company: string | null; firstName: string; lastName: string }) => c.company || `${c.firstName} ${c.lastName}`.trim();
  const hm = (d: Date) => new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(d);
  const place = (a: NonNullable<typeof next>) => a.location || a.case.inspectionLocation;
  const canWrite = user.permissions.has('appointments.write.all') || user.permissions.has('appointments.write.own');

  return (
    <>
      <PageHeader title="Heute" intro={dateLong()} />

      <Section title="Nächster Termin">
        {!next ? (
          <EmptyState icon="calendar" title="Kein Termin anstehend" action={<Link href="/admin/termine" className="adm-btn adm-btn-secondary">Zum Kalender</Link>}>In den nächsten 14 Tagen ist nichts eingetragen.</EmptyState>
        ) : (
          <div className="adm-panel" style={{ display: 'grid', gap: 14 }}>
            <div style={{ minWidth: 0 }}>
              <p className="t-3" style={{ margin: 0, fontSize: 12 }}>{fmtWhen(next.startsAt)} · {KIND_LABELS[next.kind]} · <span className="mono">{next.case.caseNumber}</span></p>
              <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, letterSpacing: '-.01em' }}>{hm(next.startsAt)} · {who(next.case.customer)}</p>
              <p className="t-2" style={{ margin: '2px 0 0' }}>{next.case.vehicle.manufacturer} {next.case.vehicle.model}{next.case.vehicle.licensePlate ? <> · <span className="mono">{next.case.vehicle.licensePlate}</span></> : null}</p>
              {place(next) && <p className="t-2" style={{ margin: '2px 0 0', display: 'flex', gap: 6, alignItems: 'center' }}><AdminIcon name="map" className="h-4 w-4" />{place(next)}</p>}
            </div>
            <div className="adm-actions">
              {place(next) && <a href={mapsHref(place(next))} target="_blank" rel="noreferrer" className="adm-btn" style={{ flex: '1 1 140px' }}><AdminIcon name="navigate" />Navigation</a>}
              {phoneHref(next.case.customer.phone) && <a href={phoneHref(next.case.customer.phone)} className="adm-btn adm-btn-secondary" style={{ flex: '1 1 120px' }}><AdminIcon name="phone" />Anrufen</a>}
              <Link href={`/admin/faelle/${next.case.caseNumber}/`} className="adm-btn adm-btn-secondary" style={{ flex: '1 1 120px' }}>Fall öffnen</Link>
              {next.kind === 'INSPECTION' && canWrite && <Link href={`/admin/faelle/${next.case.caseNumber}/erfassung/?termin=${next.id}`} className="adm-btn adm-btn-secondary" style={{ flex: '1 1 140px' }}><AdminIcon name="photo" />{next.inspection ? 'Besichtigung fortsetzen' : 'Besichtigung starten'}</Link>}
            </div>
          </div>
        )}
      </Section>

      <Section title={`Termine heute · ${t.appointments.length}`} aside={<Link href="/admin/termine" className="adm-link">Kalender</Link>}>
        {t.appointments.length === 0 ? <p className="t-3" style={{ margin: 0 }}>Heute sind keine Termine eingetragen.</p> : (
          <ul className="adm-list">
            {t.appointments.map((a) => (
              <li key={a.id}>
                <span className="main">
                  <Link href={`/admin/faelle/${a.case.caseNumber}/?tab=termine`} className="stretch">{hm(a.startsAt)}–{hm(a.endsAt)} · {who(a.case.customer)}</Link>
                  <span className="secondary">{KIND_LABELS[a.kind]} · {a.case.vehicle.licensePlate ?? a.case.vehicle.model}{place(a as never) ? ` · ${place(a as never)}` : ''}{user.permissions.has('appointments.read.all') ? ` · ${a.expert.firstName} ${a.expert.lastName}` : ''}</span>
                </span>
                <Badge tone={a.status === 'CONFIRMED' ? 'ok' : a.status === 'DONE' ? 'muted' : 'info'}>{APPT_LABELS[a.status]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {canLeads && (
        <Section title={`Neue Anfragen · ${t.newLeads.length}`} aside={<Link href="/admin/anfragen?status=NEW" className="adm-link">Alle</Link>}>
          {t.newLeads.length === 0 ? <p className="t-3" style={{ margin: 0 }}>Keine neuen Anfragen – alles bearbeitet.</p> : (
            <ul className="adm-list">
              {t.newLeads.map((l) => (
                <li key={l.id}>
                  <span className="main">
                    <Link href={`/admin/anfragen/${l.id}/`} className="stretch">{l.name}</Link>
                    <span className="secondary">{l.reason} · {l.vehicleKind}{l.location ? ` · ${l.location}` : ''} · {fmtWhen(l.createdAt)}</span>
                  </span>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative', zIndex: 2 }}>
                    {l.notificationStatus === 'FAILED' && <Badge tone="warn">Mail</Badge>}
                    {phoneHref(l.phone) && <a href={phoneHref(l.phone)} className="adm-btn adm-btn-secondary adm-btn-icon" aria-label={`${l.name} anrufen`}><AdminIcon name="phone" /></a>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {canLeads && (
        <Section title={`Wiedervorlagen · ${t.dueLeads.length}`}>
          {t.dueLeads.length === 0 ? <p className="t-3" style={{ margin: 0 }}>Keine fälligen Wiedervorlagen.</p> : (
            <ul className="adm-list">
              {t.dueLeads.map((l) => (
                <li key={l.id}>
                  <span className="main"><Link href={`/admin/anfragen/${l.id}/`} className="stretch">{l.name}</Link><span className={`secondary ${l.nextActionAt && l.nextActionAt.getTime() < now ? 't-danger' : ''}`}>{l.nextActionAt && l.nextActionAt.getTime() < now ? 'überfällig · ' : ''}{fmtWhen(l.nextActionAt)}</span></span>
                  <StatusPill kind="lead" status={l.status} label={LEAD_LABELS[l.status]} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <Section title={`Fälle in Bearbeitung · ${t.workCases.length}`} aside={<Link href="/admin/faelle?status=open" className="adm-link">Alle offenen</Link>}>
        {t.workCases.length === 0 ? <p className="t-3" style={{ margin: 0 }}>Keine offenen Fälle.</p> : (
          <ul className="adm-list">
            {t.workCases.map((c) => (
              <li key={c.id}>
                <span className="main"><Link href={`/admin/faelle/${c.caseNumber}/`} className="stretch mono">{c.caseNumber}</Link><span className="secondary">{c.customer.company || c.customer.lastName} · {c.vehicle.licensePlate ?? c.vehicle.model}</span></span>
                <StatusPill kind="case" status={c.status} label={CASE_LABELS[c.status]} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
