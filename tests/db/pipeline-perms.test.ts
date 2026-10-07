import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '@/server/db';
import { assertTestDb, resetDb, makeUser, asAuthUser, makeLead, CUSTOMER, VEHICLE } from './helpers';
import { changeLeadStatus, convertLead, listLeads, getLead, addLeadNote } from '@/server/pipeline/leads';
import { createCustomer, getCustomer, listCustomers, customerNotes, addCustomerNote, updateCustomer } from '@/server/pipeline/customers';
import { createVehicle, listVehicles, getVehicle, updateVehicle } from '@/server/pipeline/vehicles';
import { addCaseNote, assignExpert, caseNotes, changeCaseStatus, createCase, getCase, listCases, updateCase, archiveCase } from '@/server/pipeline/cases';
import { globalSearch } from '@/server/pipeline/search';
import { todayOverview, dashboardCounts } from '@/server/pipeline/today';
import { ForbiddenError } from '@/server/auth/errors';

assertTestDb();
beforeEach(resetDb);

async function world() {
  const office = await asAuthUser((await makeUser({ role: 'OFFICE' })).user.id);
  const owner = await asAuthUser((await makeUser({ role: 'OWNER' })).user.id);
  const expA = await makeUser({ role: 'EXPERT' });
  const expB = await makeUser({ role: 'EXPERT' });
  const accounting = await asAuthUser((await makeUser({ role: 'ACCOUNTING' })).user.id);
  const content = await asAuthUser((await makeUser({ role: 'CONTENT_MANAGER' })).user.id);

  const mk = async (last: string, plate: string, expert: string | null) => {
    const c = await createCustomer(office, { ...CUSTOMER, lastName: last, email: `${last.toLowerCase()}@example.test`, phone: `0511 99${last.length}0000` });
    const v = await createVehicle(office, c.id, { ...VEHICLE, licensePlate: plate, vin: '' });
    const k = await createCase(office, { customerId: c.id, vehicleId: v.id, data: { description: `Interner Hergang ${last}`, opposingInsurance: 'Gegner AG', lawyer: 'RA Streng', insuranceName: 'Meine Versicherung', insuranceClaimNumber: `SN-${last}` } });
    if (expert) await assignExpert(owner, k.id, expert);
    return { c, v, k };
  };
  const a = await mk('Alpha', 'H AB 111', expA.user.id);
  const b = await mk('Bravo', 'H CD 222', expB.user.id);
  const free = await mk('Charlie', 'H EF 333', null);
  return { office, owner, expA: await asAuthUser(expA.user.id), expB: await asAuthUser(expB.user.id), accounting, content, a, b, free };
}

test('Sachverständiger: sieht NUR eigene Fälle – Liste, Detail, Suche, Statuswechsel, Notiz', async () => {
  const w = await world();
  const own = await listCases(w.expA, {});
  assert.deepEqual(own.rows.map((r) => r.caseNumber), [w.a.k.caseNumber]);
  assert.equal((await getCase(w.expA, w.a.k.caseNumber)).caseNumber, w.a.k.caseNumber);
  await assert.rejects(getCase(w.expA, w.b.k.caseNumber), /nicht gefunden/, 'fremder Fall ist „nicht gefunden“, nicht „verboten“');
  await assert.rejects(getCase(w.expA, w.free.k.caseNumber), /nicht gefunden/, 'nicht zugewiesener Fall ebenso');
  await assert.rejects(changeCaseStatus(w.expA, w.b.k.id, 'APPOINTMENT_SET'), /nicht gefunden/);
  await assert.rejects(addCaseNote(w.expA, w.b.k.id, { body: 'Einbruch' }), /nicht gefunden/);
  await assert.rejects(updateCase(w.expA, w.b.k.id, {}), /nicht gefunden/);
  assert.equal((await db.case.findUniqueOrThrow({ where: { id: w.b.k.id } })).status, 'NEW', 'fremder Fall unverändert');

  // eigener Fall: fachliche Schritte ja, Verwaltungs-Schritte nein
  await changeCaseStatus(w.office, w.a.k.id, 'APPOINTMENT_SET');
  await changeCaseStatus(w.expA, w.a.k.id, 'INSPECTED');
  await changeCaseStatus(w.expA, w.a.k.id, 'IN_PROGRESS');
  await assert.rejects(changeCaseStatus(w.expA, w.a.k.id, 'CANCELLED', 'will nicht'), ForbiddenError);
  await changeCaseStatus(w.expA, w.a.k.id, 'REPORT_READY');
  await assert.rejects(changeCaseStatus(w.expA, w.a.k.id, 'REPORT_SENT'), ForbiddenError, 'Versand ist Büro-Sache');
  await addCaseNote(w.expA, w.a.k.id, { body: 'Besichtigt, Heck links' });
  assert.equal((await caseNotes(w.expA, w.a.k.id)).length, 1);
  await assert.rejects(assignExpert(w.expA, w.a.k.id, null), ForbiddenError, 'Zuweisen nur Leitung/Büro');
  await assert.rejects(createCase(w.expA, { customerId: w.a.c.id, vehicleId: w.a.v.id, data: {} }), ForbiddenError);
});

