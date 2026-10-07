/**
 * Privater Dateispeicher. Zwei Treiber hinter einer Schnittstelle:
 *  - LocalDriver: Dateisystem unter .data/private (nur Entwicklung/Tests)
 *  - S3Driver: S3-kompatibel (Cloudflare R2, AWS S3, MinIO) – Produktion
 * Dateien sind nie öffentlich erreichbar; Auslieferung nur über die authentifizierte Route nach Rechteprüfung.
 */
export interface StorageDriver {
  readonly id: 'local' | 's3';
  put(key: string, bytes: Uint8Array, mimeType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Kurzlebige signierte URL (nur S3). Local liefert `null` → die Route streamt selbst. */
  signedUrl(key: string, opts: { expiresInSeconds: number; fileName?: string; mimeType?: string }): Promise<string | null>;
}

/** Schlüssel sind zufällig und strukturlos – nie Dateiname, nie Fallnummer. */
export const STORAGE_KEY_RE = /^[a-z0-9][a-z0-9/_-]{8,200}$/;

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}
