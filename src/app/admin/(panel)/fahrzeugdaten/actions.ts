'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorize } from '@/server/auth/guards';
import { echo, toFormState, type FormState } from '@/server/admin/form';
import { str } from '@/server/admin/fields';
import { archiveRecord, resolveConflict, upsertNormalized, type ConflictAction } from '@/server/vehicledata/catalog';
import { callProvider, testConnection, testLookup, updateProvider } from '@/server/vehicledata/gateway';
import { createImportPreview, advanceFetch, runImport, setJobState, type ImportMode } from '@/server/vehicledata/imports';
import { db } from '@/server/db';
import { normalizeHsn, normalizeTsn, type LicenseKey } from '@/lib/vehicle-data';
import type { NormalizedVehicle } from '@/server/vehicledata/providers/types';

const BASE = '/admin/fahrzeugdaten';

/* ------------------------------------------------------------ Anbieter */

export async function updateProviderAction(_p: FormState, fd: FormData): Promise<FormState> {
  const key = str(fd, 'key');
  const values = echo(fd);
  try {
    const user = await authorize('vehicledata.manage');
    const patch: Record<string, unknown> = {};
    if (fd.has('licenseStatus')) patch.licenseStatus = str(fd, 'licenseStatus');
    if (fd.has('__switches')) {
      patch.enabled = fd.get('enabled') === 'on';
      patch.autoLookup = fd.get('autoLookup') === 'on';
      patch.massImport = fd.get('massImport') === 'on';
    }
    if (fd.has('rateLimitPerMin')) patch.rateLimitPerMin = Number(str(fd, 'rateLimitPerMin'));
    if (fd.has('urlTemplate')) patch.urlTemplate = str(fd, 'urlTemplate') || null;
    if (fd.has('notes')) patch.notes = str(fd, 'notes') || null;
    if (fd.get('resume') === '1') patch.resume = true;
    // Lizenzstatus zuerst, damit die Schalter im selben Schritt gegen den neuen Status geprüft werden
    if (patch.licenseStatus && (patch.enabled !== undefined)) {
      const { licenseStatus, ...rest } = patch;
      await updateProvider(user, key, { licenseStatus });
      await updateProvider(user, key, rest);
    } else {
      await updateProvider(user, key, patch);
    }
    revalidatePath(`${BASE}/quellen`);
    return { ok: true, message: 'Gespeichert.', values };
  } catch (e) { return toFormState(e, values); }
}

export type TestOutcome = { status: string; message: string; durationMs?: number; httpStatus?: number; records?: { hsn: string; tsn: string; title: string; power: string | null; displacement: string | null; fuel: string | null; sourceUrl: string | null }[] };

const summarize = (v: NormalizedVehicle) => ({
  hsn: v.hsn, tsn: v.tsn, title: v.vehicleNameRaw ?? [v.manufacturer, v.model].filter(Boolean).join(' '),
  power: v.powerKw || v.powerHp ? [v.powerKw && `${v.powerKw} kW`, v.powerHp && `${v.powerHp} PS`].filter(Boolean).join(' / ') : null,
  displacement: v.displacementCc ? `${v.displacementCc.toLocaleString('de-DE')} cm³` : null, fuel: v.fuelType, sourceUrl: v.sourceUrl,
});

export async function testConnectionAction(key: string): Promise<TestOutcome> {
  try {
    const user = await authorize('vehicledata.manage');
    const r = await testConnection(user, key);
    revalidatePath(`${BASE}/quellen`);
    return r.status === 'ok' ? { status: 'ok', message: r.data.message, durationMs: r.durationMs, httpStatus: r.httpStatus } : { status: r.status, message: r.message, durationMs: r.durationMs, httpStatus: r.httpStatus };
  } catch (e) { return { status: 'error', message: toFormState(e).error ?? 'Fehler.' }; }
}

export async function testLookupAction(key: string, hsn: string, tsn: string): Promise<TestOutcome> {
  try {
    const user = await authorize('vehicledata.manage');
    const h = normalizeHsn(hsn), t = normalizeTsn(tsn);
    if (!h.value || !t.value) return { status: 'invalid', message: h.error ?? t.error ?? 'Bitte HSN und TSN angeben.' };
    const r = await testLookup(user, key, h.value, t.value);
    revalidatePath(`${BASE}/quellen`);
    return r.status === 'ok'
      ? { status: 'ok', message: `${r.data.length} Treffer – nichts wurde gespeichert.`, durationMs: r.durationMs, httpStatus: r.httpStatus, records: r.data.map(summarize) }
      : { status: r.status, message: r.message, durationMs: r.durationMs, httpStatus: r.httpStatus };
  } catch (e) { return { status: 'error', message: toFormState(e).error ?? 'Fehler.' }; }
}