test('Sachverständiger: Kunden & Fahrzeuge nur im Umfang eigener Fälle; keine Anfragen', async () => {
  const w = await world();
  assert.deepEqual((await listCustomers(w.expA, {})).rows.map((r) => r.lastName), ['Alpha']);
  await assert.rejects(getCustomer(w.expA, w.b.c.id), /nicht gefunden/);
  assert.deepEqual((await listVehicles(w.expA, {})).rows.map((r) => r.licensePlate), ['H-AB 111']);
  await assert.rejects(getVehicle(w.expA, w.b.v.id), /nicht gefunden/);
  await assert.rejects(updateVehicle(w.expA, w.b.v.id, { manufacturer: 'X', model: 'Y' }), /nicht gefunden/);
  await updateVehicle(w.expA, w.a.v.id, { manufacturer: 'VW', model: 'Golf VIII', licensePlate: 'H AB 111' }); // eigenes Fahrzeug darf er ergänzen
  await assert.rejects(updateCustomer(w.expA, w.a.c.id, CUSTOMER), ForbiddenError, 'Kundenstammdaten ändert nur das Büro');
  assert.deepEqual(await customerNotes(w.expA, w.a.c.id), [], 'interne Kundennotizen nicht für Experten');
  await assert.rejects(listLeads(w.expA, {}), ForbiddenError);
  const { leadId } = await makeLead();
  await assert.rejects(getLead(w.expA, leadId), ForbiddenError);
  await assert.rejects(convertLead(w.expA, leadId, {} as never), ForbiddenError);
});

test('Website-Rolle (CONTENT_MANAGER): NULL Zugriff auf Kundendaten – überall serverseitig verweigert', async () => {
  const w = await world();
  const { leadId } = await makeLead();
  await assert.rejects(listLeads(w.content, {}), ForbiddenError);
  await assert.rejects(getLead(w.content, leadId), ForbiddenError);
  await assert.rejects(listCustomers(w.content, {}), ForbiddenError);
  await assert.rejects(getCustomer(w.content, w.a.c.id), ForbiddenError);
  await assert.rejects(listVehicles(w.content, {}), ForbiddenError);
  await assert.rejects(listCases(w.content, {}), ForbiddenError);
  await assert.rejects(getCase(w.content, w.a.k.caseNumber), ForbiddenError);
  await assert.rejects(globalSearch(w.content, 'Alpha'), ForbiddenError);
  assert.deepEqual(await dashboardCounts(w.content), { newLeads: null, failedMail: null, openCases: null, unassigned: null, customers: null, reportsOpen: null, followUpsDue: null });
  assert.deepEqual(await todayOverview(w.content), { newLeads: [], dueLeads: [], workCases: [], jobs: [] });
});

test('Buchhaltung: Kunden & Fallkontext ja – aber keine Unfall-Interna, Notizen, Fahrzeuge, Anfragen', async () => {
  const w = await world();
  const c = await getCase(w.accounting, w.a.k.caseNumber);
  assert.equal(c.internalsVisible, false);
  assert.equal(c.description, null, 'Unfallhergang bleibt verborgen');
  assert.equal(c.opposingInsurance, null);
  assert.equal(c.lawyer, null);
  assert.equal(c.insuranceName, 'Meine Versicherung', 'Abrechnungsrelevantes bleibt sichtbar');
  assert.equal(c.insuranceClaimNumber, 'SN-Alpha');
  assert.equal(c.customer.lastName, 'Alpha');
  await addCaseNote(w.office, w.a.k.id, { body: 'Intern: Kunde zahlungsunwillig' });
  assert.deepEqual(await caseNotes(w.accounting, w.a.k.id), []);
  await assert.rejects(addCaseNote(w.accounting, w.a.k.id, { body: 'x' }), ForbiddenError);
  await assert.rejects(changeCaseStatus(w.accounting, w.a.k.id, 'APPOINTMENT_SET'), ForbiddenError);
  await assert.rejects(updateCase(w.accounting, w.a.k.id, {}), ForbiddenError);
  await assert.rejects(listVehicles(w.accounting, {}), ForbiddenError);
  await assert.rejects(listLeads(w.accounting, {}), ForbiddenError);
  await assert.rejects(createCustomer(w.accounting, CUSTOMER), ForbiddenError);
  assert.equal((await listCustomers(w.accounting, {})).total, 3);
  assert.deepEqual(await customerNotes(w.accounting, w.a.c.id), []);
  await assert.rejects(addCustomerNote(w.accounting, w.a.c.id, { body: 'x' }), ForbiddenError);
});

