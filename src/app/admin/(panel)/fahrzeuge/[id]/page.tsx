import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { orNotFound } from '@/server/admin/safe';
import { getVehicle, vehicleCases } from '@/server/pipeline/vehicles';
import { vehicleProvenance } from '@/server/vehicledata/apply';
import { withOpenConflicts } from '@/server/vehicledata/catalog';
import { CASE_LABELS } from '@/lib/workflow';
import { APPROVAL_LABELS, approvalStatus, FUEL_LABELS, fmtCc, fmtPower, sourceLabel, PRIORITY_LABELS, type ApprovalKey, type CheckRow, type FuelKey } from '@/lib/vehicle-data';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { DrawerHost, Menu, OpenDrawer } from '@/components/admin/Overlay';
import { AsideBlock, DetailHeader, EmptyState, Rows, Section, StatusPill, SummaryBar, Tabs, fmtDate, fmtWhen, qp } from '@/components/admin/ui';
import { ConfirmForm, VehicleForm } from '@/components/admin/forms';
import { ConfirmFieldButton, RegistrationForm, VinForm } from '@/components/admin/VehicleDataPanels';
import { StatusBadge } from '@/components/admin/VehicleIdentify';
import { archiveVehicleAction, updateVehicleAction } from '../actions';

export const metadata: Metadata = { title: 'Fahrzeugakte' };

const TABS: [string, string][] = [
  ['uebersicht', 'Übersicht'], ['technik', 'Technische Daten'], ['zulassung', 'Zulassung'], ['hsn', 'HSN/TSN'], ['fin', 'FIN'], ['ausstattung', 'Ausstattung'],
  ['schaeden', 'Schäden'], ['kalkulation', 'Kalkulation'], ['bewertung', 'Bewertung'], ['fotos', 'Fotos'], ['dokumente', 'Dokumente'], ['historie', 'Historie'],
];
const NA = <span className="t-3">Nicht verfügbar</span>;
const ST_BADGE: Record<string, string> = { conform: 'ok', deviation: 'warn', individual: 'info', unknown: 'muted' };

