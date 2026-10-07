import type { Metadata } from 'next';
import { requirePagePermission } from '@/server/auth/guards';
import { listLocations } from '@/server/pipeline/masterdata';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { DrawerHost, Menu, OpenDrawer } from '@/components/admin/Overlay';
import { LocationForm } from '@/components/admin/LocationForm';
import { ConfirmForm } from '@/components/admin/forms';
import { Badge, EmptyState, PageHeader } from '@/components/admin/ui';
import { archiveLocationAction, saveLocationAction } from './actions';

export const metadata: Metadata = { title: 'Standorte' };

export default async function LocationsPage() {
  const user = await requirePagePermission('masterdata.write', 'locations.write', 'users.read');
  const rows = await listLocations(user);
  const canWrite = user.permissions.has('locations.write');
  const drawers = canWrite
    ? [
        { id: 'new', title: 'Standort anlegen', content: <LocationForm action={saveLocationAction} submitLabel="Standort anlegen" /> },
        ...rows.map((l) => ({
          id: `edit-${l.id}`, title: 'Standort bearbeiten',
          content: <LocationForm action={saveLocationAction} id={l.id} submitLabel="Speichern" initial={{ name: l.name, street: l.street, postalCode: l.postalCode, city: l.city, phone: l.phone, email: l.email, openingHours: l.openingHours, isDefault: l.isDefault }} />,
        })),
      ]
    : [];
  return (
    <DrawerHost drawers={drawers}>
      <PageHeader title="Standorte" intro="Niederlassungen. Mitarbeiter und Fälle werden einem Standort zugeordnet; neue Fälle bekommen automatisch den Standort ihres Sachverständigen bzw. den Hauptstandort." actions={canWrite ? <OpenDrawer id="new" icon="plus" className="adm-btn">Standort</OpenDrawer> : undefined} />
      {rows.length === 0 ? (
        <EmptyState icon="map" title="Noch kein Standort" action={canWrite ? <OpenDrawer id="new" className="adm-btn">Standort anlegen</OpenDrawer> : undefined}>Legen Sie mindestens einen Standort an.</EmptyState>
      ) : (
        <div className="dt-wrap">
          <table className="dt">
            <thead><tr><th>Standort</th><th>Anschrift</th><th>Kontakt</th><th>Öffnungszeiten</th><th className="num">Mitarbeiter</th><th className="num">Fälle</th><th aria-label="Aktionen" /></tr></thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td data-slot="title"><span className="primary">{l.name}</span>{l.isDefault && <Badge tone="info">Hauptstandort</Badge>}</td>
                  <td data-slot="sub">{[l.street, [l.postalCode, l.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || <span className="t-3">–</span>}</td>
                  <td data-slot="meta">{[l.phone, l.email].filter(Boolean).join(' · ') || '–'}</td>
                  <td data-slot="hide">{l.openingHours ?? <span className="t-3">–</span>}</td>
                  <td data-slot="hide" className="num">{l._count.users}</td>
                  <td data-slot="hide" className="num">{l._count.cases}</td>
                  <td data-slot="hide" className="menu-cell">
                    {canWrite && <Menu label={`Aktionen für ${l.name}`} triggerClassName="adm-btn adm-btn-quiet adm-btn-icon adm-btn-sm" trigger={<AdminIcon name="more" />} entries={[{ kind: 'drawer', label: 'Bearbeiten', drawer: `edit-${l.id}`, icon: 'edit' }]} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canWrite && rows.some((l) => !l.isDefault) && (
        <section className="adm-section" style={{ marginTop: 24 }}>
          <div className="adm-section-h"><h2>Standort archivieren</h2></div>
          <div className="adm-actions">
            {rows.filter((l) => !l.isDefault).map((l) => <ConfirmForm key={l.id} action={archiveLocationAction} id={l.id} label={`${l.name} archivieren`} title="Standort archivieren?" confirm="Nur möglich, wenn dem Standort keine aktiven Mitarbeiter und keine offenen Fälle zugeordnet sind." danger />)}
          </div>
        </section>
      )}
    </DrawerHost>
  );
}
