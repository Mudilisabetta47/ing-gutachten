import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { db } from '@/server/db';
import { assertTestDb, resetDb, makeUser, asAuthUser, makeLead, makeAppointment, useTempStorage, JPEG_BYTES } from './helpers';
import { convertLead } from '@/server/pipeline/leads';
import { customerSchema, vehicleSchema, caseSchema } from '@/server/pipeline/schemas';
import { assignExpert } from '@/server/pipeline/cases';
import { finishInspection, startInspection } from '@/server/pipeline/inspection';
import { addCasePhoto } from '@/server/pipeline/media';
import { addDamage } from '@/server/pipeline/damages';
import { createCalculation, finalizeCalculation, saveCalculation } from '@/server/pipeline/calculations';
import { addEntry, selectEntry } from '@/server/pipeline/valuation';
import { approveReport, createReport, getReport, markSent, reportPdf, saveReport, submitReport } from '@/server/pipeline/reports';
import { addPayment, createInvoice, getInvoice, invoicePdf, issueInvoice, saveInvoice } from '@/server/pipeline/invoices';
import { createTask, completeTask } from '@/server/pipeline/tasks';
import { addCommunication } from '@/server/pipeline/communication';
import { setSetting } from '@/server/settings';
import { normalizeContent } from '@/lib/report';

