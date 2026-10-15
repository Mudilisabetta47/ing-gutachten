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

/* ------------------------------------------------------------ QR-Code der Zwei-Faktor-Einrichtung */
test('QR-Code: der erzeugte Code lässt sich wieder auslesen und liefert genau die otpauth-Adresse', () => {
  const qrcode = require('qrcode-generator');
  const jsQR = require('jsqr');
  const uri = T.otpauthUri('inhaber@ing-gutachten.example', T.newSecret());
  const qr = qrcode(0, 'M'); qr.addData(uri, 'Byte'); qr.make();
  const n = qr.getModuleCount(), quiet = 4, scale = 6, dim = (n + quiet * 2) * scale;
  const px = new Uint8ClampedArray(dim * dim * 4).fill(255);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) { const i = (((r + quiet) * scale + y) * dim + (c + quiet) * scale + x) * 4; px[i] = px[i + 1] = px[i + 2] = 0; }
  const decoded = jsQR(px, dim, dim);
  assert.ok(decoded, 'Code wird erkannt');
  assert.equal(decoded.data, uri);
});

/* ------------------------------------------------------------ Verschlüsselung des Dateispeichers */
const SC = lib('storage-crypto');
const ring = (cur, prev) => SC.keyRingFromEnv({ STORAGE_ENCRYPTION_KEY: cur, ...(prev ? { STORAGE_ENCRYPTION_KEY_PREVIOUS: prev } : {}) });
const K1 = 'a'.repeat(40), K2 = 'b'.repeat(40);
test('Speicher-Verschlüsselung: Rundweg, Chiffretext enthält den Klartext nicht, jedes Mal anderer IV', () => {
  const r = ring(K1);
  const plain = new TextEncoder().encode('Vertrauliches Gutachten – Kennzeichen H-AB 1234 – ' + 'x'.repeat(200));
  const a = SC.encryptBytes(r, 'p/2026/10/abc123def', plain), b = SC.encryptBytes(r, 'p/2026/10/abc123def', plain);
  assert.ok(SC.isEncrypted(a) && !SC.isEncrypted(plain));
  assert.notDeepEqual(Buffer.from(a), Buffer.from(b));
  assert.ok(!Buffer.from(a).includes(Buffer.from('Gutachten')) && !Buffer.from(a).includes(Buffer.from('H-AB 1234')));
  assert.deepEqual(Buffer.from(SC.decryptBytes(r, 'p/2026/10/abc123def', a).bytes), Buffer.from(plain));
  assert.equal(a.length, plain.length + 5 + 1 + 12 + 16, 'Aufschlag: Kopf + IV + Tag');
});
test('Speicher-Verschlüsselung: Manipulation, falscher Schlüssel und untergeschobenes Objekt werden erkannt', () => {
  const r = ring(K1), plain = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const enc = SC.encryptBytes(r, 'p/2026/10/key-one-aaa', plain);
  const flipped = Uint8Array.from(enc); flipped[flipped.length - 20] ^= 1;
  assert.throws(() => SC.decryptBytes(r, 'p/2026/10/key-one-aaa', flipped), 'verändertes Byte');
  assert.throws(() => SC.decryptBytes(r, 'p/2026/10/key-one-aaa', enc.subarray(0, enc.length - 1)), 'abgeschnitten');
  assert.throws(() => SC.decryptBytes(ring(K2), 'p/2026/10/key-one-aaa', enc), 'falscher Schlüssel');
  assert.throws(() => SC.decryptBytes(r, 'p/2026/10/key-two-bbb', enc), 'anderer Objektschlüssel (Kopie unter fremdem Namen)');
});
test('Speicher-Verschlüsselung: Schlüsselwechsel – alter Schlüssel liest weiter, neue Objekte tragen den neuen', () => {
  const old = SC.encryptBytes(ring(K1), 'p/2026/10/rot-aaaaaa', new Uint8Array([9, 9, 9]));
  const both = ring(K2, K1);
  const d = SC.decryptBytes(both, 'p/2026/10/rot-aaaaaa', old);
  assert.ok(d.usedPrevious);
  assert.deepEqual([...d.bytes], [9, 9, 9]);
  const fresh = SC.encryptBytes(both, 'p/2026/10/rot-aaaaaa', d.bytes);
  assert.equal(SC.decryptBytes(both, 'p/2026/10/rot-aaaaaa', fresh).usedPrevious, false);
  assert.throws(() => SC.decryptBytes(ring(K2), 'p/2026/10/rot-aaaaaa', old), 'ohne alten Schlüssel nicht lesbar');
});
test('Speicher-Verschlüsselung: zu kurzer Schlüssel wird abgewiesen, kein Schlüssel = keine Verschlüsselung', () => {
  assert.throws(() => SC.keyRingFromEnv({ STORAGE_ENCRYPTION_KEY: 'kurz' }), /zu kurz/);
  assert.equal(SC.keyRingFromEnv({}), null);
});

