import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '@/server/db';
import { assertTestDb, resetDb, makeUser, asAuthUser } from './helpers';
import { appsFor } from '@/lib/studio-apps';
import { getStudioPrefs, resetStudioPrefs, saveStudioPrefs } from '@/server/studio/prefs';
import { buildNotices } from '@/server/admin/notices';
import { dashboardCounts } from '@/server/pipeline/today';
import { DomainError } from '@/server/errors';

assertTestDb();
beforeEach(resetDb);

const allowedOf = (u: Awaited<ReturnType<typeof asAuthUser>>) => new Set(appsFor((p) => u.permissions.has(p)).map((a) => a.id));
const win = (appId: string, url = `/admin/${appId}/`) => ({ appId, url, title: appId, x: 100, y: 80, w: 900, h: 600, min: false, max: false, snap: null, z: 11 });

test('Apps erscheinen nur, wenn die Rolle sie sehen darf', async () => {
  const owner = await asAuthUser((await makeUser({ role: 'OWNER' })).user.id);
  const expert = await asAuthUser((await makeUser({ role: 'EXPERT' })).user.id);
  const acc = await asAuthUser((await makeUser({ role: 'ACCOUNTING' })).user.id);
  const cm = await asAuthUser((await makeUser({ role: 'CONTENT_MANAGER' })).user.id);
  const o = allowedOf(owner), e = allowedOf(expert), a = allowedOf(acc), c = allowedOf(cm);
  for (const id of ['faelle', 'finanzen', 'verwaltung', 'benutzer', 'protokoll', 'kalkulation', 'gutachten']) assert.ok(o.has(id), `Inhaber: ${id}`);
  assert.ok(e.has('faelle') && e.has('kalkulation') && e.has('bewertung') && e.has('gutachten'));
  assert.ok(!e.has('finanzen') && !e.has('benutzer') && !e.has('verwaltung'), 'Gutachter: kein Geld, keine Benutzer');
  assert.ok(a.has('finanzen') && !a.has('kalkulation') && !a.has('benutzer'), 'Buchhaltung: Finanzen ja, Kalkulation nein');
  assert.ok(!c.has('faelle') && !c.has('kunden') && !c.has('finanzen'), 'Website-Rolle: keine Kundendaten-Apps');
  assert.ok(c.has('uebersicht'), 'jede Rolle hat die Übersicht');
});

test('Einstellungen: Standardwerte, Speichern, nur eigenes Konto', async () => {
  const a = await asAuthUser((await makeUser({ role: 'OFFICE' })).user.id);
  const b = await asAuthUser((await makeUser({ role: 'OFFICE' })).user.id);
  const p0 = await getStudioPrefs(a, allowedOf(a));
  assert.deepEqual([p0.settings.theme, p0.settings.wallpaper, p0.windows.length], ['dark', 'ing-blue', 0]);
  assert.ok(p0.pinned.length > 0 && p0.pinned.every((id) => allowedOf(a).has(id)), 'Standard angeheftet, aber nur erlaubte Apps');
  await saveStudioPrefs(a, { settings: { theme: 'light', wallpaper: 'daylight' }, windows: [win('faelle')], pinned: ['kunden'] }, allowedOf(a));
  const pa = await getStudioPrefs(a, allowedOf(a));
  assert.deepEqual([pa.settings.theme, pa.settings.wallpaper, pa.windows.length, pa.pinned], ['light', 'daylight', 1, ['kunden']]);
  const pb = await getStudioPrefs(b, allowedOf(b));
  assert.equal(pb.settings.theme, 'dark', 'anderes Konto unberührt');
  assert.equal(await db.userPreference.count(), 1);
  await saveStudioPrefs(a, { settings: { theme: 'system' } }, allowedOf(a));
  assert.equal((await getStudioPrefs(a, allowedOf(a))).settings.theme, 'system', 'Überschreiben statt Duplizieren');
  assert.equal(await db.userPreference.count(), 1);
  await resetStudioPrefs(a);
  assert.equal((await getStudioPrefs(a, allowedOf(a))).settings.theme, 'dark');
});