export default async function VehicleDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission('vehicles.read');
  const { id } = await params;
  const tabQ = qp((await searchParams).tab) ?? 'uebersicht';
  const tab = TABS.some(([k]) => k === tabQ) ? tabQ : 'uebersicht';
  const v = await orNotFound(getVehicle(user, id));
  const cases = await vehicleCases(user, id);
  const canWrite = user.permissions.has('vehicles.write');
  const canData = user.permissions.has('vehicledata.read');
  const canSeeCustomer = user.permissions.has('customers.read') || user.permissions.has('customers.read.own');
  const owner = v.customer.company || `${v.customer.firstName} ${v.customer.lastName}`;
  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');
  const base = `/admin/fahrzeuge/${id}`;
  const prov = canData && (tab === 'hsn' || tab === 'historie') ? await vehicleProvenance(user, id) : null;
  const record = v.hsnTsnRecord && canData && tab === 'hsn' ? (await withOpenConflicts([v.hsnTsnRecord]))[0] : null;
  const check = (v.registrationCheck ?? null) as { at: string; rows: CheckRow[]; note: string | null; recordId: string | null } | null;
  const approval = approvalStatus((v.approvalKind ?? null) as ApprovalKey | null, check?.rows);
  const power = fmtPower(v.powerKw, v.powerHp);

  const initial = {
    manufacturer: v.manufacturer, model: v.model, variant: v.variant, licensePlate: v.licensePlate, vin: v.vin, firstRegistration: iso(v.firstRegistration), mileage: v.mileage?.toString(), fuelType: v.fuelType, color: v.color,
    hsn: v.hsn, tsn: v.tsn, hsnTsnId: v.hsnTsnId, engineName: v.engineName, engineCode: v.engineCode, bodyStyle: v.bodyStyle, driveType: v.driveType, transmission: v.transmission, vehicleClass: v.vehicleClass,
    powerKw: v.powerKw?.toString(), powerHp: v.powerHp?.toString(), displacementCc: v.displacementCc?.toString(), seats: v.seats?.toString(),
  };
  const drawers = canWrite ? [{ id: 'edit', title: 'Fahrzeugdaten bearbeiten', content: <VehicleForm action={updateVehicleAction} hidden={{ id }} submitLabel="Speichern" initial={initial} canIdentify={canData && user.permissions.has('vehicledata.write')} /> }] : [];

  const caseLinks = (sub: string, label: string) => cases.length === 0 ? <EmptyState icon="case" title="Noch keine Fälle">Zu diesem Fahrzeug gibt es noch keinen Fall.</EmptyState> : (
    <ul className="adm-list">{cases.map((k) => (
      <li key={k.id}><span className="main"><Link href={`/admin/faelle/${k.caseNumber}/?tab=${sub}`} className="stretch mono">{k.caseNumber}</Link><span className="secondary">{label} · {fmtWhen(k.createdAt)}</span></span><StatusPill kind="case" status={k.status} label={CASE_LABELS[k.status]} /></li>
    ))}</ul>
  );

  return (
    <DrawerHost drawers={drawers}>
      <DetailHeader
        crumbs={[{ label: 'Fahrzeuge', href: '/admin/fahrzeuge' }, { label: v.licensePlate ?? `${v.manufacturer} ${v.model}` }]}
        lead={<span className="adm-avatar adm-avatar-lg" style={{ borderRadius: 12 }}><AdminIcon name="car" className="h-5 w-5" /></span>}
        title={<span><span className="t-3" style={{ display: 'block', fontSize: 13, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase' }}>{v.manufacturer}</span>{v.model}{v.variant ? ` ${v.variant}` : ''}</span>}
        meta={[v.licensePlate ? <span key="p" className="mono" style={{ fontWeight: 600, color: 'rgb(var(--a-text))' }}>{v.licensePlate}</span> : 'Ohne Kennzeichen', [v.engineName, power, v.fuelType ? FUEL_LABELS[v.fuelType as FuelKey] : null].filter(Boolean).join(' · ') || 'Technische Daten nicht erfasst', canSeeCustomer ? <Link key="o" href={`/admin/kunden/${v.customer.id}/`} className="adm-link">{owner}</Link> : owner]}
        actions={<>
          {canData && <Link href={`/admin/fahrzeuge/identifizieren/?fahrzeug=${id}`} className="adm-btn adm-btn-secondary"><AdminIcon name="search" />Identifizieren</Link>}
          {canWrite && <OpenDrawer id="edit" icon="edit" className="adm-btn adm-btn-secondary">Bearbeiten</OpenDrawer>}
          {user.permissions.has('vehicles.delete') && <Menu label="Weitere Aktionen" triggerClassName="adm-btn adm-btn-secondary adm-btn-icon" trigger={<AdminIcon name="more" />} entries={[{ kind: 'link', label: 'Zur Fahrzeugliste', href: '/admin/fahrzeuge', icon: 'car' }]} />}
        </>}
      />
      <SummaryBar items={[
        ['HSN / TSN', v.hsn && v.tsn ? <span className="mono" style={{ fontSize: 13 }}>{v.hsn} / {v.tsn}</span> : null],
        ['FIN', v.vin ? <span className="mono" style={{ fontSize: 12.5 }}>{v.vin}</span> : null],
        ['Erstzulassung', fmtDate(v.firstRegistration)],
        ['Kilometerstand', v.mileage ? `${v.mileage.toLocaleString('de-DE')} km` : null],
        ['Leistung', power],
      ]} />
      <Tabs label="Fahrzeugakte" active={tab} items={TABS.map(([k, l]) => ({ key: k, label: l, href: k === 'uebersicht' ? base : `${base}?tab=${k}`, count: k === 'schaeden' || k === 'kalkulation' || k === 'bewertung' ? undefined : undefined }))} />

      {tab === 'uebersicht' && (
        <div className="adm-work">
          <div style={{ minWidth: 0 }}>
            <Section title="Verknüpfte Fälle">
              {cases.length === 0 ? <EmptyState icon="case" title="Noch keine Fälle">Zu diesem Fahrzeug gibt es noch keinen Fall.</EmptyState> : (
                <ul className="adm-list">{cases.map((k) => (
                  <li key={k.id}><span className="main"><Link href={`/admin/faelle/${k.caseNumber}/`} className="stretch mono">{k.caseNumber}</Link><span className="secondary">{fmtWhen(k.createdAt)}</span></span><StatusPill kind="case" status={k.status} label={CASE_LABELS[k.status]} /></li>
                ))}</ul>
              )}
            </Section>
            <Section title="Fahrzeugdaten">
              <Rows items={[
                ['Kennzeichen', v.licensePlate ? <span className="mono">{v.licensePlate}</span> : null], ['Hersteller', v.manufacturer], ['Modell', `${v.model}${v.variant ? ` ${v.variant}` : ''}`],
                ['Motor', v.engineName], ['Leistung', power], ['Hubraum', fmtCc(v.displacementCc)], ['Kraftstoff', v.fuelType ? FUEL_LABELS[v.fuelType as FuelKey] : null],
                ['FIN', v.vin ? <span className="mono">{v.vin}</span> : null], ['Angelegt', fmtWhen(v.createdAt)],
              ]} />
            </Section>
          </div>
          <aside>
            <AsideBlock title="Eigentümer"><p style={{ margin: 0, fontWeight: 600 }}>{canSeeCustomer ? <Link href={`/admin/kunden/${v.customer.id}/`} className="adm-link">{owner}</Link> : owner}</p></AsideBlock>
            {canData && (
              <AsideBlock title="Identifikation">
                {v.hsnTsnRecord
                  ? <div style={{ display: 'grid', gap: 6 }}><StatusBadge status={v.hsnTsnRecord.verificationStatus} /><span className="t-2" style={{ fontSize: 13 }}>Datensatz {v.hsnTsnRecord.hsn}/{v.hsnTsnRecord.tsn} · {sourceLabel(v.hsnTsnRecord.source)}</span><Link href={`${base}?tab=hsn`} className="adm-link">Datenherkunft ansehen</Link></div>
                  : <div style={{ display: 'grid', gap: 8 }}><span className="t-2" style={{ fontSize: 13 }}>Noch nicht über HSN/TSN identifiziert.</span><Link href={`/admin/fahrzeuge/identifizieren/?fahrzeug=${id}`} className="adm-btn adm-btn-secondary">Jetzt identifizieren</Link></div>}
              </AsideBlock>
            )}
            {user.permissions.has('vehicles.delete') && (
              <AsideBlock title="Verwaltung"><ConfirmForm action={archiveVehicleAction} id={id} label="Fahrzeug archivieren" title="Fahrzeug archivieren?" confirm="Nur möglich, wenn kein Fall mehr offen ist. Die Daten bleiben erhalten." danger /></AsideBlock>
            )}
          </aside>
        </div>
      )}

      {tab === 'technik' && (
        <Section title="Technische Daten">
          <Rows items={[
            ['Hersteller', v.manufacturer], ['Modell', v.model], ['Variante', v.variant], ['Karosserie', v.bodyStyle], ['Motor', v.engineName], ['Motorkennbuchstabe', v.engineCode],
            ['Leistung', power], ['Hubraum', fmtCc(v.displacementCc)], ['Kraftstoff', v.fuelType ? FUEL_LABELS[v.fuelType as FuelKey] : null], ['Antrieb', v.driveType], ['Getriebe', v.transmission],
            ['Sitzplätze', v.seats?.toString() ?? null], ['Fahrzeugklasse', v.vehicleClass], ['Farbe', v.color],
          ].map(([l, val]) => [l as string, (val ?? NA) as React.ReactNode])} />
          <p className="t-3" style={{ fontSize: 12.5, margin: '10px 0 0' }}>Fehlende Angaben werden nie geschätzt. Herkunft jeder Angabe: Reiter „HSN/TSN“.</p>
        </Section>
      )}

      {tab === 'zulassung' && (
        <>
          <Section title="Zulassung / Typgenehmigung">
            <Rows items={[
              ['EG-Typgenehmigung / ABE', v.approvalKind ? APPROVAL_LABELS[v.approvalKind as ApprovalKey] : NA], ['Genehmigungsnummer', v.approvalNumber ?? NA],
              ['Typ (D.2)', v.typeCode ?? NA], ['Variante (D.2)', v.variantCode ?? NA], ['Version (D.2)', v.versionCode ?? NA], ['Fahrzeugklasse (J)', v.vehicleClass ?? NA],
              ['Status', <span key="s" className={`adm-badge adm-badge-${ST_BADGE[approval.state]}`}>{approval.state === 'conform' ? '✓ Daten konform' : approval.state === 'deviation' ? '⚠ Abweichung' : approval.state === 'individual' ? 'Einzelgenehmigung prüfen' : 'Nicht beurteilbar'}</span>],
            ]} />
            <div className={`adm-alert ${approval.state === 'deviation' ? 'adm-alert-warn' : ''}`} style={{ marginTop: 12 }}><AdminIcon name={approval.state === 'deviation' ? 'alert' : 'info'} />{approval.text}</div>
            {check && (
              <div style={{ marginTop: 14 }}>
                <b style={{ fontSize: 13 }}>Abgleich Fahrzeugschein ↔ Datenbank</b> <span className="t-3" style={{ fontSize: 12 }}>vom {fmtWhen(new Date(check.at))}</span>
                <table className="vi-prov" style={{ marginTop: 6 }}><thead><tr><th>Feld</th><th>Fahrzeugschein</th><th>Datenbank</th><th /></tr></thead><tbody>
                  {check.rows.map((r) => <tr key={r.field}><td>{r.label}</td><td>{r.registration ?? NA}</td><td>{r.database ?? NA}</td><td>{r.state === 'ok' ? <span className="adm-badge adm-badge-ok">✓ konform</span> : r.state === 'deviation' ? <span className="adm-badge adm-badge-warn">⚠ Abweichung – bitte prüfen</span> : <span className="adm-badge adm-badge-muted">offen</span>}</td></tr>)}
                </tbody></table>
                {check.note && <p className="t-3" style={{ fontSize: 12.5 }}>{check.note}</p>}
              </div>
            )}
          </Section>
          {canWrite && user.permissions.has('vehicledata.write') && (
            <Section title="Fahrzeugschein erfassen">
              <RegistrationForm vehicleId={id} initial={{ hsn: v.hsn ?? '', tsn: v.tsn ?? '', manufacturer: v.manufacturer, typeCode: v.typeCode ?? '', variantCode: v.variantCode ?? '', versionCode: v.versionCode ?? '', vin: v.vin ?? '', vehicleClass: v.vehicleClass ?? '', firstRegistration: iso(v.firstRegistration), displacementCc: v.displacementCc?.toString() ?? '', powerKw: v.powerKw?.toString() ?? '', fuel: v.fuelType ? FUEL_LABELS[v.fuelType as FuelKey] : '', seats: v.seats?.toString() ?? '', approvalKind: v.approvalKind ?? '', approvalNumber: v.approvalNumber ?? '' }} />
            </Section>
          )}
        </>
      )}

      {tab === 'hsn' && (
        canData ? (
          <>
            <Section title="HSN/TSN und Datensatz">
              {record ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  <Rows items={[['HSN / TSN', <span key="c" className="mono">{record.hsn} / {record.tsn}</span>], ['Datensatz', `${record.manufacturer ?? ''} ${record.model ?? record.vehicleNameRaw ?? ''}`], ['Datenquelle', sourceLabel(record.source)], ['Status', <StatusBadge key="b" status={record.verificationStatus} />], ['Zuletzt geprüft', record.lastCheckedAt ? fmtWhen(new Date(record.lastCheckedAt)) : NA]]} />
                  {record.openConflicts?.map((c) => <div key={c.id} className="adm-alert adm-alert-warn"><AdminIcon name="alert" /><div><b>Datenkonflikt:</b> {c.fields.join(', ')} – bitte Fahrzeugdaten überprüfen.{user.permissions.has('vehicledata.manage') && <> <Link href="/admin/fahrzeugdaten/konflikte" className="adm-link">Konflikte ansehen</Link></>}</div></div>)}
                </div>
              ) : <EmptyState icon="search" title="Noch nicht identifiziert" action={<Link href={`/admin/fahrzeuge/identifizieren/?fahrzeug=${id}`} className="adm-btn">Per HSN/TSN identifizieren</Link>}>Es ist noch kein HSN/TSN-Datensatz mit diesem Fahrzeug verknüpft. Eigene Eingaben bleiben unberührt.</EmptyState>}
            </Section>
            <Section title="Datenherkunft">
              {!prov || prov.points.length === 0 ? <p className="t-3" style={{ margin: 0 }}>Noch keine nachvollziehbaren Quellen erfasst.</p> : (
                <div className="dt-wrap"><table className="vi-prov"><thead><tr><th>Feld</th><th>Wert</th><th>Quelle</th><th>Priorität</th><th>Status</th><th>Abruf</th>{canWrite && <th />}</tr></thead><tbody>
                  {prov.points.map((p) => (
                    <tr key={p.id}><td>{p.field}</td><td>{p.value ?? NA}</td><td>{sourceLabel(p.source)}{p.sourceUrl ? <> · <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="adm-link">Quelle</a></> : null}</td><td className="t-2">{p.priority} · {PRIORITY_LABELS[p.priority] ?? ''}</td><td><StatusBadge status={p.status} /></td><td className="nowrap t-2">{fmtWhen(p.retrievedAt)}</td>{canWrite && <td>{p.priority < 100 ? <ConfirmFieldButton vehicleId={id} field={p.field} /> : null}</td>}</tr>
                  ))}
                </tbody></table></div>
              )}
            </Section>
          </>
        ) : <EmptyState icon="shield" title="Kein Zugriff">Für die Fahrzeugdaten fehlt die Berechtigung.</EmptyState>
      )}

      {tab === 'fin' && (
        <Section title="Fahrgestellnummer (FIN)">
          {canWrite ? <VinForm vehicleId={id} current={v.vin} /> : <Rows items={[['FIN', v.vin ? <span className="mono">{v.vin}</span> : NA]]} />}
          <div className="adm-alert" style={{ marginTop: 14 }}><AdminIcon name="info" />Ein FIN-Decoder (Hersteller, Modelljahr, Ausstattung) ist noch nicht angebunden. Die FIN wird formal geprüft und gespeichert; Daten daraus werden nicht erfunden.</div>
        </Section>
      )}

      {tab === 'ausstattung' && (
        <Section title="Ausstattung">
          <EmptyState icon="info" title="Keine Ausstattungsdaten">Ausstattungs- und Sonderausstattungsdaten stammen aus einem angebundenen Fahrzeugdatenanbieter (z. B. FIN-Decoder oder DAT). Es ist noch keiner angebunden – es werden keine Daten erfunden.</EmptyState>
        </Section>
      )}
      {tab === 'schaeden' && <Section title="Schäden">{caseLinks('schaden', 'Schadenerfassung')}</Section>}
      {tab === 'kalkulation' && <Section title="Kalkulation">{caseLinks('kalkulation', 'Kalkulation')}</Section>}
      {tab === 'bewertung' && <Section title="Bewertung">{caseLinks('bewertung', 'Bewertung')}</Section>}
      {tab === 'fotos' && <Section title="Fotos">{caseLinks('fotos', 'Fotos')}</Section>}
      {tab === 'dokumente' && <Section title="Dokumente">{caseLinks('dokumente', 'Dokumente')}</Section>}

      {tab === 'historie' && (
        <Section title="Historie der Fahrzeugdaten">
          {!prov || prov.history.length === 0 ? <p className="t-3" style={{ margin: 0 }}>Noch keine Änderungen protokolliert.</p> : (
            <div className="dt-wrap"><table className="vi-prov"><thead><tr><th>Zeitpunkt</th><th>Ereignis</th><th>Alt</th><th>Neu</th><th>Quelle</th><th>Benutzer</th></tr></thead><tbody>
              {prov.history.map((h) => (
                <tr key={h.id}><td className="nowrap">{fmtWhen(h.at)}</td><td>{h.field === '*' ? h.note : `${h.field}${h.note ? ` (${h.note})` : ''}`}</td><td>{h.field === '*' ? '' : h.oldValue ?? '–'}</td><td>{h.field === '*' ? '' : h.newValue ?? '–'}</td><td>{sourceLabel(h.source)}</td><td>{h.actor ?? '–'}</td></tr>
              ))}
            </tbody></table></div>
          )}
        </Section>
      )}
    </DrawerHost>
  );
}
