import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { db } from '@/server/db';
import { assertTestDb, resetDb, makeUser, asAuthUser, makeLead, makeAppointment, useTempStorage, JPEG_BYTES, PDF_BYTES, CUSTOMER, VEHICLE } from './helpers';
import { localDriver } from '@/server/storage/local';
import { getStorage, newStorageKey } from '@/server/storage';
import { addCasePhoto, addDocument, deleteCasePhoto, deleteDocument, listCasePhotos, listDocuments, putMedia, readMedia, updateCasePhoto } from '@/server/pipeline/media';
import { caseAppointments, createAppointment, listAppointments, rescheduleAppointment, setAppointmentStatus } from '@/server/pipeline/appointments';
import { finishInspection, startInspection, updateInspection } from '@/server/pipeline/inspection';
import { addDamage, deleteDamage, listDamages, updateDamage } from '@/server/pipeline/damages';
import { createCustomer } from '@/server/pipeline/customers';
import { createVehicle } from '@/server/pipeline/vehicles';
import { assignExpert, createCase } from '@/server/pipeline/cases';
import { convertLead } from '@/server/pipeline/leads';
import { persistInquiry, storeInquiryFiles, markNotification } from '@/server/pipeline/intake';
import { customerSchema, vehicleSchema, caseSchema } from '@/server/pipeline/schemas';
import { setSetting } from '@/server/settings';
import { DomainError } from '@/server/errors';
import { ForbiddenError } from '@/server/auth/errors';

