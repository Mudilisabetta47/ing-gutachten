import 'server-only';
import { getMailConfig, MailConfigError } from '@/lib/mail';
import { SITE_URL } from '@/lib/content';

/** Betriebsstatus für das Dashboard und die Einstellungen – ohne Geheimnisse. */
export function getSystemStatus() {
  let mail: { ok: boolean; label: string };
  try {
    const cfg = getMailConfig();
    mail = cfg ? { ok: true, label: `${cfg.provider.id} → ${cfg.to.replace(/(.).+(@.+)/, '$1…$2')}` } : { ok: false, label: 'nicht konfiguriert' };
  } catch (e) {
    mail = { ok: false, label: e instanceof MailConfigError ? 'Konfigurationsfehler (dry-run nicht erlaubt)' : 'Fehler' };
  }
  return {
    mail,
    storage: { ok: Boolean(process.env.S3_BUCKET || process.env.STORAGE_DRIVER === 'local'), label: process.env.S3_BUCKET ? 'S3-kompatibel' : process.env.STORAGE_DRIVER === 'local' ? 'lokal (Entwicklung)' : 'nicht konfiguriert' },
    siteUrl: SITE_URL,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unbekannt',
  };
}
