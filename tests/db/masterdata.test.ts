import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '@/server/db';
import { assertTestDb, resetDb, makeUser, asAuthUser, CUSTOMER, VEHICLE } from './helpers';
import { createCustomer } from '@/server/pipeline/customers';
import { createVehicle } from '@/server/pipeline/vehicles';
import { assignExpert, createCase, listCases, updateCase } from '@/server/pipeline/cases';
import { archiveLocation, archiveOrganization, caseRefOptions, createOrganization, listOrganizations, saveLocation, updateOrganization } from '@/server/pipeline/masterdata';
import { caseChecklist } from '@/server/pipeline/case-checklist';
import { ForbiddenError } from '@/server/auth/errors';
import { DomainError } from '@/server/errors';

assertTestDb();
beforeEach(resetDb);

async function world() {
  const office = await asAuthUser((await makeUser({ role: 'OFFICE' })).user.id);
  const owner = await asAuthUser((await makeUser({ role: 'OWNER' })).user.id);
  const expert = await makeUser({ role: 'EXPERT' });
  const exp = await asAuthUser(expert.user.id);
  const content = await asAuthUser((await makeUser({ role: 'CONTENT_MANAGER' })).user.id);
  const cust = await createCustomer(office, CUSTOMER);
  const veh = await createVehicle(office, cust.id, VEHICLE);
  return { office, owner, exp, expertId: expert.user.id, content, cust, veh };
}

test('Stammdaten: Versicherung anlegen, bearbeiten, archivieren; Satz-Felder nur bei Werkstätten', async () => {
  const { office, owner } = await world();
  const ins = await createOrganization(owner, 'INSURANCE', { name: 'Beispiel Versicherung (Demo)', rateBodyCents: '12000' });
  assert.equal(ins.kind, 'INSURANCE');
  assert.equal(ins.rateBodyCents, null, 'Stundensätze gehören nur zu Werkstätten');
  const ws = await createOrganization(owner, 'WORKSHOP', { name: 'Werkstatt Nord (Demo)', rateBodyCents: '135,50', partsMarkupBp: '12,5' });
  assert.equal(ws.rateBodyCents, 13550);
  assert.equal(ws.partsMarkupBp, 1250);
  const keys = await updateOrganization(owner, ws.id, { name: 'Werkstatt Nord (Demo)', city: 'Hannover' });
  assert.ok(keys.includes('city'));
  await assert.rejects(createOrganization(owner, 'UNSINN', { name: 'Xx' }), DomainError);
  await assert.rejects(createOrganization(owner, 'LAWYER', { name: 'X' }), 'Name zu kurz');
  const l1 = await listOrganizations(office, { kind: 'INSURANCE' });
  assert.equal(l1.rows.length, 1);
  await archiveOrganization(owner, ins.id);
  assert.equal((await listOrganizations(office, { kind: 'INSURANCE' })).rows.length, 0);
  assert.equal((await listOrganizations(office, { kind: 'INSURANCE', archiv: true })).rows.length, 1);
});

test('Stammdaten: Schreiben nur mit Recht; Gutachter lesen nur, Redaktion sieht nichts', async () => {
  const { exp, content, office } = await world();
  await assert.rejects(createOrganization(exp, 'INSURANCE', { name: 'Nicht erlaubt' }), ForbiddenError);
  await listOrganizations(exp, { kind: 'INSURANCE' });
  await assert.rejects(listOrganizations(content, { kind: 'WORKSHOP' }), ForbiddenError);
  assert.deepEqual((await caseRefOptions(content)).insurances, []);
  assert.ok((await caseRefOptions(office)).locations.length >= 1, 'Standardstandort aus der Migration');
});

test('Standorte: ein Hauptstandort, Archivieren nur ohne Zuordnung', async () => {
  const { owner, office } = await world();
  const main = await db.location.findFirstOrThrow({ where: { isDefault: true } });
  const b = await saveLocation(owner, null, { name: 'Filiale Süd', isDefault: true });
  assert.equal((await db.location.count({ where: { isDefault: true } })), 1);
  assert.equal((await db.location.findUniqueOrThrow({ where: { id: main.id } })).isDefault, false);
  await assert.rejects(archiveLocation(owner, b.id), /Hauptstandort/);
  await assert.rejects(saveLocation(office, null, { name: 'Darf nicht' }), ForbiddenError);
  await db.user.update({ where: { id: office.id }, data: { locationId: main.id } });
  await saveLocation(owner, main.id, { name: main.name, isDefault: false });
  await assert.rejects(archiveLocation(owner, main.id), /zugeordnet|Mitarbeiter/);
});

test('Fall: Referenzen, Priorität, Schadenart und Listenfilter', async () => {
  const { office, owner, cust, veh, expertId } = await world();
  const ins = await createOrganization(owner, 'INSURANCE', { name: 'Filter Versicherung (Demo)' });
  const loc = await saveLocation(owner, null, { name: 'Filiale West' });
  const a = await createCase(office, { customerId: cust.id, vehicleId: veh.id, data: { priority: 'HIGH', claimType: 'LIABILITY', insuranceOrgId: ins.id, locationId: loc.id } });
  const b = await createCase(office, { customerId: cust.id, vehicleId: veh.id, data: {} });
  await assignExpert(owner, b.id, expertId);
  const by = async (f: Record<string, string>) => (await listCases(owner, f)).rows.map((r) => r.id).sort();
  assert.deepEqual(await by({ priority: 'HIGH' }), [a.id]);
  assert.deepEqual(await by({ claimType: 'LIABILITY' }), [a.id]);
  assert.deepEqual(await by({ insuranceOrgId: ins.id }), [a.id]);
  assert.deepEqual(await by({ locationId: loc.id }), [a.id]);
  assert.deepEqual(await by({ from: '2999-01-01' }), []);
  assert.equal((await by({})).length, 2);
  await updateCase(office, a.id, { priority: 'URGENT' });
  assert.deepEqual(await by({ priority: 'URGENT' }), [a.id]);
  await assert.rejects(createCase(office, { customerId: cust.id, vehicleId: veh.id, data: { insuranceOrgId: '00000000-0000-4000-8000-000000000000' } }), 'unbekannte Versicherung wird abgelehnt');
});

test('Fall: Fallnummer im neuen Format ING-JJJJ-NNNNN', async () => {
  const { office, cust, veh } = await world();
  const k = await createCase(office, { customerId: cust.id, vehicleId: veh.id, data: {} });
  assert.match(k.caseNumber, /^ING-\d{4}-\d{5}$/);
});

test('Checkliste: leitet sich aus echten Daten ab, Gutachter fremder Fälle sieht nichts', async () => {
  const { office, owner, exp, cust, veh, expertId } = await world();
  const k = await createCase(office, { customerId: cust.id, vehicleId: veh.id, data: { claimType: 'LIABILITY' } });
  const cl = await caseChecklist(office, k.id);
  assert.ok(cl.items.length >= 10);
  assert.equal(cl.items.find((i) => i.key === 'poa')?.state, 'open');
  assert.equal(cl.items.find((i) => i.key === 'customer')?.state, 'done');
  await assert.rejects(caseChecklist(exp, k.id), 'nicht zugewiesen → nicht gefunden');
  await assignExpert(owner, k.id, expertId);
  await caseChecklist(exp, k.id);
});
