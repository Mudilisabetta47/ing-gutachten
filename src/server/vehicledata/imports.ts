import 'server-only';
import type { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';
import type { AuthUser } from '@/server/auth/session-types';
import { DomainError, notFoundError } from '@/server/errors';
import { diffRecords, normalizeHsn, normalizeTsn, type LicenseKey } from '@/lib/vehicle-data';
import { assertAllowedUrl, FetchError } from './fetcher';
import { vehicleFromFields, type NormalizedVehicle, type VehicleFields } from './html-parser';
import { requireManage, toDto, upsertNormalized } from './catalog';
import { callProvider, providerConfig } from './gateway';
import { HSN_TSN_DEFAULT_HOSTS } from './providers/hsn-tsn';

/* ------------------------------------------------------------ Modi */

export const IMPORT_MODES = [
  { key: 'SINGLE', label: 'Einzelne HSN/TSN', source: 'provider', available: true },
  { key: 'URL', label: 'Einzelne URL(s)', source: 'provider', available: true },
  { key: 'MANUFACTURER', label: 'Hersteller', source: 'provider', available: false, why: 'Listenseiten des Anbieters sind nicht konfiguriert – die Seitenstruktur wird nicht erraten.' },
  { key: 'MODEL', label: 'Modell', source: 'provider', available: false, why: 'Listenseiten des Anbieters sind nicht konfiguriert – die Seitenstruktur wird nicht erraten.' },
  { key: 'CSV', label: 'CSV', source: 'file', available: true },
  { key: 'EXCEL', label: 'Excel', source: 'file', available: false, why: 'Excel wird nicht direkt gelesen. Bitte die Tabelle als CSV (UTF-8, Semikolon) speichern.' },
  { key: 'JSON', label: 'JSON', source: 'file', available: true },
  { key: 'API', label: 'API', source: 'provider', available: false, why: 'Es ist keine API-Schnittstelle eingerichtet.' },
] as const;
export type ImportMode = (typeof IMPORT_MODES)[number]['key'];

const MAX_ROWS = 5000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_URLS = 50;
const FETCH_BUDGET_MS = 20_000;
const COMMIT_BUDGET_MS = 15_000;

/* ------------------------------------------------------------ CSV / JSON lesen */

/** RFC-4180-nahes CSV: Anführungszeichen, doppelte Anführungszeichen, Trennzeichen ; , Tab (automatisch erkannt). */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, '');
  const first = t.split(/\r?\n/, 1)[0] ?? '';
  const delim = [';', '\t', ','].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

const KEY_MAP: [RegExp, keyof VehicleFields][] = [
  [/^(hsn\/tsn|hsntsn|schluesselnummer|schlüsselnummer|code)$/, 'code'], [/^hsn$/, 'hsn'], [/^tsn$/, 'tsn'],
  [/^(hersteller|marke|manufacturer|make)$/, 'manufacturer'],
  [/^(name|fahrzeug|bezeichnung|modell|typ|fahrzeugbezeichnung|handelsbezeichnung|vehicle|model)$/, 'name'],
  [/^(leistung|power)$/, 'power'], [/^(ps|hp|leistung_ps|leistungps|power_hp)$/, 'ps'], [/^(kw|leistung_kw|leistungkw|power_kw)$/, 'kw'],
  [/^(ccm|hubraum|displacement|cm3|hubraum_ccm)$/, 'displacement'], [/^(kraftstoff|fuel|treibstoff)$/, 'fuel'],
];
const mapKey = (k: string): keyof VehicleFields | null => {
  const n = k.toLocaleLowerCase('de-DE').replace(/[\s.\-]+/g, '_').replace(/^_|_$/g, '');
  return KEY_MAP.find(([re]) => re.test(n.replace(/_/g, '')) || re.test(n))?.[1] ?? null;
};

type StageItem = { ok: true; vehicle: NormalizedVehicle } | { ok: false; error: string; text: string };

