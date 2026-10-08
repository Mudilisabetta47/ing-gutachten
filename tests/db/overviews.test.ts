import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '@/server/db';
import { assertTestDb, resetDb, makeUser, asAuthUser, CUSTOMER, VEHICLE } from './helpers';
import { analytics, archiveOverview, exportCsv } from '@/server/pipeline/analytics';
import { calculationsOverview, documentsOverview, inspectionsOverview, photosOverview, valuationsOverview } from '@/server/pipeline/overviews';
import { createCustomer } from '@/server/pipeline/customers';
import { createVehicle } from '@/server/pipeline/vehicles';
import { assignExpert, createCase } from '@/server/pipeline/cases';
import { createInvoice, issueInvoice, saveInvoice, addPayment } from '@/server/pipeline/invoices';
import { setSetting } from '@/server/settings';
import { ForbiddenError } from '@/server/auth/errors';
import { globalSearch } from '@/server/pipeline/search';
import { createTask } from '@/server/pipeline/tasks';

assertTestDb();
beforeEach(resetDb);

async function world() {
  const owner = await asAuthUser((await makeUser({ role: 'OWNER' })).user.id);
  const office = await asAuthUser((await makeUser({ role: 'OFFICE' })).user.id);
  const exp = await asAuthUser((await makeUser({ role: 'EXPERT' })).user.id);
  const exp2 = await asAuthUser((await makeUser({ role: 'EXPERT' })).user.id);
  const acc = await asAuthUser((await makeUser({ role: 'ACCOUNTING' })).user.id);
  const cm = await asAuthUser((await makeUser({ role: 'CONTENT_MANAGER' })).user.id);
  const cust = await createCustomer(office, { ...CUSTOMER, street: 'Weg 1', postalCode: '30159', city: 'Hannover' } as never);
  const veh = await createVehicle(office, cust.id, VEHICLE);
  const c1 = await createCase(office, { customerId: cust.id, vehicleId: veh.id, data: {} });
  const c2 = await createCase(office, { customerId: cust.id, vehicleId: veh.id, data: {} });
  await assignExpert(owner, c1.id, exp.id);
  await assignExpert(owner, c2.id, exp2.id);
  return { owner, office, exp, exp2, acc, cm, c1, c2, cust };
}

test('Kalkulationen & Bewertungen: Sichtbereich folgt den Rechten (alle / nur eigene / keine)', async () => {
  const w = await world();
  for (const c of [w.c1, w.c2]) {
    await db.calculation.create({ data: { caseId: c.id, version: 1, status: 'FINAL', finalizedAt: new Date(), vatBp: 1900, items: { create: [{ ref: `r-${c.id}`, position: 1, kind: 'PART', description: 'Teil', quantityX100: 100, unitPriceCents: 10000 }] } } });
    await db.valuationEntry.create({ data: { caseId: c.id, type: 'REPLACEMENT_VALUE', amountCents: 1500000, taxMode: 'GROSS', selected: true } });
    await db.valuationEntry.create({ data: { caseId: c.id, type: 'RESIDUAL_VALUE', amountCents: 300000, taxMode: 'GROSS', selected: false } });
  }
  const all = await calculationsOverview(w.office, {});
  assert.equal(all.total, 2);
  assert.equal(all.rows[0].netCents, 10000);
  assert.equal(all.rows[0].grossCents, 11900);
  assert.equal((await calculationsOverview(w.exp, {})).total, 1, 'Gutachter nur eigene');
  assert.equal((await calculationsOverview(w.exp, {})).rows[0].caseNumber, w.c1.caseNumber);
  assert.equal((await calculationsOverview(w.office, { q: w.c2.caseNumber })).total, 1);
  assert.equal((await calculationsOverview(w.office, { status: 'DRAFT' })).total, 0);
  await assert.rejects(calculationsOverview(w.acc, {}), ForbiddenError);
  assert.equal((await valuationsOverview(w.office, { types: ['REPLACEMENT_VALUE'] })).total, 2);
  assert.equal((await valuationsOverview(w.office, { types: ['RESIDUAL_VALUE'] })).total, 0, 'nur gewählte Werte');
  assert.equal((await valuationsOverview(w.exp2, { types: ['REPLACEMENT_VALUE'] })).total, 1);
  await assert.rejects(valuationsOverview(w.cm, { types: ['REPLACEMENT_VALUE'] }), ForbiddenError);
});

