import type { Metadata } from 'next';
import { requirePagePermission } from '@/server/auth/guards';
import { PERMISSIONS, ROLE_LABELS, ROLE_PERMISSIONS, type Permission } from '@/server/auth/permissions';
import { Alert, PageHeader, Section } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Rollen & Rechte' };

const GROUPS: [string, string, (p: Permission) => boolean][] = [
  ['Anfragen & Kunden', 'Anfragen, Kunden, Fahrzeuge', (p) => /^(leads|customers|vehicles)\./.test(p)],
  ['Fälle', 'Fälle anlegen, zuweisen, Status', (p) => p.startsWith('cases.')],
  ['Termine, Fotos, Dokumente', 'Besichtigung und Akte', (p) => /^(appointments|photos|documents)\./.test(p)],
  ['Kalkulation & Bewertung', 'Kalkulation, Bewertung, Fahrzeugdaten', (p) => /^(calculations|valuations|vehicledata)\./.test(p)],
  ['Gutachten', 'Schreiben, Prüfen, Freigeben, Versand', (p) => /^reports\./.test(p) || p === 'templates.write'],
  ['Finanzen', 'Rechnungen, Zahlungen, Mahnwesen', (p) => /^(invoices|payments|dunning)\./.test(p)],
  ['Aufgaben & Kommunikation', 'Aufgaben, Notizen, Anrufe', (p) => /^(tasks|communication)\./.test(p)],
  ['Auswertungen', 'Kennzahlen', (p) => p.startsWith('kpi.')],
  ['Stammdaten & System', 'Stammdaten, Benutzer, Einstellungen, Export', (p) => /^(masterdata|locations|users|settings|integrations|audit|data|search)\./.test(p)],
  ['Website', 'Inhalte und SEO (Phase 5)', (p) => /^(cms|seo|redirects|media)\./.test(p)],
];
const ROLES = Object.keys(ROLE_PERMISSIONS) as (keyof typeof ROLE_PERMISSIONS)[];

export default async function RolesPage() {
  await requirePagePermission('users.read');
  const perms = [...PERMISSIONS] as Permission[];
  return (
    <>
      <PageHeader title="Rollen & Rechte" intro="Welche Rolle was darf. Die Rechte werden bei jeder Anfrage serverseitig geprüft – ausgeblendete Menüs allein schützen nichts. „eigene“ heißt: nur Fälle, die der Person zugewiesen sind." />
      <Alert tone="info" icon="lock">Einzelne Abweichungen vergeben Sie pro Benutzer unter „Benutzer“. Diese Übersicht zeigt die Standardrechte der Rollen und ist nicht bearbeitbar.</Alert>
      <Section title="Überblick je Bereich">
        <div className="dt-wrap"><table className="dt perm-matrix">
          <thead><tr><th>Bereich</th>{ROLES.map((r) => <th key={r}>{ROLE_LABELS[r]}</th>)}</tr></thead>
          <tbody>{GROUPS.map(([name, , test]) => {
            const ps = perms.filter(test);
            return (
              <tr key={name}>
                <td data-slot="title"><b>{name}</b></td>
                {ROLES.map((r) => {
                  const have = ps.filter((p) => ROLE_PERMISSIONS[r].includes(p)).length;
                  return <td key={r} data-slot="hide" title={`${have} von ${ps.length} Rechten`}>{have === 0 ? <span className="t-3">–</span> : have === ps.length ? <b>voll</b> : `${have}/${ps.length}`}</td>;
                })}
              </tr>
            );
          })}</tbody>
        </table></div>
      </Section>
      <Section title="Alle Einzelrechte">
        <div className="dt-wrap" style={{ overflowX: 'auto' }}><table className="dt perm-matrix">
          <thead><tr><th>Recht</th>{ROLES.map((r) => <th key={r}>{ROLE_LABELS[r]}</th>)}</tr></thead>
          <tbody>{perms.map((p) => (
            <tr key={p}><td data-slot="title" className="mono" style={{ fontSize: 12 }}>{p}</td>{ROLES.map((r) => <td key={r} data-slot="hide">{ROLE_PERMISSIONS[r].includes(p) ? <span aria-label="erlaubt">✓</span> : <span className="t-3" aria-label="nicht erlaubt">–</span>}</td>)}</tr>
          ))}</tbody>
        </table></div>
      </Section>
    </>
  );
}