assertTestDb();
let dir = '';
beforeEach(async () => {
  await resetDb();
  dir = await useTempStorage();
});
after(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

const countFiles = async (d: string): Promise<number> => {
  let n = 0;
  for (const e of await readdir(d, { withFileTypes: true })) n += e.isDirectory() ? await countFiles(path.join(d, e.name)) : 1;
  return n;
};

async function world() {
  const office = await asAuthUser((await makeUser({ role: 'OFFICE' })).user.id);
  const owner = await asAuthUser((await makeUser({ role: 'OWNER' })).user.id);
  const eA = await makeUser({ role: 'EXPERT' });
  const eB = await makeUser({ role: 'EXPERT' });
  const expA = await asAuthUser(eA.user.id);
  const expB = await asAuthUser(eB.user.id);
  const accounting = await asAuthUser((await makeUser({ role: 'ACCOUNTING' })).user.id);
  const content = await asAuthUser((await makeUser({ role: 'CONTENT_MANAGER' })).user.id);
  const cust = await createCustomer(office, CUSTOMER);
  const veh = await createVehicle(office, cust.id, VEHICLE);
  const mk = async (expertId: string | null) => {
    const k = await createCase(office, { customerId: cust.id, vehicleId: veh.id, data: {} });
    if (expertId) await assignExpert(owner, k.id, expertId);
    return k;
  };
  return { office, owner, expA, expB, eA: eA.user, eB: eB.user, accounting, content, cust, veh, mk };
}

/* ------------------------------------------------------------ Speicher */

test('Speicher (lokal): ablegen, lesen, löschen; nie überschreiben; Pfade außerhalb werden verweigert', async () => {
  const s = localDriver(dir);
  const key = newStorageKey('p');
  assert.match(key, /^p\/\d{4}\/\d{2}\/[a-z0-9]{20,}$/, 'zufälliger Schlüssel ohne Dateiname/Fallnummer');
  assert.notEqual(newStorageKey('p'), key);
  await s.put(key, JPEG_BYTES, 'image/jpeg');
  assert.deepEqual([...(await s.get(key))!], [...JPEG_BYTES]);
  assert.equal(await s.exists(key), true);
  await assert.rejects(s.put(key, JPEG_BYTES, 'image/jpeg'), 'bestehende Datei wird nie überschrieben');
  for (const bad of ['../etc/passwd', '/etc/passwd', 'p/../../x1234567890', 'p//2026/x123456789', 'A/Upper/Case12345', 'a']) await assert.rejects(s.get(bad), /Ungültig/, bad);
  await s.delete(key);
  assert.equal(await s.get(key), null);
  assert.equal(await s.signedUrl(key, { expiresInSeconds: 60 }), null, 'lokal gibt es keine signierte URL – die Route streamt selbst');
});

test('Speicher-Konfiguration: ohne Treiber null; lokal auf Vercel verboten', () => {
  assert.equal(getStorage({} as NodeJS.ProcessEnv), null);
  assert.equal(getStorage({ STORAGE_DRIVER: 'local', VERCEL: '1' } as unknown as NodeJS.ProcessEnv), null);
  assert.equal(getStorage({ STORAGE_DRIVER: 's3', S3_BUCKET_PRIVATE: 'b' } as unknown as NodeJS.ProcessEnv), null, 'S3 ohne Zugangsdaten ist nicht konfiguriert');
  assert.equal(getStorage({ STORAGE_DRIVER: 'local', STORAGE_LOCAL_DIR: dir } as unknown as NodeJS.ProcessEnv)?.id, 'local');
});

/* ------------------------------------------------------------ Fotos */

test('Foto hochladen: Datei im Speicher, Media-Zeile mit Hash, Audit; Original-Dateiname wird nicht gespeichert', async () => {
  const w = await world();
  const k = await w.mk(w.eA.id);
  const photo = await addCasePhoto(w.expA, k.id, { bytes: JPEG_BYTES, thumb: JPEG_BYTES }, { category: 'PLATE', title: 'Kennzeichen vorn' });
  const media = await db.media.findUniqueOrThrow({ where: { id: photo.mediaId } });
  assert.equal(media.bucket, 'PRIVATE');
  assert.equal(media.mimeType, 'image/jpeg');
  assert.match(media.sha256, /^[0-9a-f]{64}$/);
  assert.equal(media.uploadedById, w.eA.id);
  assert.ok(await getStorage()!.exists(media.storageKey));
  assert.ok(await getStorage()!.exists(media.thumbKey!));
  assert.equal(await countFiles(dir), 2);
  assert.equal(await db.auditLog.count({ where: { action: 'photo.add', entityId: k.id } }), 1);
  const list = await listCasePhotos(w.expA, k.id);
  assert.equal(list.length, 1);
  assert.equal(list[0].title, 'Kennzeichen vorn');
  assert.ok(!JSON.stringify(list).includes(media.storageKey), 'Speicherschlüssel verlassen den Server nie');
});

test('Upload-Prüfung: Typ aus dem Inhalt (SVG/EXE/Text mit .jpg fliegen raus), leer, zu groß, ungültige Vorschau', async () => {
  const w = await world();
  const k = await w.mk(w.eA.id);
  const bytes = (s: string) => new Uint8Array(Buffer.from(s));
  await assert.rejects(addCasePhoto(w.expA, k.id, { bytes: bytes('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') }, {}), /nicht erlaubt/);
  await assert.rejects(addCasePhoto(w.expA, k.id, { bytes: new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0]) }, {}), /nicht erlaubt/);
  await assert.rejects(addCasePhoto(w.expA, k.id, { bytes: bytes('GIF89a....') }, {}), /nicht erlaubt/);
  await assert.rejects(addCasePhoto(w.expA, k.id, { bytes: PDF_BYTES }, {}), /nicht erlaubt/, 'PDF ist als Foto nicht zulässig');
  await assert.rejects(addCasePhoto(w.expA, k.id, { bytes: new Uint8Array(0) }, {}), /leer/);
  await assert.rejects(addCasePhoto(w.expA, k.id, { bytes: JPEG_BYTES, thumb: bytes('kein bild') }, {}), /Vorschau/);
  await setSetting('uploads', { maxPhotoMb: 1, maxDocumentMb: 25, maxFilesPerUpload: 20 }, w.owner.id);
  const big = new Uint8Array(1.5 * 1024 * 1024);
  big.set(JPEG_BYTES);
  await assert.rejects(addCasePhoto(w.expA, k.id, { bytes: big }, {}), /größer als/);
  assert.equal(await countFiles(dir), 0, 'abgelehnte Uploads hinterlassen nichts im Speicher');
  assert.equal(await db.media.count(), 0);
});

test('Scheitert die Datenbankzeile, wird das gespeicherte Objekt wieder entfernt (keine Datei-Leichen)', async () => {
  await assert.rejects(putMedia('gibt-es-nicht', { bytes: JPEG_BYTES, thumb: JPEG_BYTES }, 'photo'));
  assert.equal(await countFiles(dir), 0);
});

