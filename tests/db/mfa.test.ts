import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '@/server/db';
import { assertTestDb, resetDb, makeUser, asAuthUser } from './helpers';
import { authenticate, LOGIN_MAX_ATTEMPTS } from '@/server/auth/login';
import { adminResetMfa, beginEnrollment, completeChallenge, confirmEnrollment, createChallenge, decryptSecret, disableMfa, encryptSecret, mfaStatus, regenerateRecoveryCodes, CHALLENGE_MAX_ATTEMPTS } from '@/server/auth/mfa';
import { base32Decode, stepOf, totp } from '@/lib/totp';
import { DomainError } from '@/server/errors';
import { ForbiddenError } from '@/server/auth/errors';

assertTestDb();
beforeEach(resetDb);
const ctx = { ip: '203.0.113.7', userAgent: 'test' };
const NOW = Date.now(); // die Anmeldung selbst nutzt die echte Uhr; Codes werden relativ dazu berechnet

/** Konto mit aktivem zweiten Faktor; liefert Klartext-Geheimnis und Wiederherstellungscodes. */
async function mfaUser(role: 'OWNER' | 'ADMIN' | 'OFFICE' = 'OFFICE') {
  const { user, password } = await makeUser({ role });
  const au = await asAuthUser(user.id);
  const { secret } = await beginEnrollment(au);
  const plain = secret;
  const { recoveryCodes } = await confirmEnrollment(au, totp(plain, NOW), NOW);
  return { user, password, au, secret: plain, recoveryCodes };
}

test('Geheimnis liegt verschlüsselt in der Datenbank und ist manipulationssicher', async () => {
  const { user } = await makeUser();
  const au = await asAuthUser(user.id);
  const { secret, uri } = await beginEnrollment(au);
  assert.match(secret, /^[A-Z2-7]{32}$/);
  assert.ok(uri.startsWith('otpauth://totp/'));
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.ok(row.mfaSecret && !row.mfaSecret.includes(secret), 'kein Klartext in der DB');
  assert.equal(decryptSecret(row.mfaSecret!), secret);
  assert.equal(row.mfaEnabledAt, null, 'noch nicht aktiv, bevor ein Code bestätigt wurde');
  const parts = row.mfaSecret!.split(':');
  parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith('AA') ? 'BB' : 'AA');
  assert.throws(() => decryptSecret(parts.join(':')), undefined, 'veränderter Text wird erkannt');
  assert.notEqual(encryptSecret('x'), encryptSecret('x'), 'jedes Mal anderer Initialisierungsvektor');
});

test('Einrichten: falscher Code abgelehnt, richtiger aktiviert und liefert 8 Wiederherstellungscodes (nur Hashes gespeichert)', async () => {
  const { user } = await makeUser();
  const au = await asAuthUser(user.id);
  await assert.rejects(confirmEnrollment(au, '123456', NOW), /Bitte zuerst die Einrichtung/);
  const { secret } = await beginEnrollment(au);
  await assert.rejects(confirmEnrollment(au, '000000', NOW), /stimmt nicht/);
  assert.equal((await mfaStatus(user.id)).enabled, false);
  const { recoveryCodes } = await confirmEnrollment(au, totp(secret, NOW), NOW);
  assert.equal(recoveryCodes.length, 8);
  const st = await mfaStatus(user.id);
  assert.deepEqual([st.enabled, st.pending, st.recoveryLeft], [true, false, 8]);
  const stored = await db.mfaRecoveryCode.findMany({ where: { userId: user.id } });
  assert.equal(stored.length, 8);
  for (const c of recoveryCodes) assert.ok(!stored.some((s) => s.codeHash.includes(c.replace('-', ''))), 'kein Klartext');
  assert.equal(await db.auditLog.count({ where: { action: 'auth.mfa_enable', actorId: user.id } }), 1);
  await assert.rejects(beginEnrollment(au), /bereits aktiv/);
});

