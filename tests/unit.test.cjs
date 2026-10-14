/* Unit-Tests für die serverseitige Logik (Validierung, Dateitypen, Rate Limit, Mail-Provider, SITE_URL). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const lib = (p) => require(path.join(__dirname, '..', '.test-build', 'lib', p));

const schema = lib('request-schema');
const { rateLimit } = lib('rate-limit');

const valid = { anlass: 'Unfall', fahrzeug: 'PKW', name: 'Max Muster', telefon: '0511 1234567', email: 'max@example.de', standort: '', nachricht: '', datenschutz: true };

test('validateFields: gültige Eingabe', () => {
  assert.deepEqual(schema.validateFields(valid), {});
});
test('validateFields: Pflichtfelder und Formate', () => {
  const e = schema.validateFields({ ...valid, anlass: 'x', name: '', telefon: '12', email: 'kaputt', datenschutz: false });
  assert.ok(e.anlass && e.name && e.telefon && e.email && e.datenschutz);
});
test('validateFields: Schrittbegrenzung', () => {
  assert.deepEqual(schema.validateFields({ ...valid, name: '' }, 'schaden'), {});
  assert.ok(schema.validateFields({ ...valid, name: '' }, 'kontakt').name);
});
test('clean: Steuerzeichen, Weißraum, Länge', () => {
  assert.equal(schema.clean('  a \u0000\u0007 b\n c  ', 50), 'a b c');
  assert.equal(schema.clean('x'.repeat(500), 10).length, 10);
  assert.equal(schema.clean(42, 10), '');
  assert.equal(schema.clean('a\n\n\n\nb', 50, true), 'a\n\nb');
});
test('detectType: Magic Bytes statt Dateiname', () => {
  assert.equal(schema.detectType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0])).ext, 'jpg');
  assert.equal(schema.detectType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])).ext, 'png');
  const webp = new Uint8Array(16); webp.set([0x52, 0x49, 0x46, 0x46], 0); webp.set([0x57, 0x45, 0x42, 0x50], 8);
  assert.equal(schema.detectType(webp).ext, 'webp');
  assert.equal(schema.detectType(Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 1])).ext, 'pdf');
});
test('detectType: SVG, HTML, EXE werden abgelehnt', () => {
  const enc = (s) => new TextEncoder().encode(s);
  assert.equal(schema.detectType(enc('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
  assert.equal(schema.detectType(enc('<!doctype html><script>')), null);
  assert.equal(schema.detectType(Uint8Array.from([0x4d, 0x5a, 0x90, 0, 3])), null);
  assert.equal(schema.detectType(new Uint8Array(0)), null);
});
test('rateLimit: sperrt nach dem Maximum, trennt Schlüssel', () => {
  for (let i = 0; i < 3; i++) assert.equal(rateLimit('a', 3, 60000).ok, true);
  const blocked = rateLimit('a', 3, 60000);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfter > 0);
  assert.equal(rateLimit('b', 3, 60000).ok, true);
});

/* ---------- Mail-Provider mit gestubbtem fetch ---------- */
const message = {
  to: 'inbox@example.de',
  from: { email: 'web@example.de', name: 'Web' },
  replyTo: { email: 'kunde@example.de', name: 'Kunde' },
  subject: 'Betreff',
  html: '<p>x</p>',
  text: 'x',
  attachments: [{ filename: 'foto-1.jpg', contentBase64: 'QUJD', mime: 'image/jpeg' }],
};
function stubFetch(status = 200) {
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init }); return { ok: status < 400, status }; };
  return calls;
}
test('Brevo: Endpunkt, Header, Body, Anhänge', async () => {
  const { brevoProvider } = lib('mail/brevo');
  const calls = stubFetch();
  await brevoProvider('KEY').send(message);
  assert.equal(calls[0].url, 'https://api.brevo.com/v3/smtp/email');
  assert.equal(calls[0].init.headers['api-key'], 'KEY');
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(body.to, [{ email: 'inbox@example.de' }]);
  assert.deepEqual(body.attachment, [{ name: 'foto-1.jpg', content: 'QUJD' }]);
  assert.equal(body.replyTo.email, 'kunde@example.de');
});
test('Resend: Endpunkt, Bearer, Body, Anhänge', async () => {
  const { resendProvider } = lib('mail/resend');
  const calls = stubFetch();
  await resendProvider('KEY').send(message);
  assert.equal(calls[0].url, 'https://api.resend.com/emails');
  assert.equal(calls[0].init.headers.authorization, 'Bearer KEY');
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(body.attachments, [{ filename: 'foto-1.jpg', content: 'QUJD' }]);
  assert.equal(body.reply_to, 'kunde@example.de');
});
test('Provider: Fehlerstatus wirft MailError', async () => {
  const { brevoProvider } = lib('mail/brevo');
  stubFetch(401);
  await assert.rejects(() => brevoProvider('X').send(message), /401/);
});
test('getMailConfig: ohne Konfiguration → null (kein Fake-Versand)', () => {
  const { getMailConfig } = lib('mail');
  for (const k of ['MAIL_PROVIDER', 'BREVO_API_KEY', 'RESEND_API_KEY', 'MAIL_FROM', 'MAIL_TO']) delete process.env[k];
  assert.equal(getMailConfig(), null);
  process.env.MAIL_FROM = 'a@b.de'; process.env.MAIL_TO = 'c@d.de';
  assert.equal(getMailConfig(), null, 'Brevo ohne Key');
  process.env.BREVO_API_KEY = 'k';
  assert.equal(getMailConfig().provider.id, 'brevo');
  process.env.MAIL_PROVIDER = 'resend';
  assert.equal(getMailConfig(), null, 'Resend ohne Key');
  process.env.RESEND_API_KEY = 'k';
  assert.equal(getMailConfig().provider.id, 'resend');
});
const base = { MAIL_PROVIDER: 'dry-run', MAIL_FROM: 'a@b.de', MAIL_TO: 'c@d.de' };
test('Dry-Run-Guard: Vercel Production → Konfigurationsfehler, egal welche Flags', () => {
  const { getMailConfig, MailConfigError } = lib('mail');
  for (const extra of [{}, { ALLOW_PREVIEW_DRY_RUN: 'true' }, { NODE_ENV: 'development' }]) {
    assert.throws(() => getMailConfig({ ...base, VERCEL_ENV: 'production', ...extra }), MailConfigError);
  }
});
test('Dry-Run-Guard: Vercel Preview nur mit ALLOW_PREVIEW_DRY_RUN=true', () => {
  const { getMailConfig, MailConfigError } = lib('mail');
  assert.throws(() => getMailConfig({ ...base, VERCEL_ENV: 'preview', NODE_ENV: 'production' }), MailConfigError);
  assert.throws(() => getMailConfig({ ...base, VERCEL_ENV: 'preview', NODE_ENV: 'production', ALLOW_PREVIEW_DRY_RUN: 'yes' }), MailConfigError);
  assert.equal(getMailConfig({ ...base, VERCEL_ENV: 'preview', NODE_ENV: 'production', ALLOW_PREVIEW_DRY_RUN: 'true' }).provider.id, 'dry-run');
});
test('Dry-Run-Guard: lokal nur im Entwicklungsmodus, nie bei next start', () => {
  const { getMailConfig, MailConfigError } = lib('mail');
  assert.equal(getMailConfig({ ...base, NODE_ENV: 'development' }).provider.id, 'dry-run');
  assert.throws(() => getMailConfig({ ...base, NODE_ENV: 'production' }), MailConfigError);
});
test('Dry-Run-Guard: Fehlermeldung enthält keine Geheimnisse', () => {
  const { getMailConfig } = lib('mail');
  try {
    getMailConfig({ ...base, BREVO_API_KEY: 'SUPERGEHEIM123', VERCEL_ENV: 'production' });
    assert.fail('sollte werfen');
  } catch (e) {
    assert.ok(!/SUPERGEHEIM123/.test(e.message));
    assert.match(e.message, /nicht erlaubt/);
  }
});
test('Echte Provider werden vom Guard nicht berührt', () => {
  const { getMailConfig } = lib('mail');
  assert.equal(getMailConfig({ MAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'k', MAIL_FROM: 'a@b.de', MAIL_TO: 'c@d.de', VERCEL_ENV: 'production' }).provider.id, 'brevo');
  assert.equal(getMailConfig({ MAIL_PROVIDER: 'brevo', VERCEL_ENV: 'production' }), null);
});

