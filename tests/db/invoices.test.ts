import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { db } from '@/server/db';
import { assertTestDb, resetDb, makeUser, asAuthUser, CUSTOMER, VEHICLE } from './helpers';
import { addDays, csvCell, daysBetween, invoiceState, invoiceTotals, itemNet, nextDunningLevel, openCents } from '@/lib/invoice';
import { addPayment, archiveService, cancelDunning, cancelInvoice, caseInvoices, createDunning, createInvoice, deleteDraft, dunningOverview, dunningPdf, financeStats, getInvoice, invoicePdf, invoicesCsv, issueDunning, issueInvoice, listInvoices, listPayments, listServices, recipientOptions, reversePayment, saveInvoice, saveService } from '@/server/pipeline/invoices';
import { createCustomer } from '@/server/pipeline/customers';
import { createVehicle } from '@/server/pipeline/vehicles';
import { assignExpert, createCase } from '@/server/pipeline/cases';
import { createOrganization } from '@/server/pipeline/masterdata';
import { setSetting } from '@/server/settings';
import { ForbiddenError } from '@/server/auth/errors';

assertTestDb();
beforeEach(resetDb);

/* ------------------------------------------------------------ rein */

test('Rechnungssummen: MwSt je Satz auf die Summe, nicht je Zeile', () => {
  assert.equal(itemNet({ quantityX100: 150, unitPriceCents: 999 }), 1499);
  const t = invoiceTotals([{ quantityX100: 100, unitPriceCents: 333, vatBp: 1900 }, { quantityX100: 100, unitPriceCents: 333, vatBp: 1900 }, { quantityX100: 100, unitPriceCents: 1000, vatBp: 700 }, { quantityX100: 100, unitPriceCents: 500, vatBp: 0 }]);
  assert.deepEqual(t.groups, [{ vatBp: 1900, netCents: 666, vatCents: 127 }, { vatBp: 700, netCents: 1000, vatCents: 70 }, { vatBp: 0, netCents: 500, vatCents: 0 }]);
  assert.deepEqual([t.netCents, t.vatCents, t.grossCents], [2166, 197, 2363]);
});

test('Rechnungszustand: offen, teilweise, bezahlt, überfällig, storniert', () => {
  const base = { grossCents: 10000, paidCents: 0, dueDate: '2026-10-20' as string | null };
  assert.equal(invoiceState({ ...base, status: 'DRAFT' }, '2026-10-08'), 'DRAFT');
  assert.equal(invoiceState({ ...base, status: 'ISSUED' }, '2026-10-08'), 'OPEN');
  assert.equal(invoiceState({ ...base, status: 'ISSUED', paidCents: 4000 }, '2026-10-08'), 'PARTIAL');
  assert.equal(invoiceState({ ...base, status: 'ISSUED', paidCents: 10000 }, '2026-12-01'), 'PAID');
  assert.equal(invoiceState({ ...base, status: 'ISSUED' }, '2026-10-21'), 'OVERDUE');
  assert.equal(invoiceState({ ...base, status: 'ISSUED' }, '2026-10-20'), 'OPEN', 'am Fälligkeitstag noch nicht überfällig');
  assert.equal(invoiceState({ ...base, status: 'CANCELLED' }, '2026-12-01'), 'CANCELLED');
  assert.equal(openCents({ grossCents: 100, paidCents: 130 }), 0);
});

test('Datum, Mahnstufen, CSV-Schutz', () => {
  assert.equal(addDays('2026-10-25', 14), '2026-11-08');
  assert.equal(addDays('2026-12-25', 10), '2027-01-04');
  assert.equal(daysBetween('2026-10-01', '2026-10-08'), 7);
  assert.equal(nextDunningLevel([]), 1);
  assert.equal(nextDunningLevel([{ level: 1, status: 'ISSUED' }, { level: 2, status: 'CANCELLED' }]), 2);
  assert.equal(nextDunningLevel([{ level: 3, status: 'ISSUED' }]), null);
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell('+49 511'), "'+49 511");
  assert.equal(csvCell('a;b'), '"a;b"');
  assert.equal(csvCell('-12,50'), '-12,50', 'Zahlen bleiben Zahlen');
});

/* ------------------------------------------------------------ Dienst */

