import { brevoProvider } from './brevo';
import { resendProvider } from './resend';
import type { MailProvider } from './types';

export type { MailMessage, MailProvider, MailAttachment } from './types';
export { MailError } from './types';

export type MailConfig = { provider: MailProvider; from: { email: string; name: string }; to: string };

/**
 * Liest die Konfiguration aus den Umgebungsvariablen (nur serverseitig).
 * Gibt `null` zurück, wenn etwas fehlt – die API antwortet dann ehrlich mit 503
 * und tut NICHT so, als sei etwas versendet worden.
 *
 * `MAIL_PROVIDER=dry-run` ist ausschließlich außerhalb von Production erlaubt
 * (lokale Entwicklung/Tests): die Anfrage wird komplett validiert, aber nichts versendet.
 */
export function getMailConfig(): MailConfig | null {
  const kind = (process.env.MAIL_PROVIDER ?? 'brevo').toLowerCase();
  const fromEmail = process.env.MAIL_FROM?.trim();
  const to = process.env.MAIL_TO?.trim();
  const name = process.env.MAIL_FROM_NAME?.trim() || 'ING Gutachten Website';
  if (!fromEmail || !to) return null;

  if (kind === 'dry-run') {
    if (process.env.NODE_ENV === 'production') return null;
    return { provider: { id: 'dry-run', async send() {} }, from: { email: fromEmail, name }, to };
  }
  if (kind === 'brevo') {
    const key = process.env.BREVO_API_KEY?.trim();
    return key ? { provider: brevoProvider(key), from: { email: fromEmail, name }, to } : null;
  }
  if (kind === 'resend') {
    const key = process.env.RESEND_API_KEY?.trim();
    return key ? { provider: resendProvider(key), from: { email: fromEmail, name }, to } : null;
  }
  return null;
}
