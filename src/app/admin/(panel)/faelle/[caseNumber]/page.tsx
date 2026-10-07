import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { orNotFound } from '@/server/admin/safe';
import { caseNotes, getCase, listExperts } from '@/server/pipeline/cases';
import { caseActivity } from '@/server/pipeline/activity';
import { CASE_EXPERT_TARGETS, CASE_LABELS, CASE_TRANSITIONS, FUEL_LABELS, SERVICE_LABELS, caseReasonRequired } from '@/lib/workflow';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { DrawerHost, Menu, OpenDrawer, type MenuEntry } from '@/components/admin/Overlay';
import { FlashToast } from '@/components/admin/Toast';
import { AsideBlock, Alert, Badge, DetailHeader, EmptyState, Rows, Section, StatusPill, SummaryBar, Tabs, Timeline, fmtDate, fmtWhen, mapsHref, phoneHref, qp } from '@/components/admin/ui';
import { CaseForm, ConfirmForm, NoteForm } from '@/components/admin/forms';
import { CaseStatusForm, AssignForm } from './CaseForms';
import { archiveCaseAction, caseNoteAction, restoreCaseAction, updateCaseAction } from '../actions';

export const metadata: Metadata = { title: 'Fall' };

const TABS = [
  ['uebersicht', 'Übersicht'], ['fahrzeug', 'Fahrzeug'], ['schaden', 'Schaden'], ['fotos', 'Fotos'], ['dokumente', 'Dokumente'],
  ['termine', 'Termine'], ['gutachten', 'Gutachten'], ['rechnung', 'Rechnung'], ['kommunikation', 'Kommunikation'], ['historie', 'Historie'],
] as const;

const LATER: Record<string, [string, string]> = {
  dokumente: ['Dokumente folgen in Phase 3', 'Der private Dateispeicher für Dokumente und Fotos wird in Phase 3 gebaut.'],
  termine: ['Termine folgen in Phase 3', 'Kalender und Terminverwaltung werden in Phase 3 gebaut. Bis dahin zeigt der Fallstatus „Termin vereinbart“ den Stand.'],
  gutachten: ['Gutachten folgen in Phase 3', 'Die Gutachten-Erstellung mit Versionierung und PDF kommt in Phase 3.'],
  rechnung: ['Rechnungen folgen in Phase 4', 'Rechnungen, Zahlungen und Mahnwesen werden in Phase 4 gebaut.'],
  kommunikation: ['Kommunikation folgt in Phase 4', 'E-Mail-Vorlagen und der Kommunikationsverlauf werden in Phase 4 gebaut.'],
};