async function world(opts: { company?: boolean } = {}) {
  const owner = await asAuthUser((await makeUser({ role: 'OWNER' })).user.id);
  const office = await asAuthUser((await makeUser({ role: 'OFFICE' })).user.id);
  const acc = await asAuthUser((await makeUser({ role: 'ACCOUNTING' })).user.id);
  const exp = await asAuthUser((await makeUser({ role: 'EXPERT' })).user.id);
  if (opts.company !== false) await setSetting('company', { name: 'Gutachten Muster (Demo)', street: 'Musterstr. 1', postalCode: '30159', city: 'Hannover', phone: '', email: '', website: '', taxId: 'DE000000000 (Demo)', bank: 'IBAN DE00 0000 0000 0000 0000 00 (Demo)', footer: '' }, owner.id);
  const cust = await createCustomer(office, { ...CUSTOMER, street: 'Beispielweg 3', postalCode: '30159', city: 'Hannover' } as never);
  const veh = await createVehicle(office, cust.id, VEHICLE);
  const ins = await createOrganization(owner, 'INSURANCE', { name: 'Test-Versicherung (Demo)', street: 'Versicherungsallee 1', postalCode: '50667', city: 'Köln' });
  const c = await createCase(office, { customerId: cust.id, vehicleId: veh.id, data: { insuranceOrgId: ins.id, insuranceClaimNumber: 'SN-77' } });
  await db.case.update({ where: { id: c.id }, data: { status: 'SENT' } });
  return { owner, office, acc, exp, cust, c, ins };
}
const items = [{ description: 'Gutachterhonorar', quantityX100: 100, unit: null, unitPriceCents: 45000, vatBp: 1900, serviceId: null }, { description: 'Fahrtkosten', quantityX100: 1200, unit: 'km', unitPriceCents: 70, vatBp: 1900, serviceId: null }];
const draft = async (w: Awaited<ReturnType<typeof world>>, over: Record<string, unknown> = {}) => {
  const inv = await createInvoice(w.acc, { caseId: w.c.id });
  return saveInvoice(w.acc, inv.id, { recipient: { name: 'Erika Mustermann', street: 'Beispielweg 3', postalCode: '30159', city: 'Hannover' }, paymentTermsDays: 14, items, ...over });
};

test('Entwurf: Empfänger aus dem Fall (Kunde/Versicherung), Beträge werden berechnet', async () => {
  const w = await world();
  const opts = await recipientOptions(w.acc, w.c.id);
  assert.deepEqual(opts.map((o) => o.key), ['customer', 'insurance']);
  const inv = await createInvoice(w.acc, { caseId: w.c.id, recipientKey: 'insurance' });
  const d = await getInvoice(w.acc, inv.id);
  assert.deepEqual([d.status, d.number, d.recipient.name, d.recipient.city, d.recipient.ref], ['DRAFT', null, 'Test-Versicherung (Demo)', 'Köln', 'SN-77']);
  const s = await saveInvoice(w.acc, inv.id, { recipient: { name: 'X', street: 'S', postalCode: '1', city: 'C' }, items });
  assert.deepEqual([s.totals.netCents, s.totals.vatCents, s.totals.grossCents], [45840, 8710, 54550]);
});

test('Ausstellen: Pflichtangaben, lückenlose Nummer RE-JJJJ-NNNNN, Fälligkeit, Fallstatus „Abrechnung“', async () => {
  const w = await world({ company: false });
  const d = await draft(w);
  await assert.rejects(issueInvoice(w.acc, d.id), /Steuernummer|Unternehmen/);
  await setSetting('company', { name: 'Muster', street: 'Musterstr. 1', postalCode: '30159', city: 'Hannover', phone: '', email: '', website: '', taxId: 'DE1', bank: '', footer: '' }, w.owner.id);
  const a = await issueInvoice(w.acc, d.id, { issueDate: '2026-10-08' });
  assert.match(a.number!, /^RE-2026-\d{5}$/);
  assert.deepEqual([a.status, a.issueDate, a.dueDate, a.totals.grossCents], ['ISSUED', '2026-10-08', '2026-10-22', 54550]);
  assert.equal((await db.case.findUniqueOrThrow({ where: { id: w.c.id } })).status, 'BILLING');
  const b = await issueInvoice(w.acc, (await draft(w)).id, { issueDate: '2026-10-09' });
  assert.equal(Number(b.number!.slice(-5)), Number(a.number!.slice(-5)) + 1, 'lückenlos');
  await assert.rejects(issueInvoice(w.acc, a.id), /bereits ausgestellt/);
  const empty = await createInvoice(w.acc, { caseId: w.c.id });
  await assert.rejects(issueInvoice(w.acc, empty.id), /Position/);
  const noAddr = await draft(w, { recipient: { name: 'Nur Name' } });
  await assert.rejects(issueInvoice(w.acc, noAddr.id), /Anschrift/);
});

