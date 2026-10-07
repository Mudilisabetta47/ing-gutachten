import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/server/db';
import { requireUser, can } from '@/server/auth/guards';
import { getSystemStatus } from '@/server/admin/status';
import { dashboardCounts, todayOverview } from '@/server/pipeline/today';
import { CASE_LABELS, LEAD_LABELS } from '@/lib/workflow';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { Badge, EmptyState, Kpi, Kpis, PageHeader, Section, StatusPill, Timeline, fmtWhen, phoneHref, type TimelineItem } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Dashboard' };

const ACTION_LABEL: Record<string, string> = {
  'auth.login': 'hat sich angemeldet', 'auth.logout': 'hat sich abgemeldet', 'auth.login_failed': 'Fehlgeschlagene Anmeldung', 'auth.login_throttled': 'Anmeldung gedrosselt',
  'auth.password_change': 'hat das Passwort geändert', 'user.create': 'hat einen Benutzer angelegt', 'user.update': 'hat einen Benutzer geändert', 'user.role_change': 'hat eine Rolle geändert',
  'user.deactivate': 'hat einen Benutzer deaktiviert', 'user.password_reset': 'hat ein Passwort zurückgesetzt', 'settings.update': 'hat eine Einstellung geändert',
  'lead.create': 'Neue Anfrage über die Website eingegangen', 'lead.status_change': 'hat den Anfragestatus geändert', 'lead.update': 'hat eine Anfrage bearbeitet', 'lead.convert': 'hat eine Anfrage in einen Fall umgewandelt',
  'lead.notification_failed': 'E-Mail-Benachrichtigung fehlgeschlagen', 'lead.assign': 'hat eine Anfrage zugewiesen', 'note.add': 'hat eine Notiz hinzugefügt',
  'customer.create': 'hat einen Kunden angelegt', 'customer.update': 'hat einen Kunden geändert', 'customer.archive': 'hat einen Kunden archiviert', 'customer.restore': 'hat einen Kunden wiederhergestellt',
  'vehicle.create': 'hat ein Fahrzeug angelegt', 'vehicle.update': 'hat ein Fahrzeug geändert', 'vehicle.archive': 'hat ein Fahrzeug archiviert',
  'appointment.create': 'hat einen Termin angelegt', 'appointment.update': 'hat einen Termin geändert', 'appointment.status_change': 'hat einen Termin aktualisiert',
  'photo.add': 'hat ein Foto hinzugefügt', 'photo.update': 'hat ein Foto bearbeitet', 'photo.delete': 'hat ein Foto gelöscht', 'document.add': 'hat ein Dokument hinzugefügt', 'document.delete': 'hat ein Dokument gelöscht',
  'damage.add': 'hat einen Schaden erfasst', 'damage.update': 'hat einen Schaden bearbeitet', 'damage.delete': 'hat einen Schaden gelöscht', 'inspection.start': 'hat eine Besichtigung begonnen', 'inspection.finish': 'hat eine Besichtigung abgeschlossen', 'media.download': 'hat eine Datei abgerufen',
  'case.create': 'hat einen Fall angelegt', 'case.update': 'hat einen Fall geändert', 'case.status_change': 'hat den Fallstatus geändert', 'case.assign': 'hat einen Fall zugewiesen', 'case.archive': 'hat einen Fall archiviert', 'case.restore': 'hat einen Fall wiederhergestellt',
};

