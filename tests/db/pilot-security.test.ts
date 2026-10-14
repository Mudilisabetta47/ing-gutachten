import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '@/server/db';
import { assertTestDb, resetDb, makeUser } from './helpers';
import { authenticate } from '@/server/auth/login';
import { KNOWN_DEMO_PASSWORD, ingEnv, isDemoEmail, isLiveEnv } from '@/lib/env';
import { validatePasswordPolicy } from '@/server/auth/password';
import { readFileSync } from 'node:fs';

assertTestDb();
beforeEach(resetDb);
const ctx = { ip: '203.0.113.50', userAgent: 'test' };
const saved = { ING_ENV: process.env.ING_ENV, VERCEL_ENV: process.env.VERCEL_ENV };
afterEach(() => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });

test('Umgebung: ING_ENV, Vercel-Ableitung, lokaler Produktionsstart ist kein Echtbetrieb', () => {
  assert.equal(ingEnv({ ING_ENV: 'production' } as never), 'production');
  assert.equal(ingEnv({ VERCEL_ENV: 'production' } as never), 'production');
  assert.equal(ingEnv({ VERCEL_ENV: 'preview' } as never), 'staging');
  assert.equal(ingEnv({ NODE_ENV: 'production' } as never), 'development', 'lokaler next start');
  assert.equal(ingEnv({ ING_ENV: 'Staging' } as never), 'staging');
  assert.equal(ingEnv({ ING_ENV: 'unsinn' } as never), 'development');
  assert.ok(isLiveEnv({ ING_ENV: 'staging' } as never) && isLiveEnv({ ING_ENV: 'production' } as never) && !isLiveEnv({} as never));
  assert.ok(isDemoEmail(' Inhaber@DEMO.ing.test ') && !isDemoEmail('inhaber@ing-gutachten.de'));
});

test('Das bekannte Demo-Passwort stimmt mit dem Seed überein und ist in der Passwort-Richtlinie gesperrt', () => {
  const seed = readFileSync(new URL('../../scripts/seed-demo.ts', import.meta.url), 'utf8').match(/DEMO_PASSWORD = '([^']+)'/)![1];
  assert.equal(KNOWN_DEMO_PASSWORD, seed);
  assert.ok(validatePasswordPolicy(KNOWN_DEMO_PASSWORD, { email: 'x@example.test' }), 'Richtlinie lehnt es ab');
});

test('Lokal (development) funktionieren Demo-Konten wie bisher', async () => {
  delete process.env.ING_ENV; delete process.env.VERCEL_ENV;
  const { user, password } = await makeUser({ email: 'inhaber@demo.ing.test', password: KNOWN_DEMO_PASSWORD });
  assert.equal(user.email, 'inhaber@demo.ing.test');
  const r = await authenticate('inhaber@demo.ing.test', password, ctx);
  assert.ok(r.ok);
});

for (const env of ['staging', 'production'] as const) {
  test(`${env}: Demo-Konto und bekanntes Demo-Passwort werden abgewiesen – auch wenn sie in der Datenbank stehen`, async () => {
    process.env.ING_ENV = env;
    const demo = await makeUser({ email: 'buero@demo.ing.test', password: KNOWN_DEMO_PASSWORD });
    const r1 = await authenticate('buero@demo.ing.test', demo.password, ctx);
    assert.deepEqual(r1, { ok: false, reason: 'invalid' }, 'Demo-Adresse');
    const real = await makeUser({ email: 'echt@ing-gutachten.example', password: KNOWN_DEMO_PASSWORD });
    const r2 = await authenticate('echt@ing-gutachten.example', real.password, ctx);
    assert.deepEqual(r2, { ok: false, reason: 'invalid' }, 'echte Adresse, aber das bekannte Demo-Passwort');
    assert.equal(await db.session.count(), 0, 'keine Sitzung entstanden');
    assert.equal(await db.auditLog.count({ where: { action: 'auth.demo_blocked' } }), 2, 'beide Versuche protokolliert');
    const ok = await makeUser({ email: 'inhaber@ing-gutachten.example', password: 'Ein-sicheres-Passwort-4711x' });
    const r3 = await authenticate('inhaber@ing-gutachten.example', ok.password, ctx);
    assert.ok(r3.ok, 'normale Konten funktionieren weiter');
  });
}
