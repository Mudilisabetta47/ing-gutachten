import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '@/server/db';
import { assertTestDb, resetDb, makeUser, asAuthUser, makeLead, CUSTOMER, VEHICLE } from './helpers';
import { markNotification, persistInquiry } from '@/server/pipeline/intake';
import { addLeadNote, changeLeadStatus, convertLead, findLeadDuplicates, getLead, listLeads, updateLead } from '@/server/pipeline/leads';
import { archiveCustomer, createCustomer, listCustomers, restoreCustomer, updateCustomer } from '@/server/pipeline/customers';
import { archiveVehicle, createVehicle, listVehicles } from '@/server/pipeline/vehicles';
import { addCaseNote, archiveCase, assignExpert, changeCaseStatus, createCase, getCase, listCases, restoreCase } from '@/server/pipeline/cases';
import { caseActivity } from '@/server/pipeline/activity';
import { customerSchema, vehicleSchema, caseSchema } from '@/server/pipeline/schemas';
import { createCustomerTx, createVehicleTx, createCaseTx } from '@/server/pipeline/core';
import { DomainError } from '@/server/errors';
import { ForbiddenError } from '@/server/auth/errors';

assertTestDb();
beforeEach(resetDb);

const office = async () => asAuthUser((await makeUser({ role: 'OFFICE' })).user.id);
const caseData = () => caseSchema.parse({ serviceType: 'ACCIDENT_REPORT', inspectionLocation: 'Hannover' });
const convertInput = () => ({
  customer: { mode: 'new' as const, data: customerSchema.parse(CUSTOMER) },
  vehicle: { mode: 'new' as const, data: vehicleSchema.parse(VEHICLE) },
  case: caseData(),
});

/* ------------------------------------------------------------ Intake */

test('Anfrage speichern: Inquiry (unveränderliche Kopie) + Lead + Historie + Audit, ohne PII im Audit', async () => {
  const { inquiryId, leadId } = await persistInquiry({
    fields: { anlass: 'Unfall', fahrzeug: 'PKW', name: 'Erika Mustermann', telefon: '+49 511 1234567', email: 'erika@example.test', standort: 'Hannover', nachricht: 'Heckschaden', datenschutz: true },
    attachments: [{ kind: 'photo', fileName: 'foto-1.jpg', mimeType: 'image/jpeg', sizeBytes: 1234, sha256: 'a'.repeat(64) }],
    tracking: { utmSource: 'google', utmMedium: 'cpc', utmCampaign: null, referrerHost: 'www.google.com', landingPath: '/kfz-gutachter-hannover/' },
    ip: '203.0.113.7',
  });
  const inq = await db.inquiry.findUniqueOrThrow({ where: { id: inquiryId }, include: { attachments: true, lead: true } });
  assert.equal(inq.lead?.id, leadId);
  assert.equal(inq.consentAt.getTime(), inq.receivedAt.getTime());
  assert.match(inq.privacyVersion, /^datenschutz-/);
  assert.match(inq.formVersion, /^form-/);
  assert.equal(inq.utmSource, 'google');
  assert.equal(inq.ipHash, null, 'ohne Salz wird keine IP-Ableitung gespeichert');
  assert.equal(inq.attachments[0].status, 'NOT_STORED', 'bis zur Mail-Zustellung nicht als gesichert ausgeben');
  assert.equal(inq.attachments[0].storageKey, null);
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  assert.equal(lead.status, 'NEW');
  assert.equal(lead.phoneNorm, '0511 1234567'.replace(/\D/g, ''));
  assert.equal(lead.notificationStatus, 'PENDING');
  assert.equal(await db.leadStatusHistory.count({ where: { leadId } }), 1);
  const audit = await db.auditLog.findMany({ where: { entityId: leadId } });
  assert.equal(audit.length, 1);
  assert.doesNotMatch(JSON.stringify(audit), /erika|Mustermann|1234567|example\.test/i, 'keine personenbezogenen Daten im Audit');
});