export default async function CaseDetailPage({ params, searchParams }: { params: Promise<{ caseNumber: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission('cases.read.all', 'cases.read.own');
  const { caseNumber } = await params;
  const sp = await searchParams;
  const wanted = qp(sp.tab);
  const tab = TABS.find(([k]) => k === wanted)?.[0] ?? 'uebersicht';
  const c = await orNotFound(getCase(user, caseNumber));

  const isOwn = c.assignedExpert?.id === user.id;
  const canWrite = user.permissions.has('cases.write.all') || (user.permissions.has('cases.write.own') && isOwn);
  const canStatus = user.permissions.has('cases.status');
  const canAssign = user.permissions.has('cases.assign') && !c.deletedAt;
  const statusOptions = CASE_TRANSITIONS[c.status]
    .filter((s) => canStatus || (user.permissions.has('cases.write.own') && isOwn && CASE_EXPERT_TARGETS.includes(s)))
    .map((s) => ({ value: s, label: CASE_LABELS[s], needsReason: caseReasonRequired(c.status, s) }));
  const canSeeCustomer = user.permissions.has('customers.read') || user.permissions.has('customers.read.own');
  const name = c.customer.company || `${c.customer.firstName} ${c.customer.lastName}`.trim();
  const base = `/admin/faelle/${caseNumber}/`;
  const vehicleName = `${c.vehicle.manufacturer} ${c.vehicle.model}${c.vehicle.variant ? ` ${c.vehicle.variant}` : ''}`;
  const expert = c.assignedExpert ? `${c.assignedExpert.firstName} ${c.assignedExpert.lastName}` : null;
  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');

  const [notes, activity, experts] = await Promise.all([
    tab === 'uebersicht' ? caseNotes(user, c.id) : Promise.resolve([]),
    caseActivity(c.id, { includeNotes: c.internalsVisible }),
    canAssign ? listExperts(user) : Promise.resolve([]),
  ]);
  const attachments = c.lead?.inquiry?.attachments ?? [];
  const expertList = experts.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }));

  const drawers = [
    ...(statusOptions.length && !c.deletedAt ? [{ id: 'status', title: 'Status ändern', content: <CaseStatusForm id={c.id} caseNumber={caseNumber} current={CASE_LABELS[c.status]} options={statusOptions} /> }] : []),
    ...(canAssign ? [{ id: 'assign', title: 'Sachverständigen zuweisen', content: <AssignForm id={c.id} caseNumber={caseNumber} current={c.assignedExpert?.id ?? null} experts={expertList} /> }] : []),
    ...(c.internalsVisible && canWrite && !c.deletedAt ? [
      { id: 'note', title: 'Notiz hinzufügen', content: <NoteForm action={caseNoteAction} id={c.id} extra={{ caseNumber }} /> },
      { id: 'edit', title: 'Schaden und Versicherung bearbeiten', content: (
        <CaseForm
          bare action={updateCaseAction} hidden={{ id: c.id, caseNumber }} experts={[]} canAssign={false} submitLabel="Speichern"
          initial={{ serviceType: c.serviceType, damageDate: iso(c.damageDate), accidentDate: iso(c.accidentDate), inspectionLocation: c.inspectionLocation, insuranceName: c.insuranceName, insuranceClaimNumber: c.insuranceClaimNumber, opposingInsurance: c.opposingInsurance, opposingClaimNumber: c.opposingClaimNumber, lawyer: c.lawyer, repairShop: c.repairShop, description: c.description }}
        />
      ) },
    ] : []),
  ];

  const more: MenuEntry[] = [
    ...(statusOptions.length && !c.deletedAt ? [{ kind: 'drawer' as const, label: 'Status ändern', drawer: 'status', icon: 'check' as const }] : []),
    ...(canAssign ? [{ kind: 'drawer' as const, label: 'Sachverständigen zuweisen', drawer: 'assign', icon: 'user' as const }] : []),
    ...(c.internalsVisible && canWrite && !c.deletedAt ? [
      { kind: 'drawer' as const, label: 'Notiz hinzufügen', drawer: 'note', icon: 'note' as const },
      { kind: 'drawer' as const, label: 'Schaden bearbeiten', drawer: 'edit', icon: 'edit' as const },
    ] : []),
    ...(canSeeCustomer ? [{ kind: 'sep' as const }, { kind: 'link' as const, label: 'Kunde öffnen', href: `/admin/kunden/${c.customer.id}/`, icon: 'users' as const }] : []),
    ...(user.permissions.has('vehicles.read') ? [{ kind: 'link' as const, label: 'Fahrzeug öffnen', href: `/admin/fahrzeuge/${c.vehicle.id}/`, icon: 'car' as const }] : []),
  ];

  const Main = (): ReactNode => {
    if (tab === 'uebersicht')
      return (
        <>
          <Section title="Auftrag">
            <Rows items={[
              ['Gutachtenart', SERVICE_LABELS[c.serviceType]],
              ['Besichtigungsort', c.inspectionLocation ? <a href={mapsHref(c.inspectionLocation)} className="adm-link" target="_blank" rel="noreferrer">{c.inspectionLocation}</a> : null],
              ['Versicherung', c.insuranceName],
              ['Schadennummer', c.insuranceClaimNumber ? <span className="mono">{c.insuranceClaimNumber}</span> : null],
              ['Angelegt', `${fmtWhen(c.createdAt)}${c.createdBy ? ` · ${c.createdBy.firstName} ${c.createdBy.lastName}` : ''}`],
              ['Abgeschlossen', c.closedAt ? fmtWhen(c.closedAt) : null],
              ['Anfrage', c.lead && user.permissions.has('leads.read') ? <Link href={`/admin/anfragen/${c.lead.id}/`} className="adm-link">Ursprüngliche Anfrage öffnen</Link> : null],
            ]} />
          </Section>
          {c.internalsVisible && (
            <Section id="notiz" title="Notizen" aside={canWrite && !c.deletedAt ? <OpenDrawer id="note" icon="plus" className="adm-btn adm-btn-secondary adm-btn-sm">Notiz</OpenDrawer> : undefined}>
              {notes.length === 0 ? <p className="t-3" style={{ margin: 0 }}>Noch keine Notizen.</p> : (
                <ul className="adm-list">{notes.map((n) => (
                  <li key={n.id} style={{ alignItems: 'flex-start' }}>
                    <span style={{ minWidth: 0 }}>
                      <span className="t-3" style={{ fontSize: 12 }}>{n.author ? `${n.author.firstName} ${n.author.lastName}` : 'System'} · {fmtWhen(n.createdAt)}{n.kind === 'PHONE_CALL' ? ' · Telefonnotiz' : ''}</span>
                      <span style={{ display: 'block', whiteSpace: 'pre-wrap', marginTop: 2 }}>{n.body}</span>
                    </span>
                  </li>
                ))}</ul>
              )}
            </Section>
          )}
        </>
      );
    if (tab === 'fahrzeug')
      return (
        <Section title="Fahrzeug" aside={user.permissions.has('vehicles.read') ? <Link href={`/admin/fahrzeuge/${c.vehicle.id}/`} className="adm-link">Fahrzeug öffnen</Link> : undefined}>
          <Rows items={[
            ['Kennzeichen', c.vehicle.licensePlate ? <span className="mono">{c.vehicle.licensePlate}</span> : null], ['Fahrzeug', vehicleName],
            ['FIN', c.vehicle.vin ? <span className="mono">{c.vehicle.vin}</span> : null], ['Erstzulassung', fmtDate(c.vehicle.firstRegistration)],
            ['Kilometerstand', c.vehicle.mileage?.toLocaleString('de-DE')], ['Antrieb', c.vehicle.fuelType ? FUEL_LABELS[c.vehicle.fuelType] : null], ['Farbe', c.vehicle.color],
          ]} />
        </Section>
      );
    if (tab === 'schaden')
      return c.internalsVisible ? (
        <Section title="Schaden und Beteiligte" aside={canWrite && !c.deletedAt ? <OpenDrawer id="edit" icon="edit" className="adm-btn adm-btn-secondary adm-btn-sm">Bearbeiten</OpenDrawer> : undefined}>
          <Rows items={[
            ['Schadendatum', fmtDate(c.damageDate)], ['Unfalldatum', fmtDate(c.accidentDate)], ['Besichtigungsort', c.inspectionLocation],
            ['Versicherung', c.insuranceName], ['Schadennummer', c.insuranceClaimNumber ? <span className="mono">{c.insuranceClaimNumber}</span> : null],
            ['Gegnerische Versicherung', c.opposingInsurance], ['Gegnerische Schadennr.', c.opposingClaimNumber ? <span className="mono">{c.opposingClaimNumber}</span> : null],
            ['Rechtsanwalt', c.lawyer], ['Werkstatt', c.repairShop],
          ]} />
          <p style={{ margin: '14px 0 0', whiteSpace: 'pre-wrap' }}>{c.description || <span className="t-3">Keine Beschreibung.</span>}</p>
        </Section>
      ) : (
        <Section title="Schaden">
          <Rows items={[['Versicherung', c.insuranceName], ['Schadennummer', c.insuranceClaimNumber ? <span className="mono">{c.insuranceClaimNumber}</span> : null]]} />
          <p className="t-3" style={{ margin: '12px 0 0' }}>Unfallhergang und Beteiligte sind für Ihre Rolle nicht sichtbar.</p>
        </Section>
      );
    if (tab === 'fotos')
      return attachments.length === 0 ? (
        <EmptyState icon="photo" title="Noch keine Fotos">Der private Dateispeicher und der Foto-Upload folgen in Phase 3.{c.lead ? ' Mit der ursprünglichen Anfrage wurden keine Dateien gesendet.' : ''}</EmptyState>
      ) : (
        <Section title="Fotos aus der Anfrage">
          <p style={{ margin: '0 0 10px' }}>{attachments.length} Datei(en) wurden mit der Anfrage gesendet. Sie liegen nicht in der Datenbank – bis zum Dateispeicher (Phase 3) nur im Anhang der E-Mail-Benachrichtigung.</p>
          <ul className="adm-list">{attachments.map((a) => (
            <li key={a.id}><span className="main"><span>{a.kind === 'registration' ? 'Fahrzeugschein' : 'Foto'}</span><span className="secondary">{Math.max(1, Math.round(a.sizeBytes / 1024))} KB</span></span><Badge>{a.status === 'MAIL_ONLY' ? 'Nur per E-Mail' : a.status === 'STORED' ? 'Gespeichert' : 'Nicht gesichert'}</Badge></li>
          ))}</ul>
        </Section>
      );
    if (LATER[tab]) return <EmptyState icon="clock" title={LATER[tab][0]}>{LATER[tab][1]}</EmptyState>;
    return (
      <div className="adm-grid-2">
        <Section title="Statusverlauf">
          <ol className="adm-timeline">
            {c.history.map((h) => (
              <li key={h.id} data-kind="status">
                <span className="time">{new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(h.createdAt)}<small>{new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' }).format(h.createdAt)}.</small></span>
                <span className="body"><span className="who">{CASE_LABELS[h.toStatus]}</span>{h.fromStatus ? <span className="t-3"> (zuvor {CASE_LABELS[h.fromStatus]})</span> : null}<span className="detail">{h.actor ? `${h.actor.firstName} ${h.actor.lastName}` : 'System'}{h.reason ? ` · ${h.reason}` : ''}</span></span>
              </li>
            ))}
          </ol>
        </Section>
        <Section title="Alle Aktivitäten"><Timeline items={activity} /></Section>
      </div>
    );
  };

  return (
    <DrawerHost drawers={drawers}>
      {qp(sp.neu) && <FlashToast text={`Fall ${c.caseNumber} angelegt. Die Anfrage bleibt erhalten und verweist auf diesen Fall.`} param="neu" />}
      <DetailHeader
        crumbs={[{ label: 'Fälle', href: '/admin/faelle' }, { label: c.caseNumber }]}
        title={<span><span className="mono" style={{ fontSize: '.78em', fontWeight: 600 }}>{c.caseNumber}</span></span>}
        badge={<StatusPill kind="case" status={c.status} label={CASE_LABELS[c.status]} large />}
        meta={[
          <span key="v"><b style={{ fontWeight: 600 }}>{vehicleName}</b>{c.vehicle.licensePlate ? <> · <span className="mono">{c.vehicle.licensePlate}</span></> : null}</span>,
          canSeeCustomer ? <Link key="c" href={`/admin/kunden/${c.customer.id}/`} className="adm-link">{name}</Link> : <span key="c">{name}</span>,
          ...(c.deletedAt ? [<Badge key="a" tone="danger">Archiviert</Badge>] : []),
        ]}
        actions={
          <>
            <Link href={`${base}?tab=termine`} className="adm-btn adm-btn-secondary adm-hide-mobile"><AdminIcon name="calendar" />Termin</Link>
            <Link href={`${base}?tab=dokumente`} className="adm-btn adm-btn-secondary adm-hide-mobile"><AdminIcon name="doc" />Dokument</Link>
            <Link href={`${base}?tab=gutachten`} className="adm-btn adm-btn-secondary adm-hide-mobile">Gutachten</Link>
            {statusOptions.length > 0 && !c.deletedAt && <OpenDrawer id="status" className="adm-btn adm-hide-mobile">Status ändern</OpenDrawer>}
            {more.length > 0 && <Menu label="Weitere Aktionen" triggerClassName="adm-btn adm-btn-secondary adm-btn-icon" trigger={<AdminIcon name="more" />} entries={more} />}
          </>
        }
      />

      <SummaryBar
        items={[
          ['Schadendatum', c.internalsVisible ? fmtDate(c.damageDate) : null],
          ['Gutachtenart', SERVICE_LABELS[c.serviceType]],
          ['Besichtigung', c.inspectionLocation],
          ['Gutachter', expert],
          ['Versicherung', c.insuranceName],
          ['Schadennr.', c.insuranceClaimNumber ? <span className="mono">{c.insuranceClaimNumber}</span> : null],
        ]}
      />

      {c.deletedAt && <div style={{ marginTop: 16 }}><Alert tone="danger">Dieser Fall ist archiviert und nur für die Leitung sichtbar.</Alert></div>}

      <Tabs label="Fallbereiche" active={tab} items={TABS.map(([k, l]) => ({ key: k, label: l, href: k === 'uebersicht' ? base : `${base}?tab=${k}`, count: k === 'fotos' ? attachments.length : undefined }))} />

      <div className="adm-work">
        <div style={{ minWidth: 0 }}><Main /></div>
        <aside aria-label="Bearbeitung">
          <AsideBlock title="Status">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <StatusPill kind="case" status={c.status} label={CASE_LABELS[c.status]} large />
              {statusOptions.length > 0 && !c.deletedAt && <OpenDrawer id="status" className="adm-btn adm-btn-secondary adm-btn-sm">Ändern</OpenDrawer>}
            </div>
          </AsideBlock>
          <AsideBlock title="Gutachter">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span>{expert ?? <span className="t-3">Nicht zugewiesen</span>}</span>
              {canAssign && <OpenDrawer id="assign" className="adm-btn adm-btn-secondary adm-btn-sm">{expert ? 'Ändern' : 'Zuweisen'}</OpenDrawer>}
            </div>
          </AsideBlock>
          <AsideBlock title="Kunde">
            <p style={{ margin: 0, fontWeight: 600 }}>{name}</p>
            <p className="t-2" style={{ margin: '2px 0 8px' }}>{[c.customer.street, [c.customer.postalCode, c.customer.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '–'}</p>
            <div className="adm-actions">
              {phoneHref(c.customer.phone) && <a href={phoneHref(c.customer.phone)} className="adm-btn adm-btn-secondary adm-btn-sm"><AdminIcon name="phone" />Anrufen</a>}
              {c.customer.email && <a href={`mailto:${c.customer.email}`} className="adm-btn adm-btn-secondary adm-btn-sm"><AdminIcon name="mail" />E-Mail</a>}
            </div>
          </AsideBlock>
          <AsideBlock title="Zuletzt">
            <Timeline items={activity.slice(0, 5)} />
            {activity.length > 5 && <Link href={`${base}?tab=historie`} className="adm-link" style={{ display: 'inline-block', marginTop: 8 }}>Gesamte Historie</Link>}
          </AsideBlock>
          {user.permissions.has('cases.delete') && (
            <AsideBlock title="Verwaltung">
              {c.deletedAt
                ? <ConfirmForm action={restoreCaseAction} id={c.id} extra={{ caseNumber }} label="Fall wiederherstellen" title="Fall wiederherstellen?" confirm="Der Fall erscheint wieder in den Listen." />
                : <ConfirmForm action={archiveCaseAction} id={c.id} extra={{ caseNumber }} label="Fall archivieren" title="Fall archivieren?" confirm="Der Fall verschwindet aus den Listen, alle Daten bleiben erhalten. Nur die Leitung kann ihn wiederherstellen." danger />}
            </AsideBlock>
          )}
        </aside>
      </div>
      {statusOptions.length > 0 && !c.deletedAt && (
        <div className="adm-quickbar">
          {phoneHref(c.customer.phone) && <a href={phoneHref(c.customer.phone)} className="adm-btn adm-btn-secondary"><AdminIcon name="phone" />Anrufen</a>}
          <OpenDrawer id="status" className="adm-btn">Status ändern</OpenDrawer>
        </div>
      )}
    </DrawerHost>
  );
}
