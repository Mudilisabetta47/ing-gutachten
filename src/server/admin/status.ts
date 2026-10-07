import 'server-only';
import { getMailConfig, MailConfigError } from '@/lib/mail';
import { SITE_URL } from '@/lib/content';
import { getStorage } from '@/server/storage';

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
    storage: (() => {
      const d = getStorage();
      return { ok: d !== null, label: d?.id === 's3' ? 'S3-kompatibel (privat)' : d?.id === 'local' ? 'lokal (nur Entwicklung)' : 'nicht konfiguriert' };
    })(),
    siteUrl: SITE_URL,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unbekannt',
  };
}