function rowsFromObjects(objs: Record<string, unknown>[], label: string): StageItem[] {
  return objs.map((o) => {
    const f: VehicleFields = { cells: [] };
    for (const [k, v] of Object.entries(o)) {
      if (v === null || v === undefined) continue;
      const val = String(v).trim();
      if (!val) continue;
      f.cells.push(val);
      const mk = mapKey(k);
      if (mk && mk !== 'cells') (f as Record<string, unknown>)[mk] = val;
    }
    const r = vehicleFromFields(f, null);
    if (r.ok) r.vehicle.raw = { ...r.vehicle.raw, sourceLabel: label };
    return r;
  });
}

export function parseImportFile(mode: 'CSV' | 'JSON', text: string, label: string): StageItem[] {
  if (Buffer.byteLength(text, 'utf8') > MAX_FILE_BYTES) throw new DomainError('Die Datei ist zu groß (max. 2 MB).');
  let objs: Record<string, unknown>[];
  if (mode === 'JSON') {
    let data: unknown;
    try { data = JSON.parse(text); } catch { throw new DomainError('Die JSON-Datei ist ungültig.'); }
    const arr = Array.isArray(data) ? data : Array.isArray((data as { records?: unknown })?.records) ? (data as { records: unknown[] }).records : null;
    if (!arr) throw new DomainError('Erwartet wird eine Liste von Datensätzen (oder { "records": [...] }).');
    objs = arr.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x));
  } else {
    const table = parseCsv(text);
    if (table.length < 2) throw new DomainError('Die CSV-Datei braucht eine Kopfzeile und mindestens eine Datenzeile.');
    const head = table[0].map((h) => h.trim());
    if (!head.some((h) => ['hsn', 'hsn/tsn', 'code', 'schlüsselnummer'].includes(h.toLocaleLowerCase('de-DE')))) throw new DomainError('In der Kopfzeile wurde keine Spalte „HSN“ (oder „HSN/TSN“) gefunden.');
    objs = table.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
  }
  if (objs.length === 0) throw new DomainError('Die Datei enthält keine Datensätze.');
  if (objs.length > MAX_ROWS) throw new DomainError(`Zu viele Datensätze (max. ${MAX_ROWS} pro Import).`);
  return rowsFromObjects(objs, label);
}

/* ------------------------------------------------------------ Stagen & Klassifizieren */

async function stage(jobId: string, startPos: number, items: StageItem[]) {
  if (!items.length) return;
  await db.vehicleImportRow.createMany({
    data: items.map((it, i) => ({
      jobId, position: startPos + i,
      hsn: it.ok ? it.vehicle.hsn : null, tsn: it.ok ? it.vehicle.tsn : null,
      payload: (it.ok ? it.vehicle : { text: it.text }) as unknown as Prisma.InputJsonValue,
      outcome: it.ok ? ('NEW' as const) : ('INVALID' as const), error: it.ok ? null : it.error,
    })),
  });
}

