import test, { beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { db } from '@/server/db';
import { assertTestDb, resetDb, makeUser, asAuthUser, CUSTOMER, VEHICLE, JPEG_BYTES, PDF_BYTES } from './helpers';
import { getRawStorage, getStorage } from '@/server/storage';
import { s3Driver } from '@/server/storage/s3';
import { encryptedDriver } from '@/server/storage/encrypted';
import { keyRingFromEnv, isEncrypted, masterKey } from '@/lib/storage-crypto';
import { migrateStorage } from '@/server/storage/migrate';
import { addCasePhoto, addDocument, readMedia } from '@/server/pipeline/media';
import { assignExpert, createCase } from '@/server/pipeline/cases';
import { createCustomer } from '@/server/pipeline/customers';
import { createVehicle } from '@/server/pipeline/vehicles';

assertTestDb();
const K1 = 'k1-'.padEnd(48, 'x'), K2 = 'k2-'.padEnd(48, 'y');
const keys = ['STORAGE_DRIVER', 'STORAGE_LOCAL_DIR', 'STORAGE_ENCRYPTION_KEY', 'STORAGE_ENCRYPTION_KEY_PREVIOUS', 'ING_ENV', 'S3_BUCKET_PRIVATE', 'S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];
const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
let dir = '';
beforeEach(async () => { await resetDb(); dir = await mkdtemp(path.join(tmpdir(), 'ing-enc-')); process.env.STORAGE_DRIVER = 'local'; process.env.STORAGE_LOCAL_DIR = dir; delete process.env.STORAGE_ENCRYPTION_KEY; delete process.env.STORAGE_ENCRYPTION_KEY_PREVIOUS; delete process.env.ING_ENV; });
afterEach(async () => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } await rm(dir, { recursive: true, force: true }); });
after(() => db.$disconnect());

