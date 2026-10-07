import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { db } from '@/server/db';
import { assertTestDb, resetDb } from './helpers';
import { POST } from '@/app/api/anfrage/route';

assertTestDb();

const g = globalThis as unknown as { __ingPrisma?: PrismaClient };
const realFetch = globalThis.fetch;
const realError = console.error;
const MAIL_ENV = ['MAIL_PROVIDER', 'MAIL_FROM', 'MAIL_TO', 'BREVO_API_KEY'] as const;
const saved: Record<string, string | undefined> = {};
let logs: string[] = [];
let ipCounter = 1;

beforeEach(async () => {
  await resetDb();
  for (const k of [...MAIL_ENV, 'DATABASE_URL']) saved[k] = process.env[k];
  logs = [];
  console.error = (...a: unknown[]) => void logs.push(a.map(String).join(' '));
});
afterEach(() => {
  for (const k of [...MAIL_ENV, 'DATABASE_URL']) (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]));
  globalThis.fetch = realFetch;
  console.error = realError;
});

const mailDryRun = () => Object.assign(process.env, { MAIL_PROVIDER: 'dry-run', MAIL_FROM: 'web@example.test', MAIL_TO: 'buero@example.test' });
const mailBrevo = (status: number) => {
  Object.assign(process.env, { MAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'test-key', MAIL_FROM: 'web@example.test', MAIL_TO: 'buero@example.test' });
  globalThis.fetch = (async () => new Response('{}', { status })) as typeof fetch;
};
const mailNone = () => { delete process.env.MAIL_FROM; delete process.env.MAIL_TO; process.env.MAIL_PROVIDER = 'brevo'; };

/** DB „fällt aus“: der Client zeigt auf einen toten Port. */
async function withDeadDb<T>(fn: () => Promise<T>): Promise<T> {
  await db.user.count(); // echten Client sicherstellen
  const real = g.__ingPrisma;
  g.__ingPrisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: 'postgresql://x@127.0.0.1:1/none', connectionTimeoutMillis: 800 }), log: [] });
  try { return await fn(); } finally { await g.__ingPrisma?.$disconnect().catch(() => {}); g.__ingPrisma = real; }
}

function req(over: Record<string, string> = {}, files: { name: string; bytes: number[] }[] = []) {
  const f = new FormData();
  const base = { anlass: 'Unfall', fahrzeug: 'PKW', name: 'Erika Mustermann', telefon: '0511 1234567', email: 'erika@example.test', standort: 'Hannover', nachricht: 'Heckschaden', datenschutz: 'true', website: '', t: String(Date.now() - 20_000), ...over };
  for (const [k, v] of Object.entries(base)) f.append(k, v);
  for (const file of files) f.append('foto', new Blob([new Uint8Array(file.bytes)], { type: 'image/jpeg' }), file.name);
  return new Request('http://localhost/api/anfrage', { method: 'POST', body: f, headers: { host: 'localhost', 'x-forwarded-for': `198.51.100.${ipCounter++}` } });
}
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
const body = async (r: Response) => (await r.json()) as Record<string, unknown>;

test('DB ok + Mail ok → Erfolg; Anfrage & Lead gespeichert, Anhänge als MAIL_ONLY, Status SENT', async () => {
  mailBrevo(201);
  const res = await POST(req({}, [{ name: 'IMG_0001.jpg', bytes: JPEG }]));
  assert.equal(res.status, 200);
  assert.equal((await body(res)).ok, true);
  const lead = await db.lead.findFirstOrThrow({ include: { inquiry: { include: { attachments: true } } } });
  assert.equal(lead.notificationStatus, 'SENT');
  assert.equal(lead.status, 'NEW');
  assert.equal(lead.inquiry?.attachments[0].status, 'MAIL_ONLY');
  assert.equal(lead.inquiry?.attachments[0].fileName, 'foto-1.jpg', 'Original-Dateiname wird nicht übernommen');
  assert.match(lead.inquiry?.attachments[0].sha256 ?? '', /^[0-9a-f]{64}$/);
  assert.ok(lead.inquiry?.consentAt && lead.inquiry.privacyVersion && lead.inquiry.formVersion);
});

test('DB ok + Mail FEHLGESCHLAGEN → trotzdem Erfolg; Lead mit notificationStatus FAILED, Anhänge „nicht gesichert“', async () => {
  mailBrevo(500);
  const res = await POST(req({}, [{ name: 'a.jpg', bytes: JPEG }]));
  assert.equal(res.status, 200);
  assert.equal((await body(res)).ok, true);
  const lead = await db.lead.findFirstOrThrow({ include: { inquiry: { include: { attachments: true } } } });
  assert.equal(lead.notificationStatus, 'FAILED');
  assert.equal(lead.inquiry?.attachments[0].status, 'NOT_STORED');
  assert.ok(logs.some((l) => l.includes('Versand fehlgeschlagen')));
  assert.equal(await db.auditLog.count({ where: { action: 'lead.notification_failed' } }), 1);
});

