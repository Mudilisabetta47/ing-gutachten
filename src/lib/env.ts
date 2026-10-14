/**
 * Betriebsumgebung. Wird NICHT aus NODE_ENV abgeleitet (ein lokaler `next start` ist kein Echtbetrieb),
 * sondern aus ING_ENV bzw. – wenn nicht gesetzt – aus Vercel (production → production, preview → staging).
 *   development  lokal, Demo-Daten erlaubt
 *   test         automatische Tests
 *   staging      Vorabnahme mit Testdaten (eigene Datenbank/Speicher), aber wie Produktion abgesichert
 *   production   Echtbetrieb: keine Demo-Konten, kein bekanntes Demo-Passwort, kein Dry-Run-Mail
 */
export type IngEnv = 'development' | 'test' | 'staging' | 'production';
const ALL: readonly IngEnv[] = ['development', 'test', 'staging', 'production'];

export function ingEnv(env: NodeJS.ProcessEnv = process.env): IngEnv {
  const v = (env.ING_ENV ?? '').toLowerCase();
  if ((ALL as readonly string[]).includes(v)) return v as IngEnv;
  if (env.VERCEL_ENV === 'production') return 'production';
  if (env.VERCEL_ENV === 'preview') return 'staging';
  return env.NODE_ENV === 'test' ? 'test' : 'development';
}

/** Staging und Produktion: dort gelten die strengen Regeln. */
export const isLiveEnv = (env: NodeJS.ProcessEnv = process.env) => ingEnv(env) === 'production' || ingEnv(env) === 'staging';

export const DEMO_EMAIL_DOMAIN = 'demo.ing.test';
/** Das aus dem Repository bekannte Demo-Passwort (scripts/seed-demo.ts). In Staging/Produktion darf es nie funktionieren. */
export const KNOWN_DEMO_PASSWORD = 'Demo-Passwort-Lokal-2026!';
export const isDemoEmail = (email: string) => email.trim().toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
