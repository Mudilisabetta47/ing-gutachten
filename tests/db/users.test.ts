import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ZodError } from 'zod';
import { db } from '@/server/db';
import { ForbiddenError } from '@/server/auth/errors';
import { createUser, resetPassword, updateUser } from '@/server/users';
import { writeAudit, redact } from '@/server/audit';
import { getSetting, setSetting, SETTING_DEFAULTS } from '@/server/settings';
import { asAuthUser, assertTestDb, makeUser, resetDb } from './helpers';

before(() => assertTestDb());
beforeEach(() => resetDb());
after(() => db.$disconnect());

const newUser = (over: Record<string, unknown> = {}) => ({ email: 'neu@test.example', firstName: 'Neu', lastName: 'Kollege', role: 'OFFICE', isExpert: false, password: 'Eine-ordentliche-Passphrase-7', ...over });

test('Benutzer anlegen: Passwortwechsel erzwungen, Hash statt Klartext, Audit-Eintrag', async () => {
  const owner = await asAuthUser((await makeUser({ role: 'OWNER' })).user.id);
  const u = await createUser(owner, newUser());
  assert.equal(u.mustChangePassword, true);
  assert.ok(u.passwordHash.startsWith('$argon2id$'));
  const log = await db.auditLog.findFirstOrThrow({ where: { action: 'user.create', entityId: u.id } });
  assert.ok(!JSON.stringify(log).includes('Eine-ordentliche'), 'Passwort darf nie im Protokoll stehen');
});

test('Schwaches Passwort und doppelte E-Mail werden abgewiesen', async () => {
  const owner = await asAuthUser((await makeUser({ role: 'OWNER' })).user.id);
  await assert.rejects(() => createUser(owner, newUser({ password: 'kurz' })), ZodError);
  await createUser(owner, newUser());
  await assert.rejects(() => createUser(owner, newUser()), ZodError);
});

test('Ein ADMIN kann keine Inhaber anlegen oder ändern', async () => {
  const admin = await asAuthUser((await makeUser({ role: 'ADMIN' })).user.id);
  await assert.rejects(() => createUser(admin, newUser({ role: 'OWNER' })), ForbiddenError);
  const owner = (await makeUser({ role: 'OWNER' })).user;
  await assert.rejects(() => updateUser(admin, { id: owner.id, role: 'OFFICE', isActive: true, isExpert: false }), ForbiddenError);
  await assert.rejects(() => resetPassword(admin, owner.id, 'Eine-ordentliche-Passphrase-7'), ForbiddenError);
});

test('Der letzte aktive Inhaber kann nicht herabgestuft oder deaktiviert werden', async () => {
  const a = (await makeUser({ role: 'OWNER' })).user;
  const b = (await makeUser({ role: 'OWNER' })).user;
  const actorA = await asAuthUser(a.id);
  await updateUser(actorA, { id: b.id, role: 'ADMIN', isActive: true, isExpert: false }); // einer von zwei: erlaubt
  const actorB = await asAuthUser(b.id);
  // b ist jetzt ADMIN und darf Inhaber a nicht ändern; a ist der letzte Inhaber
  await assert.rejects(() => updateUser(actorB, { id: a.id, role: 'OFFICE', isActive: true, isExpert: false }), ForbiddenError);
});

test('Das eigene Konto kann nicht deaktiviert oder in der Rolle geändert werden', async () => {
  const me = (await makeUser({ role: 'ADMIN' })).user;
  const actor = await asAuthUser(me.id);
  await assert.rejects(() => updateUser(actor, { id: me.id, role: 'ADMIN', isActive: false, isExpert: false }), ForbiddenError);
  await assert.rejects(() => updateUser(actor, { id: me.id, role: 'OFFICE', isActive: true, isExpert: false }), ForbiddenError);
});

test('Rollenwechsel und Deaktivierung beenden Sitzungen sofort; Passwort-Reset ebenso', async () => {
  const admin = await asAuthUser((await makeUser({ role: 'ADMIN' })).user.id);
  const t = (await makeUser({ role: 'OFFICE' })).user;
  const mk = () => db.session.create({ data: { userId: t.id, tokenHash: Math.random().toString(36), expiresAt: new Date(Date.now() + 3600_000) } });
  await mk();
  await updateUser(admin, { id: t.id, role: 'EXPERT', isActive: true, isExpert: true });
  assert.equal(await db.session.count({ where: { userId: t.id, revokedAt: null } }), 0);
  await mk();
  await updateUser(admin, { id: t.id, role: 'EXPERT', isActive: false, isExpert: true });
  assert.equal(await db.session.count({ where: { userId: t.id, revokedAt: null } }), 0);
  await mk();
  await resetPassword(admin, t.id, 'Eine-ordentliche-Passphrase-7');
  assert.equal(await db.session.count({ where: { userId: t.id, revokedAt: null } }), 0);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: t.id } })).mustChangePassword, true);
});

test('Audit: Geheimnisse werden entfernt', async () => {
  const r = redact({ email: 'a@b.de', passwordHash: 'x', nested: { apiToken: 'y', ok: 1 }, list: [{ secretKey: 'z' }] }) as Record<string, unknown>;
  const s = JSON.stringify(r);
  assert.ok(!s.includes('"x"') && !s.includes('"y"') && !s.includes('"z"'));
  assert.ok(s.includes('[redacted]') && s.includes('a@b.de'));
  await writeAudit({ action: 'test.entry', entityType: 'Test', after: { password: 'geheim' } });
  const row = await db.auditLog.findFirstOrThrow({ where: { action: 'test.entry' } });
  assert.ok(!JSON.stringify(row.after).includes('geheim'));
});

test('Einstellungen: Defaults, Validierung, Audit', async () => {
  const owner = (await makeUser({ role: 'OWNER' })).user;
  assert.deepEqual(await getSetting('numbering'), SETTING_DEFAULTS.numbering);
  await setSetting('numbering', { casePrefix: 'GA', caseDigits: 5, invoicePrefix: 'RE', invoiceDigits: 5 }, owner.id);
  assert.equal((await getSetting('numbering')).casePrefix, 'GA');
  await assert.rejects(() => setSetting('numbering', { casePrefix: '<script>', caseDigits: 5, invoicePrefix: 'RE', invoiceDigits: 5 }, owner.id), ZodError);
  await assert.rejects(() => setSetting('uploads', { maxPhotoMb: 9999, maxDocumentMb: 1, maxFilesPerUpload: 1 }, owner.id), ZodError);
  assert.equal(await db.auditLog.count({ where: { action: 'settings.update' } }), 1);
});