/* ------------------------------------------------------------ Mail: Empfänger-Positivliste */
const MAIL = lib('mail/index');
test('Mail-Positivliste: nur freigegebene Adressen/Domains; Staging verlangt sie; MAIL_TO muss freigegeben sein', async () => {
  const list = MAIL.parseAllowlist(' Test@Beispiel.de, @intern.example ,');
  assert.deepEqual(list, ['test@beispiel.de', '@intern.example']);
  assert.ok(MAIL.isRecipientAllowed('TEST@beispiel.de', list) && MAIL.isRecipientAllowed('a@intern.example', list));
  assert.ok(!MAIL.isRecipientAllowed('kunde@gmail.com', list) && !MAIL.isRecipientAllowed('x@evil-intern.example', list), 'Domain-Anhang darf nicht durch Teilstring umgangen werden');
  assert.ok(MAIL.isRecipientAllowed('irgendwer@x.de', []), 'leere Liste = keine Einschränkung (Produktion)');
  const sent = [];
  const p = MAIL.withAllowlist({ id: 't', async send(m) { sent.push(m.to); } }, list);
  await p.send({ to: 'test@beispiel.de', from: { email: 'a@b.c', name: 'x' }, subject: 's', html: '', text: '', attachments: [] });
  await assert.rejects(p.send({ to: 'kunde@gmail.com', from: { email: 'a@b.c', name: 'x' }, subject: 's', html: '', text: '', attachments: [] }), /nicht freigegeben/);
  assert.deepEqual(sent, ['test@beispiel.de']);
  const base = { MAIL_PROVIDER: 'dry-run', MAIL_FROM: 'a@b.c', MAIL_TO: 'test@beispiel.de' };
  assert.throws(() => MAIL.getMailConfig({ ...base, MAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'x', ING_ENV: 'staging' }), /Pflicht/);
  assert.ok(MAIL.getMailConfig({ ...base, ING_ENV: 'staging', ALLOW_PREVIEW_DRY_RUN: 'true', VERCEL_ENV: 'preview' }), 'Dry-Run versendet nichts → keine Positivliste nötig');
  assert.throws(() => MAIL.getMailConfig({ ...base, MAIL_ALLOWED_RECIPIENTS: '@intern.example', NODE_ENV: 'development' }), /nicht in MAIL_ALLOWED_RECIPIENTS/);
  assert.ok(MAIL.getMailConfig({ ...base, MAIL_ALLOWED_RECIPIENTS: 'test@beispiel.de', ING_ENV: 'staging', ALLOW_PREVIEW_DRY_RUN: 'true', VERCEL_ENV: 'preview' }));
});

