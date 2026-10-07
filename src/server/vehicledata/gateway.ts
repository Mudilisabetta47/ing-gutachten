import 'server-only';
import type { Prisma, VehicleProvider } from '@prisma/client';
import { z } from 'zod';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';
import type { AuthUser } from '@/server/auth/session-types';
import { DomainError, notFoundError } from '@/server/errors';
import { getProvider } from './providers';
import { validateTemplate, HSN_TSN_DEFAULT_HOSTS } from './providers/hsn-tsn';
import type { NormalizedVehicle, ProviderConfig, ProviderOutcome } from './providers/types';
import { requireManage } from './catalog';
import type { LicenseKey } from '@/lib/vehicle-data';

/**
 * Einziger Weg zu externen Anbietern. Hier gelten – unabhängig vom Adapter – Freigabe (Lizenzstatus), Pause, Rate-Limit
 * und Protokollierung. UI-Komponenten und Seiten rufen niemals einen Adapter direkt auf.
 */

export type Purpose = 'live' | 'test' | 'single' | 'mass';
const ALLOWED: LicenseKey[] = ['APPROVED', 'LICENSED'];

export const providerConfig = (row: VehicleProvider): ProviderConfig => {
  const c = (row.config ?? {}) as ProviderConfig;
  return { allowedHosts: row.key === 'HSN_TSN' ? (c.allowedHosts?.length ? c.allowedHosts : HSN_TSN_DEFAULT_HOSTS) : c.allowedHosts, urlTemplate: c.urlTemplate ?? null, timeoutMs: c.timeoutMs, maxBytes: c.maxBytes };
};

/** Darf diese Art von Abfrage laufen? Liefert eine Begründung, wenn nicht. */
export function gate(row: VehicleProvider, purpose: Purpose, now = new Date()): { ok: true } | { ok: false; status: 'disabled' | 'license' | 'paused' | 'rate_limited'; message: string } {
  if (row.licenseStatus === 'DISABLED' || (!row.enabled && purpose !== 'test')) return { ok: false, status: 'disabled', message: 'Dieser Anbieter ist deaktiviert.' };
  if (row.pausedUntil && row.pausedUntil > now) return { ok: false, status: 'paused', message: `Pausiert bis ${row.pausedUntil.toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}${row.pauseReason ? ` (${row.pauseReason})` : ''}.` };
  if (purpose === 'live' && !(row.autoLookup && ALLOWED.includes(row.licenseStatus))) return { ok: false, status: 'license', message: 'Externe Abfragen sind nicht freigegeben (Lizenzstatus und automatische Abfragen im Admin prüfen).' };
  if (purpose === 'mass' && !(row.massImport && ALLOWED.includes(row.licenseStatus))) return { ok: false, status: 'license', message: 'Massenimport ist nicht freigegeben (Lizenzstatus APPROVED/LICENSED und Massenimport aktivieren).' };
  if ((purpose === 'test' || purpose === 'single') && row.licenseStatus === 'UNKNOWN') return { ok: false, status: 'license', message: 'Der Lizenzstatus ist unbekannt – bitte zuerst prüfen und festlegen.' };
  return { ok: true };
}

