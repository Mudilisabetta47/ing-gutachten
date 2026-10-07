import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { orNotFound } from '@/server/admin/safe';
import { findLeadDuplicates, getLead, userOptions } from '@/server/pipeline/leads';
import { leadActivity } from '@/server/pipeline/activity';
import { LEAD_CONVERTIBLE, LEAD_LABELS, LEAD_TRANSITIONS, SERVICE_LABELS, serviceFromReason } from '@/lib/workflow';
import { REQUEST_VEHICLES } from '@/lib/request-schema';
import { toBerlinLocalInput } from '@/lib/berlin';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { DrawerHost, Menu, OpenDrawer, type MenuEntry } from '@/components/admin/Overlay';
import { AsideBlock, Alert, Badge, DetailHeader, EmptyState, Rows, Section, StatusPill, SummaryBar, Tabs, Timeline, fmtWhen, phoneHref, qp, shortRef } from '@/components/admin/ui';
import { LeadAppointmentForm, LeadEditForm, LeadNoteForm, LeadStatusForm } from './LeadForms';

export const metadata: Metadata = { title: 'Anfrage' };

const ATTACHMENT_STATUS: Record<string, string> = { STORED: 'Gespeichert', MAIL_ONLY: 'Nur per E-Mail zugestellt', NOT_STORED: 'Nicht gesichert' };
const KIND: Record<string, string> = { photo: 'Foto', registration: 'Fahrzeugschein' };
const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))} KB`;

const TABS = [['uebersicht', 'Übersicht'], ['fahrzeug', 'Fahrzeug'], ['schaden', 'Schaden'], ['fotos', 'Fotos'], ['notizen', 'Notizen'], ['aktivitaet', 'Aktivität']] as const;

export default async function LeadDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission('leads.read');
  const { id } = await params;
  const wanted = qp((await searchParams).tab);
  const tab = TABS.find(([k]) => k === wanted)?.[0] ?? 'uebersicht';
  const lead = await orNotFound(getLead(user, id));
  const [dups, activity, users] = await Promise.all([findLeadDuplicates(user, id), leadActivity(id), userOptions(user)]);

  const canWrite = user.permissions.has('leads.write');
  const canConvert = user.permissions.has('leads.convert') && LEAD_CONVERTIBLE.includes(lead.status);
  const open = lead.status !== 'CONVERTED' && lead.status !== 'SPAM' && lead.status !== 'CLOSED';
  const inq = lead.inquiry;
  const attachments = inq?.attachments ?? [];
  const lost = attachments.filter((a) => a.status === 'NOT_STORED').length;
  const hasDups = dups.customers.length + dups.vehicles.length + dups.cases.length + dups.leads.length > 0;
  const transitions = LEAD_TRANSITIONS[lead.status].map((s) => ({ value: s, label: LEAD_LABELS[s] }));
  const base = `/admin/anfragen/${id}/`;
  const ref = shortRef(lead.id, 'ANF');
  const assignee = lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` : null;
  const next = toBerlinLocalInput(lead.nextActionAt);

  const drawers = canWrite
    ? [
        ...(transitions.length ? [{ id: 'status', title: 'Status ändern', content: <LeadStatusForm id={id} current={LEAD_LABELS[lead.status]} options={transitions} /> }] : []),
        { id: 'note', title: 'Notiz hinzufügen', content: <LeadNoteForm id={id} /> },
        ...(open ? [{ id: 'appointment', title: 'Termin vorbereiten', content: <LeadAppointmentForm id={id} value={next} /> }] : []),
        ...(lead.status !== 'CONVERTED' ? [{ id: 'edit', title: 'Daten bearbeiten', content: (
          <LeadEditForm
            lead={{ id, name: lead.name, email: lead.email, phone: lead.phone, location: lead.location, licensePlate: lead.licensePlate, vehicleKind: lead.vehicleKind, message: lead.message, assignedToId: lead.assignedToId, nextActionAt: next }}
            users={users.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` }))}
            vehicleKinds={REQUEST_VEHICLES}
          />
        ) }] : []),
      ]
    : [];

  const more: MenuEntry[] = [
    ...(canWrite && transitions.length ? [{ kind: 'drawer' as const, label: 'Status ändern', drawer: 'status', icon: 'check' as const }] : []),
    ...(canWrite ? [{ kind: 'drawer' as const, label: 'Notiz hinzufügen', drawer: 'note', icon: 'note' as const }] : []),
    ...(canWrite && lead.status !== 'CONVERTED' ? [{ kind: 'drawer' as const, label: 'Daten bearbeiten', drawer: 'edit', icon: 'edit' as const }] : []),
    { kind: 'sep' as const },
    { kind: 'link' as const, label: 'Zur Anfragenliste', href: '/admin/anfragen', icon: 'inbox' as const },
  ];

  const Main = () => {
    if (tab === 'uebersicht')
      return (
        <>
          <Section title="Kontakt">
            <Rows items={[
              ['Telefon', lead.phone ? <a href={phoneHref(lead.phone)} className="adm-link">{lead.phone}</a> : null],
              ['E-Mail', lead.email ? <a href={`mailto:${lead.email}`} className="adm-link">{lead.email}</a> : null],
              ['Ort', lead.location],
            ]} />
          </Section>
          <Section title="Anfrage" aside="Originalangaben unveränderlich">
            <Rows items={[
              ['Leistung', `${lead.reason} · ${SERVICE_LABELS[serviceFromReason(lead.reason)]}`],
              ['Quelle', lead.source === 'website_form' ? 'Website-Formular' : lead.source],
              ['Eingang', fmtWhen(inq?.receivedAt ?? lead.createdAt)],
              ['Herkunft', inq ? [inq.utmSource, inq.utmMedium, inq.utmCampaign].filter(Boolean).join(' / ') || inq.referrerHost : null],
              ['Eingangsseite', inq?.landingPath ? <span className="mono">{inq.landingPath}</span> : null],
              ['Einwilligung', inq ? <span className="t-2">{fmtWhen(inq.consentAt)} · <span className="mono">{inq.privacyVersion}</span></span> : null],
              ['Formular', inq ? <span className="mono t-2">{inq.formVersion}</span> : null],
            ]} />
          </Section>
          <Section title="Nachricht des Kunden">
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{lead.message || <span className="t-3">Keine Nachricht.</span>}</p>
          </Section>
        </>
      );
    if (tab === 'fahrzeug')
      return (
        <Section title="Fahrzeug">
          <Rows items={[['Fahrzeugart', lead.vehicleKind], ['Kennzeichen', lead.licensePlate ? <span className="mono">{lead.licensePlate}</span> : null]]} />
          {!lead.licensePlate && <p className="t-3" style={{ margin: '12px 0 0' }}>Hersteller, Modell und FIN werden bei der Umwandlung erfasst.</p>}
        </Section>
      );
    if (tab === 'schaden')
      return (
        <Section title="Schaden">
          <Rows items={[['Anlass', lead.reason], ['Gutachtenart', SERVICE_LABELS[serviceFromReason(lead.reason)]], ['Ort des Fahrzeugs', lead.location]]} />
          <p style={{ margin: '14px 0 0', whiteSpace: 'pre-wrap' }}>{lead.message || <span className="t-3">Keine Beschreibung.</span>}</p>
        </Section>
      );
    if (tab === 'fotos')
      return (
        <Section title="Fotos und Dateien">
          {attachments.length === 0 ? (
            <EmptyState icon="photo" title="Keine Dateien">Mit dieser Anfrage wurden keine Fotos oder Dokumente gesendet.</EmptyState>
          ) : (
            <>
              <ul className="adm-list">
                {attachments.map((a) => (
                  <li key={a.id}>
                    <span className="main"><span>{KIND[a.kind] ?? a.kind}</span><span className="secondary">{a.mimeType.replace('image/', '').toUpperCase()} · {kb(a.sizeBytes)}</span></span>
                    <Badge tone={a.status === 'NOT_STORED' ? 'warn' : 'muted'}>{ATTACHMENT_STATUS[a.status]}</Badge>
                  </li>
                ))}
              </ul>
              <p className="t-3" style={{ margin: '12px 0 0' }}>Die Dateien liegen nicht in der Datenbank. Der private Dateispeicher folgt in Phase 3; bis dahin befinden sie sich nur im Anhang der E-Mail-Benachrichtigung.</p>
            </>
          )}
        </Section>
      );
    if (tab === 'notizen')
      return (
        <Section title="Interne Notizen" aside={canWrite ? <OpenDrawer id="note" icon="plus" className="adm-btn adm-btn-secondary adm-btn-sm">Notiz</OpenDrawer> : undefined}>
          {lead.notes.length === 0 ? (
            <EmptyState icon="note" title="Noch keine Notizen" action={canWrite ? <OpenDrawer id="note" className="adm-btn">Erste Notiz schreiben</OpenDrawer> : undefined}>Telefonate, Absprachen und Hinweise zur Anfrage – nur intern sichtbar.</EmptyState>
          ) : (
            <ul className="adm-list">
              {lead.notes.map((n) => (
                <li key={n.id} style={{ alignItems: 'flex-start' }}>
                  <span style={{ minWidth: 0 }}>
                    <span className="t-3" style={{ fontSize: 12 }}>{n.author ? `${n.author.firstName} ${n.author.lastName}` : 'System'} · {fmtWhen(n.createdAt)}{n.kind === 'PHONE_CALL' ? ' · Telefonnotiz' : ''}</span>
                    <span style={{ display: 'block', whiteSpace: 'pre-wrap', marginTop: 2 }}>{n.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      );
    return <Section title="Aktivität"><Timeline items={activity} /></Section>;
  };

  return (
    <DrawerHost drawers={drawers}>
      <DetailHeader
        crumbs={[{ label: 'Anfragen', href: '/admin/anfragen' }, { label: ref }]}
        title={lead.name}
        badge={<StatusPill kind="lead" status={lead.status} label={LEAD_LABELS[lead.status]} large />}
        meta={[
          'Website-Anfrage',
          fmtWhen(lead.createdAt),
          lead.phone ? <a key="p" href={phoneHref(lead.phone)} className="adm-link">{lead.phone}</a> : null,
          lead.email ? <a key="e" href={`mailto:${lead.email}`} className="adm-link">{lead.email}</a> : null,
        ].filter(Boolean) as ReactNode[]}
        actions={
          <>
            {phoneHref(lead.phone) && <a href={phoneHref(lead.phone)} className="adm-btn adm-btn-secondary adm-hide-mobile"><AdminIcon name="phone" />Anrufen</a>}
            {lead.email && <a href={`mailto:${lead.email}`} className="adm-btn adm-btn-secondary adm-hide-mobile"><AdminIcon name="mail" />E-Mail</a>}
            {canWrite && open && <OpenDrawer id="appointment" icon="calendar" className="adm-btn adm-btn-secondary adm-hide-mobile">Termin</OpenDrawer>}
            <Menu label="Weitere Aktionen" triggerClassName="adm-btn adm-btn-secondary adm-btn-icon" trigger={<AdminIcon name="more" />} entries={more} />
            {canConvert && <Link href={`${base}umwandeln/`} className="adm-btn adm-hide-mobile">In Fall umwandeln<AdminIcon name="chevronRight" /></Link>}
          </>
        }
      />

      <SummaryBar
        items={[
          ['Kunde', lead.name],
          ['Fahrzeug', [lead.vehicleKind, lead.licensePlate].filter(Boolean).join(' · ')],
          ['Ort', lead.location],
          ['Leistung', SERVICE_LABELS[serviceFromReason(lead.reason)]],
          ['Eingang', fmtWhen(lead.createdAt)],
        ]}
      />

      <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
        {lead.notificationStatus === 'FAILED' && <Alert tone="warn">Anfrage gespeichert – E-Mail-Benachrichtigung fehlgeschlagen.{lead.notificationError ? ` (${lead.notificationError})` : ''}</Alert>}
        {lead.notificationStatus === 'SKIPPED' && <Alert>Anfrage gespeichert. Es wurde keine E-Mail versendet ({lead.notificationError ?? 'nicht konfiguriert'}).</Alert>}
        {lost > 0 && lead.notificationStatus !== 'PENDING' && <Alert tone="warn">{lost} Datei(en) aus der Anfrage wurden nicht gesichert (der Dateispeicher folgt in Phase 3). Bitte beim Kunden nachfordern.</Alert>}
        {lead.status === 'CONVERTED' && lead.convertedCase && (
          <Alert tone="ok">
            Umgewandelt am {fmtWhen(lead.convertedAt)} in Fall <Link href={`/admin/faelle/${lead.convertedCase.caseNumber}/`} className="adm-link mono">{lead.convertedCase.caseNumber}</Link>
            {lead.convertedCustomer && <> · Kunde <Link href={`/admin/kunden/${lead.convertedCustomer.id}/`} className="adm-link">{lead.convertedCustomer.company || `${lead.convertedCustomer.firstName} ${lead.convertedCustomer.lastName}`}</Link></>}
            {lead.convertedVehicle && <> · Fahrzeug <Link href={`/admin/fahrzeuge/${lead.convertedVehicle.id}/`} className="adm-link">{lead.convertedVehicle.licensePlate ?? `${lead.convertedVehicle.manufacturer} ${lead.convertedVehicle.model}`}</Link></>}
          </Alert>
        )}
        {hasDups && (
          <Alert tone="warn" icon="users">
            <b>Möglicher bestehender Kunde / Fall.</b> Gleiche Telefonnummer, E-Mail oder gleiches Kennzeichen – es wird nichts automatisch zusammengeführt.
            <ul className="adm-list" style={{ marginTop: 6 }}>
              {dups.customers.map((c) => <li key={c.id}><span>Kunde: <Link href={`/admin/kunden/${c.id}/`} className="adm-link">{c.company || `${c.firstName} ${c.lastName}`}</Link> <span className="t-3">· {[c.email, c.phone, c.city].filter(Boolean).join(' · ')}</span></span></li>)}
              {dups.vehicles.map((v) => <li key={v.id}><span>Fahrzeug: <Link href={`/admin/fahrzeuge/${v.id}/`} className="adm-link">{v.licensePlate ?? `${v.manufacturer} ${v.model}`}</Link></span></li>)}
              {dups.cases.map((c) => <li key={c.id}><span>Fall: <Link href={`/admin/faelle/${c.caseNumber}/`} className="adm-link mono">{c.caseNumber}</Link> <span className="t-3">· {fmtWhen(c.createdAt)}</span></span></li>)}
              {dups.leads.map((l) => <li key={l.id}><span>Weitere Anfrage: <Link href={`/admin/anfragen/${l.id}/`} className="adm-link">{l.name}</Link> <span className="t-3">· {LEAD_LABELS[l.status]} · {fmtWhen(l.createdAt)}</span></span></li>)}
            </ul>
          </Alert>
        )}
      </div>

      <Tabs label="Anfragebereiche" active={tab} items={TABS.map(([k, l]) => ({ key: k, label: l, href: k === 'uebersicht' ? base : `${base}?tab=${k}`, count: k === 'notizen' ? lead.notes.length : k === 'fotos' ? attachments.length : undefined }))} />

      <div className="adm-work">
        <div style={{ minWidth: 0 }}><Main /></div>
        <aside aria-label="Bearbeitung">
          <AsideBlock title="Status">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <StatusPill kind="lead" status={lead.status} label={LEAD_LABELS[lead.status]} large />
              {canWrite && transitions.length > 0 && <OpenDrawer id="status" className="adm-btn adm-btn-secondary adm-btn-sm">Ändern</OpenDrawer>}
            </div>
          </AsideBlock>
          {open && (
            <AsideBlock title="Nächste Aktion">
              {canWrite ? <OpenDrawer id="appointment" icon="calendar" className="adm-btn adm-btn-secondary" >Termin vorbereiten</OpenDrawer> : <span className="t-3">–</span>}
            </AsideBlock>
          )}
          <AsideBlock title="Zuständig">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span>{assignee ?? <span className="t-3">Niemand zugewiesen</span>}</span>
              {canWrite && lead.status !== 'CONVERTED' && <OpenDrawer id="edit" className="adm-btn adm-btn-quiet adm-btn-sm">Ändern</OpenDrawer>}
            </div>
          </AsideBlock>
          <AsideBlock title="Wiedervorlage">{lead.nextActionAt ? fmtWhen(lead.nextActionAt) : <span className="t-3">Keine</span>}</AsideBlock>
          <AsideBlock title="Zuletzt">
            <Timeline items={activity.slice(0, 4)} />
            {activity.length > 4 && <Link href={`${base}?tab=aktivitaet`} className="adm-link" style={{ display: 'inline-block', marginTop: 8 }}>Alle Aktivitäten</Link>}
          </AsideBlock>
        </aside>
      </div>

      {canConvert && (
        <div className="adm-quickbar">
          {phoneHref(lead.phone) && <a href={phoneHref(lead.phone)} className="adm-btn adm-btn-secondary"><AdminIcon name="phone" />Anrufen</a>}
          <Link href={`${base}umwandeln/`} className="adm-btn">In Fall umwandeln</Link>
        </div>
      )}
    </DrawerHost>
  );
}
