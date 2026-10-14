import test, { beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { db } from '@/server/db';
import { assertTestDb, resetDb } from './helpers';
import { GET } from '@/app/api/health/route';

assertTestDb();
const keys = ['STORAGE_DRIVER', 'STORAGE_LOCAL_DIR', 'STORAGE_ENCRYPTION_KEY', 'HEALTH_TOKEN', 'MAIL_PROVIDER', 'MAIL_FROM', 'MAIL_TO', 'ING_ENV'];
const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
let dir = '';
beforeEach(async () => { await resetDb(); dir = await mkdtemp(path.join(tmpdir(), 'ing-health-')); process.env.STORAGE_DRIVER = 'local'; process.env.STORAGE_LOCAL_DIR = dir; process.env.STORAGE_ENCRYPTION_KEY = 'h'.repeat(40); process.env.HEALTH_TOKEN = 't'.repeat(32); process.env.MAIL_PROVIDER = 'dry-run'; process.env.MAIL_FROM = 'a@b.c'; process.env.MAIL_TO = 'x@y.z'; delete process.env.ING_ENV; });
afterEach(async () => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } await rm(dir, { recursive: true, force: true }); });
after(() => db.$disconnect());

const call = (auth?: string) => GET(new Request('http://localhost/api/health/', { headers: auth ? { Authorization: auth } : {} }));

test('Health ohne Token: nur „ok“ – keine Details, keine Daten', async () => {
  const r = await call();
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { status: 'ok' });
  assert.match(r.headers.get('cache-control') ?? '', /no-store/);
});
test('Health mit falschem/zu kurzem Token liefert ebenfalls nur den Status', async () => {
  for (const bad of ['Bearer falsch', `Bearer ${'t'.repeat(31)}x`, 'Bearer ']) assert.deepEqual(Object.keys(await (await call(bad)).json()), ['status']);
  process.env.HEALTH_TOKEN = 'kurz';
  assert.deepEqual(Object.keys(await (await call('Bearer kurz')).json()), ['status'], 'zu kurzes Token wird nie akzeptiert');
});
test('Health mit Token: Datenbank, Migrationen, Speicher (Schreib-/Lese-/Löschprobe mit Verschlüsselung), Mail – ohne Geheimnisse', async () => {
  const r = await call(`Bearer ${'t'.repeat(32)}`);
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.equal(j.status, 'ok');
  assert.equal(j.checks.database.ok, true); assert.equal(j.checks.migrations.ok, true); assert.equal(j.checks.storage.ok, true); assert.equal(j.checks.mfaKey.ok, true);
  const text = JSON.stringify(j);
  for (const secret of ['t'.repeat(32), 'h'.repeat(40), process.env.DATABASE_URL ?? 'x-nie']) assert.ok(!text.includes(secret), 'kein Geheimnis in der Antwort');
});
test('Health meldet „degraded“ (503), wenn der Speicher fehlt – auch ohne Token', async () => {
  delete process.env.STORAGE_DRIVER;
  const r = await call();
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { status: 'degraded' });
  const d = await (await call(`Bearer ${'t'.repeat(32)}`)).json();
  assert.equal(d.checks.storage.ok, false);
});
