import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { db } from '@/server/db';
import { assertTestDb, resetDb, makeUser, asAuthUser, useTempStorage, JPEG_BYTES, CUSTOMER, VEHICLE } from './helpers';
import { defaultContent, normalizeContent, resolveText, validateReport, type ReportContent } from '@/lib/report';
import { pdfSafe } from '@/server/reports/pdf';
import { addComment, approveReport, archiveTextBlock, buildSnapshot, caseReports, createReport, getReport, listReports, listTextBlocks, markSent, reopenReport, reportPdf, requestChanges, resolveComment, saveReport, saveTextBlock, submitReport } from '@/server/pipeline/reports';
import { addCasePhoto } from '@/server/pipeline/media';
import { addDamage } from '@/server/pipeline/damages';
import { createCalculation, saveCalculation } from '@/server/pipeline/calculations';
import { addEntry } from '@/server/pipeline/valuation';
import { createCustomer } from '@/server/pipeline/customers';
import { createVehicle } from '@/server/pipeline/vehicles';
import { assignExpert, createCase, updateCase } from '@/server/pipeline/cases';
import { ForbiddenError } from '@/server/auth/errors';

assertTestDb();
let dir = '';
beforeEach(async () => { await resetDb(); dir = await useTempStorage(); });
after(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

/* ------------------------------------------------------------ rein */

test('Variablen: ersetzt bekannte, meldet fehlende und unbekannte – erfindet nichts', () => {
  const r = resolveText('Fall {{fall.nummer}} · {{ fahrzeug.fin }} · {{gibt.es.nicht}}', { 'fall.nummer': 'ING-1', 'fahrzeug.fin': null });
  assert.equal(r.text, 'Fall ING-1 · [fehlt: Fahrgestellnummer (FIN)] · [unbekannte Variable: gibt.es.nicht]');
  assert.deepEqual([r.missing, r.unknown], [['fahrzeug.fin'], ['gibt.es.nicht']]);
});

test('Standardkapitel: sinnvolle Gliederung, normalisieren schützt vor kaputten Daten', () => {
  const d = defaultContent();
  assert.deepEqual(d.chapters.map((c) => c.key), ['auftrag', 'fahrzeug', 'hergang', 'schaeden', 'kalkulation', 'bewertung', 'fotos', 'ergebnis', 'hinweise']);
  const n = normalizeContent({ chapters: [{ key: 'a', title: 'A', text: 5, auto: 'unsinn' }, { key: 'a', title: 'doppelt' }, null, { key: 'b' }] });
  assert.deepEqual(n.chapters.map((c) => [c.key, c.auto, c.text]), [['a', null, '5'], ['b', null, '']]);
  assert.equal(normalizeContent('kaputt').chapters.length, 9);
});

test('Prüfung: fehlende Variablen blockieren, fehlende Bausteine warnen', () => {
  const content: ReportContent = { chapters: [{ key: 'a', title: 'Auftrag', enabled: true, auto: null, text: '{{kunde.name}} {{fahrzeug.fin}}' }, { key: 'k', title: 'Kalkulation', enabled: true, auto: 'calculation', text: '' }, { key: 'x', title: 'Aus', enabled: false, auto: null, text: '{{fahrzeug.fin}}' }] };
  const issues = validateReport(content, { vars: { 'kunde.name': 'X' }, counts: { damages: 0, photos: 0, calcItems: 0, hasCalc: false, hasWbw: false, hasVin: false } });
  assert.deepEqual(issues.map((i) => i.level), ['error', 'warn']);
  assert.match(issues[0].text, /FIN|fahrzeug\.fin/);
  assert.equal(validateReport({ chapters: [] }, { vars: {}, counts: { damages: 0, photos: 0, calcItems: 0, hasCalc: false, hasWbw: false, hasVin: false } })[0].level, 'error');
});

test('PDF-Text: nicht darstellbare Zeichen werden ersetzt statt zum Absturz zu führen', () => {
  assert.equal(pdfSafe('Größe ≥ 5 €, Ü → ß „Ja“ ✓ 日本'), 'Größe >= 5 €, Ü -> ß „Ja“ ok ??');
});

/* ------------------------------------------------------------ Dienst */

async function world() {
  const office = await asAuthUser((await makeUser({ role: 'OFFICE' })).user.id);
  const owner = await asAuthUser((await makeUser({ role: 'OWNER' })).user.id);
  const reviewer = await asAuthUser((await makeUser({ role: 'REVIEWER' })).user.id);
  const e1 = await makeUser({ role: 'EXPERT' }), e2 = await makeUser({ role: 'EXPERT' });
  const exp1 = await asAuthUser(e1.user.id), exp2 = await asAuthUser(e2.user.id);
  const cust = await createCustomer(office, CUSTOMER);
  const veh = await createVehicle(office, cust.id, VEHICLE);
  const c = await createCase(office, { customerId: cust.id, vehicleId: veh.id, data: { insuranceName: 'Testversicherung', insuranceClaimNumber: 'SN-1' } });
  await assignExpert(owner, c.id, e1.user.id);
  await updateCase(office, c.id, { description: 'Heckschaden durch Auffahrunfall.', inspectionLocation: 'Hannover' });
  await db.case.update({ where: { id: c.id }, data: { status: 'REPORT_DRAFT' } });
  return { office, owner, reviewer, exp1, exp2, c, veh };
}
/** Alle Pflichtwerte setzen, damit eine Einreichung möglich ist. */
async function fillAll(w: Awaited<ReturnType<typeof world>>) {
  await db.case.update({ where: { id: w.c.id }, data: { damageDate: new Date('2026-09-30T00:00:00Z'), accidentDate: new Date('2026-09-30T00:00:00Z') } });
  await db.appointment.create({ data: { caseId: w.c.id, expertId: (await db.user.findFirstOrThrow({ where: { id: w.c.assignedExpertId ?? undefined } }).catch(() => null))?.id ?? (await db.case.findUniqueOrThrow({ where: { id: w.c.id } })).assignedExpertId!, kind: 'INSPECTION', status: 'DONE', startsAt: new Date('2026-10-02T09:00:00Z'), endsAt: new Date('2026-10-02T10:00:00Z'), location: 'Hannover' } });
  await addDamage(w.exp1, w.c.id, { partId: 'bumper_rear', view: 'REAR', kind: 'CURRENT', severity: 'HEAVY', repairKind: 'Ersetzen', damageType: 'Verformung' });
  const calc = await createCalculation(w.exp1, w.c.id);
  await saveCalculation(w.exp1, calc.id, { vatBp: 1900, minutesPerAw: 5, rateBodyCents: 13000, rateMechanicCents: null, rateElectricCents: null, ratePaintCents: 15000, partsMarkupBp: 0, paintMaterialBp: 0, items: [{ kind: 'PART', description: 'Stoßfänger hinten', quantityX100: 100, minutes: 0, unitPriceCents: 45000, discountBp: 0 }, { kind: 'LABOR', description: 'Aus-/Einbau', quantityX100: 100, minutes: 60, unitPriceCents: 0, discountBp: 0 }] });
  await addEntry(w.exp1, w.c.id, { type: 'REPLACEMENT_VALUE', amountCents: 1500000, taxMode: 'GROSS', source: 'MANUAL', referenceDate: '2026-10-01' });
  await db.vehicle.update({ where: { id: w.veh.id }, data: { vin: 'WVWZZZ1KZ6W000001', mileage: 84210, firstRegistration: new Date('2019-05-01T00:00:00Z') } });
  await addCasePhoto(w.exp1, w.c.id, { bytes: JPEG_BYTES }, { category: 'DAMAGE', title: 'Heck' });
}

test('Gutachten anlegen: Nummer GA-JJJJ-NNNNN, nur eines in Arbeit je Fall, Standardkapitel', async () => {
  const { exp1, c } = await world();
  const r = await createReport(exp1, c.id);
  assert.match(r.number, /^GA-\d{4}-\d{5}$/);
  assert.equal(r.status, 'DRAFT');
  assert.equal(normalizeContent(r.content).chapters.length, 9);
  await assert.rejects(createReport(exp1, c.id), /bereits ein Gutachten in Arbeit/);
  assert.equal((await caseReports(exp1, c.id)).length, 1);
});

test('Datenstand: Variablen und Tabellen kommen aus Fall, Fahrzeug, Schäden, Kalkulation und Bewertung', async () => {
  const w = await world(); await fillAll(w);
  const s = await buildSnapshot(w.exp1, w.c.id, 'GA-TEST');
  assert.equal(s.vars['fahrzeug.typ'], 'VW Golf');
  assert.equal(s.vars['fahrzeug.fin'], 'WVWZZZ1KZ6W000001');
  assert.equal(s.vars['schadennummer'], 'SN-1');
  assert.equal(s.vars['kalkulation.netto'], '580,00 €'.replace(/ /g, ' '));
  assert.match(String(s.vars['bewertung.wbw']), /15\.000,00/);
  assert.equal(s.vars['besichtigung.ort'], 'Hannover');
  assert.deepEqual([s.counts.damages, s.counts.photos, s.counts.hasCalc, s.counts.hasWbw], [1, 1, true, true]);
  assert.equal(s.damages[0].component, 'Stoßfänger hinten');
  assert.equal(s.calc?.items.length, 2);
});

test('Autosave mit Zähler: zwei Fenster überschreiben sich nicht', async () => {
  const { exp1, c } = await world();
  const r = await createReport(exp1, c.id);
  const content = normalizeContent(r.content);
  content.chapters[0].text = 'Neuer Text';
  const a = await saveReport(exp1, r.id, { title: 'Titel', content }, 0);
  assert.equal(a.saveCounter, 1);
  await assert.rejects(saveReport(exp1, r.id, { content }, 0), /zwischenzeitlich/);
  await saveReport(exp1, r.id, { content }, 1);
  assert.equal((await getReport(exp1, r.id)).content.chapters[0].text, 'Neuer Text');
});

test('Einreichen: offene Variablen blockieren; sonst In Prüfung, Fallstatus „Prüfung“, Stand eingefroren', async () => {
  const w = await world();
  const r = await createReport(w.exp1, w.c.id);
  await assert.rejects(submitReport(w.exp1, r.id), /offenen Punkte/);
  await fillAll(w);
  const res = await submitReport(w.exp1, r.id);
  assert.equal(res.caseStatusMoved, true);
  assert.equal((await db.case.findUniqueOrThrow({ where: { id: w.c.id } })).status, 'REVIEW');
  assert.equal((await db.report.findUniqueOrThrow({ where: { id: r.id } })).status, 'IN_REVIEW');
  const v = await db.reportVersion.findFirstOrThrow({ where: { reportId: r.id } });
  assert.equal(v.kind, 'SUBMIT');
  await assert.rejects(saveReport(w.exp1, r.id, { content: defaultContent() }), /nicht bearbeitet/);
  await assert.rejects(submitReport(w.exp1, r.id), /nicht .*eingereicht/);
});

test('Prüfung: Änderungen anfordern (mit Begründung) → Überarbeitung → erneut einreichen', async () => {
  const w = await world(); await fillAll(w);
  const r = await createReport(w.exp1, w.c.id);
  await submitReport(w.exp1, r.id);
  await assert.rejects(requestChanges(w.reviewer, r.id), /Kommentar oder eine Begründung/);
  await assert.rejects(requestChanges(w.exp1, r.id, 'x'), ForbiddenError);
  await addComment(w.reviewer, r.id, { chapterKey: 'schaeden', body: 'Bitte Schweregrad begründen.' });
  await requestChanges(w.reviewer, r.id);
  const after = await db.report.findUniqueOrThrow({ where: { id: r.id } });
  assert.deepEqual([after.status, after.revision], ['CHANGES_REQUESTED', 2]);
  assert.equal((await db.case.findUniqueOrThrow({ where: { id: w.c.id } })).status, 'REPORT_DRAFT');
  const view = await getReport(w.exp1, r.id);
  assert.equal(view.comments.length, 1);
  assert.equal(view.can.write, true);
  await resolveComment(w.exp1, view.comments[0].id, true);
  await saveReport(w.exp1, r.id, { content: view.content }, view.report.saveCounter);
  await submitReport(w.exp1, r.id);
  assert.equal((await db.reportVersion.count({ where: { reportId: r.id, kind: 'SUBMIT' } })), 2);
});

test('Freigabe: Vier-Augen-Prinzip, PDF wird erzeugt und im Fall abgelegt, Fallstatus „Freigegeben“', async () => {
  const w = await world(); await fillAll(w);
  const r = await createReport(w.exp1, w.c.id);
  await submitReport(w.exp1, r.id);
  await assert.rejects(approveReport(w.exp1, r.id), ForbiddenError, 'Gutachter darf nicht freigeben');
  await assert.rejects(approveReport(w.office, r.id), ForbiddenError, 'Büro darf nicht freigeben');
  await approveReport(w.reviewer, r.id);
  const rep = await db.report.findUniqueOrThrow({ where: { id: r.id } });
  assert.deepEqual([rep.status, rep.approvedById !== null], ['APPROVED', true]);
  assert.equal((await db.case.findUniqueOrThrow({ where: { id: w.c.id } })).status, 'APPROVED');
  const doc = await db.document.findFirstOrThrow({ where: { caseId: w.c.id, category: 'REPORT' } });
  assert.match(doc.title, /^Gutachten GA-/);
  const pdf = await reportPdf(w.reviewer, r.id);
  assert.equal(Buffer.from(pdf.bytes.slice(0, 5)).toString(), '%PDF-');
  assert.ok((await PDFDocument.load(pdf.bytes)).getPageCount() >= 1);
  await assert.rejects(approveReport(w.reviewer, r.id), /nicht in Prüfung/);
});

test('Selbstfreigabe: nur der Inhaber, und sie wird protokolliert', async () => {
  const w = await world(); await fillAll(w);
  await db.case.update({ where: { id: w.c.id }, data: { assignedExpertId: (await db.user.findFirstOrThrow({ where: { role: 'OWNER' } })).id } });
  const r = await createReport(w.owner, w.c.id);
  await submitReport(w.owner, r.id);
  const view = await getReport(w.owner, r.id);
  assert.equal(view.can.approve, true);
  await approveReport(w.owner, r.id);
  assert.ok(await db.auditLog.findFirst({ where: { action: 'report.approve', summary: { contains: 'Selbstfreigabe' } } }));
});

test('Versand wird nur erfasst (kein automatischer Versand); danach Fallstatus „Versendet“', async () => {
  const w = await world(); await fillAll(w);
  const r = await createReport(w.exp1, w.c.id);
  await submitReport(w.exp1, r.id);
  await assert.rejects(markSent(w.office, r.id, { to: 'x@y.de', channel: 'EMAIL' }), /Nur freigegebene/);
  await approveReport(w.reviewer, r.id);
  await assert.rejects(markSent(w.exp1, r.id, { to: 'x@y.de', channel: 'EMAIL' }), ForbiddenError);
  await assert.rejects(markSent(w.office, r.id, { to: '', channel: 'EMAIL' }), /Empfänger/);
  await markSent(w.office, r.id, { to: 'kunde@example.test', channel: 'EMAIL', note: 'per E-Mail' });
  const rep = await db.report.findUniqueOrThrow({ where: { id: r.id } });
  assert.deepEqual([rep.status, rep.sentTo, rep.sentChannel, rep.sentById !== null], ['SENT', 'kunde@example.test', 'EMAIL', true]);
  assert.equal((await db.case.findUniqueOrThrow({ where: { id: w.c.id } })).status, 'SENT');
});

test('Wieder öffnen: Begründung nötig, neue Fassung, PDFs bleiben erhalten', async () => {
  const w = await world(); await fillAll(w);
  const r = await createReport(w.exp1, w.c.id);
  await submitReport(w.exp1, r.id); await approveReport(w.reviewer, r.id);
  await assert.rejects(reopenReport(w.exp1, r.id, ''), /Begründung/);
  await reopenReport(w.exp1, r.id, 'Wertminderung nachgetragen');
  const rep = await db.report.findUniqueOrThrow({ where: { id: r.id } });
  assert.deepEqual([rep.status, rep.revision, rep.approvedAt], ['DRAFT', 2, null]);
  assert.equal(await db.document.count({ where: { caseId: w.c.id, category: 'REPORT' } }), 1, 'altes PDF bleibt');
  // neuer Entwurf ist erlaubt zu bearbeiten und erneut einzureichen
  await submitReport(w.exp1, r.id);
  assert.equal((await db.reportVersion.count({ where: { reportId: r.id } })), 3);
});

test('Entwurfs-PDF: gültiges PDF auch mit vielen Positionen (mehrere Seiten) und Fotos', async () => {
  const w = await world(); await fillAll(w);
  const calc = (await db.calculation.findFirstOrThrow({ where: { caseId: w.c.id } }));
  const items = Array.from({ length: 70 }, (_, i) => ({ kind: 'PART', description: `Position ${i + 1} mit einer längeren Bezeichnung zum Testen des Zeilenumbruchs im Dokument`, quantityX100: 100, minutes: 0, unitPriceCents: 1000 + i, discountBp: 0 }));
  await saveCalculation(w.exp1, calc.id, { vatBp: 1900, minutesPerAw: 5, rateBodyCents: 13000, rateMechanicCents: null, rateElectricCents: null, ratePaintCents: null, partsMarkupBp: 0, paintMaterialBp: 0, items });
  const r = await createReport(w.exp1, w.c.id);
  const pdf = await reportPdf(w.exp1, r.id);
  const doc = await PDFDocument.load(pdf.bytes);
  assert.ok(doc.getPageCount() >= 3, `Seiten: ${doc.getPageCount()}`);
  assert.equal(pdf.fileName, `${r.number}.pdf`);
});

test('Rechte: fremder Gutachter sieht nichts; Prüfer liest; Buchhaltung ohne Zugriff; Liste nach Rolle', async () => {
  const w = await world(); await fillAll(w);
  const r = await createReport(w.exp1, w.c.id);
  await assert.rejects(getReport(w.exp2, r.id), /nicht gefunden/);
  await assert.rejects(saveReport(w.exp2, r.id, { content: defaultContent() }), /nicht gefunden/);
  assert.equal((await getReport(w.reviewer, r.id)).can.write, false);
  const acc = await asAuthUser((await makeUser({ role: 'ACCOUNTING' })).user.id);
  await assert.rejects(getReport(acc, r.id));
  await assert.rejects(listReports(acc));
  assert.equal((await listReports(w.exp1)).total, 1);
  assert.equal((await listReports(w.exp2)).total, 0);
  assert.equal((await listReports(w.reviewer, { status: 'DRAFT' })).total, 1);
  assert.equal((await listReports(w.reviewer, { q: 'GA-' })).total, 1);
  assert.equal((await listReports(w.reviewer, { q: 'gibtsnicht' })).total, 0);
});

test('Textbausteine: nur mit Recht anlegen; unbekannte Variablen werden abgewiesen', async () => {
  const { owner, exp1 } = await world();
  await assert.rejects(saveTextBlock(exp1, null, { title: 'Test', body: 'x' }), ForbiddenError);
  await assert.rejects(saveTextBlock(owner, null, { title: 'Test', body: 'Hallo {{gibt.es.nicht}}' }), /Unbekannte Variable/);
  const b = await saveTextBlock(owner, null, { title: 'Schlussformel (Beispiel)', category: 'Allgemein', body: 'Das Gutachten wurde nach bestem Wissen erstellt. {{gutachter.name}}' });
  assert.equal((await listTextBlocks(exp1)).length, 1);
  await archiveTextBlock(owner, b.id);
  assert.equal((await listTextBlocks(exp1)).length, 0);
});