/** Vergleich mit dem Bestand: NEU / bereits vorhanden / Konflikt – ohne etwas zu verändern. */
async function classify(jobId: string) {
  const rows = await db.vehicleImportRow.findMany({ where: { jobId, outcome: { in: ['NEW', 'EXISTS', 'CONFLICT'] } }, orderBy: { position: 'asc' } });
  const seen = new Map<string, NormalizedVehicle>();
  const updates: { id: string; outcome: 'NEW' | 'EXISTS' | 'CONFLICT' | 'INVALID'; error?: string; recordId?: string }[] = [];
  const pairs = [...new Set(rows.map((r) => `${r.hsn}|${r.tsn}`))].map((k) => k.split('|'));
  const existing = new Map<string, Awaited<ReturnType<typeof db.vehicleHsnTsn.findMany>>>();
  for (let i = 0; i < pairs.length; i += 200) {
    const chunk = pairs.slice(i, i + 200);
    const found = await db.vehicleHsnTsn.findMany({ where: { deletedAt: null, OR: chunk.map(([hsn, tsn]) => ({ hsn, tsn })) } });
    for (const r of found) { const k = `${r.hsn}|${r.tsn}`; existing.set(k, [...(existing.get(k) ?? []), r]); }
  }
  for (const r of rows) {
    const nv = r.payload as unknown as NormalizedVehicle;
    const key = `${r.hsn}|${r.tsn}|${nv.sourceRecordId ?? ''}`;
    const prev = seen.get(key);
    if (prev) {
      if (diffRecords(prev, nv).length === 0) updates.push({ id: r.id, outcome: 'EXISTS', error: 'Doppelt in der Datei (identisch).' });
      else updates.push({ id: r.id, outcome: 'INVALID', error: 'Widerspruch innerhalb der Datei: gleiche HSN/TSN mit anderen Werten.' });
      continue;
    }
    seen.set(key, nv);
    const ex = existing.get(`${r.hsn}|${r.tsn}`) ?? [];
    if (!ex.length) { updates.push({ id: r.id, outcome: 'NEW' }); continue; }
    const conflict = ex.find((e) => diffRecords(e, nv).length > 0);
    updates.push(conflict ? { id: r.id, outcome: 'CONFLICT', recordId: conflict.id } : { id: r.id, outcome: 'EXISTS', recordId: ex[0].id });
  }
  for (let i = 0; i < updates.length; i += 200) {
    await db.$transaction(updates.slice(i, i + 200).map((u) => db.vehicleImportRow.update({ where: { id: u.id }, data: { outcome: u.outcome, error: u.error ?? null, recordId: u.recordId ?? null } })));
  }
  const counts = await db.vehicleImportRow.groupBy({ by: ['outcome'], where: { jobId }, _count: true });
  const c = Object.fromEntries(counts.map((x) => [x.outcome, x._count]));
  await db.vehicleImportJob.update({
    where: { id: jobId },
    data: { total: Object.values(c).reduce((a, b) => a + b, 0), countNew: c.NEW ?? 0, countExists: c.EXISTS ?? 0, countConflict: c.CONFLICT ?? 0, countInvalid: c.INVALID ?? 0, countImported: c.IMPORTED ?? 0 },
  });
}

/* ------------------------------------------------------------ Vorschau anlegen */

export type PreviewInput = { providerKey?: string; mode: ImportMode; hsn?: string; tsn?: string; urls?: string; text?: string; label?: string };

export async function createImportPreview(user: AuthUser, input: PreviewInput) {
  requireManage(user);
  const mode = IMPORT_MODES.find((m) => m.key === input.mode);
  if (!mode) throw new DomainError('Unbekannter Importmodus.');
  if (!mode.available) throw new DomainError('why' in mode ? mode.why : 'Dieser Modus ist nicht verfügbar.');
  const isFile = mode.source === 'file';
  const providerKey = isFile ? 'IMPORT_FILE' : input.providerKey ?? 'HSN_TSN';
  if (!isFile) {
    const row = await db.vehicleProvider.findUnique({ where: { key: providerKey } });
    if (!row || row.kind !== 'external') throw new DomainError('Bitte einen externen Anbieter wählen.');
  }
  const label = (input.label?.trim() || (isFile ? `${mode.label}-Datei` : mode.label)).slice(0, 120);
  const job = await db.vehicleImportJob.create({ data: { providerKey, mode: mode.key, label, status: 'PREVIEW', createdById: user.id, params: { phase: 'fetch' } } });
  await writeAudit({ actorId: user.id, action: 'vehicledata.import_preview', entityType: 'VehicleImportJob', entityId: job.id, summary: `Importvorschau (${mode.label}, ${providerKey})` });

  if (mode.key === 'CSV' || mode.key === 'JSON') {
    const items = parseImportFile(mode.key, input.text ?? '', label);
    await stage(job.id, 0, items);
    await db.vehicleImportJob.update({ where: { id: job.id }, data: { params: { phase: 'ready' } } });
    await classify(job.id);
    return job.id;
  }
  if (mode.key === 'SINGLE') {
    const h = normalizeHsn(input.hsn), t = normalizeTsn(input.tsn);
    if (!h.value || !t.value) throw new DomainError(h.error ?? t.error ?? 'Bitte HSN und TSN angeben.');
    await db.vehicleImportJob.update({ where: { id: job.id }, data: { params: { phase: 'fetch', hsn: h.value, tsn: t.value } } });
  } else if (mode.key === 'URL') {
    const urls = [...new Set((input.urls ?? '').split(/\s+/).map((u) => u.trim()).filter(Boolean))];
    if (!urls.length) throw new DomainError('Bitte mindestens eine URL angeben.');
    if (urls.length > MAX_URLS) throw new DomainError(`Höchstens ${MAX_URLS} URLs pro Import.`);
    await db.vehicleImportJob.update({ where: { id: job.id }, data: { params: { phase: 'fetch', urls } } });
  }
  await advanceFetch(user, job.id);
  return job.id;
}