test('Anmeldung: Passwort allein liefert keine Sitzung; Code im zweiten Schritt schon', async () => {
  const w = await mfaUser();
  const r1 = await authenticate(w.user.email, w.password, ctx);
  assert.ok(r1.ok && r1.mfa, 'zweiter Schritt verlangt');
  if (!r1.ok || !r1.mfa) return;
  assert.equal(await db.session.count({ where: { userId: w.user.id } }), 0, 'noch keine Sitzung');
  const later = NOW + 60_000;
  const done = await completeChallenge(r1.challenge, totp(w.secret, later), ctx, later);
  assert.ok(done.ok);
  assert.equal(await db.session.count({ where: { userId: w.user.id } }), 1);
  assert.equal(await db.mfaChallenge.count({ where: { userId: w.user.id } }), 0, 'Aufgabe ist verbraucht');
  assert.equal(await db.auditLog.count({ where: { action: 'auth.login', actorId: w.user.id } }), 1);
  // dieselbe Aufgabe nicht noch einmal
  const again = await completeChallenge(r1.challenge, totp(w.secret, later), ctx, later);
  assert.deepEqual(again, { ok: false, reason: 'expired' });
});

test('Ein Code gilt nur einmal (auch in einer neuen Anmeldung), der nächste Schritt funktioniert', async () => {
  const w = await mfaUser();
  const t = NOW + 120_000; // anderer Schritt als bei der Einrichtung
  const login = async (at: number) => { const r = await authenticate(w.user.email, w.password, ctx); assert.ok(r.ok && r.mfa); return r.ok && r.mfa ? r.challenge : ''; };
  assert.ok((await completeChallenge(await login(t), totp(w.secret, t), ctx, t)).ok);
  const replay = await completeChallenge(await login(t), totp(w.secret, t), ctx, t);
  assert.deepEqual(replay, { ok: false, reason: 'invalid' }, 'Wiederverwendung desselben Codes wird abgelehnt');
  const next = t + 30_000;
  assert.ok((await completeChallenge(await login(next), totp(w.secret, next), ctx, next)).ok);
});

test('Falsche Codes: Versuche und Konto-Sperre; Aufgabe verfällt nach Zeit und nach zu vielen Versuchen', async () => {
  const w = await mfaUser();
  const r = await authenticate(w.user.email, w.password, ctx);
  assert.ok(r.ok && r.mfa);
  if (!r.ok || !r.mfa) return;
  const t = NOW + 200_000;
  for (let i = 0; i < LOGIN_MAX_ATTEMPTS - 1; i++) assert.deepEqual(await completeChallenge(r.challenge, '000000', ctx, t), { ok: false, reason: 'invalid' });
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: w.user.id } })).failedLogins, LOGIN_MAX_ATTEMPTS - 1);
  assert.deepEqual(await completeChallenge(r.challenge, '000000', ctx, t), { ok: false, reason: 'locked' }, 'letzter Fehlversuch sperrt das Konto');
  assert.equal(await db.mfaChallenge.count({ where: { userId: w.user.id } }), 0);
  assert.equal(await db.session.count({ where: { userId: w.user.id } }), 0);
  assert.ok(await db.auditLog.count({ where: { action: 'auth.mfa_failed', actorId: w.user.id } }) >= LOGIN_MAX_ATTEMPTS);
  assert.ok(CHALLENGE_MAX_ATTEMPTS >= 3);

  const x = await mfaUser();
  const c = await createChallenge(x.user.id, NOW);
  assert.deepEqual(await completeChallenge(c, totp(x.secret, NOW + 6 * 60_000), ctx, NOW + 6 * 60_000), { ok: false, reason: 'expired' }, 'nach 5 Minuten abgelaufen');
});