test('Ohne eingerichteten Speicher: klare Meldung, nichts gespeichert', async () => {
  const w = await world();
  const k = await w.mk(w.eA.id);
  delete process.env.STORAGE_DRIVER;
  await assert.rejects(addCasePhoto(w.expA, k.id, { bytes: JPEG_BYTES }, {}), /nicht eingerichtet/);
  process.env.STORAGE_DRIVER = 'local';
});

test('Zugriff auf Fotos: Experte nur eigene Fälle, Website-Rolle/Buchhaltung nie; fremder Fall = „nicht gefunden“', async () => {
  const w = await world();
  const own = await w.mk(w.eA.id);
  const foreign = await w.mk(w.eB.id);
  const photo = await addCasePhoto(w.expA, own.id, { bytes: JPEG_BYTES, thumb: JPEG_BYTES }, { category: 'DAMAGE' });
  const foreignPhoto = await addCasePhoto(w.expB, foreign.id, { bytes: JPEG_BYTES }, {});
  await assert.rejects(addCasePhoto(w.expA, foreign.id, { bytes: JPEG_BYTES }, {}), /nicht gefunden/);
  await assert.rejects(listCasePhotos(w.expA, foreign.id), /nicht gefunden/);
  await assert.rejects(readMedia(w.expA, foreignPhoto.mediaId), /nicht gefunden/);
  await assert.rejects(readMedia(w.expB, photo.mediaId), /nicht gefunden/);
  assert.ok((await readMedia(w.expA, photo.mediaId)).bytes);
  assert.ok((await readMedia(w.office, photo.mediaId)).bytes, 'Büro liest alle Fotos');
  await assert.rejects(readMedia(w.content, photo.mediaId), ForbiddenError);
  await assert.rejects(readMedia(w.accounting, photo.mediaId), ForbiddenError);
  await assert.rejects(listCasePhotos(w.accounting, own.id), ForbiddenError);
  await assert.rejects(addCasePhoto(w.accounting, own.id, { bytes: JPEG_BYTES }, {}), ForbiddenError);
});

test('Auslieferung: Originalabruf wird protokolliert, Vorschau nicht; signierte URL gibt es lokal nicht', async () => {
  const w = await world();
  const k = await w.mk(w.eA.id);
  const photo = await addCasePhoto(w.expA, k.id, { bytes: JPEG_BYTES, thumb: JPEG_BYTES }, {});
  const t = await readMedia(w.expA, photo.mediaId, 'thumb');
  assert.equal(t.signedUrl, null);
  assert.equal(await db.auditLog.count({ where: { action: 'media.download' } }), 0, 'Vorschauen fluten das Protokoll nicht');
  const f = await readMedia(w.expA, photo.mediaId, 'full');
  assert.match(f.fileName, /^ING-\d{4}-\d{5}-foto\.jpg$/);
  assert.equal(await db.auditLog.count({ where: { action: 'media.download', actorId: w.eA.id } }), 1);
});

test('Foto bearbeiten/löschen: Kategorie & Titel; Löschen blendet aus (Soft Delete) und sperrt den Abruf', async () => {
  const w = await world();
  const k = await w.mk(w.eA.id);
  const photo = await addCasePhoto(w.expA, k.id, { bytes: JPEG_BYTES }, { category: 'DAMAGE' });
  await updateCasePhoto(w.expA, photo.id, { category: 'ODOMETER', title: 'Tacho 84.210' });
  assert.equal((await listCasePhotos(w.expA, k.id))[0].category, 'ODOMETER');
  await assert.rejects(updateCasePhoto(w.expB, photo.id, { category: 'OTHER' }), /nicht gefunden/);
  await assert.rejects(deleteCasePhoto(w.expB, photo.id), /nicht gefunden/);
  await deleteCasePhoto(w.expA, photo.id);
  assert.equal((await listCasePhotos(w.expA, k.id)).length, 0);
  await assert.rejects(readMedia(w.expA, photo.mediaId), /nicht gefunden/);
  assert.equal(await db.auditLog.count({ where: { action: 'photo.delete' } }), 1);
});

/* ------------------------------------------------------------ Dokumente */