/* ---------- SITE_URL ---------- */
function siteWith(env) {
  const keys = ['SITE_URL', 'NEXT_PUBLIC_SITE_URL', 'VERCEL_ENV', 'NODE_ENV'];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  keys.forEach((k) => delete process.env[k]);
  Object.assign(process.env, env);
  delete require.cache[require.resolve(path.join(__dirname, '..', '.test-build', 'lib', 'site.js'))];
  const m = lib('site');
  keys.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k])));
  return m;
}
test('SITE_URL: Production-Fallback ist ing-gutachten.de', () => {
  assert.equal(siteWith({ NODE_ENV: 'production' }).SITE_URL, 'https://ing-gutachten.de');
});
test('SITE_URL: Vercel-Adresse wird in Production NIE Canonical', () => {
  const m = siteWith({ NODE_ENV: 'production', VERCEL_ENV: 'production', SITE_URL: 'https://ing-gutachten.vercel.app' });
  assert.equal(m.SITE_URL, 'https://ing-gutachten.de');
});
test('SITE_URL: ENV wird normalisiert, Entwicklung nutzt localhost', () => {
  assert.equal(siteWith({ NODE_ENV: 'production', SITE_URL: 'https://example.org/' }).SITE_URL, 'https://example.org');
  assert.equal(siteWith({ NODE_ENV: 'development' }).SITE_URL, 'http://localhost:3000');
});
test('IS_PREVIEW nur auf Vercel-Preview', () => {
  assert.equal(siteWith({ VERCEL_ENV: 'preview' }).IS_PREVIEW, true);
  assert.equal(siteWith({ VERCEL_ENV: 'production' }).IS_PREVIEW, false);
});

