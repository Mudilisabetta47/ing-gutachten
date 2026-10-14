/**
 * Gemeinsame Bausteine für Sicherung und Wiederherstellung (scripts/backup.ts, restore.ts, backup-verify.ts).
 * Sicherungsordner:  db.dump(.enc) · objects/<Speicherschlüssel> · manifest.json (+ manifest.hmac)
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import pg from 'pg';

export const MAGIC = Buffer.from('INGB1');
export type TableCount = Record<string, number>;
export type Manifest = {
  version: 1;
  createdAt: string;
  ingEnv: string;
  source: { host: string; database: string };
  db: { file: string; sha256: string; bytes: number; encrypted: boolean; plainSha256: string };
  objects: { count: number; bytes: number; files: Record<string, { sha256: string; bytes: number }>; missing: string[] };
  tables: TableCount;
  encryptedStorage: boolean;
  /** Erweiterungen der Quelle (liegen nicht im Schema-Dump, müssen im Ziel vor dem Zurückspielen angelegt werden). */
  extensions: { name: string; schema: string }[];
};

export const sha256File = async (file: string) => {
  const h = createHash('sha256');
  await pipeline(createReadStream(file), h);
  return h.digest('hex');
};
export const sha256Buf = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

export function backupKey(env: NodeJS.ProcessEnv = process.env): Buffer | null {
  const k = env.BACKUP_ENCRYPTION_KEY ?? '';
  if (!k) return null;
  if (k.length < 32) throw new Error('BACKUP_ENCRYPTION_KEY ist zu kurz (mindestens 32 Zeichen).');
  return createHash('sha256').update(`ing-backup-master:${k}`).digest();
}
const fileKey = (master: Buffer, salt: Buffer) => Buffer.from(hkdfSync('sha256', master, salt, 'ing-backup-v1', 32));

/** Datei streamend mit AES-256-GCM verschlüsseln: MAGIC | Salz(16) | IV(12) | Chiffretext | Tag(16). */
export async function encryptFile(src: string, dst: string, master: Buffer): Promise<void> {
  const salt = randomBytes(16), iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', fileKey(master, salt), iv);
  const out = createWriteStream(dst, { flags: 'wx', mode: 0o600 });
  out.write(Buffer.concat([MAGIC, salt, iv]));
  await pipeline(createReadStream(src), c, out, { end: false });
  await new Promise<void>((res, rej) => out.end(c.getAuthTag(), (e?: Error | null) => (e ? rej(e) : res())));
}

export async function decryptFile(src: string, dst: string, master: Buffer): Promise<void> {
  const size = (await stat(src)).size;
  const headLen = MAGIC.length + 16 + 12;
  if (size < headLen + 16) throw new Error('Sicherungsdatei zu kurz oder beschädigt.');
  const fh = await (await import('node:fs/promises')).open(src, 'r');
  const head = Buffer.alloc(headLen), tag = Buffer.alloc(16);
  await fh.read(head, 0, headLen, 0);
  await fh.read(tag, 0, 16, size - 16);
  await fh.close();
  if (!head.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Keine verschlüsselte ING-Sicherung.');
  const d = createDecipheriv('aes-256-gcm', fileKey(master, head.subarray(MAGIC.length, MAGIC.length + 16)), head.subarray(MAGIC.length + 16));
  d.setAuthTag(tag);
  await pipeline(createReadStream(src, { start: headLen, end: size - 17 }), d, createWriteStream(dst, { flags: 'wx', mode: 0o600 }));
}

export const manifestMac = (json: string, master: Buffer) => createHmac('sha256', master).update(json).digest('hex');
export function macOk(json: string, mac: string, master: Buffer) {
  const a = Buffer.from(manifestMac(json, master)), b = Buffer.from(mac.trim());
  return a.length === b.length && timingSafeEqual(a, b);
}

export function run(cmd: string, args: string[], env: NodeJS.ProcessEnv = process.env, capture = false): Promise<{ code: number; err: string; out: string }> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { env, stdio: ['ignore', capture ? 'pipe' : 'inherit', 'pipe'] });
    let err = '', out = '';
    if (capture) p.stdout!.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) => resolve({ code: 127, err: String(e.message), out }));
    p.on('close', (code) => resolve({ code: code ?? 1, err, out }));
  });
}

/** Prisma-URLs tragen ?schema=…, das libpq (pg_dump/pg_restore) nicht kennt. */
export const libpqUrl = (url: string) => { const u = new URL(url.replace(/^postgres(ql)?:/, 'http:')); for (const k of ['schema', 'pgbouncer', 'connection_limit']) u.searchParams.delete(k); return url.replace(/^(postgres(?:ql)?:).*$/, (_, pre) => pre + u.toString().replace(/^http:/, '')); };
export const dbNameOf = (url: string) => decodeURIComponent(new URL(url.replace(/^postgres(ql)?:/, 'http:')).pathname.slice(1));
export const dbHostOf = (url: string) => new URL(url.replace(/^postgres(ql)?:/, 'http:')).host;

/** Anzahl Zeilen aller Tabellen im Schema public (exakt; bei Pilotgröße unproblematisch). */
export async function tableCounts(url: string): Promise<TableCount> {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    const t = await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1`);
    const out: TableCount = {};
    for (const r of t.rows) out[r.table_name] = Number((await c.query(`SELECT count(*) AS n FROM public."${r.table_name}"`)).rows[0].n);
    return out;
  } finally { await c.end(); }
}

export async function extensionsOf(url: string): Promise<{ name: string; schema: string }[]> {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    const r = await c.query(`SELECT e.extname AS name, n.nspname AS schema FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname NOT IN ('plpgsql') ORDER BY 1`);
    return r.rows;
  } finally { await c.end(); }
}

/** Alle Speicherschlüssel, auf die die Datenbank verweist. */
export async function referencedKeys(url: string): Promise<string[]> {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    const r = await c.query(`SELECT storage_key AS k FROM media UNION SELECT thumb_key FROM media WHERE thumb_key IS NOT NULL ORDER BY 1`);
    return r.rows.map((x) => x.k as string);
  } finally { await c.end(); }
}

export async function listFiles(dir: string, base = dir): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listFiles(p, base)));
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out.sort();
}

export { mkdir, readFile, writeFile, stat };