test('Dokumente: PDF ja, Kundenebene nur mit Recht „alle“, Löschen nur Leitung; Abruf protokolliert', async () => {
  const w = await world();
  const k = await w.mk(w.eA.id);
  const doc = await addDocument(w.office, { caseId: k.id }, { bytes: PDF_BYTES }, { category: 'POWER_OF_ATTORNEY', title: 'Vollmacht' });
  assert.equal((await db.media.findUniqueOrThrow({ where: { id: doc.mediaId } })).mimeType, 'application/pdf');
  await assert.rejects(addDocument(w.office, { caseId: k.id }, { bytes: PDF_BYTES }, { title: '' }), /Titel/);
  await addDocument(w.expA, { caseId: k.id }, { bytes: PDF_BYTES }, { title: 'Schreiben der Versicherung', category: 'INSURANCE_LETTER' });
  await assert.rejects(addDocument(w.expA, { customerId: w.cust.id }, { bytes: PDF_BYTES }, { title: 'x' }), ForbiddenError);
  await assert.rejects(addDocument(w.expB, { caseId: k.id }, { bytes: PDF_BYTES }, { title: 'x' }), /nicht gefunden/);
  await addDocument(w.office, { customerId: w.cust.id }, { bytes: PDF_BYTES }, { title: 'Rahmenvertrag' });
  assert.equal((await listDocuments(w.expA, { caseId: k.id })).length, 2);
  assert.equal((await listDocuments(w.office, { customerId: w.cust.id })).length, 3, 'Kundenansicht zeigt auch die Dokumente seiner Fälle');
  const dl = await readMedia(w.expA, doc.mediaId);
  assert.equal(dl.mimeType, 'application/pdf');
  assert.equal(await db.auditLog.count({ where: { action: 'media.download' } }), 1);
  await assert.rejects(deleteDocument(w.office, doc.id), ForbiddenError);
  await deleteDocument(w.owner, doc.id);
  assert.equal((await listDocuments(w.expA, { caseId: k.id })).length, 1);
});

/* ------------------------------------------------------------ Anfrage-Dateien */

test('Formular-Fotos: im Speicher abgelegt (STORED), Mail-Status stuft sie nicht herab; Umwandlung übernimmt sie in den Fall', async () => {
  const w = await world();
  const { inquiryId, leadId } = await persistInquiry({
    fields: { anlass: 'Unfall', fahrzeug: 'PKW', name: 'Paula Prüfer', telefon: '0511 9988776', email: 'paula@example.test', standort: 'Hannover', nachricht: '', datenschutz: true },
    attachments: [
      { kind: 'photo', fileName: 'foto-1.jpg', mimeType: 'image/jpeg', sizeBytes: JPEG_BYTES.length, sha256: 'a'.repeat(64) },
      { kind: 'registration', fileName: 'fahrzeugschein.pdf', mimeType: 'application/pdf', sizeBytes: PDF_BYTES.length, sha256: 'b'.repeat(64) },
    ],
    tracking: { utmSource: null, utmMedium: null, utmCampaign: null, referrerHost: null, landingPath: null }, ip: 'unknown',
  });
  const n = await storeInquiryFiles(inquiryId, [
    { kind: 'photo', fileName: 'foto-1.jpg', mimeType: 'image/jpeg', sizeBytes: JPEG_BYTES.length, sha256: 'a'.repeat(64), bytes: JPEG_BYTES },
    { kind: 'registration', fileName: 'fahrzeugschein.pdf', mimeType: 'application/pdf', sizeBytes: PDF_BYTES.length, sha256: 'b'.repeat(64), bytes: PDF_BYTES },
  ]);
  assert.equal(n, 2);
  await markNotification(leadId, 'SENT');
  const atts = await db.inquiryAttachment.findMany({ where: { inquiryId }, orderBy: { fileName: 'asc' } });
  assert.deepEqual(atts.map((a) => a.status), ['STORED', 'STORED'], 'Mail-Erfolg stuft gespeicherte Dateien nicht auf „nur per E-Mail“ herab');
  const r = await convertLead(w.office, leadId, { customer: { mode: 'new', data: customerSchema.parse({ lastName: 'Prüfer' }) }, vehicle: { mode: 'new', data: vehicleSchema.parse({ manufacturer: 'VW', model: 'Golf' }) }, case: caseSchema.parse({}) });
  const photos = await listCasePhotos(w.office, r.caseId);
  assert.equal(photos.length, 1);
  assert.equal(photos[0].category, 'REQUEST');
  const docs = await listDocuments(w.office, { caseId: r.caseId });
  assert.equal(docs[0].category, 'REGISTRATION');
  assert.ok((await readMedia(w.office, photos[0].mediaId)).bytes, 'derselbe Medienbestand, jetzt am Fall');
});