/* ------------------------------------------------------------ Fehlerüberwachung */
const ER = lib('error-report');
test('Fehlerbericht: personenbezogene Daten, Tokens und Verbindungen werden entfernt', () => {
  const dirty = 'Kunde erika.mustermann@example.de (0511 1234567) unter postgresql://user:geheim@db.example.com:5432/x und https://a.example/p?token=abc123&x=1 mit Sitzung ' + 'A'.repeat(40);
  const s = ER.scrub(dirty, 500);
  assert.ok(!s.includes('erika') && !s.includes('1234567') && !s.includes('geheim') && !s.includes('token=abc') && !s.includes('AAAAAAAA'), s);
  assert.ok(s.includes('[E-Mail]') && s.includes('[Nummer]') && s.includes('[Datenbank-Verbindung]') && s.includes('https://a.example/p'));
});
test('Fehlerbericht: Route ohne Query und ohne IDs, stabile Kennung', () => {
  const d1 = ER.describeError(new Error('Boom für x@y.de'), { route: '/admin/faelle/cmv8gzabcdefghijklmnop/?tab=a&q=Müller', method: 'GET', kind: 'render' });
  const d2 = ER.describeError(new Error('Boom für z@w.de'), { route: '/admin/faelle/cmv8gzabcdefghijklmnop/?tab=b', method: 'GET', kind: 'render' });
  assert.equal(d1.route, '/admin/faelle/[id]/');
  assert.ok(!JSON.stringify(d1).includes('Müller') && !JSON.stringify(d1).includes('x@y.de'));
  assert.equal(d1.fingerprint, d2.fingerprint, 'gleicher Fehler → gleiche Kennung');
  assert.notEqual(d1.fingerprint, ER.describeError(new Error('Etwas anderes'), { route: '/admin/faelle/' }).fingerprint);
});
test('Fehlerbericht: Alarm nur über https, entdoppelt, begrenzt, und nie werfend', async () => {
  ER._resetErrorReporter();
  const origErr = console.error; console.error = () => {};
  try {
    const calls = [];
    const ok = async (url, init) => { calls.push([url, JSON.parse(init.body)]); return { ok: true }; };
    const env = { ALERT_WEBHOOK_URL: 'https://hooks.example/abc', ING_ENV: 'staging' };
    assert.deepEqual(await ER.reportError(new Error('A'), { route: '/x' }, env, ok), { logged: true, alerted: true });
    assert.deepEqual(await ER.reportError(new Error('A'), { route: '/x' }, env, ok), { logged: true, alerted: false }, 'derselbe Fehler binnen 5 Minuten');
    assert.match(calls[0][1].text, /ING \(staging\)/);
    assert.deepEqual(await ER.reportError(new Error('B'), {}, { ALERT_WEBHOOK_URL: 'http://unsicher.example/' }, ok), { logged: true, alerted: false }, 'http wird nicht verwendet');
    assert.deepEqual(await ER.reportError(new Error('C'), {}, {}, ok), { logged: true, alerted: false }, 'ohne Webhook nur Log');
    const failing = async () => { throw new Error('Netz weg'); };
    assert.deepEqual(await ER.reportError(new Error('D'), {}, env, failing), { logged: true, alerted: false }, 'ein kaputter Webhook darf die Anwendung nicht stören');
    ER._resetErrorReporter();
    let sent = 0; const count = async () => { sent++; return { ok: true }; };
    for (let i = 0; i < 25; i++) await ER.reportError(new Error('Fehler ' + i), { route: '/r' + i }, env, count);
    assert.equal(sent, 10, 'höchstens 10 Alarme pro Minute');
  } finally { console.error = origErr; }
});