test('Ausgestellte Rechnung ist unveränderlich – auch direkt in der Datenbank', async () => {
  const w = await world();
  const inv = await issueInvoice(w.acc, (await draft(w)).id);
  await assert.rejects(saveInvoice(w.acc, inv.id, { recipient: { name: 'Neu' }, items }), /nicht mehr geändert/);
  await assert.rejects(deleteDraft(w.acc, inv.id), /Entwürfe/);
  await assert.rejects(db.invoice.update({ where: { id: inv.id }, data: { grossCents: 1, netCents: 1, vatCents: 0 } }), /unveraenderlich/);
  await assert.rejects(db.invoice.update({ where: { id: inv.id }, data: { recipientName: 'Fälschung' } }), /unveraenderlich/);
  await assert.rejects(db.invoice.delete({ where: { id: inv.id } }), /nicht geloescht/);
  await assert.rejects(db.invoiceItem.update({ where: { id: (await db.invoiceItem.findFirstOrThrow({ where: { invoiceId: inv.id } })).id }, data: { unitPriceCents: 1 } }), /unveraenderlich/);
  await assert.rejects(db.invoiceItem.create({ data: { invoiceId: inv.id, position: 9, description: 'x', unitPriceCents: 1 } }), /unveraenderlich/);
});

test('Entwurf löschen, ausgestellte nur stornieren (mit Begründung)', async () => {
  const w = await world();
  const d = await draft(w);
  await deleteDraft(w.acc, d.id);
  assert.equal(await db.invoice.count(), 0);
  const inv = await issueInvoice(w.acc, (await draft(w)).id);
  await assert.rejects(cancelInvoice(w.acc, inv.id, ''), /Begründung/);
  await cancelInvoice(w.acc, inv.id, 'Falscher Empfänger');
  const c = await getInvoice(w.acc, inv.id);
  assert.deepEqual([c.status, c.state, c.cancelReason], ['CANCELLED', 'CANCELLED', 'Falscher Empfänger']);
  await assert.rejects(addPayment(w.acc, inv.id, { amountCents: 100, paidOn: '2026-10-01' }), /ausgestellten/);
  await assert.rejects(db.invoice.update({ where: { id: inv.id }, data: { cancelReason: 'anders' } }), /unveraenderlich/);
});

test('Zahlungen: Teilzahlung, Überzahlung abgewiesen, Vollzahlung schließt den Fall, Storno öffnet ihn wieder', async () => {
  const w = await world();
  const inv = await issueInvoice(w.acc, (await draft(w)).id);
  await assert.rejects(addPayment(w.exp, inv.id, { amountCents: 100, paidOn: '2026-10-08' }), ForbiddenError);
  await assert.rejects(addPayment(w.acc, inv.id, { amountCents: 0, paidOn: '2026-10-08' }), /größer 0/);
  await assert.rejects(addPayment(w.acc, inv.id, { amountCents: 100, paidOn: '2099-01-01' }), /Zukunft/);
  await assert.rejects(addPayment(w.acc, inv.id, { amountCents: 54551, paidOn: '2026-10-08' }), /übersteigt/);
  const p1 = await addPayment(w.acc, inv.id, { amountCents: 20000, paidOn: '2026-10-08', method: 'BANK', reference: 'Überweisung 1' });
  assert.equal(p1.fullyPaid, false);
  assert.equal((await getInvoice(w.acc, inv.id)).state, 'PARTIAL');
  const p2 = await addPayment(w.acc, inv.id, { amountCents: 34550, paidOn: '2026-10-08' });
  assert.deepEqual([p2.fullyPaid, p2.caseClosed], [true, true]);
  assert.equal((await db.case.findUniqueOrThrow({ where: { id: w.c.id } })).status, 'CLOSED');
  assert.equal((await getInvoice(w.acc, inv.id)).state, 'PAID');
  await assert.rejects(cancelInvoice(w.acc, inv.id, 'x'), /Zahlungen/);
  await assert.rejects(db.payment.update({ where: { id: p1.payment.id }, data: { amountCents: 1 } }), /unveraenderlich/);
  await assert.rejects(db.payment.delete({ where: { id: p1.payment.id } }), /nicht geloescht/);
  await reversePayment(w.acc, p2.payment.id, 'Fehlbuchung');
  assert.equal((await getInvoice(w.acc, inv.id)).openCents, 34550);
  assert.equal((await db.case.findUniqueOrThrow({ where: { id: w.c.id } })).status, 'BILLING', 'Fall wieder in der Abrechnung');
  await assert.rejects(reversePayment(w.acc, p2.payment.id, 'nochmal'), /bereits storniert/);
  assert.equal((await listPayments(w.acc)).total, 2);
});