test('Formular-Fotos ohne Speicher: nichts wird gespeichert, Anhang bleibt „nicht gesichert“ (Mail-Fallback)', async () => {
  delete process.env.STORAGE_DRIVER;
  const { inquiryId } = await persistInquiry({
    fields: { anlass: 'Unfall', fahrzeug: 'PKW', name: 'A B', telefon: '0511 123456', email: 'a@example.test', standort: '', nachricht: '', datenschutz: true },
    attachments: [{ kind: 'photo', fileName: 'foto-1.jpg', mimeType: 'image/jpeg', sizeBytes: 10, sha256: 'c'.repeat(64) }],
    tracking: { utmSource: null, utmMedium: null, utmCampaign: null, referrerHost: null, landingPath: null }, ip: 'unknown',
  });
  assert.equal(await storeInquiryFiles(inquiryId, [{ kind: 'photo', fileName: 'foto-1.jpg', mimeType: 'image/jpeg', sizeBytes: 10, sha256: 'c'.repeat(64), bytes: JPEG_BYTES }]), 0);
  assert.equal((await db.inquiryAttachment.findFirstOrThrow({ where: { inquiryId } })).status, 'NOT_STORED');
  process.env.STORAGE_DRIVER = 'local';
});

/* ------------------------------------------------------------ Termine */

const at = (h: number, durH = 1) => ({ startsAt: new Date(Date.UTC(2030, 5, 3, h)), endsAt: new Date(Date.UTC(2030, 5, 3, h + durH)) });

test('Termin anlegen: Fall wird „Termin vereinbart“, Gutachter wird zugewiesen, Audit; Absage ohne weiteren Termin → „Termin offen“', async () => {
  const w = await world();
  const k = await w.mk(null);
  const a = await createAppointment(w.office, k.id, { expertId: w.eA.id, kind: 'INSPECTION', ...at(9), location: 'Hannover, Werkstatt' });
  const c = await db.case.findUniqueOrThrow({ where: { id: k.id } });
  assert.equal(c.status, 'APPOINTMENT_SET');
  assert.equal(c.assignedExpertId, w.eA.id, 'unbesetzter Fall geht an den Terminpartner');
  assert.equal((await db.caseStatusHistory.findMany({ where: { caseId: k.id }, orderBy: { createdAt: 'asc' } })).map((h) => h.toStatus).join(), 'NEW,APPOINTMENT_SET');
  await assert.rejects(setAppointmentStatus(w.office, a.id, 'CANCELLED'), /Grund/);
  await setAppointmentStatus(w.office, a.id, 'CANCELLED', 'Kunde krank');
  assert.equal((await db.case.findUniqueOrThrow({ where: { id: k.id } })).status, 'APPOINTMENT_PENDING');
  const second = await createAppointment(w.office, k.id, { expertId: w.eA.id, kind: 'INSPECTION', ...at(9) });
  assert.equal((await db.case.findUniqueOrThrow({ where: { id: k.id } })).status, 'APPOINTMENT_SET');
  await createAppointment(w.office, k.id, { expertId: w.eA.id, kind: 'INSPECTION', ...at(14) });
  await setAppointmentStatus(w.office, second.id, 'CANCELLED', 'Verschoben');
  assert.equal((await db.case.findUniqueOrThrow({ where: { id: k.id } })).status, 'APPOINTMENT_SET', 'ein weiterer aktiver Termin hält den Status');
});