test('Inquiry ist unveränderlich (DB-Trigger) – nur Anonymisierung der Personenfelder erlaubt', async () => {
  const { inquiryId } = await makeLead();
  await assert.rejects(db.inquiry.update({ where: { id: inquiryId }, data: { reason: 'Etwas anderes' } }), /unveränderlich|unver/i);
  await assert.rejects(db.inquiry.update({ where: { id: inquiryId }, data: { name: 'Fälschung' } }));
  await assert.rejects(db.inquiry.update({ where: { id: inquiryId }, data: { consentAt: new Date(0) } }));
  await db.inquiry.update({ where: { id: inquiryId }, data: { name: '[anonymisiert]', email: '[anonymisiert]', phone: '[anonymisiert]', message: null, location: null } });
  assert.equal((await db.inquiry.findUniqueOrThrow({ where: { id: inquiryId } })).name, '[anonymisiert]');
});

test('Mail-Ergebnis: SENT sichert Anhänge als MAIL_ONLY, FAILED bleibt sichtbar und wird protokolliert', async () => {
  const a = await persistInquiry({
    fields: { anlass: 'Unfall', fahrzeug: 'PKW', name: 'A B', telefon: '0511 123456', email: 'a@example.test', standort: '', nachricht: '', datenschutz: true },
    attachments: [{ kind: 'photo', fileName: 'foto-1.jpg', mimeType: 'image/jpeg', sizeBytes: 10, sha256: 'b'.repeat(64) }],
    tracking: { utmSource: null, utmMedium: null, utmCampaign: null, referrerHost: null, landingPath: null }, ip: 'unknown',
  });
  await markNotification(a.leadId, 'SENT');
  assert.equal((await db.lead.findUniqueOrThrow({ where: { id: a.leadId } })).notificationStatus, 'SENT');
  assert.equal((await db.inquiryAttachment.findFirstOrThrow({ where: { inquiryId: a.inquiryId } })).status, 'MAIL_ONLY');

  const b = await makeLead({ name: 'Zweiter Fall' });
  await markNotification(b.leadId, 'FAILED', 'Versand abgelehnt');
  const l = await db.lead.findUniqueOrThrow({ where: { id: b.leadId } });
  assert.equal(l.notificationStatus, 'FAILED');
  assert.equal(l.notificationError, 'Versand abgelehnt');
  assert.equal(await db.auditLog.count({ where: { action: 'lead.notification_failed', entityId: b.leadId } }), 1);
});

/* ------------------------------------------------------------ Lead-Workflow */

test('Lead-Status: erlaubte Übergänge, Historie, Audit; CONVERTED nie manuell', async () => {
  const u = await office();
  const { leadId } = await makeLead();
  await changeLeadStatus(u, leadId, 'CONTACTED');
  await changeLeadStatus(u, leadId, 'APPOINTMENT_SET');
  await assert.rejects(changeLeadStatus(u, leadId, 'CONVERTED'), DomainError);
  await assert.rejects(changeLeadStatus(u, leadId, 'NEW'), DomainError, 'Rückwärts nach NEW nicht erlaubt');
  await changeLeadStatus(u, leadId, 'CLOSED', 'Kunde meldet sich nicht');
  const l = await getLead(u, leadId);
  assert.equal(l.status, 'CLOSED');
  assert.equal(l.closedReason, 'Kunde meldet sich nicht');
  assert.equal(l.history.length, 4); // NEW (Eingang) + 3 Wechsel
  assert.equal(await db.auditLog.count({ where: { action: 'lead.status_change', entityId: leadId } }), 3);
});

test('Lead bearbeiten: Plausibilitäts-Normalisierung, Audit nur mit Feldnamen', async () => {
  const u = await office();
  const { leadId } = await makeLead();
  await updateLead(u, leadId, { name: 'Erika Musterfrau', email: 'neu@example.test', phone: '+49 511 7654321', licensePlate: 'h ab 123', vehicleKind: 'PKW', location: 'Laatzen' });
  const l = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  assert.equal(l.licensePlate, 'H-AB 123');
  assert.equal(l.licensePlateNorm, 'HAB123');
  assert.equal(l.phoneNorm, '05117654321');
  const a = await db.auditLog.findFirstOrThrow({ where: { action: 'lead.update', entityId: leadId } });
  assert.doesNotMatch(JSON.stringify(a), /Musterfrau|neu@example|7654321/);
  assert.match(a.summary ?? '', /name/);
});