/* ------------------------------------------------------------ Vorabprüfung Staging/Produktion */
const PF = lib('preflight');
const GOOD = { ING_ENV: 'production', DATABASE_URL: 'postgresql://app:Xk3pQ9vLmN2wRt8sYb4@db.example-host.supabase.co:5432/postgres?sslmode=require', STORAGE_DRIVER: 's3', S3_BUCKET_PRIVATE: 'ing-prod-private', S3_ACCESS_KEY_ID: 'AKIA…', S3_SECRET_ACCESS_KEY: 'x', STORAGE_ENCRYPTION_KEY: 'Qm9yZ2VuLXVuZC1TdGVybmVuLWF1Zi1kZW4tV2VnLTc3', MFA_ENCRYPTION_KEY: 'Zm9yLW1mYS1vbmx5LWRpZmZlcmVudC1rZXktOTk4ODc3', IP_HASH_SALT: 'a1b2c3d4e5f6g7h8i9j0', BACKUP_ENCRYPTION_KEY: 'YmFja3VwLWtleS1mb3ItZW5jcnlwdGVkLWR1bXBzLTAx', SITE_URL: 'https://ing-gutachten.de', MAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'k', MAIL_FROM: 'web@ing-gutachten.de', MAIL_TO: 'info@ing-gutachten.de', ALERT_WEBHOOK_URL: 'https://hooks.example/x', HEALTH_TOKEN: 'h'.repeat(24) + 'Zq' };
const errs = (e, t = 'production', o) => PF.evaluatePreflight(e, t, o).filter((x) => x.level === 'error').map((x) => x.msg);
test('Vorabprüfung: eine vollständige Produktionsumgebung hat keine Fehler', () => { assert.deepEqual(errs(GOOD), []); });
test('Vorabprüfung: typische Fehlkonfigurationen werden gefunden', () => {
  assert.ok(errs({ ...GOOD, ING_ENV: undefined }).some((m) => m.includes('ING_ENV')));
  assert.ok(errs({ ...GOOD, DATABASE_URL: 'postgresql://u:p@localhost:5432/x' }).some((m) => m.includes('lokale')));
  assert.ok(errs({ ...GOOD, DATABASE_URL: GOOD.DATABASE_URL.replace('?sslmode=require', '') }).some((m) => m.includes('sslmode')));
  assert.ok(errs({ ...GOOD, STORAGE_DRIVER: 'local' }).some((m) => m.includes('STORAGE_DRIVER')));
  assert.ok(errs({ ...GOOD, STORAGE_ENCRYPTION_KEY: undefined }).some((m) => m.includes('STORAGE_ENCRYPTION_KEY')));
  assert.ok(errs({ ...GOOD, STORAGE_ENCRYPTION_KEY: 'changeme-changeme-changeme-changeme' }).some((m) => m.includes('schwach')));
  assert.ok(errs({ ...GOOD, MFA_ENCRYPTION_KEY: 'x'.repeat(40) }).some((m) => m.includes('MFA_ENCRYPTION_KEY')));
  assert.ok(errs({ ...GOOD, MFA_ENCRYPTION_KEY: GOOD.STORAGE_ENCRYPTION_KEY }).some((m) => m.includes('identisch')));
  assert.ok(errs({ ...GOOD, SITE_URL: 'https://ing-gutachten.vercel.app' }).some((m) => m.includes('vercel.app')));
  assert.ok(errs({ ...GOOD, MAIL_PROVIDER: 'dry-run' }).some((m) => m.includes('nicht erlaubt')));
  assert.ok(errs({ ...GOOD, ALLOW_PREVIEW_DRY_RUN: 'true' }).some((m) => m.includes('ALLOW_PREVIEW_DRY_RUN')));
  assert.ok(errs({ ...GOOD, LOGIN_MAX_ATTEMPTS: '500' }).some((m) => m.includes('LOGIN_MAX_ATTEMPTS')));
  assert.ok(errs({ ...GOOD, NEXT_PUBLIC_API_SECRET: 'x' }).some((m) => m.includes('NEXT_PUBLIC_API_SECRET')));
  assert.ok(errs({ ...GOOD, S3_BUCKET_PUBLIC: 'ing-prod-private' }).some((m) => m.includes('identisch')));
});
const warns = (e, t = 'production') => PF.evaluatePreflight(e, t).filter((x) => x.level === 'warn').map((x) => x.msg);
test('Vorabprüfung: Supabase-Direktverbindung für die App, fehlende Alarm-Mail, Alarm-Mail außerhalb der Positivliste', () => {
  assert.ok(warns(GOOD).some((m) => m.includes('direkte Supabase-Verbindung')));
  const pooled = { ...GOOD, DATABASE_URL: 'postgresql://postgres.abcd:Xk3pQ9vLmN2wRt8sYb4@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require' };
  assert.ok(!warns(pooled).some((m) => m.includes('Supabase')));
  assert.ok(warns({ ...pooled, DATABASE_URL: pooled.DATABASE_URL.replace(':6543', ':5432') }).some((m) => m.includes('Port 6543')));
  assert.ok(warns(GOOD).some((m) => m.includes('ALERT_EMAIL_TO fehlt')));
  assert.ok(errs({ ...GOOD, ALERT_EMAIL_TO: 'kaputt' }).some((m) => m.includes('ALERT_EMAIL_TO')));
  assert.ok(errs({ ...GOOD, S3_ENDPOINT: 'http://unsicher.example' }).some((m) => m.includes('S3_ENDPOINT')));
  const st = { ...GOOD, ING_ENV: 'staging', MAIL_TO: 'test@beispiel.de', MAIL_ALLOWED_RECIPIENTS: 'test@beispiel.de', ALERT_EMAIL_TO: 'andere@beispiel.de' };
  assert.ok(errs(st, 'staging').some((m) => m.includes('ALERT_EMAIL_TO steht nicht')));
  assert.ok(!errs({ ...st, ALERT_EMAIL_TO: 'test@beispiel.de' }, 'staging').some((m) => m.includes('ALERT_EMAIL_TO')));
});
test('Vorabprüfung: Staging verlangt die Empfänger-Positivliste; Vergleich mit Produktion findet geteilte Ressourcen', () => {
  const st = { ...GOOD, ING_ENV: 'staging', S3_BUCKET_PRIVATE: 'ing-staging-private', STORAGE_ENCRYPTION_KEY: 'Uy1zdGFnaW5nLXN0b3JhZ2Uta2V5LXVuaXF1ZS02NjU1', MFA_ENCRYPTION_KEY: 'Uy1zdGFnaW5nLW1mYS1rZXktdW5pcXVlLTc3NDQzMw', IP_HASH_SALT: 'zzyyxxwwvvuuttss11', BACKUP_ENCRYPTION_KEY: 'Uy1zdGFnaW5nLWJhY2t1cC1rZXktdW5pcXVlLTU1', HEALTH_TOKEN: 'staging-health-token-0123456789', DATABASE_URL: 'postgresql://app:Xk3pQ9vLmN2wRt8sYb4@db.staging-host.supabase.co:5432/postgres?sslmode=require', S3_ACCESS_KEY_ID: 'AKIASTAGING' };
  assert.ok(errs(st, 'staging').some((m) => m.includes('MAIL_ALLOWED_RECIPIENTS')));
  assert.deepEqual(errs({ ...st, MAIL_TO: 'test@beispiel.de', MAIL_ALLOWED_RECIPIENTS: 'test@beispiel.de' }, 'staging', GOOD), []);
  const shared = errs({ ...st, MAIL_TO: 'test@beispiel.de', MAIL_ALLOWED_RECIPIENTS: 'test@beispiel.de', DATABASE_URL: GOOD.DATABASE_URL, S3_BUCKET_PRIVATE: GOOD.S3_BUCKET_PRIVATE, MFA_ENCRYPTION_KEY: GOOD.MFA_ENCRYPTION_KEY }, 'staging', GOOD).join(' ');
  assert.ok(shared.includes('Datenbank') && shared.includes('S3_BUCKET_PRIVATE') && shared.includes('MFA_ENCRYPTION_KEY'));
});