const greeting = () => {
  const h = Number(new Intl.DateTimeFormat('de-DE', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Berlin' }).format(new Date()));
  return h < 11 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend';
};
const dateLong = () => new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Berlin' }).format(new Date());

export default async function DashboardPage() {
  const user = await requireUser();
  const seeAll = can(user, 'audit.read');
  const [counts, today, audit] = await Promise.all([
    dashboardCounts(user),
    todayOverview(user),
    db.auditLog.findMany({
      where: seeAll ? {} : { actorId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { actor: { select: { firstName: true, lastName: true } } },
    }),
  ]);
  const activity: TimelineItem[] = audit.map((a) => ({
    id: a.id, at: a.createdAt, actor: a.actor ? `${a.actor.firstName} ${a.actor.lastName}` : null,
    text: ACTION_LABEL[a.action] ?? a.action, kind: a.action.includes('status') ? 'status' : a.action.startsWith('note') ? 'note' : 'system',
  }));
  const status = can(user, 'settings.read') ? getSystemStatus() : null;
  const hasKpi = counts.newLeads !== null || counts.openCases !== null;
  const now = Date.now();

  return (
    <>
      <PageHeader title={`${greeting()}, ${user.firstName}.`} intro={dateLong()} />

      {hasKpi && (
        <Kpis>
          {counts.newLeads !== null && <Kpi label="Neue Anfragen" value={counts.newLeads} href="/admin/anfragen?status=NEW" testId="count-new-leads" note={counts.failedMail ? `${counts.failedMail} ohne Mail-Hinweis` : undefined} warn />}
          {counts.openCases !== null && <Kpi label="Offene Fälle" value={counts.openCases} href="/admin/faelle?status=open" testId="count-open-cases" note={counts.unassigned ? `${counts.unassigned} ohne Gutachter` : undefined} warn />}
          {counts.appointmentsToday !== null && <Kpi label="Termine heute" value={counts.appointmentsToday} href="/admin/termine?ansicht=tag" testId="count-appts-today" />}
          {counts.reportsOpen !== null && <Kpi label="Gutachten offen" value={counts.reportsOpen} href="/admin/faelle?status=IN_PROGRESS" />}
          {counts.followUpsDue !== null && <Kpi label="Wiedervorlagen fällig" value={counts.followUpsDue} href="/admin/heute" />}
          {counts.customers !== null && <Kpi label="Kunden" value={counts.customers} href="/admin/kunden" />}
        </Kpis>
      )}

      <div className="adm-work" style={{ marginTop: 28 }}>
        <div style={{ minWidth: 0 }}>
          {counts.newLeads !== null && (
            <Section title="Neue Anfragen" aside={<Link href="/admin/anfragen?status=NEW" className="adm-link">Alle anzeigen</Link>}>
              {today.newLeads.length === 0 ? <p className="t-3" style={{ margin: 0 }}>Keine neuen Anfragen – alles bearbeitet.</p> : (
                <ul className="adm-list">
                  {today.newLeads.slice(0, 6).map((l) => (
                    <li key={l.id}>
                      <span className="main">
                        <Link href={`/admin/anfragen/${l.id}/`} className="stretch">{l.name}</Link>
                        <span className="secondary">{l.reason} · {l.vehicleKind}{l.location ? ` · ${l.location}` : ''} · {fmtWhen(l.createdAt)}</span>
                      </span>
                      <span style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative', zIndex: 2 }}>
                        {l.notificationStatus === 'FAILED' && <Badge tone="warn">Mail fehlgeschlagen</Badge>}
                        {phoneHref(l.phone) && <a href={phoneHref(l.phone)} className="adm-btn adm-btn-secondary adm-btn-sm adm-btn-icon" aria-label={`${l.name} anrufen`}><AdminIcon name="phone" /></a>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          {counts.openCases !== null && (
            <Section title={user.permissions.has('cases.read.all') ? 'Offene Fälle' : 'Meine offenen Fälle'} aside={<Link href="/admin/faelle?status=open" className="adm-link">Alle anzeigen</Link>}>
              {today.workCases.length === 0 ? <p className="t-3" style={{ margin: 0 }}>Keine offenen Fälle.</p> : (
                <div className="dt-wrap">
                  <table className="dt">
                    <thead><tr><th>Fall</th><th>Kunde</th><th>Kennzeichen</th><th>Status</th></tr></thead>
                    <tbody>
                      {today.workCases.map((c) => (
                        <tr key={c.id}>
                          <td data-slot="title"><Link href={`/admin/faelle/${c.caseNumber}/`} className="primary stretch mono">{c.caseNumber}</Link></td>
                          <td data-slot="sub">{c.customer.company || c.customer.lastName}</td>
                          <td data-slot="meta">{c.vehicle.licensePlate ? <span className="mono">{c.vehicle.licensePlate}</span> : c.vehicle.model}</td>
                          <td data-slot="badge"><StatusPill kind="case" status={c.status} label={CASE_LABELS[c.status]} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          )}
        </div>

        <aside aria-label="Heute und Aktivität">
          <div className="adm-aside-block">
            <h3>Heute</h3>
            {today.appointments.length === 0 ? <p className="t-3" style={{ margin: 0 }}>Heute sind keine Termine eingetragen.</p> : (
              <ul className="adm-list">
                {today.appointments.slice(0, 5).map((a) => (
                  <li key={a.id}><span className="main"><Link href={`/admin/faelle/${a.case.caseNumber}/?tab=termine`} className="stretch">{new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(a.startsAt)} · {a.case.customer.company || a.case.customer.lastName}</Link><span className="secondary">{a.case.vehicle.licensePlate ?? a.case.vehicle.model}</span></span></li>
                ))}
              </ul>
            )}
            <Link href="/admin/heute" className="adm-btn adm-btn-secondary adm-btn-sm" style={{ marginTop: 10 }}>Heute öffnen</Link>
          </div>
          {counts.followUpsDue !== null && (
            <div className="adm-aside-block">
              <h3>Wiedervorlagen</h3>
              {today.dueLeads.length === 0 ? <p className="t-3" style={{ margin: 0 }}>Keine fälligen Wiedervorlagen.</p> : (
                <ul className="adm-list">
                  {today.dueLeads.slice(0, 5).map((l) => (
                    <li key={l.id}>
                      <span className="main"><Link href={`/admin/anfragen/${l.id}/`} className="stretch">{l.name}</Link><span className={`secondary ${l.nextActionAt && l.nextActionAt.getTime() < now ? 't-danger' : ''}`}>{l.nextActionAt && l.nextActionAt.getTime() < now ? 'überfällig · ' : ''}{fmtWhen(l.nextActionAt)}</span></span>
                      <StatusPill kind="lead" status={l.status} label={LEAD_LABELS[l.status]} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="adm-aside-block">
            <h3>Aktivität</h3>
            {activity.length === 0 ? <p className="t-3" style={{ margin: 0 }}>Noch keine Einträge.</p> : <Timeline items={activity} />}
            {(can(user, 'audit.read') || can(user, 'audit.read.own')) && <Link href="/admin/protokoll" className="adm-link" style={{ display: 'inline-block', marginTop: 8 }}>Gesamtes Protokoll</Link>}
          </div>
          {status && (
            <div className="adm-aside-block">
              <h3>Betrieb</h3>
              <ul className="adm-list">
                <li><span>E-Mail-Versand</span><Badge tone={status.mail.ok ? 'ok' : 'muted'}>{status.mail.ok ? 'Aktiv' : 'Nicht konfiguriert'}</Badge></li>
                <li><span>Dateispeicher</span><Badge tone={status.storage.ok ? 'ok' : 'muted'}>{status.storage.ok ? 'Aktiv' : 'Folgt (Phase 3)'}</Badge></li>
              </ul>
            </div>
          )}
        </aside>
      </div>
      {!hasKpi && <EmptyState icon="home" title="Willkommen im Operating System">Für Ihre Rolle gibt es noch keine Arbeitsbereiche auf dieser Übersicht. Nutzen Sie die Navigation links.</EmptyState>}
    </>
  );
}
