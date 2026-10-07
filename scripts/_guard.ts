/**
 * Sicherheitsgurt für alle Skripte, die Daten schreiben:
 *  - nie in Production
 *  - nur gegen eine lokale Datenbank (localhost/127.0.0.1) – außer mit ausdrücklichem ALLOW_REMOTE_DB=yes
 */
export function assertSafeTarget(action: string, opts: { allowRemote?: boolean } = {}): void {
  const url = process.env.DATABASE_URL ?? '';
  if (!url) throw new Error('DATABASE_URL ist nicht gesetzt.');
  if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
    throw new Error(`${action}: in Production nicht erlaubt.`);
  }
  const host = new URL(url.replace(/^postgres(ql)?:/, 'http:')).hostname;
  const local = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (!local && !(opts.allowRemote && process.env.ALLOW_REMOTE_DB === 'yes')) {
    throw new Error(`${action}: Ziel-Datenbank "${host}" ist nicht lokal. Abbruch (ALLOW_REMOTE_DB=yes nur bewusst setzen).`);
  }
}
