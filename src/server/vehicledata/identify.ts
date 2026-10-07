import 'server-only';
import type { VehicleHsnTsn } from '@prisma/client';
import { db } from '@/server/db';
import type { AuthUser } from '@/server/auth/session-types';
import { diffRecords, normalizeHsn, normalizeTsn, sourcePriority, validateVin, type LicenseKey } from '@/lib/vehicle-data';
import { vehicleScope } from '@/server/pipeline/access';
import { requireRead, STALE_DAYS, toDto, upsertNormalized, withOpenConflicts, type RecordDto } from './catalog';
import { callProvider, gate } from './gateway';

export type ExternalState = 'not_asked' | 'not_enabled' | 'ok' | 'not_found' | 'unavailable' | 'paused' | 'rate_limited' | 'not_configured';

export type IdentifyResult = {
  status: 'found' | 'multiple' | 'not_found' | 'invalid';
  hsn: string | null; tsn: string | null;
  errors: { hsn?: string; tsn?: string };
  hints: string[];
  records: RecordDto[];
  /** Weitere Quellen mit identischen Daten (nur Anzeige) */
  alsoIn: string[];
  external: { state: ExternalState; message?: string };
  cached: boolean;
};

const EXT_MESSAGE: Record<ExternalState, string | undefined> = {
  not_asked: undefined, not_enabled: undefined, ok: undefined, not_found: 'Der externe Anbieter kennt diese HSN/TSN nicht.',
  unavailable: 'Externe Fahrzeugdaten derzeit nicht erreichbar.', paused: 'Der externe Anbieter ist derzeit pausiert.',
  rate_limited: 'Der externe Anbieter ist derzeit ausgelastet.', not_configured: undefined,
};

/** Gleiche Fahrzeuge aus mehreren Quellen zu einer Anzeige zusammenfassen; abweichende bleiben getrennte Varianten. */
function collapse(records: VehicleHsnTsn[]): { primary: VehicleHsnTsn[]; alsoIn: string[] } {
  const rank = (r: VehicleHsnTsn) => sourcePriority(r.source, { license: r.source === 'KBA' ? 'LICENSED' : undefined }) * 10 + (r.verificationStatus === 'VERIFIED' ? 5 : 0);
  const sorted = [...records].sort((a, b) => rank(b) - rank(a));
  const primary: VehicleHsnTsn[] = [];
  const alsoIn: string[] = [];
  for (const r of sorted) {
    const dup = primary.find((p) => p.source !== r.source && diffRecords(p, r).length === 0);
    if (dup) alsoIn.push(r.source); else primary.push(r);
  }
  return { primary, alsoIn };
}

/**
 * HSN/TSN → Fahrzeug. Reihenfolge: 1. eigene Datenbank (sofort, kein externer Request), 2. nur wenn nichts vorhanden oder alles veraltet
 * ist UND ein Anbieter ausdrücklich freigegeben ist: externer Abruf → normalisieren → in der eigenen Datenbank zwischenspeichern.
 * Ist der Anbieter nicht erreichbar, bleibt das Ergebnis der eigenen Datenbank bestehen.
 */
