import type { NormalizedVehicle } from '../html-parser';

export type { NormalizedVehicle };

/** Konfiguration eines Providers aus der Datenbank (keine Geheimnisse – Zugangsdaten gehören in Umgebungsvariablen). */
export type ProviderConfig = {
  allowedHosts?: string[];
  /** URL-Vorlage mit {hsn} und {tsn}; ohne Vorlage ist der Provider „nicht konfiguriert“ (Seitenstruktur wird nie erraten). */
  urlTemplate?: string | null;
  timeoutMs?: number;
  maxBytes?: number;
};

export type OutcomeStatus =
  | 'ok' | 'not_found' | 'not_configured' | 'disabled' | 'license' | 'paused' | 'rate_limited' | 'unavailable' | 'blocked' | 'error';

export type ProviderOutcome<T> =
  | { status: 'ok'; data: T; httpStatus?: number; durationMs?: number; sourceUrl?: string }
  | { status: Exclude<OutcomeStatus, 'ok'>; message: string; category?: string; httpStatus?: number; durationMs?: number; retryAfterSec?: number };

export type ProviderContext = { config: ProviderConfig };

/**
 * Schnittstelle für jede Fahrzeugdatenquelle. Provider kennen weder Datenbank noch Benutzer – sie liefern normalisierte Datensätze
 * oder einen klaren Zustand. Lizenz-, Rate-Limit- und Protokollierungslogik liegt im VehicleDataService.
 */
export interface VehicleDataProvider {
  readonly key: string;
  readonly label: string;
  readonly kind: 'internal' | 'external';
  /** false = nur Platzhalter ohne echte Schnittstelle; wird nie aufgerufen und kann nicht aktiviert werden */
  readonly connected: boolean;
  readonly capabilities: { hsnTsn: boolean; vin: boolean; search: boolean; details: boolean; importUrl: boolean };
  lookupByHsnTsn(hsn: string, tsn: string, ctx: ProviderContext): Promise<ProviderOutcome<NormalizedVehicle[]>>;
  searchVehicle(query: string, ctx: ProviderContext): Promise<ProviderOutcome<NormalizedVehicle[]>>;
  lookupByVin(vin: string, ctx: ProviderContext): Promise<ProviderOutcome<NormalizedVehicle[]>>;
  getVehicleDetails(ref: { sourceUrl?: string | null; sourceRecordId?: string | null }, ctx: ProviderContext): Promise<ProviderOutcome<NormalizedVehicle[]>>;
  /** Erreichbarkeits-/Konfigurationsprüfung ohne Datenübernahme */
  healthCheck(ctx: ProviderContext): Promise<ProviderOutcome<{ message: string }>>;
  /** Aktualisiert einen vorhandenen Datensatz aus der Quelle (liefert den Quellstand, speichert nichts) */
  syncVehicle(record: { hsn: string; tsn: string; sourceUrl?: string | null }, ctx: ProviderContext): Promise<ProviderOutcome<NormalizedVehicle[]>>;
}
