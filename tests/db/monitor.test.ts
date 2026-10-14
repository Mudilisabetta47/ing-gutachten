import test, { beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { db } from '@/server/db';
import { assertTestDb, resetDb } from './helpers';
import { GET } from '@/app/api/monitor/check/route';

assertTestDb();
const keys = ['STORAGE_DRIVER', 'STORAGE_LOCAL_DIR', 'STORAGE_ENCRYPTION_KEY', 'MONITOR_SECRET', 'ALERT_EMAIL_TO', 'MAIL_PROVIDER', 'MAIL_FROM', 'MAIL_TO', 'ING_ENV'];
const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
const SECRET = 'm'.repeat(32);
let dir = '';
beforeEach(async () => {
  await resetDb();
  dir = await mkdtemp(path.join(tmpdir(), 'ing-monitor-'));
  Object.assign(process.env, { STORAGE_DRIVER: 'local', STORAGE_LOCAL_DIR: dir, STORAGE_ENCRYPTION_KEY: 'h'.repeat(40), MONITOR_SECRET: SECRET, ALERT_EMAIL_TO: 'betrieb@example.test', MAIL_PROVIDER: 'dry-run', MAIL_FROM: 'a@b.c', MAIL_TO: 'x@y.z' });
  delete process.env.ING_ENV;
});
afterEach(async () => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } await rm(dir, { recursive: true, force: true }); });
after(() => db.$disconnect());

const call = (auth?: string) => GET(new Request('http://localhost/api/monitor/check/', { headers: auth ? { Authorization: auth } : {} }));
const state = async () => (await db.systemSetting.findUnique({ where: { key: 'monitor.state' } }))?.value as { status: string } | undefined;

test('Überwachung ohne/mit falschem Geheimnis: 401, keine Details, kein Zustand gespeichert', async () => {
  for (const bad of [undefined, 'Bearer falsch', `Bearer ${'m'.repeat(31)}x`, 'Bearer ']) {
    const r = await call(bad);
    assert.equal(r.status, 401);
    assert.deepEqual(await r.json(), { error: 'auth' });
  }
  process.env.MONITOR_SECRET = 'kurz';
  assert.equal((await call('Bearer kurz')).status, 401, 'zu kurzes Geheimnis wird nie akzeptiert');
  assert.equal(await state(), undefined);
});
test('Überwachung: alles in Ordnung → 200, keine Mail, Zustand „ok“', async () => {
  const r = await call(`Bearer ${SECRET}`);
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.deepEqual({ s: j.status, a: j.action, m: j.mailed }, { s: 'ok', a: 'none', m: false });
  assert.equal((await state())?.status, 'ok');
});
test('Überwachung: Störung → 503 + eine Mail; zweiter Lauf keine Mail; Erholung → Entwarnung', async () => {
  delete process.env.STORAGE_DRIVER; // Speicher fällt aus
  let r = await call(`Bearer ${SECRET}`); let j = await r.json();
  assert.equal(r.status, 503);
  assert.deepEqual({ a: j.action, m: j.mailed, f: j.failing }, { a: 'alert', m: true, f: ['storage'] });
  assert.equal((await state())?.status, 'degraded');
  r = await call(`Bearer ${SECRET}`); j = await r.json();
  assert.deepEqual({ a: j.action, m: j.mailed }, { a: 'none', m: false }, 'kein Dauerfeuer');
  process.env.STORAGE_DRIVER = 'local';
  r = await call(`Bearer ${SECRET}`); j = await r.json();
  assert.equal(r.status, 200);
  assert.deepEqual({ a: j.action, m: j.mailed }, { a: 'recovered', m: true });
  assert.equal((await state())?.status, 'ok');
  assert.ok(!JSON.stringify(j).includes(SECRET) && !JSON.stringify(j).includes('betrieb@example.test'), 'keine Geheimnisse/Adressen in der Antwort');
});
test('Überwachung ohne Empfänger: Störung wird erkannt (503), es geht nur keine Mail raus', async () => {
  delete process.env.ALERT_EMAIL_TO; delete process.env.STORAGE_DRIVER;
  const r = await call(`Bearer ${SECRET}`); const j = await r.json();
  assert.equal(r.status, 503);
  assert.deepEqual({ a: j.action, m: j.mailed, n: j.recipients }, { a: 'alert', m: false, n: 0 });
});
