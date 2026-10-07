import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { todayOverview } from '@/server/pipeline/today';
import { CASE_LABELS, LEAD_LABELS } from '@/lib/workflow';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { Badge, EmptyState, PageHeader, Section, StatusPill, fmtWhen, mapsHref, phoneHref } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Heute' };

const dateLong = () => new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Berlin' }).format(new Date());

export default async function TodayPage() {
  const user = await requirePagePermission('leads.read', 'cases.read.all', 'cases.read.own');
  const t = await todayOverview(user);
  const canLeads = user.permissions.has('leads.read');
  const now = Date.now();
  const [first, ...rest] = t.jobs;
  const who = (c: { company: string | null; firstName: string; lastName: string }) => c.company || `${c.firstName} ${c.lastName}`.trim();

  return (
    <>
      <PageHeader title="Heute" intro={dateLong()} />

      <Section title="Nächster Einsatz">
        {!first ? (
          <EmptyState icon="calendar" title="Kein Einsatz vereinbart">Fälle mit dem Status „Termin vereinbart“ erscheinen hier. Der Kalender mit Uhrzeiten folgt in Phase 3.</EmptyState>
        ) : (
          <div className="adm-panel" style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <p className="t-3" style={{ margin: 0, fontSize: 12 }}><span className="mono">{first.caseNumber}</span> · Termin vereinbart</p>
                <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700, letterSpacing: '-.01em' }}>{who(first.customer)}</p>
                <p className="t-2" style={{ margin: '2px 0 0' }}>{first.vehicle.manufacturer} {first.vehicle.model}{first.vehicle.licensePlate ? <> · <span className="mono">{first.vehicle.licensePlate}</span></> : null}</p>
                {first.inspectionLocation && <p className="t-2" style={{ margin: '2px 0 0', display: 'flex', gap: 6, alignItems: 'center' }}><AdminIcon name="map" className="h-4 w-4" />{first.inspectionLocation}</p>}
              </div>
            </div>
            <div className="adm-actions">
              {first.inspectionLocation && <a href={mapsHref(first.inspectionLocation)} target="_blank" rel="noreferrer" className="adm-btn" style={{ flex: '1 1 140px' }}><AdminIcon name="navigate" />Navigation</a>}
              {phoneHref(first.customer.phone) && <a href={phoneHref(first.customer.phone)} className="adm-btn adm-btn-secondary" style={{ flex: '1 1 120px' }}><AdminIcon name="phone" />Anrufen</a>}
              <Link href={`/admin/faelle/${first.caseNumber}/`} className="adm-btn adm-btn-secondary" style={{ flex: '1 1 120px' }}>Fall öffnen</Link>
            </div>
          </div>
        )}
        {rest.length > 0 && (
          <ul className="adm-list" style={{ marginTop: 8 }}>
            {rest.map((j) => (
              <li key={j.id}>
                <span className="main"><Link href={`/admin/faelle/${j.caseNumber}/`} className="stretch">{who(j.customer)}</Link><span className="secondary">{j.vehicle.manufacturer} {j.vehicle.model}{j.inspectionLocation ? ` · ${j.inspectionLocation}` : ''}</span></span>
                <span className="mono t-3" style={{ fontSize: 12 }}>{j.caseNumber}</span>
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