/* ------------------------------------------------------------ Überwachung per E-Mail */
const MON = lib('monitor');
const ALERT = lib('mail/alert');
test('Überwachung: eine Mail bei Störung, Erinnerung erst nach 6 h, Entwarnung bei Erholung – kein Dauerfeuer', () => {
  const t0 = new Date('2026-10-14T10:00:00Z');
  let r = MON.decideMonitor(null, true, [], t0);
  assert.equal(r.action, 'none');
  r = MON.decideMonitor(r.state, false, ['database'], new Date(t0.getTime() + 60_000));
  assert.equal(r.action, 'alert');
  const down = r.state;
  r = MON.decideMonitor(down, false, ['database'], new Date(t0.getTime() + 5 * 60_000));
  assert.equal(r.action, 'none', 'derselbe Ausfall: keine zweite Mail');
  r = MON.decideMonitor(down, false, ['database', 'storage'], new Date(t0.getTime() + 6 * 60_000));
  assert.equal(r.action, 'alert', 'anderer Befund: neue Meldung');
  r = MON.decideMonitor(down, false, ['database'], new Date(t0.getTime() + 7 * 3600_000));
  assert.equal(r.action, 'reminder');
  r = MON.decideMonitor(down, true, [], new Date(t0.getTime() + 3600_000));
  assert.equal(r.action, 'recovered');
  assert.equal(MON.decideMonitor(r.state, true, [], new Date(t0.getTime() + 7200_000)).action, 'none');
  const m = MON.monitorMailText('alert', 'staging', ['storage'], '2026-10-14T10:01:00Z');
  assert.match(m.subject, /staging.*storage/); assert.ok(!/@|postgres:/i.test(m.text), 'keine Adressen/Verbindungen im Text');
});
test('Alarm-Mail: nur gültige Empfänger (höchstens 3), nie werfend, Fehlerbericht schickt auch per Mail', async () => {
  assert.deepEqual(ALERT.alertRecipients({ ALERT_EMAIL_TO: 'a@x.de, kaputt, b@y.de;c@z.de, d@e.de,f@g.de,h@i.de' }), ['a@x.de', 'd@e.de', 'f@g.de']);
  assert.deepEqual(ALERT.alertRecipients({}), []);
  assert.equal(await ALERT.alertMailer({})('s', 't'), false, 'ohne Empfänger nichts');
  assert.equal(await ALERT.alertMailer({ ALERT_EMAIL_TO: 'a@x.de' })('s', 't'), false, 'ohne Mail-Konfiguration nichts, aber kein Fehler');
  ER._resetErrorReporter();
  const origErr = console.error; console.error = () => {};
  try {
    const sent = [];
    const mailer = async (subject, text) => { sent.push([subject, text]); return true; };
    const env = { ALERT_EMAIL_TO: 'betrieb@x.de', ING_ENV: 'staging' };
    assert.deepEqual(await ER.reportError(new Error('Boom a@b.de'), { route: '/x' }, env, async () => ({ ok: true }), mailer), { logged: true, alerted: true });
    assert.deepEqual(await ER.reportError(new Error('Boom a@b.de'), { route: '/x' }, env, async () => ({ ok: true }), mailer), { logged: true, alerted: false }, 'entdoppelt');
    assert.equal(sent.length, 1); assert.ok(!sent[0][1].includes('a@b.de'), 'keine Mailadresse im Alarmtext');
  } finally { console.error = origErr; ER._resetErrorReporter(); }
});