test('Doppelbuchung: die Datenbank verhindert Überschneidungen je Gutachter – auch bei gleichzeitigen Anfragen', async () => {
  const w = await world();
  const ks = await Promise.all([w.mk(w.eA.id), w.mk(w.eA.id), w.mk(w.eA.id), w.mk(w.eA.id), w.mk(w.eA.id)]);
  const results = await Promise.allSettled(ks.map((k) => createAppointment(w.office, k.id, { expertId: w.eA.id, kind: 'INSPECTION', ...at(10, 2) })));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1, 'genau EIN Termin gewinnt');
  for (const r of results) if (r.status === 'rejected') assert.match(String(r.reason?.message), /bereits einen Termin|parallel gebucht/);
  assert.equal(await db.appointment.count(), 1);
  // anderer Gutachter: frei; direkt angrenzend (Ende = Beginn): frei
  await createAppointment(w.office, ks[0].id, { expertId: w.eB.id, kind: 'INSPECTION', ...at(10, 2) });
  await createAppointment(w.office, ks[1].id, { expertId: w.eA.id, kind: 'INSPECTION', ...at(12, 1) });
  // abgesagte Termine blockieren nichts
  const one = await db.appointment.findFirstOrThrow({ where: { expertId: w.eA.id, startsAt: at(12).startsAt } });
  await setAppointmentStatus(w.office, one.id, 'CANCELLED', 'Test');
  await createAppointment(w.office, ks[2].id, { expertId: w.eA.id, kind: 'INSPECTION', ...at(12, 1) });
});

test('Termin-Validierung: Ende nach Beginn, höchstens 12 Stunden, nur verfügbare Sachverständige', async () => {
  const w = await world();
  const k = await w.mk(w.eA.id);
  await assert.rejects(createAppointment(w.office, k.id, { expertId: w.eA.id, startsAt: at(10).endsAt, endsAt: at(10).startsAt }), /nach dem Beginn/);
  await assert.rejects(createAppointment(w.office, k.id, { expertId: w.eA.id, ...at(6, 13) }), /höchstens 12/);
  const notExpert = (await makeUser({ role: 'OFFICE' })).user;
  await assert.rejects(createAppointment(w.office, k.id, { expertId: notExpert.id, ...at(10) }), /nicht verfügbar/);
  await assert.rejects(createAppointment(w.office, k.id, { expertId: '', ...at(10) } as never));
});

test('Termine & Rechte: Experte plant nur sich selbst auf eigenen Fällen; sieht nur eigene Termine; Buchhaltung/Website-Rolle nichts', async () => {
  const w = await world();
  const own = await w.mk(w.eA.id);
  const foreign = await w.mk(w.eB.id);
  const mine = await createAppointment(w.expA, own.id, { expertId: w.eA.id, ...at(9) });
  await assert.rejects(createAppointment(w.expA, own.id, { expertId: w.eB.id, ...at(11) }), ForbiddenError, 'nicht für andere Gutachter');
  await assert.rejects(createAppointment(w.expA, foreign.id, { expertId: w.eA.id, ...at(13) }), /nicht gefunden/);
  await createAppointment(w.office, foreign.id, { expertId: w.eB.id, ...at(9) });
  const range = { from: new Date(Date.UTC(2030, 5, 3)), to: new Date(Date.UTC(2030, 5, 4)) };
  assert.deepEqual((await listAppointments(w.expA, range)).map((a) => a.id), [mine.id]);
  assert.equal((await listAppointments(w.office, range)).length, 2);
  assert.equal((await listAppointments(w.office, { ...range, expertId: w.eB.id })).length, 1);
  await assert.rejects(listAppointments(w.accounting, range), ForbiddenError);
  await assert.rejects(listAppointments(w.content, range), ForbiddenError);
  await assert.rejects(caseAppointments(w.expA, foreign.id), /nicht gefunden/);
  await assert.rejects(rescheduleAppointment(w.expB, mine.id, { expertId: w.eA.id, ...at(15) }), /nicht gefunden/);
  await rescheduleAppointment(w.expA, mine.id, { expertId: w.eA.id, ...at(15) });
  assert.equal((await db.appointment.findUniqueOrThrow({ where: { id: mine.id } })).startsAt.toISOString(), at(15).startsAt.toISOString());
  await createAppointment(w.office, own.id, { expertId: w.eA.id, ...at(20) });
  await assert.rejects(rescheduleAppointment(w.office, mine.id, { expertId: w.eA.id, startsAt: at(14).startsAt, endsAt: at(21).endsAt }), /bereits einen Termin/, 'Verschieben auf eine belegte Zeit scheitert');
  await rescheduleAppointment(w.office, mine.id, { expertId: w.eA.id, startsAt: at(14).startsAt, endsAt: at(16).endsAt }); // sich selbst überlappen ist erlaubt
});