/** „Testdatensatz importieren“: ruft genau eine HSN/TSN ab und speichert sie (mit Konflikterkennung). */
export async function importTestRecordAction(key: string, hsn: string, tsn: string): Promise<TestOutcome> {
  try {
    const user = await authorize('vehicledata.manage');
    const h = normalizeHsn(hsn), t = normalizeTsn(tsn);
    if (!h.value || !t.value) return { status: 'invalid', message: h.error ?? t.error ?? 'Bitte HSN und TSN angeben.' };
    const row = await db.vehicleProvider.findUniqueOrThrow({ where: { key } });
    const r = await callProvider(key, 'import_test', 'single', (p, cfg) => p.lookupByHsnTsn(h.value!, t.value!, { config: cfg }));
    if (r.status !== 'ok') return { status: r.status, message: r.message };
    const results = await db.$transaction(async (tx) => { const out = []; for (const v of r.data) out.push((await upsertNormalized(tx, v, { source: key, license: row.licenseStatus as LicenseKey, actorId: user.id })).outcome); return out; });
    revalidatePath(BASE);
    return { status: 'ok', message: `Importiert: ${results.filter((x) => x === 'created').length} neu, ${results.filter((x) => x === 'exists').length} vorhanden, ${results.filter((x) => x === 'conflict').length} Konflikt(e).`, records: r.data.map(summarize) };
  } catch (e) { return { status: 'error', message: toFormState(e).error ?? 'Fehler.' }; }
}

/* ------------------------------------------------------------ Import */

export async function createImportAction(_p: FormState, fd: FormData): Promise<FormState> {
  const values = echo(fd, 'file');
  try {
    const user = await authorize('vehicledata.manage');
    const mode = str(fd, 'mode') as ImportMode;
    let text = str(fd, 'text');
    const file = fd.get('file');
    if (file instanceof File && file.size > 0) {
      if (file.size > 2 * 1024 * 1024) return { error: 'Die Datei ist zu groß (max. 2 MB).', values };
      text = await file.text();
    }
    const jobId = await createImportPreview(user, { mode, providerKey: str(fd, 'providerKey') || undefined, hsn: str(fd, 'hsn'), tsn: str(fd, 'tsn'), urls: str(fd, 'urls'), text, label: str(fd, 'label') });
    // Die Weiterleitung übernimmt der Browser (router.push): zuverlässiger als redirect() in einer Action mit Datei-Upload
    return { ok: true, redirectTo: `${BASE}/import/${jobId}/` };
  } catch (e) { return toFormState(e, values); }
}

export async function runImportAction(_p: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, 'id');
  try {
    const user = await authorize('vehicledata.manage');
    const job = await runImport(user, id);
    revalidatePath(`${BASE}/import/${id}`);
    return { ok: true, message: job.status === 'COMPLETED' ? job.message ?? 'Import abgeschlossen.' : job.message ?? 'Teilweise importiert – bitte fortsetzen.' };
  } catch (e) { return toFormState(e); }
}

export async function jobStateAction(_p: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, 'id');
  try {
    const user = await authorize('vehicledata.manage');
    const action = str(fd, 'action') as 'pause' | 'cancel' | 'resume';
    const job = action === 'resume' && fd.get('fetch') === '1' ? await advanceFetch(user, id) : await setJobState(user, id, action);
    revalidatePath(`${BASE}/import/${id}`);
    return { ok: true, message: job.status === 'PAUSED' ? job.message ?? 'Pausiert.' : action === 'cancel' ? 'Import abgebrochen.' : 'Fortgesetzt.' };
  } catch (e) { return toFormState(e); }
}

/* ------------------------------------------------------------ Konflikte & Datensätze */

export async function resolveConflictAction(_p: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await authorize('vehicledata.manage');
    const action = str(fd, 'action') as ConflictAction;
    const manual = action === 'MANUAL' ? Object.fromEntries([...fd.entries()].filter(([k, v]) => typeof v === 'string' && !['id', 'action'].includes(k) && !k.startsWith('$'))) : undefined;
    await resolveConflict(user, str(fd, 'id'), action, manual);
    revalidatePath(`${BASE}/konflikte`);
    return { ok: true, message: 'Konflikt gelöst.' };
  } catch (e) { return toFormState(e); }
}

export async function archiveRecordAction(_p: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await authorize('vehicledata.manage');
    await archiveRecord(user, str(fd, 'id'));
  } catch (e) { return toFormState(e); }
  revalidatePath(BASE);
  redirect(`${BASE}/`);
}