/** Abruf-Phase (gedrosselt, fortsetzbar): bei Limit/429/Fehlerserie pausiert der Job und kann später fortgesetzt werden. */
export async function advanceFetch(user: AuthUser, jobId: string) {
  requireManage(user);
  const job = await db.vehicleImportJob.findUnique({ where: { id: jobId } });
  if (!job) throw notFoundError('Importlauf');
  const params = (job.params ?? {}) as { phase?: string; hsn?: string; tsn?: string; urls?: string[] };
  if (params.phase !== 'fetch') return job;
  const provider = await db.vehicleProvider.findUnique({ where: { key: job.providerKey } });
  const cfg = provider ? providerConfig(provider) : {};
  const hosts = cfg.allowedHosts?.length ? cfg.allowedHosts : HSN_TSN_DEFAULT_HOSTS;
  const started = Date.now();
  let pos = job.total + job.countInvalid * 0; // Position = Anzahl bereits gestagter Zeilen
  pos = await db.vehicleImportRow.count({ where: { jobId } });
  let cursor = job.cursor;
  let pauseMsg: string | null = null;
  let consecutiveFail = 0;

  const targets: { kind: 'hsn'; hsn: string; tsn: string }[] | { kind: 'url'; url: string }[] =
    job.mode === 'SINGLE' ? [{ kind: 'hsn', hsn: params.hsn!, tsn: params.tsn! }] : (params.urls ?? []).map((url) => ({ kind: 'url' as const, url }));

  while (cursor < targets.length) {
    if (Date.now() - started > FETCH_BUDGET_MS) { pauseMsg = 'Zeitbudget erreicht – bitte fortsetzen.'; break; }
    const t = targets[cursor] as { kind: 'hsn'; hsn: string; tsn: string } | { kind: 'url'; url: string };
    let res;
    if (t.kind === 'url') {
      try { assertAllowedUrl(t.url, hosts); } catch (e) {
        await stage(jobId, pos++, [{ ok: false, error: e instanceof FetchError ? e.message : 'Ungültige URL.', text: t.url.slice(0, 160) }]);
        cursor++; continue;
      }
      res = await callProvider(job.providerKey, 'import_url', 'mass', (p, c) => p.getVehicleDetails({ sourceUrl: t.url }, { config: c }));
    } else {
      res = await callProvider(job.providerKey, 'import_single', 'single', (p, c) => p.lookupByHsnTsn(t.hsn, t.tsn, { config: c }));
    }
    if (res.status === 'ok') {
      await stage(jobId, pos, res.data.map((vehicle) => ({ ok: true as const, vehicle })));
      pos += res.data.length; cursor++; consecutiveFail = 0;
    } else if (res.status === 'rate_limited' || res.status === 'paused') {
      pauseMsg = res.message; break; // dieselbe Position später erneut – nichts wird umgangen
    } else if (res.status === 'license' || res.status === 'disabled' || res.status === 'not_configured') {
      await db.vehicleImportJob.update({ where: { id: jobId }, data: { status: 'FAILED', message: res.message, finishedAt: new Date() } });
      return db.vehicleImportJob.findUniqueOrThrow({ where: { id: jobId } });
    } else {
      await stage(jobId, pos++, [{ ok: false, error: res.message, text: t.kind === 'url' ? t.url.slice(0, 160) : `${t.hsn}/${t.tsn}` }]);
      cursor++;
      if (res.status !== 'not_found' && ++consecutiveFail >= 5) { pauseMsg = 'Mehrere Abrufe in Folge fehlgeschlagen – Import pausiert.'; break; }
    }
  }
  if (pauseMsg) {
    await db.vehicleImportJob.update({ where: { id: jobId }, data: { status: 'PAUSED', cursor, message: pauseMsg } });
  } else {
    await db.vehicleImportJob.update({ where: { id: jobId }, data: { cursor, status: 'PREVIEW', params: { ...params, phase: 'ready' }, message: null } });
    await classify(jobId);
  }
  return db.vehicleImportJob.findUniqueOrThrow({ where: { id: jobId } });
}

