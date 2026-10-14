import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { db } from '@/server/db';
import { assertTestDb, resetDb, makeUser, asAuthUser, useTempStorage, JPEG_BYTES, PDF_BYTES, CUSTOMER, VEHICLE } from './helpers';
import { addCasePhoto, addDocument, listDocuments, readMedia } from '@/server/pipeline/media';
import { getCase, assignExpert, createCase } from '@/server/pipeline/cases';
import { createCustomer } from '@/server/pipeline/customers';
import { createVehicle } from '@/server/pipeline/vehicles';
import { createReport, reportPdf } from '@/server/pipeline/reports';
import { createDunning, createInvoice, dunningPdf, getInvoice, invoicePdf, invoicesCsv, issueInvoice, saveInvoice } from '@/server/pipeline/invoices';
import { exportCsv, analytics } from '@/server/pipeline/analytics';
import { globalSearch } from '@/server/pipeline/search';
import { caseCommunication } from '@/server/pipeline/communication';
import { caseTasks } from '@/server/pipeline/tasks';
import { listCalculations } from '@/server/pipeline/calculations';
import { setSetting } from '@/server/settings';

assertTestDb();
let dir = '';
beforeEach(async () => { await resetDb(); dir = await useTempStorage(); });
after(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

const ok = async (fn: () => Promise<unknown>) => { try { await fn(); return true; } catch { return false; } };

async function world() {
  const U = async (role: 'OWNER' | 'ADMIN' | 'OFFICE' | 'EXPERT' | 'ACCOUNTING' | 'REVIEWER' | 'CONTENT_MANAGER') => asAuthUser((await makeUser({ role })).user.id);
  const owner = await U('OWNER'), office = await U('OFFICE'), expertA = await U('EXPERT'), expertB = await U('EXPERT'), accounting = await U('ACCOUNTING'), reviewer = await U('REVIEWER'), content = await U('CONTENT_MANAGER');
  await setSetting('company', { name: 'Muster', street: 'S 1', postalCode: '30159', city: 'Hannover', phone: '', email: '', website: '', taxId: 'DE1', bank: '', footer: '' }, owner.id);
  const cust = await createCustomer(office, { ...CUSTOMER, street: 'Weg 1', postalCode: '30159' } as never);
  const veh = await createVehicle(office, cust.id, VEHICLE);
  const c = await createCase(office, { customerId: cust.id, vehicleId: veh.id, data: { inspectionLocation: 'Hannover' } });
  await assignExpert(owner, c.id, expertA.id);
  const photo = await addCasePhoto(office, c.id, { bytes: JPEG_BYTES }, { category: 'DAMAGE', title: 'Heck' });
  const doc = await addDocument(office, { caseId: c.id }, { bytes: PDF_BYTES }, { category: 'REGISTRATION', title: 'Fahrzeugschein' });
  const rep = await createReport(owner, c.id);
  const inv = await createInvoice(accounting, { caseId: c.id });
  await saveInvoice(accounting, inv.id, { recipient: { name: 'Kunde', street: 'S', postalCode: '1', city: 'C' }, items: [{ description: 'Honorar', quantityX100: 100, unitPriceCents: 10000, vatBp: 1900 }] });
  const issued = await issueInvoice(accounting, inv.id, { issueDate: '2026-01-01' });
  const dun = await createDunning(accounting, inv.id, {});
  const mediaPhoto = (await db.casePhoto.findUniqueOrThrow({ where: { id: photo.id } })).mediaId;
  const mediaDoc = doc.mediaId;
  return { owner, office, expertA, expertB, accounting, reviewer, content, c, mediaPhoto, mediaDoc, repId: rep.id, invId: issued.id, dunId: dun.id, cust };
}

type Row = Record<'owner' | 'office' | 'expertA' | 'expertB' | 'accounting' | 'reviewer' | 'content', boolean>;
const row = (v: string): Row => { const [a, b, c, d, e, f, g] = v.split('').map((x) => x === '1'); return { owner: a, office: b, expertA: c, expertB: d, accounting: e, reviewer: f, content: g }; };

test('Zugriffsmatrix: wer darf Fotos, Dokumente, PDFs, Rechnungen und Exporte abrufen – und wer nicht', async () => {
  const w = await world();
  const roles = ['owner', 'office', 'expertA', 'expertB', 'accounting', 'reviewer', 'content'] as const;
  const checks: [string, (u: typeof w.owner) => Promise<unknown>, Row][] = [
    // Reihenfolge der Ziffern: Inhaber, Büro, Gutachter (zugewiesen), Gutachter (fremd), Buchhaltung, Prüfer, Website-Rolle
    ['Foto abrufen', (u) => readMedia(u, w.mediaPhoto), row('1110010')],
    ['Dokument abrufen', (u) => readMedia(u, w.mediaDoc), row('1110010')],
    ['Dokumentenliste des Falls', (u) => listDocuments(u, { caseId: w.c.id }), row('1110010')],
    ['Gutachten-PDF', (u) => reportPdf(u, w.repId), row('1110010')],
    ['Rechnungs-PDF', (u) => invoicePdf(u, w.invId), row('1100100')],
    ['Mahnungs-PDF', (u) => dunningPdf(u, w.dunId), row('1100100')],
    ['Rechnung lesen', (u) => getInvoice(u, w.invId), row('1100100')],
    ['Kalkulationen des Falls', (u) => listCalculations(u, w.c.id), row('1110010')],
    ['Kommunikation des Falls', (u) => caseCommunication(u, w.c.id), row('1110010')],
    ['Aufgaben des Falls', (u) => caseTasks(u, w.c.id), row('1110110')],
    ['Fall laden', (u) => getCase(u, w.c.caseNumber), row('1110110')],
    ['Foto hochladen', (u) => addCasePhoto(u, w.c.id, { bytes: JPEG_BYTES }, { category: 'DAMAGE', title: 'x' }), row('1110000')],
    ['Dokument hochladen', (u) => addDocument(u, { caseId: w.c.id }, { bytes: PDF_BYTES }, { category: 'OTHER', title: 'x' }), row('1110000')],
    ['Daten-Export Fälle', (u) => exportCsv(u, 'faelle'), row('1000000')],
    ['Rechnungs-Export', (u) => invoicesCsv(u), row('1000100')],
    ['Auswertungen', (u) => analytics(u), row('1111110')],
  ];
  const wrong: string[] = [];
  for (const [name, fn, expected] of checks) {
    for (const r of roles) {
      const got = await ok(() => fn(w[r]));
      if (got !== expected[r]) wrong.push(`${name} · ${r}: erwartet ${expected[r] ? 'erlaubt' : 'verweigert'}, war ${got ? 'erlaubt' : 'verweigert'}`);
    }
  }
  assert.deepEqual(wrong, []);
});

test('Nicht zugewiesener Gutachter: fremde Fälle sind „nicht gefunden“, auch über die Suche', async () => {
  const w = await world();
  assert.equal((await globalSearch(w.expertB, w.c.caseNumber)).cases.length, 0, 'Suche verrät den Fall nicht');
  assert.equal((await globalSearch(w.expertA, w.c.caseNumber)).cases.length, 1, 'zugewiesener Gutachter findet ihn');
  await assert.rejects(getCase(w.expertB, w.c.caseNumber), /nicht gefunden/i);
  await assert.rejects(readMedia(w.expertB, w.mediaPhoto), /nicht gefunden|Forbidden|verboten/i);
});

test('Gelöschte/zurückgezogene Dateien sind nicht mehr abrufbar', async () => {
  const w = await world();
  await db.casePhoto.updateMany({ where: { mediaId: w.mediaPhoto }, data: { deletedAt: new Date() } });
  await db.media.update({ where: { id: w.mediaPhoto }, data: { deletedAt: new Date() } });
  await assert.rejects(readMedia(w.owner, w.mediaPhoto), /nicht gefunden/i);
});

test('Jeder Abruf eines Originals wird protokolliert (wer, wann, was)', async () => {
  const w = await world();
  const before = await db.auditLog.count({ where: { action: 'media.download' } });
  await readMedia(w.office, w.mediaDoc);
  assert.equal(await db.auditLog.count({ where: { action: 'media.download' } }), before + 1);
  const last = await db.auditLog.findFirstOrThrow({ where: { action: 'media.download' }, orderBy: { createdAt: 'desc' } });
  assert.equal(last.actorId, w.office.id);
});
