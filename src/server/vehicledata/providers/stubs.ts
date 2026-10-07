import type { VehicleDataProvider } from './types';

/**
 * Platzhalter für noch nicht angebundene Anbieter. Sie erfinden weder Schnittstellen noch Daten:
 * jede Abfrage meldet ehrlich „nicht konfiguriert“. Ein echter Adapter ersetzt später genau diese Datei/Zeile.
 */
function notConnected(key: string, label: string, hint: string, caps: Partial<VehicleDataProvider['capabilities']> = {}): VehicleDataProvider {
  const msg = { status: 'not_configured' as const, message: `${label} ist nicht angebunden. ${hint}` };
  return {
    key, label, kind: 'external', connected: false,
    capabilities: { hsnTsn: false, vin: false, search: false, details: false, importUrl: false, ...caps },
    lookupByHsnTsn: async () => msg,
    searchVehicle: async () => msg,
    lookupByVin: async () => msg,
    getVehicleDetails: async () => msg,
    healthCheck: async () => msg,
    syncVehicle: async () => msg,
  };
}

export const KbaProvider = notConnected('KBA', 'KBA', 'Eine Anbindung setzt eine Vereinbarung mit dem Kraftfahrt-Bundesamt voraus.', { hsnTsn: true });
export const DatProvider = notConnected('DAT', 'DAT', 'Eine Anbindung setzt einen Lizenzvertrag mit der DAT voraus.', { hsnTsn: true, vin: true, search: true });
export const VinProvider = notConnected('VIN', 'VIN-Anbieter', 'Es ist noch kein FIN-Decoder ausgewählt.', { vin: true });

/** Eigene Datenbank und manuelle Daten laufen über den VehicleDataService; sie rufen nie extern ab. */
function internal(key: string, label: string): VehicleDataProvider {
  const none = { status: 'not_found' as const, message: 'Interner Bestand – Abfrage über den VehicleDataService.' };
  return {
    key, label, kind: 'internal', connected: true,
    capabilities: { hsnTsn: true, vin: false, search: true, details: true, importUrl: false },
    lookupByHsnTsn: async () => none, searchVehicle: async () => none, lookupByVin: async () => none, getVehicleDetails: async () => none,
    healthCheck: async () => ({ status: 'ok', data: { message: 'Interner Bestand verfügbar.' } }),
    syncVehicle: async () => none,
  };
}
export const OwnProvider = internal('OWN', 'Eigene Datenbank');
export const ManualVehicleProvider = internal('MANUAL', 'Manuelle Daten');