/* ------------------------------------------------------------ Importieren */

/**
 * Schreibt NEUE Datensätze; Konflikte werden als Konflikt vorgelegt (nie überschrieben); bereits Vorhandenes bleibt unberührt.
 * Eine fehlerhafte Zeile bricht den Lauf nicht ab. Bei großem Umfang wird in Abschnitten gearbeitet (fortsetzbar).
 */
export async function runImport(user: AuthUser, jobId: string) {
  requireManage(user);
  const job = await db.vehicleImportJob.findUnique({ where: { id: jobId } });
  if (!job) throw notFoundError('Importlauf');
  const phase = ((job.params ?? {}) as { phase?: string }).phase;
  if (phase !== 'ready') throw new DomainError('Der Abruf ist noch nicht abgeschlossen. Bitte zuerst die Vorschau fortsetzen.');
  if (['COMPLETED', 'CANCELLED', 'FAILED'].includes(job.status)) throw new DomainError('Dieser Importlauf ist bereits beendet.');
  const provider = await db.vehicleProvider.findUnique({ where: { key: job.providerKey } });
  const license = provider?.licenseStatus as LicenseKey | undefined;
  const source = job.providerKey;
  await db.vehicleImportJob.update({ where: { id: jobId }, data: { status: 'RUNNING', pausedUntil: null } });
  await writeAudit({ actorId: user.id, action: 'vehicledata.import_start', entityType: 'VehicleImportJob', entityId: jobId, summary: `Import gestartet (${job.label})` });
  const started = Date.now();
  let timedOut = false;
  for (;;) {
    const fresh = await db.vehicleImportJob.findUniqueOrThrow({ where: { id: jobId }, select: { status: true } });
    if (fresh.status === 'PAUSED' || fresh.status === 'CANCELLED') break;
    if (Date.now() - started > COMMIT_BUDGET_MS) { timedOut = true; break; }
    const batch = await db.vehicleImportRow.findMany({ where: { jobId, outcome: { in: ['NEW', 'CONFLICT'] } }, orderBy: { position: 'asc' }, take: 100 });
    if (!batch.length) break;
    for (const r of batch) {
      const nv = r.payload as unknown as NormalizedVehicle;
      try {
        const res = await db.$transaction((tx) => upsertNormalized(tx, nv, { source, license, actorId: user.id }));
        await db.vehicleImportRow.update({ where: { id: r.id }, data: { outcome: res.outcome === 'created' ? 'IMPORTED' : res.outcome === 'conflict' ? 'EXISTS' : 'EXISTS', recordId: res.record.id, error: res.outcome === 'conflict' ? 'Als Konflikt zur Prüfung vorgemerkt.' : null } });
      } catch {
        await db.vehicleImportRow.update({ where: { id: r.id }, data: { outcome: 'INVALID', error: 'Datensatz konnte nicht gespeichert werden.' } });
      }
    }
  }
  const counts = await db.vehicleImportRow.groupBy({ by: ['outcome'], where: { jobId }, _count: true });
  const c = Object.fromEntries(counts.map((x) => [x.outcome, x._count]));
  const open = (c.NEW ?? 0) + (c.CONFLICT ?? 0);
  const now = await db.vehicleImportJob.findUniqueOrThrow({ where: { id: jobId }, select: { status: true } });
  const conflictsCreated = await db.vehicleDataConflict.count({ where: { createdAt: { gte: job.createdAt }, incomingSource: source } });
  const done = open === 0 && now.status === 'RUNNING';
  await db.vehicleImportJob.update({
    where: { id: jobId },
    data: {
      countImported: c.IMPORTED ?? 0, countNew: c.NEW ?? 0, countConflict: c.CONFLICT ?? 0, countExists: c.EXISTS ?? 0, countInvalid: c.INVALID ?? 0,
      status: done ? 'COMPLETED' : now.status === 'RUNNING' ? 'RUNNING' : now.status, finishedAt: done ? new Date() : null,
      message: done ? `${c.IMPORTED ?? 0} importiert, ${conflictsCreated} Konflikt(e) vorgemerkt.` : timedOut ? 'Teilweise importiert – bitte fortsetzen.' : null,
    },
  });
  if (done) await writeAudit({ actorId: user.id, action: 'vehicledata.import_done', entityType: 'VehicleImportJob', entityId: jobId, summary: `Import abgeschlossen (${c.IMPORTED ?? 0} neu)`, after: { imported: c.IMPORTED ?? 0, conflicts: conflictsCreated } });
  return db.vehicleImportJob.findUniqueOrThrow({ where: { id: jobId } });
}