test('DB ok + Mail nicht konfiguriert → Erfolg, Status SKIPPED (kein Datenverlust)', async () => {
  mailNone();
  const res = await POST(req());
  assert.equal(res.status, 200);
  assert.equal((await db.lead.findFirstOrThrow()).notificationStatus, 'SKIPPED');
});

test('DB DOWN + Mail ok → neutraler Erfolg im Browser, Server-Log DATABASE_PERSISTENCE_FAILED, nichts gespeichert', async () => {
  mailBrevo(201);
  const res = await withDeadDb(() => POST(req()));
  assert.equal(res.status, 200);
  assert.equal((await body(res)).ok, true);
  assert.ok(logs.some((l) => l.includes('DATABASE_PERSISTENCE_FAILED')), 'Fehler gehört ins Server-Log');
  assert.ok(!logs.some((l) => /Erika|Mustermann|1234567|example\.test/.test(l)), 'Log enthält keine personenbezogenen Daten');
  assert.equal(await db.lead.count(), 0);
});

test('DB DOWN + Mail FEHLGESCHLAGEN → ehrlicher Fehler mit Telefonnummer, KEIN falscher Erfolg', async () => {
  mailBrevo(500);
  const res = await withDeadDb(() => POST(req()));
  assert.equal(res.status, 502);
  const b = await body(res);
  assert.equal(b.ok, false);
  assert.match(String(b.message), /0511/);
  assert.ok(logs.some((l) => l.includes('DATABASE_PERSISTENCE_FAILED')));
});

test('DB DOWN + Mail nicht konfiguriert → 503 mit Telefonnummer', async () => {
  mailNone();
  const res = await withDeadDb(() => POST(req()));
  assert.equal(res.status, 503);
  assert.match(String((await body(res)).message), /0511/);
});

test('Ohne DATABASE_URL (z. B. Vercel-Preview) verhält sich das Formular wie bisher: nur Mail', async () => {
  mailBrevo(201);
  delete process.env.DATABASE_URL;
  const ok = await POST(req());
  assert.equal(ok.status, 200);
  assert.ok(!logs.some((l) => l.includes('DATABASE_PERSISTENCE_FAILED')), 'kein Fehlalarm, wenn bewusst keine DB konfiguriert ist');
  mailBrevo(500);
  assert.equal((await POST(req())).status, 502);
});

test('Ungültige Eingabe, fehlende Zustimmung, Honeypot: nichts wird gespeichert', async () => {
  mailDryRun();
  assert.equal((await POST(req({ email: 'kaputt' }))).status, 400);
  assert.equal((await POST(req({ datenschutz: 'false' }))).status, 400);
  assert.equal((await POST(req({ anlass: 'Hacking' }))).status, 400);
  const bot = await POST(req({ website: 'http://spam' }));
  assert.equal(bot.status, 200, 'Bot erfährt nichts');
  const fast = await POST(req({ t: String(Date.now() - 100) }));
  assert.equal(fast.status, 200);
  assert.equal(await db.lead.count(), 0);
  assert.equal(await db.inquiry.count(), 0);
});

test('Unerlaubte Datei (kein Bild) wird abgewiesen – nichts gespeichert', async () => {
  mailDryRun();
  const res = await POST(req({}, [{ name: 'virus.jpg', bytes: [0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0] }]));
  assert.equal(res.status, 400);
  assert.equal(await db.inquiry.count(), 0);
});

test('Herkunft: UTM/Referrer werden nur sanitisiert gespeichert; Inquiry bleibt unverändert nach Lead-Bearbeitung', async () => {
  mailDryRun();
  const res = await POST(req({ utm_source: 'google', utm_campaign: '<img onerror=x>', ref: 'https://duckduckgo.com/?q=geheim', lp: '/kfz-gutachter-hannover/' }));
  assert.equal(res.status, 200);
  const inq = await db.inquiry.findFirstOrThrow();
  assert.equal(inq.utmSource, 'google');
  assert.equal(inq.utmCampaign, null);
  assert.equal(inq.referrerHost, 'duckduckgo.com');
  assert.equal(inq.landingPath, '/kfz-gutachter-hannover/');
  await db.lead.updateMany({ data: { name: 'Geändert' } });
  assert.equal((await db.inquiry.findFirstOrThrow()).name, 'Erika Mustermann', 'Original bleibt, wie es einging');
});