/* ------------------------------------------------------------ Kalender (ICS) */
const ICS = lib('ics');
test('ICS: Escaping, Faltung nach 75 Oktetten (UTF-8-sicher), UTC-Zeiten, CRLF', () => {
  assert.equal(ICS.icsEscape('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
  const long = 'Besichtigung · ' + 'Müller-Äpfel '.repeat(20);
  const folded = ICS.icsFold('SUMMARY:' + long).split('\r\n');
  for (const [i, l] of folded.entries()) assert.ok(Buffer.byteLength(i ? l.slice(1) : l, 'utf8') <= 75, `Zeile ${i} zu lang`);
  assert.equal(folded.map((l, i) => (i ? l.slice(1) : l)).join(''), 'SUMMARY:' + long, 'Entfalten ergibt den Original-Text');
  const ics = ICS.buildIcs([{ uid: 'a@x', start: new Date('2026-10-20T07:30:00Z'), end: new Date('2026-10-20T08:30:00Z'), updated: new Date('2026-10-14T10:00:00Z'), summary: 'Besichtigung (2026-0001)', status: 'TENTATIVE' }], { name: 'Test' });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.match(ics, /DTSTART:20261020T073000Z\r\nDTEND:20261020T083000Z/);
  assert.match(ics, /STATUS:TENTATIVE/); assert.match(ics, /UID:a@x/);
  assert.ok(!/\n(?!\s)[^\r\n]*[^\r]\n/.test(ics.replace(/\r\n/g, '')), 'nur CRLF');
});