export async function setJobState(user: AuthUser, jobId: string, action: 'pause' | 'cancel' | 'resume') {
  requireManage(user);
  const job = await db.vehicleImportJob.findUnique({ where: { id: jobId } });
  if (!job) throw notFoundError('Importlauf');
  if (['COMPLETED', 'CANCELLED', 'FAILED'].includes(job.status)) throw new DomainError('Der Importlauf ist bereits beendet.');
  const status = action === 'pause' ? 'PAUSED' : action === 'cancel' ? 'CANCELLED' : ((job.params ?? {}) as { phase?: string }).phase === 'ready' ? 'PREVIEW' : 'PAUSED';
  await db.vehicleImportJob.update({ where: { id: jobId }, data: { status, finishedAt: action === 'cancel' ? new Date() : null, message: action === 'cancel' ? 'Abgebrochen.' : action === 'pause' ? 'Pausiert.' : null } });
  await writeAudit({ actorId: user.id, action: `vehicledata.import_${action}`, entityType: 'VehicleImportJob', entityId: jobId, summary: `Importlauf: ${action}` });
  if (action === 'resume') {
    const phase = ((job.params ?? {}) as { phase?: string }).phase;
    return phase === 'fetch' ? advanceFetch(user, jobId) : db.vehicleImportJob.findUniqueOrThrow({ where: { id: jobId } });
  }
  return db.vehicleImportJob.findUniqueOrThrow({ where: { id: jobId } });
}

/* ------------------------------------------------------------ Lesen */

export async function listJobs(user: AuthUser, take = 15) {
  requireManage(user);
  return db.vehicleImportJob.findMany({ orderBy: { createdAt: 'desc' }, take, include: { provider: { select: { name: true } } } });
}

export async function getJob(user: AuthUser, id: string, opts: { outcome?: string; page?: number } = {}) {
  requireManage(user);
  const job = await db.vehicleImportJob.findUnique({ where: { id }, include: { provider: { select: { name: true } } } });
  if (!job) throw notFoundError('Importlauf');
  const page = Math.max(1, opts.page ?? 1);
  const where: Prisma.VehicleImportRowWhereInput = { jobId: id, ...(opts.outcome ? { outcome: opts.outcome as 'NEW' } : {}) };
  const [rows, total] = await Promise.all([
    db.vehicleImportRow.findMany({ where, orderBy: { position: 'asc' }, skip: (page - 1) * 25, take: 25 }),
    db.vehicleImportRow.count({ where }),
  ]);
  const recIds = rows.map((r) => r.recordId).filter(Boolean) as string[];
  const recs = recIds.length ? await db.vehicleHsnTsn.findMany({ where: { id: { in: recIds } } }) : [];
  const byId = new Map(recs.map((r) => [r.id, toDto(r)]));
  return { job, rows: rows.map((r) => ({ ...r, payload: r.payload as unknown as NormalizedVehicle, record: r.recordId ? byId.get(r.recordId) ?? null : null })), total, page, pageSize: 25 };
}
