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
