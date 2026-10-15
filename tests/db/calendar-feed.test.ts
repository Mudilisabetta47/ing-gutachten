import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { Role } from '@prisma/client';
import { db } from '@/server/db';
import { assertTestDb, resetDb, makeUser, asAuthUser, CUSTOMER, VEHICLE } from './helpers';
import { createCustomer } from '@/server/pipeline/customers';
import { createVehicle } from '@/server/pipeline/vehicles';
import { createCase } from '@/server/pipeline/cases';
import { createFeed, feedForToken, feedStatus, revokeFeed } from '@/server/calendar/feed';
import { GET } from '@/app/api/kalender/[token]/route';

assertTestDb();
beforeEach(async () => { await resetDb(); });
after(() => db.$disconnect());

async function seed() {
  const U = async (role: Role, extra: { email?: string } = {}) => asAuthUser((await makeUser({ role, ...extra })).user.id);
  const e1 = await U('EXPERT'), e2 = await U('EXPERT'), office = await U('OFFICE');
  const cust = await createCustomer(office, { ...CUSTOMER, lastName: 'Geheimname', street: 'Weg 1', postalCode: '30159' } as never);
  const veh = await createVehicle(office, cust.id, VEHICLE);
  const c1 = await createCase(office, { customerId: cust.id, vehicleId: veh.id, data: {} });
  const veh2 = await createVehicle(office, cust.id, { ...VEHICLE, licensePlate: 'H XY 999', vin: 'WVWZZZ1KZ6W000002' });
  const c2 = await createCase(office, { customerId: cust.id, vehicleId: veh2.id, data: {} });
  const now = Date.now();
  const mkA = (caseId: string, expertId: string, days: number, status: 'PLANNED' | 'CANCELLED' = 'PLANNED') =>
    db.appointment.create({ data: { caseId, expertId, kind: 'INSPECTION', status, startsAt: new Date(now + days * 86_400_000), endsAt: new Date(now + days * 86_400_000 + 3_600_000), location: 'Geheimstraße 1, Hannover' } });
  await mkA(c1.id, e1.id, 2); await mkA(c2.id, e2.id, 3); await mkA(c1.id, e1.id, 4, 'CANCELLED');
  return { e1, e2, office, c1, c2 };
}

test('Abo-Link: Schlüssel wird nur als SHA-256-Hash gespeichert, Neuerzeugen macht den alten ungültig', async () => {
  const { e1 } = await seed();
  const { token } = await createFeed(e1, { showDetails: false });
  const row = await db.calendarFeed.findUniqueOrThrow({ where: { userId: e1.id } });
  assert.equal(row.tokenHash, createHash('sha256').update(token).digest('hex'));
  assert.ok(!JSON.stringify(row).includes(token), 'kein Klartext in der Datenbank');
  assert.ok(await feedForToken(token));
  const { token: t2 } = await createFeed(e1, { showDetails: false });
  assert.equal(await feedForToken(token), null, 'alter Link ungültig');
  assert.ok(await feedForToken(t2));
  assert.equal((await feedStatus(e1.id)).exists, true);
});
test('Abo-Link: Widerruf, ungültige/unbekannte Schlüssel → null; Audit-Einträge', async () => {
  const { e1 } = await seed();
  const { token } = await createFeed(e1, { showDetails: false });
  await revokeFeed(e1);
  assert.equal(await feedForToken(token), null);
  for (const bad of ['', 'zu-kurz', 'x'.repeat(43), 'ä'.repeat(43)]) assert.equal(await feedForToken(bad), null);
  const actions = (await db.auditLog.findMany({ where: { actorId: e1.id }, orderBy: { createdAt: 'asc' } })).map((a) => a.action);
  assert.deepEqual(actions.filter((a) => a.startsWith('calendar.')), ['calendar.feed_created', 'calendar.feed_revoked']);
});
test('Abo-Inhalt folgt den Rechten: Sachverständiger nur eigene Termine, Büro alle; abgesagte als CANCELLED', async () => {
  const { e1, office, c2 } = await seed();
  const own = (await feedForToken((await createFeed(e1, { showDetails: false })).token))!;
  assert.equal((own.match(/BEGIN:VEVENT/g) ?? []).length, 2, 'e1: ein geplanter + ein abgesagter, nicht der Termin von e2');
  assert.match(own, /STATUS:CANCELLED/); assert.match(own, /STATUS:TENTATIVE/);
  assert.ok(!own.includes(c2.caseNumber), 'Fall eines anderen Sachverständigen fehlt');
  const all = (await feedForToken((await createFeed(office, { showDetails: false })).token))!;
  assert.equal((all.match(/BEGIN:VEVENT/g) ?? []).length, 3);
  assert.match(all, /Sachverständiger: Test Person/);
});
test('Abo-Inhalt: ohne Details keine Kundennamen/Orte; mit Details ja', async () => {
  const { e1, c1 } = await seed();
  const plain = (await feedForToken((await createFeed(e1, { showDetails: false })).token))!;
  assert.ok(!plain.includes('Geheimname') && !plain.includes('Geheimstraße') && !plain.includes('LOCATION'));
  assert.ok(plain.includes(`SUMMARY:Besichtigung (${c1.caseNumber})`));
  const rich = (await feedForToken((await createFeed(e1, { showDetails: true })).token))!;
  assert.match(rich, /Geheimname/); assert.match(rich, /Geheimstraße 1\\, Hannover/);
});
test('Abo-Link: deaktiviertes Konto oder entzogenes Terminrecht → kein Inhalt', async () => {
  const { e1 } = await seed();
  const { token } = await createFeed(e1, { showDetails: false });
  await db.user.update({ where: { id: e1.id }, data: { isActive: false } });
  assert.equal(await feedForToken(token), null);
  await db.user.update({ where: { id: e1.id }, data: { isActive: true } });
  await db.userPermission.createMany({ data: [{ userId: e1.id, permission: 'appointments.read.own', granted: false }] });
  assert.equal(await feedForToken(token), null, 'Recht entzogen');
});
test('Abo-Route: 404 bei unbekanntem Schlüssel, 200 text/calendar mit Schutz-Headern', async () => {
  const { e1 } = await seed();
  const r404 = await GET(new Request('http://localhost/api/kalender/' + 'a'.repeat(43) + '.ics'), { params: Promise.resolve({ token: 'a'.repeat(43) + '.ics' }) });
  assert.equal(r404.status, 404);
  const { token } = await createFeed(e1, { showDetails: false });
  const ok = await GET(new Request(`http://localhost/api/kalender/${token}.ics`), { params: Promise.resolve({ token: `${token}.ics` }) });
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('content-type') ?? '', /text\/calendar/);
  assert.match(ok.headers.get('cache-control') ?? '', /no-store/); assert.match(ok.headers.get('x-robots-tag') ?? '', /noindex/);
  assert.match(await ok.text(), /^BEGIN:VCALENDAR/);
  assert.ok((await feedStatus(e1.id)).lastUsedAt, 'letzter Abruf vermerkt');
});