test('Notizen: Autor/Zeit, Audit; leere Notiz abgelehnt', async () => {
  const u = await office();
  const { leadId } = await makeLead();
  await addLeadNote(u, leadId, { body: 'Rückruf vereinbart, 14 Uhr.' });
  await addLeadNote(u, leadId, { body: 'Nicht erreicht', kind: 'PHONE_CALL' });
  await assert.rejects(addLeadNote(u, leadId, { body: '   ' }));
  const l = await getLead(u, leadId);
  assert.equal(l.notes.length, 2);
  assert.equal(l.notes[0].author?.firstName, 'Test');
  await assert.rejects(db.$executeRawUnsafe(`INSERT INTO notes (id, body) VALUES ('x', 'hängt nirgends')`), /notes_exactly_one_target/, 'Notiz muss an genau einem Objekt hängen');
});

/* ------------------------------------------------------------ Umwandlung */

test('Umwandlung: Kunde + Fahrzeug + Fall in EINER Transaktion; Lead & Inquiry bleiben erhalten', async () => {
  const u = await office();
  const { leadId, inquiryId } = await makeLead();
  const r = await convertLead(u, leadId, convertInput());
  assert.match(r.caseNumber, /^ING-\d{4}-000001$/);
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  assert.equal(lead.status, 'CONVERTED');
  assert.equal(lead.convertedCaseId, r.caseId);
  assert.equal(lead.convertedCustomerId, r.customerId);
  assert.equal(lead.convertedVehicleId, r.vehicleId);
  assert.equal(lead.convertedById, u.id);
  assert.ok(lead.convertedAt);
  assert.ok(await db.inquiry.findUnique({ where: { id: inquiryId } }), 'Inquiry bleibt');
  const c = await getCase(u, r.caseNumber);
  assert.equal(c.status, 'NEW');
  assert.equal(c.customer.lastName, 'Mustermann');
  assert.equal(c.vehicle.licensePlate, 'H-AB 123');
  assert.equal(c.history.length, 1);
  // Erneute Umwandlung wird abgewiesen, nichts doppelt angelegt
  await assert.rejects(convertLead(u, leadId, convertInput()), /bereits umgewandelt/);
  assert.equal(await db.case.count(), 1);
  assert.equal(await db.customer.count(), 1);
  // Audit
  const actions = (await db.auditLog.findMany({ select: { action: true } })).map((a) => a.action);
  for (const a of ['customer.create', 'vehicle.create', 'case.create', 'lead.convert']) assert.ok(actions.includes(a), a);
});

test('Umwandlung: Startstatus folgt dem Anfragestatus (Termin vereinbart → Fall mit Termin)', async () => {
  const u = await office();
  const { leadId } = await makeLead();
  await changeLeadStatus(u, leadId, 'APPOINTMENT_SET');
  const r = await convertLead(u, leadId, convertInput());
  assert.equal((await getCase(u, r.caseNumber)).status, 'APPOINTMENT_SET');
});

test('Umwandlung mit bestehendem Kunden/Fahrzeug: keine Dublette, kein Überschreiben', async () => {
  const u = await office();
  const cust = await createCustomer(u, CUSTOMER);
  const veh = await createVehicle(u, cust.id, VEHICLE);
  const { leadId } = await makeLead();
  await updateLead(u, leadId, { name: 'Erika Mustermann', email: 'erika@example.test', phone: '0511 1234567', licensePlate: 'hab123', vehicleKind: 'PKW' });
  const hints = await findLeadDuplicates(u, leadId);
  assert.equal(hints.customers.length, 1, 'gleiche E-Mail/Telefon → Hinweis');
  assert.equal(hints.vehicles.length, 1, 'gleiches Kennzeichen (andere Schreibweise) → Hinweis');
  const r = await convertLead(u, leadId, { customer: { mode: 'existing', id: cust.id }, vehicle: { mode: 'existing', id: veh.id }, case: caseData() });
  assert.equal(r.customerId, cust.id);
  assert.equal(await db.customer.count(), 1);
  assert.equal(await db.vehicle.count(), 1);
  assert.equal((await db.customer.findUniqueOrThrow({ where: { id: cust.id } })).firstName, 'Erika', 'bestehende Daten unangetastet');
});