test('Mahnwesen: nur überfällig, Stufen 1–3, kein Doppelentwurf, nichts automatisch', async () => {
  const w = await world();
  const inv = await issueInvoice(w.acc, (await draft(w)).id, { issueDate: '2026-08-01' });
  assert.equal((await getInvoice(w.acc, inv.id)).state, 'OVERDUE');
  await assert.rejects(createDunning(w.exp, inv.id, {}), ForbiddenError);
  const n1 = await createDunning(w.acc, inv.id, { feeCents: 500 });
  assert.equal(n1.level, 1);
  assert.match(n1.text ?? '', new RegExp(inv.number!));
  await assert.rejects(createDunning(w.acc, inv.id, {}), /bereits einen Mahnungsentwurf/);
  await issueDunning(w.acc, n1.id);
  await assert.rejects(issueDunning(w.acc, n1.id), /bereits ausgestellt/);
  const n2 = await createDunning(w.acc, inv.id, { feeCents: 500, interestCents: 120 });
  assert.equal(n2.level, 2);
  await cancelDunning(w.acc, n2.id);
  const n2b = await createDunning(w.acc, inv.id, {});
  assert.equal(n2b.level, 2, 'stornierte Stufen zählen nicht');
  await issueDunning(w.acc, n2b.id);
  const n3 = await createDunning(w.acc, inv.id, {});
  await issueDunning(w.acc, n3.id);
  await assert.rejects(createDunning(w.acc, inv.id, {}), /höchste Mahnstufe/);
  const ov = await dunningOverview(w.acc);
  assert.equal(ov.length, 1);
  assert.equal(ov[0].nextLevel, null);
  const fresh = await issueInvoice(w.acc, (await draft(w)).id);
  await assert.rejects(createDunning(w.acc, fresh.id, {}), /noch nicht überfällig/);
  await addPayment(w.acc, inv.id, { amountCents: 54550, paidOn: '2026-10-08' });
  await assert.rejects(createDunning(w.acc, inv.id, {}), /offene/);
});

test('Listen, Kennzahlen, CSV-Export, PDF', async () => {
  const w = await world();
  const a = await issueInvoice(w.acc, (await draft(w)).id, { issueDate: '2026-08-01' });
  const b = await issueInvoice(w.acc, (await draft(w)).id, { issueDate: new Date().toISOString().slice(0, 10) });
  await draft(w);
  await addPayment(w.acc, b.id, { amountCents: 10000, paidOn: new Date().toISOString().slice(0, 10) });
  assert.equal((await listInvoices(w.acc)).total, 3);
  assert.equal((await listInvoices(w.acc, { status: 'OVERDUE' })).rows.length, 1);
  assert.equal((await listInvoices(w.acc, { status: 'DRAFT' })).rows.length, 1);
  assert.equal((await listInvoices(w.acc, { q: a.number! })).rows.length, 1);
  const st = await financeStats(w.acc);
  assert.deepEqual([st.openCount, st.overdueCount, st.drafts, st.open, st.overdue], [2, 1, 1, 54550 + 44550, 54550]);
  assert.equal(st.paidMonth > 0, true);
  const csv = await invoicesCsv(w.acc);
  assert.ok(csv.startsWith('﻿Rechnungsnummer;Status;'));
  assert.equal(csv.trim().split('\r\n').length, 4);
  await assert.rejects(invoicesCsv(w.exp), ForbiddenError);
  const pdf = await invoicePdf(w.acc, a.id);
  assert.equal(pdf.fileName, `${a.number}.pdf`);
  assert.ok((await PDFDocument.load(pdf.bytes)).getPageCount() >= 1);
  const dn = await createDunning(w.acc, a.id, { feeCents: 500 });
  assert.ok((await PDFDocument.load((await dunningPdf(w.acc, dn.id)).bytes)).getPageCount() >= 1);
  assert.equal((await caseInvoices(w.acc, w.c.id)).length, 3);
});

test('Rechte: Gutachter keinerlei Zugriff; Büro liest, Buchhaltung schreibt', async () => {
  const w = await world();
  const d = await draft(w);
  await assert.rejects(getInvoice(w.exp, d.id), ForbiddenError);
  await assert.rejects(listInvoices(w.exp), ForbiddenError);
  await assert.rejects(createInvoice(w.exp, { caseId: w.c.id }), ForbiddenError);
  assert.equal((await getInvoice(w.office, d.id)).id, d.id);
  await assert.rejects(issueInvoice(w.office, d.id), ForbiddenError);
  assert.equal((await issueInvoice(w.acc, d.id)).status, 'ISSUED');
});

test('Leistungskatalog: eigene Preise, keine Vorgaben', async () => {
  const w = await world();
  assert.equal((await listServices(w.acc)).length, 0);
  const s = await saveService(w.acc, null, { name: 'Gutachterhonorar (Demo)', unitPriceCents: 45000, vatBp: 1900, unit: 'pauschal' });
  assert.equal((await listServices(w.acc)).length, 1);
  await assert.rejects(saveService(w.exp, null, { name: 'x', unitPriceCents: 1, vatBp: 0 }), ForbiddenError);
  await archiveService(w.acc, s.id);
  assert.equal((await listServices(w.acc)).length, 0);
});