export async function identifyByHsnTsn(user: AuthUser, hsnIn: string, tsnIn: string, opts: { allowExternal?: boolean } = {}): Promise<IdentifyResult> {
  requireRead(user);
  const h = normalizeHsn(hsnIn), t = normalizeTsn(tsnIn);
  const hints = t.hint ? [t.hint] : [];
  if (!h.value || !t.value) {
    return { status: 'invalid', hsn: h.value, tsn: t.value, errors: { hsn: h.error, tsn: t.error }, hints, records: [], alsoIn: [], external: { state: 'not_asked' }, cached: false };
  }
  const hsn = h.value, tsn = t.value;
  let own = await db.vehicleHsnTsn.findMany({ where: { hsn, tsn, deletedAt: null } });
  const freshCut = Date.now() - STALE_DAYS * 86_400_000;
  const allStale = own.length > 0 && own.every((r) => r.source !== 'MANUAL' && (r.sourceLastCheckedAt ?? r.createdAt).getTime() < freshCut);
  let external: IdentifyResult['external'] = { state: 'not_asked' };
  let cached = own.length > 0 && !allStale;

  if ((own.length === 0 || allStale) && opts.allowExternal !== false) {
    const row = await db.vehicleProvider.findUnique({ where: { key: 'HSN_TSN' } });
    if (!row) {
      external = { state: 'not_enabled' };
    } else {
      const g = gate(row, 'live');
      if (!g.ok) {
        external = { state: g.status === 'paused' ? 'paused' : g.status === 'rate_limited' ? 'rate_limited' : 'not_enabled', message: g.status === 'paused' ? g.message : undefined };
      } else {
        const res = await callProvider('HSN_TSN', 'lookup', 'live', (p, cfg) => p.lookupByHsnTsn(hsn, tsn, { config: cfg }));
        if (res.status === 'ok') {
          await db.$transaction(async (tx) => {
            for (const nv of res.data) await upsertNormalized(tx, nv, { source: 'HSN_TSN', license: row.licenseStatus as LicenseKey, actorId: user.id });
          });
          own = await db.vehicleHsnTsn.findMany({ where: { hsn, tsn, deletedAt: null } });
          external = { state: 'ok' };
          cached = false;
        } else if (res.status === 'not_found') external = { state: 'not_found', message: EXT_MESSAGE.not_found };
        else if (res.status === 'not_configured') external = { state: 'not_configured' };
        else if (res.status === 'paused') external = { state: 'paused', message: EXT_MESSAGE.paused };
        else if (res.status === 'rate_limited') external = { state: 'rate_limited', message: EXT_MESSAGE.rate_limited };
        else external = { state: 'unavailable', message: EXT_MESSAGE.unavailable };
      }
    }
  }

  const { primary, alsoIn } = collapse(own);
  const records = await withOpenConflicts(primary);
  return {
    status: records.length === 0 ? 'not_found' : records.length === 1 ? 'found' : 'multiple',
    hsn, tsn, errors: {}, hints, records, alsoIn: [...new Set(alsoIn)], external, cached,
  };
}

/** Teilangaben (z. B. nur HSN) oder Freitext → Trefferliste aus der eigenen Datenbank. */
export { searchCatalog } from './catalog';

/* ------------------------------------------------------------ FIN */

export type VinResult = {
  status: 'invalid' | 'ok';
  vin: string | null; error?: string; wmi?: string;
  /** frühere Fahrzeuge mit derselben FIN im eigenen Bestand (nur im Rahmen der Zugriffsrechte) */
  known: { id: string; manufacturer: string; model: string; variant: string | null; licensePlate: string | null; hsn: string | null; tsn: string | null; powerKw: number | null; displacementCc: number | null }[];
  provider: { state: 'not_configured' | 'disabled'; message: string };
};

/** FIN prüfen und im eigenen Bestand suchen. Ein VIN-Decoder ist noch nicht angebunden – das wird ehrlich so angezeigt. */
export async function identifyByVin(user: AuthUser, input: string): Promise<VinResult> {
  requireRead(user);
  const v = validateVin(input);
  const row = await db.vehicleProvider.findUnique({ where: { key: 'VIN' } });
  const provider = { state: 'not_configured' as const, message: row?.enabled ? 'Der FIN-Anbieter ist noch nicht angebunden.' : 'Es ist kein FIN-Decoder angebunden. Die FIN wird geprüft und im eigenen Bestand gesucht.' };
  if (!v.value) return { status: 'invalid', vin: null, error: v.error, known: [], provider };
  const scope = vehicleScope(user) ?? { id: '__none__' };
  const known = await db.vehicle.findMany({
    where: { AND: [scope, { vin: v.value, deletedAt: null }] }, orderBy: { updatedAt: 'desc' }, take: 5,
    select: { id: true, manufacturer: true, model: true, variant: true, licensePlate: true, hsn: true, tsn: true, powerKw: true, displacementCc: true },
  });
  return { status: 'ok', vin: v.value, wmi: v.wmi, known, provider };
}

export { toDto };
