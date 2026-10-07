import 'server-only';
import { assertAllowedUrl, FetchError, safeFetch } from '../fetcher';
import { parseVehicleTables } from '../html-parser';
import type { NormalizedVehicle, ProviderConfig, ProviderContext, ProviderOutcome, VehicleDataProvider } from './types';

export const HSN_TSN_DEFAULT_HOSTS = ['www.hsn-tsn.de', 'hsn-tsn.de'];

const fail = <T>(e: unknown): ProviderOutcome<T> => {
  if (e instanceof FetchError) {
    const status = e.category === 'BLOCKED_URL' ? 'blocked' : e.category === 'RATE_LIMITED' ? 'rate_limited' : 'unavailable';
    return { status, message: e.message, category: e.category, httpStatus: e.httpStatus, retryAfterSec: e.retryAfterSec };
  }
  return { status: 'error', message: 'Unerwarteter Fehler beim Abruf.', category: 'UNEXPECTED' };
};

export function buildUrl(config: ProviderConfig, hsn: string, tsn: string): string | null {
  const t = config.urlTemplate?.trim();
  if (!t || !t.includes('{hsn}')) return null;
  return t.replace('{hsn}', encodeURIComponent(hsn)).replace('{tsn}', encodeURIComponent(tsn));
}

/** Prüft die vom Administrator hinterlegte Vorlage (Host-Freigabe, https, Platzhalter). */
export function validateTemplate(template: string, hosts: string[]): string | null {
  if (!template.includes('{hsn}')) return 'Die Vorlage muss {hsn} enthalten (und optional {tsn}).';
  try {
    assertAllowedUrl(template.replace('{hsn}', '0000').replace('{tsn}', 'AAA'), hosts);
  } catch (e) {
    return e instanceof FetchError ? e.message : 'Ungültige URL-Vorlage.';
  }
  return null;
}

async function load(url: string, config: ProviderConfig) {
  const res = await safeFetch(url, { allowedHosts: config.allowedHosts?.length ? config.allowedHosts : HSN_TSN_DEFAULT_HOSTS, timeoutMs: config.timeoutMs ?? 8000, maxBytes: config.maxBytes ?? 2 * 1024 * 1024 });
  return { ...res, parsed: parseVehicleTables(res.body, res.finalUrl) };
}

function toOutcome(res: Awaited<ReturnType<typeof load>>, hsn?: string, tsn?: string): ProviderOutcome<NormalizedVehicle[]> {
  let vehicles = res.parsed.rows.filter((r) => r.ok).map((r) => (r.ok ? r.vehicle : null)!).filter(Boolean);
  if (hsn && tsn) vehicles = vehicles.filter((v) => v.hsn === hsn && v.tsn === tsn);
  vehicles = vehicles.map((v, i) => ({ ...v, sourceRecordId: vehicles.length > 1 ? String(i + 1) : '', sourceUrl: v.sourceUrl ?? res.finalUrl }));
  if (!vehicles.length) return { status: 'not_found', message: 'Die Seite enthält keinen passenden Datensatz.', httpStatus: res.status, durationMs: res.durationMs };
  return { status: 'ok', data: vehicles, httpStatus: res.status, durationMs: res.durationMs, sourceUrl: res.finalUrl };
}

/**
 * Adapter für öffentlich abrufbare HSN/TSN-Seiten (hsn-tsn.de). Ein Provider unter mehreren: die Anwendung funktioniert ohne ihn.
 * Es werden nur normale serverseitige GET-Abrufe öffentlicher Seiten gemacht – keine geratenen Schnittstellen, keine Umgehung von
 * Schutzmaßnahmen, keine Browser-Automatisierung. Die Seitenadresse kommt aus der (geprüften) Provider-Konfiguration.
 */
export const HsnTsnProvider: VehicleDataProvider = {
  key: 'HSN_TSN',
  label: 'HSN/TSN-Anbieter',
  kind: 'external',
  connected: true,
  capabilities: { hsnTsn: true, vin: false, search: false, details: true, importUrl: true },

  async lookupByHsnTsn(hsn, tsn, ctx) {
    const url = buildUrl(ctx.config, hsn, tsn);
    if (!url) return { status: 'not_configured', message: 'Für diesen Anbieter ist keine Abruf-Adresse (URL-Vorlage) hinterlegt.' };
    try { return toOutcome(await load(url, ctx.config), hsn, tsn); } catch (e) { return fail(e); }
  },
  async searchVehicle() {
    return { status: 'not_configured', message: 'Freitextsuche wird von diesem Anbieter nicht unterstützt.' };
  },
  async lookupByVin() {
    return { status: 'not_configured', message: 'FIN-Abfragen werden von diesem Anbieter nicht unterstützt.' };
  },
  async getVehicleDetails(ref, ctx) {
    if (!ref.sourceUrl) return { status: 'not_configured', message: 'Keine Quell-URL vorhanden.' };
    try { return toOutcome(await load(ref.sourceUrl, ctx.config)); } catch (e) { return fail(e); }
  },
  async healthCheck(ctx) {
    const hosts = ctx.config.allowedHosts?.length ? ctx.config.allowedHosts : HSN_TSN_DEFAULT_HOSTS;
    const url = buildUrl(ctx.config, '0000', 'AAA');
    if (!url) return { status: 'not_configured', message: 'Keine URL-Vorlage hinterlegt – es gibt nichts zu prüfen.' };
    try {
      assertAllowedUrl(url, hosts);
      const res = await safeFetch(url, { allowedHosts: hosts, timeoutMs: ctx.config.timeoutMs ?? 8000, maxBytes: ctx.config.maxBytes ?? 2 * 1024 * 1024 });
      return { status: 'ok', data: { message: `Anbieter erreichbar (HTTP ${res.status}).` }, httpStatus: res.status, durationMs: res.durationMs };
    } catch (e) {
      // 404 auf der Dummy-Adresse heißt: Server erreichbar, nur die Beispielseite existiert nicht
      if (e instanceof FetchError && e.category === 'HTTP_4XX' && e.httpStatus === 404) return { status: 'ok', data: { message: 'Anbieter erreichbar (Beispielseite nicht vorhanden – das ist bei der Prüfung normal).' }, httpStatus: 404 };
      return fail(e);
    }
  },
  async syncVehicle(record, ctx) {
    if (record.sourceUrl) return this.getVehicleDetails({ sourceUrl: record.sourceUrl }, ctx);
    return this.lookupByHsnTsn(record.hsn, record.tsn, ctx);
  },
};
