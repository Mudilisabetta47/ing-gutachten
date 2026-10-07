import 'server-only';
import { HsnTsnProvider } from './hsn-tsn';
import { DatProvider, KbaProvider, ManualVehicleProvider, OwnProvider, VinProvider } from './stubs';
import type { VehicleDataProvider } from './types';

/** Registry: ein Adapter je Anbieter. Neue Anbieter (Schwacke, TecDoc, Herstellerdaten …) werden hier eingetragen – sonst ändert sich nichts. */
const PROVIDERS: Record<string, VehicleDataProvider> = {
  OWN: OwnProvider, MANUAL: ManualVehicleProvider, HSN_TSN: HsnTsnProvider, KBA: KbaProvider, DAT: DatProvider, VIN: VinProvider,
};

export const getProvider = (key: string): VehicleDataProvider | null => PROVIDERS[key] ?? null;
export const providerKeys = () => Object.keys(PROVIDERS);
export type { VehicleDataProvider, NormalizedVehicle, ProviderOutcome } from './types';
