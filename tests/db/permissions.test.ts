import test from 'node:test';
import assert from 'node:assert/strict';
import { PERMISSIONS, ROLE_PERMISSIONS, effectivePermissions, type Permission } from '@/server/auth/permissions';

const has = (role: keyof typeof ROLE_PERMISSIONS, p: Permission) => ROLE_PERMISSIONS[role].includes(p);

test('OWNER hat jedes Recht, ADMIN alle außer dem Vergeben der Inhaberrolle', () => {
  for (const p of PERMISSIONS) assert.ok(has('OWNER', p), p);
  for (const p of PERMISSIONS) assert.equal(has('ADMIN', p), p !== 'users.write.owner', p);
});

test('EXPERT: nur eigene Fälle, keine Abrechnung, kein CMS, keine Benutzerverwaltung', () => {
  for (const p of ['cases.read.all', 'cases.write.all', 'invoices.read', 'invoices.write', 'cms.write', 'users.read', 'settings.read', 'leads.read', 'photos.read.all', 'documents.read.all'] as Permission[]) {
    assert.equal(has('EXPERT', p), false, p);
  }
  for (const p of ['cases.read.own', 'photos.write.own', 'documents.write.own', 'reports.write.own', 'appointments.read.own'] as Permission[]) {
    assert.ok(has('EXPERT', p), p);
  }
});

test('CONTENT_MANAGER sieht keinerlei Kunden-, Fall-, Foto-, Dokument- oder Rechnungsdaten', () => {
  const forbidden = PERMISSIONS.filter((p) => /^(leads|customers|vehicles|cases|appointments|photos|documents|reports|invoices|payments|tasks|communication)\./.test(p));
  for (const p of forbidden) assert.equal(has('CONTENT_MANAGER', p), false, p);
  assert.ok(has('CONTENT_MANAGER', 'cms.write'));
  assert.equal(has('CONTENT_MANAGER', 'cms.publish'), false, 'Veröffentlichen erst nach Freigabe durch Inhaber/Admin');
});

test('ACCOUNTING: Rechnungen ja, Fälle schreiben/Fotos nein', () => {
  assert.ok(has('ACCOUNTING', 'invoices.write') && has('ACCOUNTING', 'payments.write'));
  for (const p of ['cases.write.all', 'cases.status', 'photos.read.all', 'cms.read', 'users.read'] as Permission[]) assert.equal(has('ACCOUNTING', p), false, p);
});

test('OFFICE: Anfragen/Kunden/Fälle/Termine ja; löschen, Benutzer, Einstellungen, Rechnungen schreiben nein', () => {
  for (const p of ['leads.convert', 'customers.write', 'cases.write.all', 'appointments.write.all', 'communication.write.all'] as Permission[]) assert.ok(has('OFFICE', p), p);
  for (const p of ['cases.delete', 'users.read', 'settings.write', 'invoices.write', 'cms.write', 'data.anonymize'] as Permission[]) assert.equal(has('OFFICE', p), false, p);
});

test('Nur OWNER/ADMIN verwalten Benutzer und Einstellungen', () => {
  for (const role of ['OFFICE', 'EXPERT', 'ACCOUNTING', 'CONTENT_MANAGER'] as const) {
    for (const p of ['users.write', 'settings.write', 'audit.read'] as Permission[]) assert.equal(has(role, p), false, `${role} ${p}`);
  }
});

test('Overrides: Recht gewähren, entziehen, unbekannte Schlüssel ignorieren, OWNER bleibt vollständig', () => {
  const grant = effectivePermissions('OFFICE', [{ permission: 'invoices.write', granted: true }]);
  assert.ok(grant.has('invoices.write'));
  const deny = effectivePermissions('OFFICE', [{ permission: 'cases.write.all', granted: false }]);
  assert.equal(deny.has('cases.write.all'), false);
  const junk = effectivePermissions('OFFICE', [{ permission: 'nonsense.permission', granted: true }]);
  assert.equal(junk.size, ROLE_PERMISSIONS.OFFICE.length);
  const owner = effectivePermissions('OWNER', [{ permission: 'users.write', granted: false }]);
  assert.ok(owner.has('users.write'));
});
