import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '@/server/db';
import { authenticate, LOGIN_MAX_ATTEMPTS } from '@/server/auth/login';
import { hashToken, revokeAllSessions } from '@/server/auth/session';
import { validatePasswordPolicy } from '@/server/auth/password';
import { assertTestDb, makeUser, resetDb } from './helpers';

const ctx = { ip: '203.0.113.7', userAgent: 'node-test' };

before(() => assertTestDb());
beforeEach(() => resetDb());
after(() => db.$disconnect());

test('Erfolgreiche Anmeldung: Session mit gehashtem Token, Audit, Zähler zurückgesetzt', async () => {
  const { user, password } = await makeUser();
  await db.user.update({ where: { id: user.id }, data: { failedLogins: 3 } });
  const r = await authenticate(user.email.toUpperCase(), password, ctx); // E-Mail ist case-insensitiv
  assert.ok(r.ok);
  if (!r.ok) return;
  const s = await db.session.findFirstOrThrow({ where: { userId: user.id } });
  assert.notEqual(s.tokenHash, r.token, 'der Klartext-Token darf nicht in der DB stehen');
  assert.equal(s.tokenHash, hashToken(r.token));
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: user.id } })).failedLogins, 0);
  assert.equal(await db.auditLog.count({ where: { action: 'auth.login', actorId: user.id } }), 1);
});

test('Falsches Passwort und unbekannte E-Mail liefern dieselbe Antwort', async () => {
  const { user } = await makeUser();
  const wrong = await authenticate(user.email, 'falsch-falsch-falsch', ctx);
  const unknown = await authenticate('gibt-es-nicht@test.example', 'falsch-falsch-falsch', ctx);
  assert.deepEqual(wrong, { ok: false, reason: 'invalid' });
  assert.deepEqual(unknown, { ok: false, reason: 'invalid' });
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: user.id } })).failedLogins, 1);
  assert.equal(await db.session.count(), 0);
});

test('Konto-Sperre nach zu vielen Fehlversuchen – auch das richtige Passwort wird dann abgewiesen', async () => {
  const { user, password } = await makeUser();
  for (let i = 0; i < LOGIN_MAX_ATTEMPTS; i++) await authenticate(user.email, 'falsch-falsch-falsch', { ...ctx, ip: `198.51.100.${i}` });
  const locked = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.ok(locked.lockedUntil && locked.lockedUntil > new Date());
  const r = await authenticate(user.email, password, { ...ctx, ip: '198.51.100.99' });
  assert.equal(r.ok, false);
});

test('Drosselung je IP', async () => {
  for (let i = 0; i < 20; i++) await authenticate(`x${i}@test.example`, 'falsch-falsch-falsch', ctx);
  const { user, password } = await makeUser();
  const r = await authenticate(user.email, password, ctx);
  assert.deepEqual(r, { ok: false, reason: 'throttled' });
});

test('Deaktivierte Konten können sich nicht anmelden', async () => {
  const { user, password } = await makeUser({ isActive: false });
  assert.equal((await authenticate(user.email, password, ctx)).ok, false);
});

test('revokeAllSessions beendet alle Sitzungen (außer optional einer)', async () => {
  const { user, password } = await makeUser();
  await authenticate(user.email, password, { ...ctx, ip: '192.0.2.1' });
  await authenticate(user.email, password, { ...ctx, ip: '192.0.2.2' });
  const [a] = await db.session.findMany({ where: { userId: user.id } });
  await revokeAllSessions(user.id, a.id);
  assert.equal(await db.session.count({ where: { userId: user.id, revokedAt: null } }), 1);
  await revokeAllSessions(user.id);
  assert.equal(await db.session.count({ where: { userId: user.id, revokedAt: null } }), 0);
});

test('Passwort-Richtlinie', () => {
  assert.ok(validatePasswordPolicy('kurz'));
  assert.ok(validatePasswordPolicy('aaaaaaaaaaaaaaaa'));
  assert.ok(validatePasswordPolicy('passwort1234'));
  assert.ok(validatePasswordPolicy('maxmustermann-2026', { email: 'maxmustermann@firma.de' }));
  assert.equal(validatePasswordPolicy('Eine-ordentliche-Passphrase-7'), null);
});