/* ------------------------------------------------------------ ING Studio: Fensterverwaltung */
const S = lib('studio');
const AREA = S.workArea({ w: 1600, h: 964 }); // 900 hoch nutzbar
const open = (st, appId, extra = {}) => S.reducer(st, { type: 'open', appId, url: `/admin/${appId}/`, title: appId, area: AREA, ...extra });

test('Studio: Fläche reserviert die Taskleiste', () => {
  assert.deepEqual(AREA, { x: 0, y: 0, w: 1600, h: 900 });
});
test('Studio: clampBounds hält die Titelleiste erreichbar und die Größe in Grenzen', () => {
  const b = S.clampBounds({ x: 5000, y: 5000, w: 50, h: 50 }, AREA);
  assert.ok(b.x <= 1600 - 120 && b.y <= 900 - 44 && b.w >= 360 && b.h >= 240);
  const c = S.clampBounds({ x: -5000, y: -40, w: 99999, h: 99999 }, AREA);
  assert.ok(c.w <= 1600 && c.h <= 900 && c.y >= 0 && c.x + c.w >= 120);
});
test('Studio: neue Fenster liegen gestaffelt und nie außerhalb', () => {
  let st = S.emptyState();
  for (const a of ['a', 'b', 'c', 'd']) st = open(st, a);
  const xs = st.windows.map((w) => w.x);
  assert.equal(new Set(xs).size, 4, 'jedes Fenster an anderer Stelle');
  for (const w of st.windows) assert.ok(w.x >= -w.w + 120 && w.x <= 1600 - 120 && w.y >= 0 && w.y <= 900 - 44);
});
test('Studio: dieselbe App öffnet nur ein Fenster (wird nach vorn geholt), mit forceNew ein weiteres', () => {
  let st = open(open(S.emptyState(), 'faelle'), 'kunden');
  const firstId = st.windows[0].id;
  st = S.reducer(st, { type: 'minimize', id: firstId });
  st = open(st, 'faelle');
  assert.equal(st.windows.length, 2);
  assert.equal(st.focus, firstId);
  assert.equal(st.windows[0].min, false, 'minimiertes Fenster wird wiederhergestellt');
  st = open(st, 'faelle', { forceNew: true });
  assert.equal(st.windows.filter((w) => w.appId === 'faelle').length, 2);
});
test('Studio: Fokus bestimmt die Ebene; Minimieren gibt den Fokus an das nächste Fenster', () => {
  let st = open(open(open(S.emptyState(), 'a'), 'b'), 'c');
  const [a, b, c] = st.windows.map((w) => w.id);
  assert.equal(st.focus, c);
  st = S.reducer(st, { type: 'focus', id: a });
  assert.equal(st.focus, a);
  assert.ok(st.windows.find((w) => w.id === a).z > st.windows.find((w) => w.id === c).z);
  st = S.reducer(st, { type: 'minimize', id: a });
  assert.equal(st.focus, c, 'oberstes sichtbares Fenster');
  st = S.reducer(st, { type: 'focus', id: a });
  assert.equal(st.windows.find((w) => w.id === a).min, false);
  st = S.reducer(st, { type: 'close', id: a });
  assert.equal(st.windows.length, 2);
  assert.notEqual(st.focus, a);
});
test('Studio: Maximieren merkt die alte Größe und stellt sie wieder her', () => {
  let st = open(S.emptyState(), 'a');
  const id = st.windows[0].id;
  const before = { x: st.windows[0].x, y: st.windows[0].y, w: st.windows[0].w, h: st.windows[0].h };
  st = S.reducer(st, { type: 'toggleMax', id, area: AREA });
  assert.deepEqual([st.windows[0].max, st.windows[0].w, st.windows[0].h], [true, 1600, 900]);
  st = S.reducer(st, { type: 'toggleMax', id, area: AREA });
  assert.deepEqual({ x: st.windows[0].x, y: st.windows[0].y, w: st.windows[0].w, h: st.windows[0].h }, before);
  assert.equal(st.windows[0].max, false);
});
test('Studio: Andocken links/rechts teilt die Fläche; Ziehen löst das Andocken', () => {
  let st = open(open(S.emptyState(), 'a'), 'b');
  const [a, b] = st.windows.map((w) => w.id);
  st = S.reducer(S.reducer(st, { type: 'snap', id: a, to: 'left', area: AREA }), { type: 'snap', id: b, to: 'right', area: AREA });
  const [wa, wb] = [st.windows[0], st.windows[1]];
  assert.deepEqual([wa.x, wa.w, wb.x, wb.w], [0, 800, 800, 800]);
  assert.equal(wa.x + wa.w, wb.x, 'keine Lücke, keine Überlappung');
  assert.ok(wa.restore && wb.restore);
  const nb = S.restoreUnderPointer(wa, { x: 400, y: 20 }, AREA);
  st = S.reducer(st, { type: 'drag', id: a, bounds: nb });
  assert.deepEqual([st.windows[0].snap, st.windows[0].max], [null, false]);
  assert.ok(st.windows[0].w < 800 || st.windows[0].w === wa.restore.w);
});
test('Studio: Andock-Zonen am Bildschirmrand', () => {
  assert.equal(S.snapZone({ x: 3, y: 400 }, AREA), 'left');
  assert.equal(S.snapZone({ x: 1597, y: 400 }, AREA), 'right');
  assert.equal(S.snapZone({ x: 800, y: 2 }, AREA), 'max');
  assert.equal(S.snapZone({ x: 800, y: 400 }, AREA), null);
});
test('Studio: Größenänderung und Browser-Resize halten Fenster im Bild', () => {
  let st = open(S.emptyState(), 'a');
  const id = st.windows[0].id;
  st = S.reducer(st, { type: 'bounds', id, bounds: { x: 100, y: 100, w: 100, h: 100 }, area: AREA });
  assert.ok(st.windows[0].w >= 360 && st.windows[0].h >= 240, 'Mindestgröße');
  st = S.reducer(st, { type: 'snap', id, to: 'right', area: AREA });
  const small = S.workArea({ w: 1000, h: 700 });
  st = S.reducer(st, { type: 'relayout', area: small });
  assert.deepEqual([st.windows[0].x, st.windows[0].w, st.windows[0].h], [500, 500, 636]);
});
test('Studio: Fenster wechseln (Zyklus) und „Desktop anzeigen“', () => {
  let st = open(open(open(S.emptyState(), 'a'), 'b'), 'c');
  const top = st.focus;
  st = S.reducer(st, { type: 'cycle', dir: 1 });
  assert.notEqual(st.focus, top);
  st = S.reducer(st, { type: 'showDesktop' });
  assert.ok(st.windows.every((w) => w.min));
  assert.equal(st.focus, null);
  st = S.reducer(st, { type: 'showDesktop' });
  assert.equal(st.windows.filter((w) => !w.min).length, 1, 'zuletzt aktives Fenster kehrt zurück');
});
test('Studio: Titel/Adresse folgen der eingebetteten Seite, Fensteranzahl ist begrenzt', () => {
  let st = open(S.emptyState(), 'a');
  st = S.reducer(st, { type: 'meta', id: st.windows[0].id, title: 'ING-2026-00001', url: '/admin/faelle/ING-2026-00001/' });
  assert.equal(st.windows[0].title, 'ING-2026-00001');
  let many = S.emptyState();
  for (let i = 0; i < 20; i++) many = open(many, `app${i}`);
  assert.equal(many.windows.length, S.MAX_WINDOWS);
});
test('Studio: nur interne Adressen dürfen in Fenstern geöffnet werden', () => {
  assert.equal(S.safeAppUrl('/admin/faelle/'), '/admin/faelle/');
  assert.equal(S.safeAppUrl('/admin/faelle/ING-1/?tab=gutachten'), '/admin/faelle/ING-1/?tab=gutachten');
  for (const bad of ['https://evil.example/', '//evil.example/admin', 'javascript:alert(1)', '/adminx/', '/admin/\\evil', '/api/admin/x', '']) assert.equal(S.safeAppUrl(bad), null, bad);
});
test('Studio: gespeicherte Einstellungen – kaputte Daten fallen auf Standard zurück, Layout wird gefiltert', () => {
  const d = S.parsePrefs('kaputt');
  assert.deepEqual([d.settings.theme, d.settings.wallpaper, d.windows.length], ['dark', 'ing-blue', 0]);
  const p = S.parsePrefs({ settings: { theme: 'neon' }, windows: [{ appId: 'faelle', url: '/admin/faelle/', title: 'F', x: 10, y: 10, w: 800, h: 500 }] });
  assert.equal(p.settings.theme, 'dark', 'ungültiger Wert → Standard');
  const wins = S.fromSaved([
    { appId: 'faelle', url: '/admin/faelle/', title: 'Fälle', x: 10, y: 10, w: 800, h: 500, min: false, max: false, snap: null, z: 11 },
    { appId: 'finanzen', url: '/admin/rechnungen/', title: 'Finanzen', x: 10, y: 10, w: 800, h: 500, min: false, max: false, snap: null, z: 12 },
    { appId: 'faelle', url: 'https://evil.example/', title: 'x', x: 10, y: 10, w: 800, h: 500, min: false, max: false, snap: null, z: 13 },
  ], new Set(['faelle']), AREA);
  assert.deepEqual(wins.map((w) => w.appId), ['faelle'], 'ohne Recht (App nicht erlaubt) und mit fremder Adresse wird nichts wiederhergestellt');
});