test('Besichtigungen, Dokumente, Fotos: nur Berechtigte, Gutachter nur eigene Fälle', async () => {
  const w = await world();
  const start = new Date(Date.now() + 86_400_000);
  await db.appointment.create({ data: { caseId: w.c1.id, expertId: w.exp.id, kind: 'INSPECTION', status: 'PLANNED', startsAt: start, endsAt: new Date(start.getTime() + 3_600_000) } });
  await db.appointment.create({ data: { caseId: w.c2.id, expertId: w.exp2.id, kind: 'REINSPECTION', status: 'PLANNED', startsAt: start, endsAt: new Date(start.getTime() + 3_600_000) } });
  assert.equal((await inspectionsOverview(w.office, { kind: 'INSPECTION' })).total, 1);
  assert.equal((await inspectionsOverview(w.office, { kind: 'REINSPECTION' })).total, 1);
  assert.equal((await inspectionsOverview(w.exp, { kind: 'REINSPECTION' })).total, 0);
  assert.equal((await inspectionsOverview(w.exp, { kind: 'INSPECTION', when: 'past' })).total, 0);
  await assert.rejects(inspectionsOverview(w.cm, { kind: 'INSPECTION' }), ForbiddenError);
  const m = await db.media.create({ data: { storageKey: 'k1', mimeType: 'application/pdf', sizeBytes: 100, sha256: 'a'.repeat(64) } });
  await db.document.create({ data: { mediaId: m.id, caseId: w.c2.id, title: 'Vollmacht', category: 'POWER_OF_ATTORNEY' } });
  assert.equal((await documentsOverview(w.office, {})).total, 1);
  assert.equal((await documentsOverview(w.exp, {})).total, 0, 'fremder Fall nicht sichtbar');
  assert.equal((await documentsOverview(w.exp2, {})).total, 1);
  assert.equal((await documentsOverview(w.office, { category: 'REGISTRATION' })).total, 0);
  await assert.rejects(documentsOverview(w.cm, {}), ForbiddenError);
  assert.equal((await photosOverview(w.office, {})).total, 0, 'ohne Fotos kein Eintrag');
});

test('Auswertungen: eigener Bereich, Umsatz nur mit Recht, Dauer zählt jeden Fall einmal', async () => {
  const w = await world();
  await setSetting('company', { name: 'Muster', street: 'S 1', postalCode: '30159', city: 'Hannover', phone: '', email: '', website: '', taxId: 'DE1', bank: '', footer: '' }, w.owner.id);
  const inv = await createInvoice(w.acc, { caseId: w.c1.id });
  await saveInvoice(w.acc, inv.id, { recipient: { name: 'Kunde', street: 'S', postalCode: '1', city: 'C' }, items: [{ description: 'Honorar', quantityX100: 100, unitPriceCents: 40000, vatBp: 1900 }] });
  await issueInvoice(w.acc, inv.id);
  await addPayment(w.acc, inv.id, { amountCents: 10000, paidOn: new Date().toISOString().slice(0, 10) });
  const a = await analytics(w.owner);
  assert.equal(a.cases!.byStatus.reduce((n, s) => n + s.count, 0), 2);
  assert.equal(a.money!.openCents, 47600 - 10000);
  assert.equal(a.money!.issuedCount, 1);
  assert.equal(a.money!.net.at(-1)!.cents, 40000);
  assert.equal(a.money!.paid.at(-1)!.cents, 10000);
  assert.ok(a.cases!.byExpert.length === 2);
  const mine = await analytics(w.exp);
  assert.equal(mine.cases!.byStatus.reduce((n, s) => n + s.count, 0), 1, 'nur eigene Fälle');
  assert.equal(mine.money, null, 'kein Umsatz ohne Recht');
  const acc = await analytics(w.acc);
  assert.equal(acc.cases, null);
  assert.equal(acc.money!.issuedCount, 1);
  await assert.rejects(analytics(w.cm), ForbiddenError);
  // abgeschlossener Fall mehrfach: zählt einmal
  await db.case.update({ where: { id: w.c1.id }, data: { status: 'CLOSED' } });
  for (let i = 0; i < 3; i++) await db.caseStatusHistory.create({ data: { caseId: w.c1.id, toStatus: 'CLOSED', actorId: w.owner.id } });
  assert.equal((await analytics(w.owner)).cases!.closedCount, 1);
});

