import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { analytics } from '@/server/pipeline/analytics';
import { CASE_LABELS } from '@/lib/workflow';
import { STATUS_LABELS as REPORT_LABELS } from '@/lib/report';
import { fmtEuro } from '@/lib/money';
import { EmptyState, Kpi, Kpis, PageHeader, Section } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Auswertungen' };
const monthLabel = (k: string) => new Intl.DateTimeFormat('de-DE', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(`${k}-15T00:00:00Z`));
const num = (n: number | null, unit = '') => (n == null ? '–' : `${n.toLocaleString('de-DE')}${unit}`);

function Bars({ rows, fmt, label }: { rows: { key: string; label: string; value: number }[]; fmt: (n: number) => string; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className="an-bars" aria-label={label}>
      {rows.map((r) => (
        <li key={r.key}>
          <span className="l">{r.label}</span>
          <span className="b" aria-hidden="true"><i style={{ width: `${(r.value / max) * 100}%` }} /></span>
          <span className="v">{fmt(r.value)}</span>
        </li>
      ))}
    </ol>
  );
}

export default async function AnalyticsPage() {
  const user = await requirePagePermission('kpi.all', 'kpi.own', 'kpi.revenue');
  const a = await analytics(user);
  const total = a.cases?.byStatus.reduce((n, s) => n + s.count, 0) ?? 0;
  return (
    <>
      <PageHeader title="Auswertungen" intro={`${a.scopeLabel} · nur echte Daten aus dem System, nichts geschätzt. Zeitraum: letzte 12 Monate.`} />
      <Kpis>
        {a.cases && <Kpi label="Fälle gesamt" value={total} />}
        {a.cases && <Kpi label="Ø Dauer bis Abschluss" value={num(a.cases.avgDaysToClose, ' Tage')} note={`${a.cases.closedCount} abgeschlossen`} />}
        {a.reports && <Kpi label="Ø Dauer bis Freigabe" value={num(a.reports.avgDaysToApproval, ' Tage')} />}
        {a.money && <Kpi label="Offene Forderungen" value={fmtEuro(a.money.openCents)} href="/admin/rechnungen/" />}
        {a.money && <Kpi label="Davon überfällig" value={fmtEuro(a.money.overdueCents)} warn={a.money.overdueCents > 0} href="/admin/mahnwesen/" />}
        {a.money && <Kpi label="Ø Rechnung (netto)" value={a.money.averageNetCents == null ? '–' : fmtEuro(a.money.averageNetCents)} note={`${a.money.issuedCount} ausgestellt`} />}
      </Kpis>
      <div className="adm-grid-2" style={{ alignItems: 'start', marginTop: 24 }}>
        {a.cases && (
          <Section title="Fälle nach Status">
            {total === 0 ? <p className="t-3" style={{ margin: 0 }}>Noch keine Fälle.</p> : <Bars label="Fälle nach Status" fmt={String} rows={a.cases.byStatus.sort((x, y) => y.count - x.count).map((s) => ({ key: s.status, label: CASE_LABELS[s.status as keyof typeof CASE_LABELS] ?? s.status, value: s.count }))} />}
          </Section>
        )}
        {a.cases && (
          <Section title="Neue Fälle je Monat">
            <Bars label="Neue Fälle je Monat" fmt={String} rows={a.cases.created.map((m) => ({ key: m.month, label: monthLabel(m.month), value: m.count }))} />
          </Section>
        )}
        {a.money && (
          <Section title="Umsatz je Monat (netto, ausgestellte Rechnungen)">
            <Bars label="Umsatz je Monat" fmt={fmtEuro} rows={a.money.net.map((m) => ({ key: m.month, label: monthLabel(m.month), value: m.cents }))} />
          </Section>
        )}
        {a.money && (
          <Section title="Zahlungseingang je Monat">
            <Bars label="Zahlungseingang je Monat" fmt={fmtEuro} rows={a.money.paid.map((m) => ({ key: m.month, label: monthLabel(m.month), value: m.cents }))} />
          </Section>
        )}
        {a.reports && a.reports.byStatus.length > 0 && (
          <Section title="Gutachten nach Status">
            <Bars label="Gutachten nach Status" fmt={String} rows={a.reports.byStatus.map((s) => ({ key: s.status, label: REPORT_LABELS[s.status] ?? s.status, value: s.count }))} />
          </Section>
        )}
        {a.cases && a.cases.byExpert.length > 0 && (
          <Section title="Auslastung je Sachverständigem">
            <div className="dt-wrap"><table className="dt">
              <thead><tr><th>Sachverständiger</th><th className="num">Offen</th><th className="num">Abgeschlossen</th></tr></thead>
              <tbody>{a.cases.byExpert.map((e) => <tr key={e.name}><td data-slot="title">{e.name}</td><td data-slot="meta" className="num">{e.open}</td><td data-slot="hide" className="num">{e.closed}</td></tr>)}</tbody>
            </table></div>
          </Section>
        )}
      </div>
      {!a.cases && !a.money && <EmptyState icon="chart" title="Keine Auswertungen">Für Ihre Rolle liegen keine Kennzahlen vor.</EmptyState>}
      <p className="vi-hint" style={{ marginTop: 16 }}>Provisionen werden nicht ausgewertet: Dafür fehlt bewusst jede Grundlage, solange die rechtliche Prüfung nicht abgeschlossen ist. <Link href="/admin/rechnungen/">Zu den Rechnungen</Link></p>
    </>
  );
}