/* ------------------------------------------------------------ TOTP (RFC 6238) */
const T = lib('totp');
const RFC_SECRET = T.base32Encode(Buffer.from('12345678901234567890')); // Testschlüssel der RFC (SHA-1)
test('TOTP: Testwerte der RFC 6238 (SHA-1, 6 Stellen)', () => {
  assert.equal(RFC_SECRET, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  for (const [t, code] of [[59, '287082'], [1111111109, '081804'], [1111111111, '050471'], [1234567890, '005924'], [2000000000, '279037'], [20000000000, '353130']]) {
    assert.equal(T.totp(RFC_SECRET, t * 1000), code, `t=${t}`);
  }
});
test('TOTP: Base32 Hin- und Rückweg, Leerzeichen und Kleinschreibung werden toleriert', () => {
  const raw = Buffer.from([1, 2, 3, 250, 251, 252, 0, 99]);
  assert.deepEqual(T.base32Decode(T.base32Encode(raw)), raw);
  assert.deepEqual(T.base32Decode('gezd gnbv-GY3T QOJQ'), Buffer.from('1234567890'));
  assert.throws(() => T.base32Decode('!!!'));
  assert.match(T.newSecret(), /^[A-Z2-7]{32}$/);
});
test('TOTP: Prüfung toleriert ±1 Schritt, lehnt alles andere und Wiederverwendung ab', () => {
  const now = 1_700_000_000_000;
  const cur = T.stepOf(now);
  const at = (d) => T.totp(RFC_SECRET, now + d * 30_000);
  assert.equal(T.verifyTotp(RFC_SECRET, at(0), now), cur);
  assert.equal(T.verifyTotp(RFC_SECRET, at(-1), now), cur - 1, 'Uhr geht nach');
  assert.equal(T.verifyTotp(RFC_SECRET, at(1), now), cur + 1, 'Uhr geht vor');
  assert.equal(T.verifyTotp(RFC_SECRET, at(-2), now), null);
  assert.equal(T.verifyTotp(RFC_SECRET, at(3), now), null);
  assert.equal(T.verifyTotp(RFC_SECRET, at(0), now, cur), null, 'derselbe Schritt zweimal: abgelehnt');
  assert.equal(T.verifyTotp(RFC_SECRET, at(0), now, cur - 1), cur, 'neuerer Schritt als der letzte: ok');
  assert.equal(T.verifyTotp(RFC_SECRET, at(-1), now, cur), null, 'älterer Schritt: abgelehnt');
  for (const bad of ['', '12345', '1234567', 'abcdef', '12 34 5x']) assert.equal(T.verifyTotp(RFC_SECRET, bad, now), null, bad);
  assert.equal(T.verifyTotp(RFC_SECRET, `${at(0).slice(0, 3)} ${at(0).slice(3)}`, now), cur, 'Leerzeichen im Code erlaubt');
});
test('TOTP: otpauth-Adresse und Wiederherstellungscodes', () => {
  const u = T.otpauthUri('inhaber@example.test', RFC_SECRET);
  assert.match(u, /^otpauth:\/\/totp\/ING%20Gutachten%3Ainhaber%40example\.test\?secret=GEZD/);
  assert.ok(u.includes('digits=6') && u.includes('period=30'));
  assert.equal(T.groupSecret('ABCDEFGHIJKL'), 'ABCD EFGH IJKL');
  const codes = new Set(Array.from({ length: 200 }, () => T.newRecoveryCode()));
  assert.equal(codes.size, 200, 'keine Wiederholungen');
  for (const c of codes) assert.match(c, /^[a-z2-9]{5}-[a-z2-9]{5}$/);
  assert.equal(T.normalizeRecovery(' ABCDE-fghjk '), 'abcde-fghjk');
});

/* ------------------------------------------------------------ Berechtigungs-Audit (statisch) */
test('Audit: jede Schnittstelle, Server-Action und Admin-Seite prüft Anmeldung/Rechte (Ausnahmen sind ausdrücklich begründet)', () => {
  const { problems, info } = require(path.join(__dirname, '..', 'scripts', 'audit-auth.cjs'));
  assert.deepEqual(problems, []);
  assert.ok(info.routes >= 12 && info.actions >= 100 && info.pages >= 50, 'es wurde wirklich etwas geprüft');
});