test('Datenexport: nur mit Recht, Formeln entschärft, protokolliert; Archivübersicht', async () => {
  const w = await world();
  await db.customer.update({ where: { id: w.cust.id }, data: { company: '=SUMME(A1)' } });
  const csv = await exportCsv(w.owner, 'kunden');
  assert.ok(csv.startsWith('﻿Name;Firma;'));
  assert.ok(csv.includes("'=SUMME(A1)"), 'Formel entschärft');
  const cases = await exportCsv(w.owner, 'faelle');
  assert.equal(cases.trim().split('\r\n').length, 3);
  assert.ok(cases.includes(w.c1.caseNumber));
  assert.equal(await db.auditLog.count({ where: { action: 'data.export' } }), 2);
  await assert.rejects(exportCsv(w.office, 'faelle'), ForbiddenError);
  await assert.rejects(exportCsv(w.exp, 'kunden'), ForbiddenError);
  await db.case.update({ where: { id: w.c2.id }, data: { deletedAt: new Date() } });
  assert.deepEqual(await archiveOverview(w.owner), { archivedCases: 1, archivedCustomers: 0 });
  await assert.rejects(archiveOverview(w.exp), ForbiddenError);
});

test('Globale Suche: Rechnungen, Gutachten und Aufgaben nur im Sichtbereich', async () => {
  const w = await world();
  await setSetting('company', { name: 'Muster', street: 'S 1', postalCode: '30159', city: 'Hannover', phone: '', email: '', website: '', taxId: 'DE1', bank: '', footer: '' }, w.owner.id);
  const inv = await createInvoice(w.acc, { caseId: w.c1.id });
  await saveInvoice(w.acc, inv.id, { recipient: { name: 'Suchkunde GmbH', street: 'S', postalCode: '1', city: 'C' }, items: [{ description: 'Honorar', quantityX100: 100, unitPriceCents: 10000, vatBp: 1900 }] });
  const issued = await issueInvoice(w.acc, inv.id);
  await createTask(w.office, { title: 'Suchaufgabe Reifen', assigneeId: w.office.id });
  await createTask(w.exp2, { title: 'Suchaufgabe privat' });
  assert.equal((await globalSearch(w.acc, 'Suchkunde')).invoices.length, 1);
  assert.equal((await globalSearch(w.acc, issued.number!)).invoices[0].label, issued.number);
  assert.equal((await globalSearch(w.exp, 'Suchkunde')).invoices.length, 0, 'Gutachter: keine Rechnungen');
  assert.equal((await globalSearch(w.office, 'Suchaufgabe')).tasks.length, 2, 'Büro mit tasks.read.all sieht alle');
  assert.deepEqual((await globalSearch(w.exp2, 'Suchaufgabe')).tasks.map((t) => t.label), ['Suchaufgabe privat']);
  assert.equal((await globalSearch(w.exp, 'Suchaufgabe')).tasks.length, 0);
});
