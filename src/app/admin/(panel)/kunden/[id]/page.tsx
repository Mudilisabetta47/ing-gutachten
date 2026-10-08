import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { orNotFound } from '@/server/admin/safe';
import { customerCases, customerNotes, customerVehicles, getCustomer } from '@/server/pipeline/customers';
import { customerActivity } from '@/server/pipeline/activity';
import { CASE_LABELS, SERVICE_LABELS } from '@/lib/workflow';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { DrawerHost, OpenDrawer } from '@/components/admin/Overlay';
import { Alert, AsideBlock, Avatar, Badge, DetailHeader, EmptyState, Rows, Section, StatusPill, SummaryBar, Tabs, Timeline, fmtDate, fmtWhen, phoneHref, qp } from '@/components/admin/ui';
import { ConfirmForm, NoteForm } from '@/components/admin/forms';
import { anonymizeCustomerAction, archiveCustomerAction, customerNoteAction, restoreCustomerAction } from '../actions';
import { deleteDocumentAction } from '../../faelle/work-actions';
import { APPT_LABELS, KIND_LABELS, customerAppointments } from '@/server/pipeline/appointments';
import { DOCUMENT_CATEGORIES, DOCUMENT_LABELS, listDocuments } from '@/server/pipeline/media';
import { MediaUploader } from '@/components/admin/work';
import { getStorage } from '@/server/storage';

export const metadata: Metadata = { title: 'Kunde' };

const TABS = [
  ['uebersicht', 'Übersicht'], ['faelle', 'Fälle'], ['fahrzeuge', 'Fahrzeuge'], ['termine', 'Termine'],
  ['rechnungen', 'Rechnungen'], ['dokumente', 'Dokumente'], ['notizen', 'Notizen'], ['aktivitaet', 'Aktivität'],
] as const;