const allFiles = async (d: string): Promise<string[]> => (await readdir(d, { withFileTypes: true })).flatMap((e) => (e.isDirectory() ? [] : [path.join(d, e.name)])).concat(...(await Promise.all((await readdir(d, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => allFiles(path.join(d, e.name))))));

async function caseWithFiles() {
  const owner = await asAuthUser((await makeUser({ role: 'OWNER' })).user.id);
  const cust = await createCustomer(owner, CUSTOMER as never);
  const veh = await createVehicle(owner, cust.id, VEHICLE);
  const c = await createCase(owner, { customerId: cust.id, vehicleId: veh.id, data: {} });
  return { owner, c };
}

test('Mit Schlüssel liegen Fotos und Dokumente nur verschlüsselt auf dem Datenträger – die Anwendung liest sie normal', async () => {
  process.env.STORAGE_ENCRYPTION_KEY = K1;
  const { owner, c } = await caseWithFiles();
  const photo = await addCasePhoto(owner, c.id, { bytes: JPEG_BYTES }, { category: 'DAMAGE', title: 'Heck' });
  const doc = await addDocument(owner, { caseId: c.id }, { bytes: PDF_BYTES }, { category: 'REGISTRATION', title: 'Fahrzeugschein' });
  const files = await allFiles(dir);
  assert.ok(files.length >= 2);
  for (const f of files) {
    const raw = new Uint8Array(await readFile(f));
    assert.ok(isEncrypted(raw), `${path.basename(f)} ist verschlüsselt`);
    assert.ok(!Buffer.from(raw).includes(Buffer.from('%PDF')) && !Buffer.from(raw).includes(Buffer.from([0xff, 0xd8, 0xff])), 'keine erkennbaren Dateikennungen im Chiffretext');
  }
  const mp = (await db.casePhoto.findUniqueOrThrow({ where: { id: photo.id } })).mediaId;
  const r1 = await readMedia(owner, mp);
  assert.equal(r1.signedUrl, null, 'keine Direkt-URL bei Verschlüsselung');
  assert.deepEqual(Buffer.from(r1.bytes!), Buffer.from(JPEG_BYTES));
  const r2 = await readMedia(owner, doc.mediaId);
  assert.deepEqual(Buffer.from(r2.bytes!), Buffer.from(PDF_BYTES));
});

test('Ohne Schlüssel: lokal erlaubt (Entwicklung), in Staging/Produktion „nicht eingerichtet“ (fail closed)', async () => {
  assert.ok(getStorage(), 'Entwicklung ohne Schlüssel');
  process.env.ING_ENV = 'staging';
  assert.equal(getStorage(), null);
  process.env.ING_ENV = 'production';
  assert.equal(getStorage(), null);
  process.env.STORAGE_ENCRYPTION_KEY = 'zu-kurz';
  assert.equal(getStorage(), null, 'zu kurzer Schlüssel = unbrauchbar');
  process.env.STORAGE_ENCRYPTION_KEY = K1;
  assert.ok(getStorage(), 'mit gültigem Schlüssel ok');
});

test('Alte unverschlüsselte Objekte: in Entwicklung lesbar, in Staging/Produktion verweigert; Migration verschlüsselt sie', async () => {
  const { owner, c } = await caseWithFiles();
  const photo = await addCasePhoto(owner, c.id, { bytes: JPEG_BYTES }, { category: 'DAMAGE', title: 'alt' }); // ohne Schlüssel gespeichert
  const mp = (await db.casePhoto.findUniqueOrThrow({ where: { id: photo.id } })).mediaId;
  assert.ok(!isEncrypted(new Uint8Array(await readFile((await allFiles(dir))[0]))));
  process.env.STORAGE_ENCRYPTION_KEY = K1;
  assert.deepEqual(Buffer.from((await readMedia(owner, mp)).bytes!), Buffer.from(JPEG_BYTES), 'Übergang: in Entwicklung lesbar');
  process.env.ING_ENV = 'staging';
  await assert.rejects(readMedia(owner, mp), /nicht verschlüsselt/);
  delete process.env.ING_ENV;
  const ring = keyRingFromEnv()!;
  const dry = await migrateStorage(getRawStorage()!, ring, { apply: false });
  assert.deepEqual([dry.plaintext, dry.rotated, dry.applied], [1, 0, false]);
  assert.ok(!isEncrypted(new Uint8Array(await readFile((await allFiles(dir))[0]))), 'Probelauf ändert nichts');
  const done = await migrateStorage(getRawStorage()!, ring, { apply: true });
  assert.deepEqual([done.plaintext, done.errors.length], [1, 0]);
  process.env.ING_ENV = 'staging';
  assert.deepEqual(Buffer.from((await readMedia(owner, mp)).bytes!), Buffer.from(JPEG_BYTES), 'nach der Migration auch im strengen Modus lesbar');
  assert.equal((await migrateStorage(getRawStorage()!, ring, { apply: false })).plaintext, 0);
});

test('Schlüsselwechsel: Objekte werden mit dem neuen Schlüssel neu verschlüsselt, danach genügt der neue allein', async () => {
  process.env.STORAGE_ENCRYPTION_KEY = K1;
  const { owner, c } = await caseWithFiles();
  const photo = await addCasePhoto(owner, c.id, { bytes: JPEG_BYTES }, { category: 'DAMAGE', title: 'x' });
  const mp = (await db.casePhoto.findUniqueOrThrow({ where: { id: photo.id } })).mediaId;
  process.env.STORAGE_ENCRYPTION_KEY = K2; process.env.STORAGE_ENCRYPTION_KEY_PREVIOUS = K1;
  assert.deepEqual(Buffer.from((await readMedia(owner, mp)).bytes!), Buffer.from(JPEG_BYTES), 'mit beiden Schlüsseln lesbar');
  const rep = await migrateStorage(getRawStorage()!, keyRingFromEnv()!, { apply: true });
  assert.deepEqual([rep.rotated, rep.errors.length], [1, 0]);
  delete process.env.STORAGE_ENCRYPTION_KEY_PREVIOUS;
  assert.deepEqual(Buffer.from((await readMedia(owner, mp)).bytes!), Buffer.from(JPEG_BYTES), 'nach dem Wechsel genügt der neue Schlüssel');
  process.env.STORAGE_ENCRYPTION_KEY = K1;
  await assert.rejects(readMedia(owner, mp), Error, 'der alte Schlüssel allein kann nicht mehr lesen');
});

test('Ein Objekt unter fremdem Namen (Kopie im Speicher) lässt sich nicht lesen', async () => {
  process.env.STORAGE_ENCRYPTION_KEY = K1;
  const { owner, c } = await caseWithFiles();
  const a = await addCasePhoto(owner, c.id, { bytes: JPEG_BYTES }, { category: 'DAMAGE', title: 'a' });
  const b = await addCasePhoto(owner, c.id, { bytes: new Uint8Array([...JPEG_BYTES]) }, { category: 'DAMAGE', title: 'b' });
  const ma = await db.media.findFirstOrThrow({ where: { photo: { id: a.id } } }), mb = await db.media.findFirstOrThrow({ where: { photo: { id: b.id } } });
  const files = await allFiles(dir);
  const fa = files.find((f) => f.includes(ma.storageKey.split('/').pop()!))!, fb = files.find((f) => f.includes(mb.storageKey.split('/').pop()!))!;
  await rm(fb); await (await import('node:fs/promises')).copyFile(fa, fb); // Angreifer kopiert Objekt A über Objekt B
  await assert.rejects(readMedia(owner, mb.id), Error, 'untergeschobenes Objekt wird erkannt');
});

/* ---------- S3-Treiber gegen einen lokalen S3-kompatiblen Testserver ---------- */
function s3Stub() {
  const store = new Map<string, Buffer>();
  const server = http.createServer((req, res) => {
    const key = decodeURIComponent((req.url ?? '').split('?')[0]);
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      if (req.method === 'PUT') { store.set(key, Buffer.concat(chunks)); res.writeHead(200, { ETag: '"x"' }).end(); }
      else if (req.method === 'GET' && store.has(key)) { const b = store.get(key)!; res.writeHead(200, { 'Content-Length': b.length }).end(b); }
      else if (req.method === 'HEAD' && store.has(key)) res.writeHead(200).end();
      else if (req.method === 'DELETE') { store.delete(key); res.writeHead(204).end(); }
      else res.writeHead(404, { 'Content-Type': 'application/xml' }).end('<Error><Code>NoSuchKey</Code></Error>');
    });
  });
  return { store, server };
}