assertTestDb();
let dir = '';
beforeEach(async () => { await resetDb(); dir = await useTempStorage(); });
after(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

const statusOf = async (id: string) => (await db.case.findUniqueOrThrow({ where: { id } })).status;

test('Gesamtablauf: Anfrage → Fall → Besichtigung → Schäden → Kalkulation → Bewertung → Gutachten → Prüfung → Freigabe → Versand → Rechnung → Zahlung → Abschluss', async () => {
  const owner = await asAuthUser((await makeUser({ role: 'OWNER' })).user.id);
  const office = await asAuthUser((await makeUser({ role: 'OFFICE' })).user.id);
  const e = await makeUser({ role: 'EXPERT' });
  const expert = await asAuthUser(e.user.id);
  const reviewer = await asAuthUser((await makeUser({ role: 'REVIEWER' })).user.id);
  const acc = await asAuthUser((await makeUser({ role: 'ACCOUNTING' })).user.id);
  await setSetting('company', { name: 'ING Gutachten (Demo)', street: 'Musterstr. 1', postalCode: '30159', city: 'Hannover', phone: '', email: '', website: '', taxId: 'Steuernr. (Demo)', bank: 'IBAN (Demo)', footer: '' }, owner.id);

  /* 1 Anfrage → Fall */
  const { leadId } = await makeLead({ name: 'Erika Mustermann', nachricht: 'Heckschaden nach Auffahrunfall' });
  const conv = await convertLead(office, leadId, {
    customer: { mode: 'new', data: customerSchema.parse({ firstName: 'Erika', lastName: 'Mustermann', email: 'erika@example.test', street: 'Weg 1', postalCode: '30159', city: 'Hannover' }) },
    vehicle: { mode: 'new', data: vehicleSchema.parse({ manufacturer: 'VW', model: 'Golf', licensePlate: 'H AB 123', vin: 'WVWZZZ1KZ6W000001', mileage: 84210, firstRegistration: '2019-05-01' }) },
    case: caseSchema.parse({ insuranceName: 'Beispiel-Versicherung (Demo)', insuranceClaimNumber: 'SN-1', damageDate: '2026-09-30', accidentDate: '2026-09-30', description: 'Heckschaden durch Auffahrunfall.', inspectionLocation: 'Hannover' }),
  });
  const caseId = conv.caseId;
  assert.equal(await statusOf(caseId), 'NEW');
  await assignExpert(owner, caseId, e.user.id);
  await createTask(office, { title: 'Besichtigungstermin abstimmen', caseId, assigneeId: e.user.id, dueDate: '2099-01-01' });
  await addCommunication(office, caseId, { body: 'Kunde ist nachmittags erreichbar', pinned: true });

  /* 2 Termin → Besichtigung */
  const appt = await makeAppointment(office, caseId, e.user.id);
  assert.equal(await statusOf(caseId), 'APPOINTMENT_SET');
  await startInspection(expert, appt.id);
  await addCasePhoto(expert, caseId, { bytes: JPEG_BYTES }, { category: 'DAMAGE', title: 'Heck' });
  await addDamage(expert, caseId, { partId: 'bumper_rear', view: 'REAR', kind: 'CURRENT', severity: 'HEAVY', repairKind: 'Ersetzen', damageType: 'Verformung' });
  await finishInspection(expert, appt.id);
  assert.equal(await statusOf(caseId), 'INSPECTED');

  /* 3 Kalkulation → Bewertung */
  const calc = await createCalculation(expert, caseId);
  await saveCalculation(expert, calc.id, { vatBp: 1900, minutesPerAw: 5, rateBodyCents: 13000, rateMechanicCents: null, rateElectricCents: null, ratePaintCents: 15000, partsMarkupBp: 0, paintMaterialBp: 0, items: [{ kind: 'PART', description: 'Stoßfänger hinten', quantityX100: 100, minutes: 0, unitPriceCents: 45000, discountBp: 0 }, { kind: 'LABOR', description: 'Aus-/Einbau', quantityX100: 100, minutes: 60, unitPriceCents: 0, discountBp: 0 }] });
  await finalizeCalculation(expert, calc.id);
  const wbw = await addEntry(expert, caseId, { type: 'REPLACEMENT_VALUE', amountCents: 1500000, taxMode: 'GROSS', source: 'MANUAL', referenceDate: '2026-10-01' });
  await selectEntry(expert, wbw.id);

  /* 4 Gutachten: schreiben → Prüfung → Freigabe → Versand */
  const rep = await createReport(expert, caseId);
  const view = await getReport(expert, rep.id);
  const content = normalizeContent(view.content);
  await saveReport(expert, rep.id, { title: null, content }, view.report.saveCounter);
  await submitReport(expert, rep.id);
  assert.equal(await statusOf(caseId), 'REVIEW');
  await assert.rejects(approveReport(expert, rep.id), /Berechtigung|Forbidden|verboten/i, 'Verfasser darf nicht selbst freigeben');
  await approveReport(reviewer, rep.id);
  assert.equal(await statusOf(caseId), 'APPROVED');
  const pdf = await reportPdf(office, rep.id);
  assert.ok((await PDFDocument.load(pdf.bytes)).getPageCount() >= 1);
  assert.equal(await db.document.count({ where: { caseId, category: 'REPORT' } }), 1, 'freigegebenes PDF liegt in der Akte');
  await markSent(office, rep.id, { to: 'erika@example.test', channel: 'EMAIL', note: 'außerhalb des Systems versendet' });
  assert.equal(await statusOf(caseId), 'SENT');

  /* 5 Rechnung → Zahlung → Abschluss */
  const inv = await createInvoice(acc, { caseId });
  await saveInvoice(acc, inv.id, { recipient: { name: 'Erika Mustermann', street: 'Weg 1', postalCode: '30159', city: 'Hannover' }, items: [{ description: 'Gutachterhonorar', quantityX100: 100, unitPriceCents: 45000, vatBp: 1900 }] });
  const issued = await issueInvoice(acc, inv.id);
  assert.equal(await statusOf(caseId), 'BILLING');
  assert.match(issued.number!, /^RE-\d{4}-\d{5}$/);
  assert.equal(issued.totals.grossCents, 53550);
  assert.ok((await PDFDocument.load((await invoicePdf(acc, inv.id)).bytes)).getPageCount() >= 1);
  const pay1 = await addPayment(acc, inv.id, { amountCents: 20000, paidOn: new Date().toISOString().slice(0, 10) });
  assert.equal(pay1.fullyPaid, false);
  assert.equal(await statusOf(caseId), 'BILLING');
  const pay2 = await addPayment(acc, inv.id, { amountCents: 33550, paidOn: new Date().toISOString().slice(0, 10) });
  assert.equal(pay2.caseClosed, true);
  assert.equal(await statusOf(caseId), 'CLOSED');
  assert.equal((await getInvoice(acc, inv.id)).state, 'PAID');

  /* 6 Nebenläufiges: Aufgabe erledigt, Verlauf vollständig und lückenlos protokolliert */
  const task = await db.task.findFirstOrThrow({ where: { caseId } });
  await completeTask(expert, task.id);
  const hist = (await db.caseStatusHistory.findMany({ where: { caseId }, orderBy: { createdAt: 'asc' } })).map((h) => h.toStatus);
  for (const s of ['NEW', 'APPOINTMENT_SET', 'INSPECTED', 'REVIEW', 'APPROVED', 'SENT', 'BILLING', 'CLOSED']) assert.ok(hist.includes(s as never), `Verlauf enthält ${s}`);
  const actions = new Set((await db.auditLog.findMany({ select: { action: true } })).map((a) => a.action));
  for (const a of ['lead.convert', 'inspection.finish', 'report.submit', 'report.approve', 'invoice.issue', 'payment.add', 'task.complete']) assert.ok(actions.has(a), `Audit enthält ${a}`);
});