export default async function CustomerDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission('customers.read', 'customers.read.own');
  const { id } = await params;
  const wanted = qp((await searchParams).tab);
  const tab = TABS.find(([k]) => k === wanted)?.[0] ?? 'uebersicht';
  const c = await orNotFound(getCustomer(user, id));
  const name = c.company || `${c.firstName} ${c.lastName}`.trim();
  const canWrite = user.permissions.has('customers.write');
  const canDelete = user.permissions.has('customers.delete');
  const base = `/admin/kunden/${id}/`;
  const address = [c.street, [c.postalCode, c.city].filter(Boolean).join(' '), c.country !== 'DE' ? c.country : ''].filter(Boolean).join(', ');

  const mayAppts = user.permissions.has('appointments.read.all') || user.permissions.has('appointments.read.own');
  const mayDocs = user.permissions.has('documents.read.all');
  const storage = getStorage() !== null;
  const [appts, docs] = await Promise.all([
    tab === 'termine' && mayAppts ? customerAppointments(user, id) : Promise.resolve([]),
    tab === 'dokumente' && mayDocs && storage ? listDocuments(user, { customerId: id }) : Promise.resolve([]),
  ]);
  const [cases, vehicles, notes, activity] = await Promise.all([
    customerCases(user, id), customerVehicles(user, id),
    tab === 'notizen' ? customerNotes(user, id) : Promise.resolve([]),
    tab === 'aktivitaet' || tab === 'uebersicht' ? customerActivity(id) : Promise.resolve([]),
  ]);

  const drawers = canWrite ? [{ id: 'note', title: 'Notiz hinzufügen', content: <NoteForm action={customerNoteAction} id={id} /> }] : [];

  const Main = () => {
    if (tab === 'uebersicht')
      return (
        <>
          <Section title="Letzte Fälle" aside={cases.length > 5 ? <Link href={`${base}?tab=faelle`} className="adm-link">Alle {cases.length}</Link> : undefined}>
            {cases.length === 0 ? <p className="t-3" style={{ margin: 0 }}>Noch keine Fälle.</p> : (
              <ul className="adm-list">{cases.slice(0, 5).map((k) => (
                <li key={k.id}>
                  <span className="main"><Link href={`/admin/faelle/${k.caseNumber}/`} className="stretch mono">{k.caseNumber}</Link><span className="secondary">{k.vehicle.manufacturer} {k.vehicle.model}{k.vehicle.licensePlate ? ` · ${k.vehicle.licensePlate}` : ''}</span></span>
                  <StatusPill kind="case" status={k.status} label={CASE_LABELS[k.status]} />
                </li>
              ))}</ul>
            )}
          </Section>
          <Section title="Fahrzeuge">
            {vehicles.length === 0 ? <p className="t-3" style={{ margin: 0 }}>Noch keine Fahrzeuge.</p> : (
              <ul className="adm-list">{vehicles.slice(0, 5).map((v) => (
                <li key={v.id}><span className="main"><Link href={`/admin/fahrzeuge/${v.id}/`} className="stretch">{v.manufacturer} {v.model}</Link><span className="secondary mono">{v.licensePlate ?? 'ohne Kennzeichen'}</span></span></li>
              ))}</ul>
            )}
          </Section>
          <Section title="Aktivität"><Timeline items={activity.slice(0, 6)} /></Section>
        </>
      );
    if (tab === 'faelle')
      return cases.length === 0 ? <EmptyState icon="case" title="Noch keine Fälle" action={user.permissions.has('cases.write.all') && !c.deletedAt ? <Link href={`/admin/faelle/neu/?kunde=${id}`} className="adm-btn">Neuen Fall anlegen</Link> : undefined}>Zu diesem Kunden gibt es noch keinen Fall.</EmptyState> : (
        <div className="dt-wrap"><table className="dt">
          <thead><tr><th>Fall</th><th>Fahrzeug</th><th>Status</th><th>Angelegt</th></tr></thead>
          <tbody>{cases.map((k) => (
            <tr key={k.id}>
              <td data-slot="title"><Link href={`/admin/faelle/${k.caseNumber}/`} className="primary stretch mono">{k.caseNumber}</Link><span className="secondary">{SERVICE_LABELS[k.serviceType]}</span></td>
              <td data-slot="sub">{k.vehicle.manufacturer} {k.vehicle.model}{k.vehicle.licensePlate ? ` · ${k.vehicle.licensePlate}` : ''}</td>
              <td data-slot="badge"><StatusPill kind="case" status={k.status} label={CASE_LABELS[k.status]} /></td>
              <td data-slot="meta" className="nowrap t-2">{fmtWhen(k.createdAt)}</td>
            </tr>
          ))}</tbody>
        </table></div>
      );
    if (tab === 'fahrzeuge')
      return vehicles.length === 0 ? <EmptyState icon="car" title="Noch keine Fahrzeuge" action={canWrite && user.permissions.has('vehicles.write') ? <Link href={`${base}fahrzeug-neu/`} className="adm-btn">Fahrzeug anlegen</Link> : undefined}>Zu diesem Kunden ist noch kein Fahrzeug erfasst.</EmptyState> : (
        <div className="dt-wrap"><table className="dt">
          <thead><tr><th>Kennzeichen</th><th>Fahrzeug</th><th>FIN</th><th>Erstzulassung</th><th className="num">Kilometer</th></tr></thead>
          <tbody>{vehicles.map((v) => (
            <tr key={v.id}>
              <td data-slot="title"><Link href={`/admin/fahrzeuge/${v.id}/`} className="primary stretch mono">{v.licensePlate ?? '–'}</Link></td>
              <td data-slot="sub">{v.manufacturer} {v.model}{v.variant ? ` ${v.variant}` : ''}</td>
              <td data-slot="meta" className="mono t-2" style={{ fontSize: 12 }}>{v.vin ?? '–'}</td>
              <td data-slot="hide">{fmtDate(v.firstRegistration)}</td>
              <td data-slot="hide" className="num">{v.mileage?.toLocaleString('de-DE') ?? '–'}</td>
            </tr>
          ))}</tbody>
        </table></div>
      );
    if (tab === 'termine')
      return !mayAppts ? <EmptyState icon="shield" title="Keine Berechtigung für Termine" /> : appts.length === 0 ? (
        <EmptyState icon="calendar" title="Noch keine Termine">Termine legen Sie im jeweiligen Fall an.</EmptyState>
      ) : (
        <Section title={`Termine · ${appts.length}`}>
          <ul className="adm-list">{appts.map((a) => (
            <li key={a.id}><span className="main"><Link href={`/admin/faelle/${a.case.caseNumber}/?tab=termine`} className="stretch">{fmtWhen(a.startsAt)} · {KIND_LABELS[a.kind]}</Link><span className="secondary mono">{a.case.caseNumber} · {a.expert.firstName} {a.expert.lastName}</span></span><Badge tone={a.status === 'CONFIRMED' ? 'ok' : a.status === 'DONE' ? 'muted' : a.status === 'PLANNED' ? 'info' : 'danger'}>{APPT_LABELS[a.status]}</Badge></li>
          ))}</ul>
        </Section>
      );
    if (tab === 'dokumente') {
      if (!mayDocs) return <EmptyState icon="shield" title="Keine Berechtigung für Dokumente" />;
      if (!storage) return <Alert tone="warn">Der private Dateispeicher ist nicht eingerichtet.</Alert>;
      return (
        <>
          {canWrite && !c.deletedAt && <Section title="Dokument hinzufügen"><MediaUploader target="document" customerId={id} categories={DOCUMENT_CATEGORIES.map((k) => [k, DOCUMENT_LABELS[k]])} defaultCategory="OTHER" /></Section>}
          <Section title={`Dokumente · ${docs.length}`}>
            {docs.length === 0 ? <EmptyState icon="doc" title="Noch keine Dokumente">Rahmenverträge, Vollmachten und weitere Unterlagen zum Kunden – privat, nur mit Anmeldung abrufbar.</EmptyState> : (
              <ul className="adm-list">{docs.map((d) => (
                <li key={d.id}>
                  <span className="main"><a href={`/api/admin/media/${d.mediaId}`} target="_blank" rel="noreferrer" className="stretch">{d.title}</a><span className="secondary">{DOCUMENT_LABELS[d.category]} · {Math.max(1, Math.round(d.media.sizeBytes / 1024))} KB · {fmtWhen(d.createdAt)}</span></span>
                  {user.permissions.has('documents.delete') && <span style={{ position: 'relative', zIndex: 2 }}><ConfirmForm action={deleteDocumentAction} id={d.id} label="Löschen" title="Dokument löschen?" confirm="Das Dokument wird ausgeblendet." danger /></span>}
                </li>
              ))}</ul>
            )}
          </Section>
        </>
      );
    }
    if (tab === 'rechnungen') return <EmptyState icon="receipt" title="Rechnungen folgen in Phase 4">Rechnungen und Zahlungen werden in Phase 4 gebaut.</EmptyState>;
    if (tab === 'notizen')
      return canWrite ? (
        <Section title="Interne Notizen" aside={<OpenDrawer id="note" icon="plus" className="adm-btn adm-btn-secondary adm-btn-sm">Notiz</OpenDrawer>}>
          {notes.length === 0 ? <EmptyState icon="note" title="Noch keine Notizen" action={<OpenDrawer id="note" className="adm-btn">Erste Notiz schreiben</OpenDrawer>}>Absprachen und Hinweise zum Kunden – nur intern sichtbar.</EmptyState> : (
            <ul className="adm-list">{notes.map((n) => (
              <li key={n.id} style={{ alignItems: 'flex-start' }}><span style={{ minWidth: 0 }}>
                <span className="t-3" style={{ fontSize: 12 }}>{n.author ? `${n.author.firstName} ${n.author.lastName}` : 'System'} · {fmtWhen(n.createdAt)}{n.kind === 'PHONE_CALL' ? ' · Telefonnotiz' : ''}</span>
                <span style={{ display: 'block', whiteSpace: 'pre-wrap', marginTop: 2 }}>{n.body}</span>
              </span></li>
            ))}</ul>
          )}
        </Section>
      ) : <EmptyState icon="shield" title="Keine Berechtigung für Kundennotizen">Interne Notizen sehen nur Mitarbeiter mit Bearbeitungsrecht am Kunden.</EmptyState>;
    return <Section title="Aktivität"><Timeline items={activity} /></Section>;
  };

  return (
    <DrawerHost drawers={drawers}>
      <DetailHeader
        crumbs={[{ label: 'Kunden', href: '/admin/kunden' }, { label: name }]}
        lead={<Avatar name={name} size="lg" />}
        title={name}
        badge={c.deletedAt ? <Badge tone="danger">Archiviert</Badge> : c.type === 'BUSINESS' ? <Badge tone="muted">Firmenkunde</Badge> : undefined}
        meta={[
          c.company ? `${c.firstName} ${c.lastName}`.trim() : null,
          c.phone ? <a key="p" href={phoneHref(c.phone)} className="adm-link">{c.phone}</a> : null,
          c.email ? <a key="e" href={`mailto:${c.email}`} className="adm-link">{c.email}</a> : null,
          c.city,
        ].filter(Boolean) as ReactNode[]}
        actions={
          <>
            {phoneHref(c.phone) && <a href={phoneHref(c.phone)} className="adm-btn adm-btn-secondary"><AdminIcon name="phone" />Anrufen</a>}
            {c.email && <a href={`mailto:${c.email}`} className="adm-btn adm-btn-secondary adm-hide-mobile"><AdminIcon name="mail" />E-Mail</a>}
            {canWrite && !c.deletedAt && <Link href={`${base}bearbeiten/`} className="adm-btn adm-btn-secondary adm-hide-mobile"><AdminIcon name="edit" />Bearbeiten</Link>}
            {user.permissions.has('cases.write.all') && !c.deletedAt && <Link href={`/admin/faelle/neu/?kunde=${id}`} className="adm-btn"><AdminIcon name="plus" />Neuer Fall</Link>}
          </>
        }
      />
      <SummaryBar items={[['Telefon', c.phone], ['E-Mail', c.email], ['Ort', c.city], ['Fälle', c._count.cases], ['Fahrzeuge', c._count.vehicles], ['Kunde seit', fmtDate(c.createdAt)]]} />
      <Tabs label="Kundenbereiche" active={tab} items={TABS.map(([k, l]) => ({ key: k, label: l, href: k === 'uebersicht' ? base : `${base}?tab=${k}`, count: k === 'faelle' ? c._count.cases : k === 'fahrzeuge' ? c._count.vehicles : undefined }))} />
      <div className="adm-work">
        <div style={{ minWidth: 0 }}><Main /></div>
        <aside aria-label="Kundendaten">
          <AsideBlock title="Kontakt"><Rows items={[['Telefon', c.phone ? <a href={phoneHref(c.phone)} className="adm-link">{c.phone}</a> : null], ['E-Mail', c.email ? <a href={`mailto:${c.email}`} className="adm-link" style={{ wordBreak: 'break-all' }}>{c.email}</a> : null]]} /></AsideBlock>
          <AsideBlock title="Anschrift"><p style={{ margin: 0 }}>{address || <span className="t-3">Keine Anschrift</span>}</p></AsideBlock>
          {canDelete && (
            <AsideBlock title="Verwaltung">
              {c.deletedAt
                ? <div style={{ display: 'grid', gap: 8 }}>
                    {!c.anonymizedAt && <ConfirmForm action={restoreCustomerAction} id={id} label="Wiederherstellen" title="Kunde wiederherstellen?" confirm="Der Kunde erscheint wieder in den Listen." />}
                    {!c.anonymizedAt && user.permissions.has('data.anonymize') && <ConfirmForm action={anonymizeCustomerAction} id={id} label="Anonymisieren (DSGVO)" title="Kunde unwiderruflich anonymisieren?" confirm="Name, Kontaktdaten, Anschrift, Notizen und Kundendokumente werden endgültig entfernt. Fälle, Fahrzeuge und bereits ausgestellte Rechnungen bleiben wegen gesetzlicher Aufbewahrungsfristen unverändert erhalten. Das lässt sich nicht rückgängig machen." danger confirmLabel="Endgültig anonymisieren" />}
                    {c.anonymizedAt && <p className="t-3" style={{ margin: 0 }}>Anonymisiert am {fmtDate(c.anonymizedAt)}.</p>}
                  </div>
                : <ConfirmForm action={archiveCustomerAction} id={id} label="Kunde archivieren" title="Kunde archivieren?" confirm="Der Kunde verschwindet aus den Listen, alle Daten bleiben erhalten. Nur möglich, wenn kein Fall mehr offen ist." danger />}
            </AsideBlock>
          )}
        </aside>
      </div>
    </DrawerHost>
  );
}
