import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '@/server/db';
import { assertTestDb, resetDb, makeUser, asAuthUser, CUSTOMER, VEHICLE } from './helpers';
import { addCustomerNote, anonymizeCustomer, archiveCustomer, createCustomer, restoreCustomer } from '@/server/pipeline/customers';
import { createVehicle } from '@/server/pipeline/vehicles';
import { createCase } from '@/server/pipeline/cases';
import { createInvoice, issueInvoice, saveInvoice, addPayment } from '@/server/pipeline/invoices';
import { setSetting } from '@/server/settings';
import { ForbiddenError } from '@/server/auth/errors';

assertTestDb();
beforeEach(resetDb);

test('DSGVO: Anonymisierung nur für archivierte Kunden ohne offene Vorgänge; Rechnungen bleiben unverändert', async () => {
  const owner = await asAuthUser((await makeUser({ role: 'OWNER' })).user.id);
  const office = await asAuthUser((await makeUser({ role: 'OFFICE' })).user.id);
  const acc = await asAuthUser((await makeUser({ role: 'ACCOUNTING' })).user.id);
  await setSetting('company', { name: 'Muster', street: 'S 1', postalCode: '30159', city: 'Hannover', phone: '', email: '', website: '', taxId: 'DE1', bank: '', footer: '' }, owner.id);
  const cust = await createCustomer(office, { ...CUSTOMER, street: 'Weg 1', postalCode: '30159' } as never);
  const veh = await createVehicle(office, cust.id, VEHICLE);
  const c = await createCase(office, { customerId: cust.id, vehicleId: veh.id, data: {} });
  await addCustomerNote(office, cust.id, { body: 'Hat Ärger mit der Versicherung' });

  await assert.rejects(anonymizeCustomer(owner, cust.id), /archiviert/, 'erst archivieren');
  await assert.rejects(archiveCustomer(owner, cust.id), /offene Fälle/);
  await db.case.update({ where: { id: c.id }, data: { status: 'CLOSED' } });
  const inv = await createInvoice(acc, { caseId: c.id });
  await saveInvoice(acc, inv.id, { recipient: { name: 'Erika Mustermann', street: 'Weg 1', postalCode: '30159', city: 'Hannover' }, items: [{ description: 'Honorar', quantityX100: 100, unitPriceCents: 10000, vatBp: 1900 }] });
  await issueInvoice(acc, inv.id);
  await assert.rejects(archiveCustomer(owner, cust.id), /offene Fälle/, 'Fall in Abrechnung');
  await addPayment(acc, inv.id, { amountCents: 11900, paidOn: new Date().toISOString().slice(0, 10) });
  await archiveCustomer(owner, cust.id);
  const draft = await db.invoice.create({ data: { customerId: cust.id, recipientName: 'Entwurf' } });
  await assert.rejects(anonymizeCustomer(owner, cust.id), /offene Rechnungen|Rechnungsentwürfe/, 'Entwurf blockiert');
  await db.invoice.delete({ where: { id: draft.id } });

  await assert.rejects(anonymizeCustomer(office, cust.id), ForbiddenError, 'nur mit Recht');
  await anonymizeCustomer(owner, cust.id);
  const after = await db.customer.findUniqueOrThrow({ where: { id: cust.id } });
  assert.deepEqual([after.firstName, after.lastName, after.email, after.phone, after.street, after.city], ['Anonymisiert', 'Anonymisiert', null, null, null, null]);
  assert.ok(after.anonymizedAt);
  assert.equal((await db.note.findFirstOrThrow({ where: { customerId: cust.id } })).body, '[anonymisiert]');
  const invAfter = await db.invoice.findUniqueOrThrow({ where: { id: inv.id } });
  assert.equal(invAfter.recipientName, 'Erika Mustermann', 'ausgestellte Rechnung bleibt (Aufbewahrungspflicht)');
  assert.ok(await db.case.findUnique({ where: { id: c.id } }), 'Fall bleibt');
  await assert.rejects(anonymizeCustomer(owner, cust.id), /bereits anonymisiert/);
  await assert.rejects(restoreCustomer(owner, cust.id), /Archivierter Kunde|nicht gefunden/, 'anonymisierte Kunden lassen sich nicht wiederherstellen');
  assert.equal(await db.auditLog.count({ where: { action: 'customer.anonymize' } }), 1);
});