test('Gespeicherte Fenster: unerlaubte Apps, fremde Adressen und Unsinn werden entfernt', async () => {
  const exp = await asAuthUser((await makeUser({ role: 'EXPERT' })).user.id);
  const saved = await saveStudioPrefs(exp, {
    windows: [win('faelle'), win('finanzen'), win('faelle', 'https://evil.example/'), win('faelle', '//evil.example/admin'), win('faelle', 'javascript:alert(1)'), { ...win('settings'), url: '' }],
    pinned: ['finanzen', 'faelle'],
    recents: [{ appId: 'finanzen', url: '/admin/rechnungen/x/', title: 'x', at: 1 }, { appId: 'faelle', url: '/admin/faelle/ING-1/', title: 'Fall', at: 2 }],
    geometry: { finanzen: { x: 1, y: 1, w: 500, h: 400 }, faelle: { x: 1, y: 1, w: 500, h: 400 } },
  }, allowedOf(exp));
  assert.deepEqual(saved.windows.map((w) => w.appId), ['faelle', 'settings']);
  assert.deepEqual(saved.pinned, ['faelle']);
  assert.deepEqual(saved.recents.map((r) => r.appId), ['faelle']);
  assert.deepEqual(Object.keys(saved.geometry), ['faelle']);
});

test('Ungültige oder übergroße Einstellungen werden abgewiesen, nicht gespeichert', async () => {
  const a = await asAuthUser((await makeUser({ role: 'OFFICE' })).user.id);
  await assert.rejects(saveStudioPrefs(a, { windows: Array.from({ length: 50 }, () => win('faelle')) }, allowedOf(a)), DomainError, 'zu viele Fenster');
  await assert.rejects(saveStudioPrefs(a, { windows: [{ ...win('faelle'), x: 'abc' }] }, allowedOf(a)), DomainError);
  await assert.rejects(saveStudioPrefs(a, 'kaputt', allowedOf(a)), DomainError);
  assert.equal(await db.userPreference.count(), 0);
  await assert.rejects(db.userPreference.create({ data: { userId: a.id, key: '', value: {} } }), /user_preferences_key_chk|check/i, 'Datenbank: Schlüssel darf nicht leer sein');
});

test('Kaputte gespeicherte Daten lassen das Studio trotzdem starten (Standardwerte)', async () => {
  const a = await asAuthUser((await makeUser({ role: 'OFFICE' })).user.id);
  await db.userPreference.create({ data: { userId: a.id, key: 'studio', value: { settings: { theme: 'neon' }, windows: 'kaputt' } } });
  const p = await getStudioPrefs(a, allowedOf(a));
  assert.deepEqual([p.settings.theme, p.windows.length], ['dark', 0]);
});

test('Einstellungen hängen per Kaskade am Benutzerkonto (kein verwaister Datensatz)', async () => {
  const rows = await db.$queryRaw<{ confdeltype: string }[]>`SELECT confdeltype::text FROM pg_constraint WHERE conname = 'user_preferences_user_id_fkey'`;
  assert.equal(rows[0]?.confdeltype, 'c');
});

test('Hinweise für die Benachrichtigungszentrale kommen aus den echten Zählern', async () => {
  const owner = await asAuthUser((await makeUser({ role: 'OWNER' })).user.id);
  const c = await dashboardCounts(owner);
  assert.deepEqual(buildNotices(c), [], 'ohne Daten keine Hinweise');
  assert.deepEqual(buildNotices(null), []);
  const n = buildNotices({ ...c, newLeads: 3, failedMail: 0, unassigned: 2 } as never);
  assert.deepEqual(n.map((x) => [x.id, x.count]), [['new', 3], ['unassigned', 2]]);
});