test('Wiederherstellungscode: einmal verwendbar, protokolliert, andere Konten unberührt', async () => {
  const w = await mfaUser();
  const other = await mfaUser();
  const code = w.recoveryCodes[0];
  const login = async () => { const r = await authenticate(w.user.email, w.password, ctx); return r.ok && r.mfa ? r.challenge : ''; };
  const ok = await completeChallenge(await login(), code.toUpperCase(), ctx, NOW);
  assert.ok(ok.ok && ok.usedRecovery);
  assert.equal((await mfaStatus(w.user.id)).recoveryLeft, 7);
  assert.deepEqual(await completeChallenge(await login(), code, ctx, NOW), { ok: false, reason: 'invalid' }, 'derselbe Code kein zweites Mal');
  assert.deepEqual(await completeChallenge(await login(), other.recoveryCodes[0], ctx, NOW), { ok: false, reason: 'invalid' }, 'Code eines anderen Kontos gilt nicht');
  assert.equal(await db.auditLog.count({ where: { action: 'auth.mfa_recovery_used', actorId: w.user.id } }), 1);
});

test('Abschalten verlangt Passwort und Code; bei Pflicht nicht erlaubt; neue Codes machen alte ungültig', async () => {
  const w = await mfaUser();
  await assert.rejects(disableMfa(w.au, 'falsch-falsch-falsch', totp(w.secret, NOW + 90_000), false, NOW + 90_000), DomainError);
  await assert.rejects(disableMfa(w.au, w.password, '000000', false, NOW + 90_000), DomainError);
  await assert.rejects(disableMfa(w.au, w.password, totp(w.secret, NOW + 90_000), true, NOW + 90_000), ForbiddenError, 'Pflicht: kein Abschalten');
  const fresh = await regenerateRecoveryCodes(w.au, totp(w.secret, NOW + 120_000), NOW + 120_000);
  assert.equal(fresh.length, 8);
  const r = await authenticate(w.user.email, w.password, ctx);
  assert.ok(r.ok && r.mfa);
  if (!r.ok || !r.mfa) return;
  assert.deepEqual(await completeChallenge(r.challenge, w.recoveryCodes[1], ctx, NOW), { ok: false, reason: 'invalid' }, 'alter Code verfallen');
  const t = NOW + 150_000;
  await disableMfa(w.au, w.password, totp(w.secret, t), false, t);
  const after = await mfaStatus(w.user.id);
  assert.deepEqual([after.enabled, after.pending, after.recoveryLeft], [false, false, 0]);
  const plain = await authenticate(w.user.email, w.password, ctx);
  assert.ok(plain.ok && !plain.mfa, 'danach wieder Anmeldung nur mit Passwort');
});

test('Leitung kann den zweiten Faktor zurücksetzen (Sitzungen enden); Administratoren nicht den eines Inhabers', async () => {
  const owner = await mfaUser('OWNER');
  const staff = await mfaUser('OFFICE');
  const adminUser = await makeUser({ role: 'ADMIN' });
  const admin = await asAuthUser(adminUser.user.id);
  const ownerAu = await asAuthUser(owner.user.id);
  const officeAu = await asAuthUser((await makeUser({ role: 'OFFICE' })).user.id);
  await db.session.create({ data: { userId: staff.user.id, tokenHash: 'h'.repeat(64), expiresAt: new Date(Date.now() + 3600_000) } });
  await assert.rejects(adminResetMfa(officeAu, staff.user.id), ForbiddenError, 'Büro darf nicht');
  await assert.rejects(adminResetMfa(admin, owner.user.id), ForbiddenError, 'Administrator nicht gegen Inhaber');
  await adminResetMfa(admin, staff.user.id);
  assert.equal((await mfaStatus(staff.user.id)).enabled, false);
  assert.equal(await db.session.count({ where: { userId: staff.user.id, revokedAt: null } }), 0);
  await assert.rejects(adminResetMfa(admin, staff.user.id), /keine Zwei-Faktor/);
  await adminResetMfa(ownerAu, owner.user.id);
  assert.equal(await db.auditLog.count({ where: { action: 'auth.mfa_reset' } }), 2);
  assert.ok(base32Decode(owner.secret).length === 20 && stepOf(NOW) > 0);
});