test('Büro darf arbeiten, aber nicht archivieren/löschen; Leitung darf', async () => {
  const w = await world();
  await assert.rejects(archiveCase(w.office, w.a.k.id), ForbiddenError);
  await archiveCase(w.owner, w.a.k.id);
  await assert.rejects(addLeadNote(w.content, 'x', { body: 'x' }), ForbiddenError);
});

test('Einzelrechte (Overrides) wirken serverseitig: Büro ohne customers.write kann keinen Kunden anlegen', async () => {
  const w = await world();
  const u = await makeUser({ role: 'OFFICE' });
  await db.userPermission.create({ data: { userId: u.user.id, permission: 'customers.write', granted: false } });
  const restricted = await asAuthUser(u.user.id);
  await assert.rejects(createCustomer(restricted, CUSTOMER), ForbiddenError);
  assert.ok((await listCustomers(restricted, {})).total >= 3, 'Lesen bleibt');
  await assert.rejects(convertLead(restricted, (await makeLead()).leadId, {} as never), ForbiddenError, 'Umwandlung braucht auch customers.write');
  void w;
});

test('Globale Suche: gleiche Regeln wie die Seiten, gruppiert nach Fälle/Kunden/Fahrzeuge/Anfragen', async () => {
  const w = await world();
  await makeLead({ name: 'Alphonse Anfrage' });
  const partial = await globalSearch(w.office, 'alp');
  assert.equal(partial.cases.length, 1, 'Teilstring des Kundennamens findet auch den Fall');
  const byName = await globalSearch(w.office, 'Alpha');
  assert.equal(byName.customers.length, 1);
  assert.equal(byName.cases.length, 1);
  assert.equal(byName.leads.length, 0);
  assert.match(byName.cases[0].href, /^\/admin\/faelle\/ING-\d{4}-\d{6}\/$/);
  const plate = await globalSearch(w.office, 'h-cd 222');
  assert.equal(plate.vehicles.length, 1);
  assert.equal(plate.cases.length, 1);
  const lead = await globalSearch(w.office, 'Alphonse');
  assert.equal(lead.leads.length, 1);
  assert.match(lead.leads[0].href, /^\/admin\/anfragen\/.+\/$/);
  assert.equal((await globalSearch(w.office, 'a')).customers.length, 0, 'unter 2 Zeichen keine Suche');

  const exp = await globalSearch(w.expA, 'H-AB 111');
  assert.deepEqual(exp.vehicles.map((v) => v.label), ['H-AB 111']);
  assert.deepEqual(exp.cases.map((c) => c.id), [w.a.k.id], 'Experte findet fremde Fälle nicht – auch nicht über die Suche');
  assert.equal((await globalSearch(w.expA, 'Bravo')).customers.length, 0);
  const acc = await globalSearch(w.accounting, 'Alpha');
  assert.equal(acc.vehicles.length, 0);
  assert.equal(acc.leads.length, 0);
  assert.equal(acc.cases.length, 1);
});

test('Dashboard & Heute: echte Zahlen (0 bleibt 0), rollenbezogen', async () => {
  const w = await world();
  const empty = await asAuthUser((await makeUser({ role: 'OFFICE' })).user.id);
  await resetDb();
  const o = await asAuthUser((await makeUser({ role: 'OFFICE' })).user.id);
  assert.deepEqual(await dashboardCounts(o), { newLeads: 0, failedMail: 0, openCases: 0, unassigned: 0, customers: 0, reportsOpen: 0, followUpsDue: 0 });
  const { leadId } = await makeLead();
  await changeLeadStatus(o, leadId, 'CONTACTED');
  await makeLead({ name: 'Zweite Anfrage' });
  const d = await dashboardCounts(o);
  assert.equal(d.newLeads, 1);
  const t = await todayOverview(o);
  assert.equal(t.newLeads.length, 1);
  void w; void empty;
});