export async function callProvider<T>(
  key: string, requestType: string, purpose: Purpose,
  fn: (provider: NonNullable<ReturnType<typeof getProvider>>, config: ProviderConfig) => Promise<ProviderOutcome<T>>,
): Promise<ProviderOutcome<T>> {
  const provider = getProvider(key);
  const row = await db.vehicleProvider.findUnique({ where: { key } });
  if (!provider || !row || provider.kind === 'internal') return { status: 'disabled', message: 'Unbekannter oder interner Anbieter.' };
  if (!provider.connected) return fn(provider, providerConfig(row)); // Platzhalter: ehrlich „nicht konfiguriert“, ohne Zählung
  const g = gate(row, purpose);
  if (!g.ok) return { status: g.status, message: g.message };

  // lokales Rate-Limit (pro Anbieter, serverweit über das Protokoll) – kein Request, wenn das Kontingent erschöpft ist
  const since = new Date(Date.now() - 60_000);
  const recent = await db.vehicleProviderLog.count({ where: { providerKey: key, at: { gte: since } } });
  if (recent >= row.rateLimitPerMin) return { status: 'rate_limited', message: `Anfragenlimit erreicht (${row.rateLimitPerMin}/Minute). Bitte kurz warten.`, category: 'LOCAL_LIMIT', retryAfterSec: 60 };

  const started = Date.now();
  let outcome: ProviderOutcome<T>;
  try {
    outcome = await fn(provider, providerConfig(row));
  } catch {
    outcome = { status: 'error', message: 'Unerwarteter Fehler beim Abruf.', category: 'UNEXPECTED' };
  }
  const durationMs = outcome.durationMs ?? Date.now() - started;
  if (outcome.status !== 'not_configured') {
    const ok = outcome.status === 'ok' || outcome.status === 'not_found';
    const found = outcome.status === 'ok' && Array.isArray(outcome.data) ? outcome.data.length : outcome.status === 'not_found' ? 0 : null;
    const category = outcome.status === 'ok' || outcome.status === 'not_found' ? null : ('category' in outcome ? outcome.category ?? outcome.status.toUpperCase() : outcome.status.toUpperCase());
    await db.$transaction(async (tx) => {
      await tx.vehicleProviderLog.create({ data: { providerKey: key, requestType, status: outcome.status, durationMs, httpStatus: outcome.httpStatus ?? null, recordsFound: found, errorCategory: category } });
      const data: Prisma.VehicleProviderUpdateInput = { requestCount: { increment: 1 }, lastConnectedAt: ok ? new Date() : undefined };
      if (ok) data.lastSuccessAt = new Date();
      else { data.errorCount = { increment: 1 }; data.lastErrorAt = new Date(); data.lastErrorCategory = category; }
      // HTTP 429 → automatisch pausieren; das Limit wird nicht umgangen
      if (outcome.status === 'rate_limited' && 'category' in outcome && outcome.category === 'RATE_LIMITED') {
        const sec = outcome.retryAfterSec ?? 900;
        data.pausedUntil = new Date(Date.now() + sec * 1000);
        data.pauseReason = 'Anbieter meldet HTTP 429 (zu viele Anfragen)';
      }
      await tx.vehicleProvider.update({ where: { key }, data });
    });
  }
  return outcome;
}

/* ------------------------------------------------------------ Verwaltung */

export async function listProviders(user: AuthUser) {
  requireManage(user);
  const rows = await db.vehicleProvider.findMany({ orderBy: { key: 'asc' } });
  const since = new Date(Date.now() - 24 * 3600_000);
  const logs = await db.vehicleProviderLog.groupBy({ by: ['providerKey', 'status'], where: { at: { gte: since } }, _count: true });
  const order = ['OWN', 'HSN_TSN', 'KBA', 'DAT', 'VIN', 'MANUAL'];
  return rows
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
    .map((r) => {
      const l = logs.filter((x) => x.providerKey === r.key);
      const total24 = l.reduce((n, x) => n + x._count, 0);
      const failed24 = l.filter((x) => !['ok', 'not_found'].includes(x.status)).reduce((n, x) => n + x._count, 0);
      return { ...r, config: providerConfig(r), total24, failed24, errorRate: r.requestCount ? Math.round((r.errorCount / r.requestCount) * 100) : null };
    });
}

export async function providerLogs(user: AuthUser, key: string, take = 20) {
  requireManage(user);
  return db.vehicleProviderLog.findMany({ where: { providerKey: key }, orderBy: { at: 'desc' }, take });
}

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  licenseStatus: z.enum(['UNKNOWN', 'REVIEW_REQUIRED', 'APPROVED', 'LICENSED', 'DISABLED']).optional(),
  autoLookup: z.boolean().optional(),
  massImport: z.boolean().optional(),
  rateLimitPerMin: z.number().int().min(1).max(120).optional(),
  urlTemplate: z.string().trim().max(300).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  resume: z.boolean().optional(),
});