test('Rollback: scheitert der Fall nach Kunde+Fahrzeug, bleibt NICHTS zurück – auch die Nummer wird nicht verbraucht', async () => {
  const u = await office();
  const { leadId } = await makeLead();
  const bad = { ...convertInput(), case: caseSchema.parse({ assignedExpertId: 'gibt-es-nicht' }) };
  await assert.rejects(convertLead(u, leadId, bad), DomainError);
  assert.equal(await db.customer.count(), 0);
  assert.equal(await db.vehicle.count(), 0);
  assert.equal(await db.case.count(), 0);
  assert.equal(await db.caseStatusHistory.count(), 0);
  assert.equal(await db.caseCounter.count(), 0, 'Zähler wurde mit zurückgerollt');
  assert.equal((await db.lead.findUniqueOrThrow({ where: { id: leadId } })).status, 'NEW');
  assert.equal(await db.auditLog.count({ where: { action: { in: ['customer.create', 'vehicle.create', 'case.create', 'lead.convert'] } } }), 0, 'kein Audit für Nicht-Geschehenes');
  // und danach klappt es sauber mit Nummer 1
  const ok = await convertLead(u, leadId, convertInput());
  assert.match(ok.caseNumber, /-000001$/);
});

test('Gleichzeitige Umwandlung desselben Leads: genau eine gewinnt', async () => {
  const u = await office();
  const { leadId } = await makeLead();
  const results = await Promise.allSettled([convertLead(u, leadId, convertInput()), convertLead(u, leadId, convertInput()), convertLead(u, leadId, convertInput())]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(await db.case.count(), 1);
  assert.equal(await db.customer.count(), 1);
});

test('Spam/abgeschlossene Anfragen lassen sich nicht umwandeln', async () => {
  const u = await office();
  const { leadId } = await makeLead();
  await changeLeadStatus(u, leadId, 'SPAM');
  await assert.rejects(convertLead(u, leadId, convertInput()), DomainError);
});

/* ------------------------------------------------------------ Fallnummern */

test('Fallnummern: 25 parallele Anlagen → lückenlos 1…25, keine Doppelten', async () => {
  const u = await office();
  const cust = await createCustomer(u, CUSTOMER);
  const veh = await createVehicle(u, cust.id, VEHICLE);
  const made = await Promise.all(Array.from({ length: 25 }, () => createCase(u, { customerId: cust.id, vehicleId: veh.id, data: {} })));
  const numbers = made.map((c) => c.caseNumber);
  assert.equal(new Set(numbers).size, 25);
  const nums = numbers.map((n) => Number(n.split('-')[2])).sort((a, b) => a - b);
  assert.deepEqual(nums, Array.from({ length: 25 }, (_, i) => i + 1));
  assert.equal((await db.caseCounter.findFirstOrThrow()).lastValue, 25);
});

test('Fallnummern: neues Jahr beginnt wieder bei 1; Präfix/Stellen kommen aus den Einstellungen', async () => {
  const u = await office();
  const cust = await createCustomer(u, CUSTOMER);
  const veh = await createVehicle(u, cust.id, VEHICLE);
  const mk = (when: string) =>
    db.$transaction((tx) => createCaseTx(tx, u.id, { customerId: cust.id, vehicleId: veh.id, data: caseData(), now: new Date(when) }));
  assert.equal((await mk('2026-06-01T10:00:00Z')).caseNumber, 'ING-2026-000001');
  assert.equal((await mk('2026-12-31T23:30:00Z')).caseNumber, 'ING-2027-000001', 'Silvester-Nacht zählt in Berlin schon 2027');
  assert.equal((await mk('2026-06-02T10:00:00Z')).caseNumber, 'ING-2026-000002');
});

/* ------------------------------------------------------------ Fall: Status */

test('Fallstatus: zentrale Prüfung, Pflichtbegründung, Historie, closedAt, Wiederöffnen', async () => {
  const u = await office();
  const { leadId } = await makeLead();
  const r = await convertLead(u, leadId, convertInput());
  await assert.rejects(changeCaseStatus(u, r.caseId, 'REPORT_SENT'), DomainError, 'Überspringen verboten');
  await assert.rejects(changeCaseStatus(u, r.caseId, 'CANCELLED'), /Begründung/);
  await changeCaseStatus(u, r.caseId, 'APPOINTMENT_SET');
  await changeCaseStatus(u, r.caseId, 'CANCELLED', 'Kunde hat verkauft');
  let c = await db.case.findUniqueOrThrow({ where: { id: r.caseId } });
  assert.equal(c.status, 'CANCELLED');
  assert.ok(c.closedAt);
  assert.equal(c.cancelledReason, 'Kunde hat verkauft');
  await assert.rejects(changeCaseStatus(u, r.caseId, 'NEW'), /Begründung/, 'Wiederöffnen braucht Begründung');
  await changeCaseStatus(u, r.caseId, 'NEW', 'Doch Auftrag erteilt');
  c = await db.case.findUniqueOrThrow({ where: { id: r.caseId } });
  assert.equal(c.closedAt, null);
  assert.equal(c.cancelledReason, null);
  const hist = await db.caseStatusHistory.findMany({ where: { caseId: r.caseId }, orderBy: { createdAt: 'asc' } });
  assert.deepEqual(hist.map((h) => h.toStatus), ['NEW', 'APPOINTMENT_SET', 'CANCELLED', 'NEW']);
  assert.equal(hist[2].reason, 'Kunde hat verkauft');
  assert.equal(await db.auditLog.count({ where: { action: 'case.status_change', entityId: r.caseId } }), 3);
});

test('Aktivitäts-Feed: Historie, Notizen und Ereignisse in einer Zeitleiste', async () => {
  const u = await office();
  const { leadId } = await makeLead();
  const r = await convertLead(u, leadId, convertInput());
  await addCaseNote(u, r.caseId, { body: 'Termin telefonisch bestätigt' });
  await changeCaseStatus(u, r.caseId, 'APPOINTMENT_SET');
  const feed = await caseActivity(r.caseId, { includeNotes: true });
  const texts = feed.map((f) => f.text).join(' | ');
  assert.match(texts, /hat den Fall angelegt/);
  assert.match(texts, /Notiz hinzugefügt/);
  assert.match(texts, /„Neu“ auf „Termin vereinbart“/);
  assert.equal(feed[0].actor, 'Test Person');
  const noNotes = await caseActivity(r.caseId, { includeNotes: false });
  assert.doesNotMatch(noNotes.map((f) => f.text).join(' '), /Notiz/);
});

/* ------------------------------------------------------------ Suche, Seiten, Archiv */

test('Suche: Kennzeichen in jeder Schreibweise, Telefon, E-Mail, FIN, Fallnummer', async () => {
  const u = await office();
  const { leadId } = await makeLead();
  const r = await convertLead(u, leadId, convertInput());
  for (const q of ['H AB 123', 'H-AB 123', 'hab123']) assert.equal((await listVehicles(u, { q })).total, 1, `Fahrzeug ${q}`);
  assert.equal((await listVehicles(u, { q: 'WVWZZZ1KZ6W000001' })).total, 1, 'FIN');
  assert.equal((await listVehicles(u, { q: 'wvwzzz1k' })).total, 1, 'FIN-Teilstring');
  assert.equal((await listCustomers(u, { q: '0511 1234567' })).total, 1, 'Telefon');
  assert.equal((await listCustomers(u, { q: '+49 511 1234567' })).total, 1, 'Telefon +49');
  assert.equal((await listCustomers(u, { q: 'ERIKA@EXAMPLE' })).total, 1, 'E-Mail, Groß/Klein egal');
  assert.equal((await listCustomers(u, { q: 'hab123' })).total, 1, 'Kunde über Kennzeichen');
  assert.equal((await listCases(u, { q: r.caseNumber })).total, 1);
  assert.equal((await listCases(u, { q: r.caseNumber.slice(4) })).total, 1, 'Teil der Fallnummer');
  assert.equal((await listCases(u, { q: 'hab123' })).total, 1, 'Fall über Kennzeichen');
  assert.equal((await listLeads(u, { q: 'hab123' })).total, 0, 'Lead hatte kein Kennzeichen');
  assert.equal((await listLeads(u, { q: 'mustermann' })).total, 1);
  assert.equal((await listCases(u, { q: 'gibtsnicht' })).total, 0);
});

test('Listen: serverseitige Seiten (25), neueste zuerst, Filter', async () => {
  const u = await office();
  for (let i = 0; i < 30; i++) await makeLead({ name: `Person ${String(i).padStart(2, '0')}`, reason: i % 2 ? 'Unfall' : 'Parkschaden' });
  const p1 = await listLeads(u, { page: 1 });
  const p2 = await listLeads(u, { page: 2 });
  assert.equal(p1.total, 30);
  assert.equal(p1.rows.length, 25);
  assert.equal(p2.rows.length, 5);
  assert.ok(p1.rows[0].createdAt >= p1.rows[24].createdAt, 'neueste zuerst');
  assert.equal((await listLeads(u, { service: 'Unfall' })).total, 15);
  assert.equal((await listLeads(u, { status: 'NEW' })).total, 30);
  assert.equal((await listLeads(u, { status: 'CLOSED' })).total, 0);
  assert.equal((await listLeads(u, { from: '2099-01-01' })).total, 0);
  assert.equal((await listLeads(u, { place: 'hannov' })).total, 30);
  assert.equal((await listLeads(u, { mail: 'failed' })).total, 0);
});

test('Archivieren: Kunde mit offenem Fall gesperrt; Fall archivieren/wiederherstellen; Audit', async () => {
  const owner = await asAuthUser((await makeUser({ role: 'OWNER' })).user.id);
  const o = await office();
  const { leadId } = await makeLead();
  const r = await convertLead(o, leadId, convertInput());
  await assert.rejects(archiveCustomer(owner, r.customerId), /offene Fälle/);
  await assert.rejects(archiveCustomer(o, r.customerId), ForbiddenError, 'Büro darf nicht archivieren');
  await assert.rejects(archiveCase(o, r.caseId), ForbiddenError);
  await archiveCase(owner, r.caseId);
  assert.equal((await listCases(o, {})).total, 0, 'archivierter Fall verschwindet aus der Liste');
  assert.equal((await listCases(owner, { archiv: true })).total, 1);
  await assert.rejects(getCase(o, r.caseNumber), /nicht gefunden/);
  await changeCaseStatus(owner, r.caseId, 'CANCELLED', 'x').catch(() => {}); // archiviert → nicht ansprechbar ist ok
  await restoreCase(owner, r.caseId);
  await changeCaseStatus(owner, r.caseId, 'CANCELLED', 'Test');
  await archiveCustomer(owner, r.customerId);
  assert.equal((await listCustomers(o, {})).total, 0);
  await restoreCustomer(owner, r.customerId);
  assert.equal((await listCustomers(o, {})).total, 1);
  const acts = (await db.auditLog.findMany({ select: { action: true } })).map((a) => a.action);
  for (const a of ['case.archive', 'case.restore', 'customer.archive', 'customer.restore']) assert.ok(acts.includes(a), a);
  // Fahrzeug: mit offenem Fall gesperrt
  const c2 = await createCustomer(o, CUSTOMER);
  const v2 = await createVehicle(o, c2.id, { manufacturer: 'BMW', model: '320d' });
  await createCase(o, { customerId: c2.id, vehicleId: v2.id, data: {} });
  await assert.rejects(archiveVehicle(owner, v2.id), /offene Fälle/);
});

test('Kunde bearbeiten/Zuweisung: Audit mit Feldnamen; nur aktive Sachverständige zuweisbar', async () => {
  const o = await office();
  const owner = await asAuthUser((await makeUser({ role: 'OWNER' })).user.id);
  const expert = (await makeUser({ role: 'EXPERT' })).user;
  const nonExpert = (await makeUser({ role: 'OFFICE' })).user;
  const cust = await createCustomer(o, CUSTOMER);
  const veh = await createVehicle(o, cust.id, VEHICLE);
  const c = await createCase(o, { customerId: cust.id, vehicleId: veh.id, data: {} });
  await updateCustomer(o, cust.id, { ...CUSTOMER, phone: '0173 7279763' });
  const au = await db.auditLog.findFirstOrThrow({ where: { action: 'customer.update' } });
  assert.doesNotMatch(JSON.stringify(au), /7279763/);
  await assert.rejects(assignExpert(o, c.id, nonExpert.id), /nicht verfügbar/);
  await assignExpert(owner, c.id, expert.id);
  assert.equal((await db.case.findUniqueOrThrow({ where: { id: c.id } })).assignedExpertId, expert.id);
  assert.equal(await db.auditLog.count({ where: { action: 'case.assign' } }), 1);
  await assert.rejects(createVehicle(o, 'nope', VEHICLE), /nicht gefunden/);
  // Fahrzeug eines anderen Kunden kann nicht an fremden Fall gehängt werden
  const other = await createCustomer(o, { ...CUSTOMER, lastName: 'Anders', email: '' });
  await assert.rejects(createCase(o, { customerId: other.id, vehicleId: veh.id, data: {} }), /gehört nicht/);
});
