// Prüft die Vorbereitung der Anfrage-API-Anbindung mit SYNTHETISCHEN Daten. Es werden keine Netzwerkanfragen gesendet.
// Optional: ING_STUDIO_SRC=/pfad/zum/ING-Studio-Repository setzen, um die Grenzen gegen den echten Servercode zu vergleichen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInquiryFormData, checkInquiryFiles, newIdempotencyKey, SERVER_LIMITS } from '../src/lib/inquiry-contract.ts';

const values = { anlass: 'Unfall', fahrzeug: 'PKW', name: 'Test Person', telefon: '0511 000000', email: 'test@example.invalid', standort: 'Hannover', nachricht: 'Synthetischer Test', datenschutz: true };
const jpeg = (bytes = 100) => new File([new Uint8Array(bytes)], 'x.jpg', { type: 'image/jpeg' });

test('Formularfelder entsprechen dem API-Vertrag', () => {
  const fd = buildInquiryFormData({ values, photos: [jpeg(), jpeg()], startedAt: 1700000000000 });
  for (const k of ['anlass', 'fahrzeug', 'name', 'telefon', 'email', 'standort', 'nachricht', 'datenschutz', 'website', 't']) assert.ok(fd.has(k), `Feld ${k} fehlt`);
  assert.equal(fd.get('datenschutz'), 'true');
  assert.equal(fd.get('website'), '', 'Honeypot muss leer sein');
  assert.equal(fd.getAll('foto').length, 2, 'Fotos heißen "foto" (mehrfach), nicht foto_1 …');
  assert.equal(fd.has('fahrzeugschein'), false, 'Fahrzeugschein ist ausgeblendet');
});

test('Idempotenz-Schlüssel: zufällig, pro Aufruf stabil im Formular', () => {
  const a = newIdempotencyKey(), b = newIdempotencyKey();
  assert.match(a, /^[0-9a-f-]{32,36}$/); assert.notEqual(a, b);
  const fd = buildInquiryFormData({ values, photos: [], startedAt: 1, idempotencyKey: a });
  assert.equal(fd.get('idempotencyKey'), a);
  assert.equal(buildInquiryFormData({ values, photos: [], startedAt: 1 }).has('idempotencyKey'), false);
});

test('Fahrzeugschein wird nur gesendet, wenn übergeben', () => {
  const doc = new File([new Uint8Array(10)], 'f.pdf', { type: 'application/pdf' });
  assert.equal(buildInquiryFormData({ values, photos: [], document: doc, startedAt: 1 }).has('fahrzeugschein'), true);
});

test('Dateigrenzen werden vor dem Senden geprüft', () => {
  assert.equal(checkInquiryFiles([jpeg(1000)]), null);
  assert.match(checkInquiryFiles(Array.from({ length: 9 }, () => jpeg(10))), /höchstens 8/);
  assert.match(checkInquiryFiles([jpeg(SERVER_LIMITS.maxPhotoBytes + 1)]), /zu groß/);
  assert.match(checkInquiryFiles([new File([new Uint8Array(5)], 'a.svg', { type: 'image/svg+xml' })]), /JPG, PNG oder WebP/);
  const big = Array.from({ length: 4 }, () => jpeg(1_500_000)); // 6 MB gesamt
  assert.match(checkInquiryFiles(big), /zusammen zu groß/);
});

test('Grenzen stimmen mit dem ING-Studio-Servercode überein (optional)', { skip: !process.env.ING_STUDIO_SRC }, async () => {
  const srv = await import(`${process.env.ING_STUDIO_SRC}/src/lib/request-schema.ts`);
  for (const k of ['maxPhotos', 'maxPhotoBytes', 'maxDocBytes', 'maxTotalBytes', 'minFillMs', 'name', 'phone', 'email', 'message']) assert.equal(SERVER_LIMITS[k], srv.LIMITS[k], `Grenze ${k} weicht ab`);
  assert.deepEqual([...srv.PHOTO_MIME], ['image/jpeg', 'image/png', 'image/webp']);
});