/** Schalter „Externe Datenquelle“. Automatische Abfragen und Massenimport sind erst nach ausdrücklicher Freigabe möglich. */
export async function updateProvider(user: AuthUser, key: string, raw: unknown) {
  requireManage(user);
  const patch = patchSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const row = await tx.vehicleProvider.findUnique({ where: { key } });
    if (!row) throw notFoundError('Anbieter');
    const provider = getProvider(key);
    const isExternal = row.kind === 'external';
    const license = patch.licenseStatus ?? row.licenseStatus;
    const data: Prisma.VehicleProviderUpdateInput = { updatedById: user.id };

    if (!isExternal && (patch.licenseStatus || patch.autoLookup || patch.massImport || patch.urlTemplate !== undefined)) throw new DomainError('Interne Quellen haben keine Lizenz- oder Abrufeinstellungen.');
    if (patch.licenseStatus) data.licenseStatus = patch.licenseStatus;
    if (patch.enabled !== undefined) data.enabled = patch.enabled;
    if (patch.rateLimitPerMin !== undefined) data.rateLimitPerMin = patch.rateLimitPerMin;
    if (patch.notes !== undefined) data.notes = patch.notes || null;
    if (patch.resume) { data.pausedUntil = null; data.pauseReason = null; }

    const wantsAuto = patch.autoLookup ?? row.autoLookup;
    const wantsMass = patch.massImport ?? row.massImport;
    const wantsEnabled = patch.enabled ?? row.enabled;
    if ((wantsAuto || wantsMass) && !ALLOWED.includes(license)) {
      if (patch.autoLookup || patch.massImport) throw new DomainError('Automatische Abfragen und Massenimport sind erst möglich, wenn der Lizenzstatus ausdrücklich auf „Freigegeben“ oder „Lizenziert“ gesetzt ist.');
    }
    // Lizenzstatus zurückgenommen → automatische Funktionen sofort aus
    data.autoLookup = ALLOWED.includes(license) && wantsEnabled ? wantsAuto : false;
    data.massImport = ALLOWED.includes(license) && wantsEnabled ? wantsMass : false;
    if ((patch.autoLookup || patch.massImport || patch.enabled) && provider && !provider.connected) throw new DomainError('Dieser Anbieter ist noch nicht angebunden und kann nicht aktiviert werden.');

    if (patch.urlTemplate !== undefined) {
      const cfg = providerConfig(row);
      const t = patch.urlTemplate?.trim() || null;
      if (t) {
        const err = validateTemplate(t, cfg.allowedHosts?.length ? cfg.allowedHosts : HSN_TSN_DEFAULT_HOSTS);
        if (err) throw new DomainError(err);
      }
      data.config = { ...((row.config ?? {}) as Record<string, unknown>), urlTemplate: t } as Prisma.InputJsonValue;
    }
    await tx.vehicleProvider.update({ where: { key }, data });
    await writeAudit({ actorId: user.id, action: 'vehicledata.provider_update', entityType: 'VehicleProvider', entityId: key, summary: `Anbieter ${row.name} geändert`, before: { enabled: row.enabled, licenseStatus: row.licenseStatus, autoLookup: row.autoLookup, massImport: row.massImport }, after: { ...patch, urlTemplate: patch.urlTemplate !== undefined ? '[gesetzt]' : undefined } }, tx);
  });
}

/* ------------------------------------------------------------ Verbindung testen (speichert nichts) */

export async function testConnection(user: AuthUser, key: string) {
  requireManage(user);
  const res = await callProvider(key, 'health', 'test', (p, cfg) => p.healthCheck({ config: cfg }));
  await writeAudit({ actorId: user.id, action: 'vehicledata.provider_test', entityType: 'VehicleProvider', entityId: key, summary: `Verbindung getestet: ${res.status}` });
  return res;
}

export async function testLookup(user: AuthUser, key: string, hsn: string, tsn: string): Promise<ProviderOutcome<NormalizedVehicle[]>> {
  requireManage(user);
  return callProvider(key, 'lookup_test', 'test', (p, cfg) => p.lookupByHsnTsn(hsn, tsn, { config: cfg }));
}