/* ------------------------------------------------------------ Besichtigung */

test('Besichtigung: beginnen (idempotent), Protokoll, abschließen → Termin erledigt + Fall „Besichtigt“; zweites Abschließen scheitert', async () => {
  const w = await world();
  const k = await w.mk(w.eA.id);
  const a = await createAppointment(w.office, k.id, { expertId: w.eA.id, ...at(9) });
  await assert.rejects(startInspection(w.expB, a.id), /nicht gefunden/);
  const i1 = await startInspection(w.expA, a.id);
  const i2 = await startInspection(w.expA, a.id);
  assert.equal(i1.id, i2.id);
  await assert.rejects(finishInspection(w.expA, (await createAppointment(w.office, (await w.mk(w.eA.id)).id, { expertId: w.eA.id, ...at(12) })).id), /noch nicht begonnen/);
  await updateInspection(w.expA, a.id, { weather: 'trocken', odometer: '84.210', note: 'Fahrzeug fahrbereit' });
  await assert.rejects(updateInspection(w.expA, a.id, { odometer: '-5' }));
  await finishInspection(w.expA, a.id);
  assert.equal((await db.appointment.findUniqueOrThrow({ where: { id: a.id } })).status, 'DONE');
  assert.equal((await db.case.findUniqueOrThrow({ where: { id: k.id } })).status, 'INSPECTED');
  const ins = await db.inspection.findUniqueOrThrow({ where: { appointmentId: a.id } });
  assert.equal(ins.status, 'FINISHED');
  assert.equal(ins.odometer, 84210);
  assert.ok(ins.finishedAt);
  await assert.rejects(finishInspection(w.expA, a.id), /bereits abgeschlossen/);
  for (const act of ['inspection.start', 'inspection.finish']) assert.equal(await db.auditLog.count({ where: { action: act, entityId: k.id } }), 1, act);
});

/* ------------------------------------------------------------ Schäden */

test('Schäden: erfassen/ändern/löschen; Buchhaltung sieht keine; Foto-Verknüpfung nur im selben Fall; Löschen löst Verknüpfung', async () => {
  const w = await world();
  const k = await w.mk(w.eA.id);
  const other = await w.mk(w.eA.id);
  const d = await addDamage(w.expA, k.id, { area: 'FRONT', component: 'Stoßfänger vorn', damageType: 'Riss', repairKind: 'Ersetzen', description: 'Riss links' });
  await assert.rejects(addDamage(w.expA, k.id, { area: 'FRONT', component: '' }), /Bauteil/);
  await assert.rejects(addDamage(w.expB, k.id, { area: 'REAR', component: 'x' }), /nicht gefunden/);
  assert.equal((await listDamages(w.expA, k.id)).length, 1);
  assert.equal((await listDamages(w.accounting, k.id)).length, 0, 'Schäden sind Interna des Falls');
  const d2 = await addDamage(w.office, other.id, { area: 'REAR', component: 'Heckklappe' });
  await assert.rejects(addCasePhoto(w.expA, k.id, { bytes: JPEG_BYTES }, { damageId: d2.id }), /gehört nicht zum Fall/);
  const photo = await addCasePhoto(w.expA, k.id, { bytes: JPEG_BYTES }, { damageId: d.id });
  assert.equal((await listDamages(w.expA, k.id))[0]._count.photos, 1);
  await updateDamage(w.expA, d.id, { area: 'FRONT', component: 'Stoßfänger vorn', damageType: 'Bruch' });
  assert.equal((await db.damage.findUniqueOrThrow({ where: { id: d.id } })).damageType, 'Bruch');
  await deleteDamage(w.expA, d.id);
  assert.equal((await listDamages(w.expA, k.id)).length, 0);
  assert.equal((await db.casePhoto.findUniqueOrThrow({ where: { id: photo.id } })).damageId, null);
  assert.equal(await db.auditLog.count({ where: { action: { in: ['damage.add', 'damage.update', 'damage.delete'] } } }), 4, 'zwei Erfassungen, eine Änderung, eine Löschung');
});