test('S3-Treiber: Objekte liegen im Bucket nur als Chiffretext; Rundweg, Löschen und Fehlerfälle', async () => {
  const { store, server } = s3Stub();
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  try {
    const port = (server.address() as { port: number }).port;
    const raw = s3Driver({ endpoint: `http://127.0.0.1:${port}`, region: 'auto', bucket: 'ing-test-private', accessKeyId: 'test', secretAccessKey: 'test' });
    const enc = encryptedDriver(raw, keyRingFromEnv({ STORAGE_ENCRYPTION_KEY: K1 } as never)!, { allowPlaintext: false });
    const plain = new TextEncoder().encode('Fahrzeugschein H-AB 1234 – streng vertraulich');
    await enc.put('p/2026/10/s3testobj1', plain, 'application/pdf');
    const stored = store.get('/ing-test-private/p/2026/10/s3testobj1')!;
    assert.ok(stored && isEncrypted(new Uint8Array(stored)) && !stored.includes(Buffer.from('Fahrzeugschein')), 'im Bucket nur Chiffretext');
    assert.deepEqual(Buffer.from((await enc.get('p/2026/10/s3testobj1'))!), Buffer.from(plain));
    assert.equal(await enc.signedUrl('p/2026/10/s3testobj1', { expiresInSeconds: 60 }), null, 'keine Direkt-URL');
    assert.equal(await enc.exists('p/2026/10/s3testobj1'), true);
    assert.equal(await enc.get('p/2026/10/gibtesnicht'), null);
    // Bucket-Betreiber tauscht Inhalt aus → Entschlüsselung scheitert
    store.set('/ing-test-private/p/2026/10/s3testobj1', Buffer.concat([stored.subarray(0, 30), Buffer.from('manipuliert!!!'), stored.subarray(44)]));
    await assert.rejects(enc.get('p/2026/10/s3testobj1'));
    await enc.delete('p/2026/10/s3testobj1');
    assert.equal(await enc.exists('p/2026/10/s3testobj1'), false);
    await assert.rejects(enc.put('../../etc/passwd', plain, 'x/y'), /Ungültiger Speicherschlüssel/);
  } finally { server.close(); }
  assert.ok(masterKey('a').length === 32);
  assert.ok((await stat(dir)).isDirectory() && createHash('sha256'));
});
