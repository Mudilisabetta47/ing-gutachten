import { brevoProvider } from './brevo';
import { resendProvider } from './resend';
import type { MailProvider } from './types';

export type { MailMessage, MailProvider, MailAttachment } from './types';
export { MailError } from './types';

export type MailConfig = { provider: MailProvider; from: { email: string; name: string }; to: string };

/** Unzulässige Konfiguration (z. B. dry-run in Production). Wird serverseitig geloggt, nie dem Besucher gezeigt. */
export class MailConfigError extends Error {
  constructor(message: string, readonly code: 'dry_run_forbidden') {
    super(message);
  }
}

/**
 * Darf der Dry-Run-Provider verwendet werden?
 *
 *  - Vercel Production:  NIEMALS (→ MailConfigError)
 *  - Vercel Preview:     nur mit ALLOW_PREVIEW_DRY_RUN=true
 *  - außerhalb Vercel:   nur im Entwicklungsmodus (`next dev`), nie bei `next start`
 */
export function isDryRunAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.VERCEL_ENV === 'production') return false;
  if (env.VERCEL_ENV === 'preview') return env.ALLOW_PREVIEW_DRY_RUN === 'true';
  if (env.VERCEL_ENV) return false; // "development" auf Vercel o. Ä.: nicht pauschal erlauben
  return env.NODE_ENV !== 'production';
}

/**
 * Liest die Konfiguration aus den Umgebungsvariablen (nur serverseitig).
 * Gibt `null` zurück, wenn etwas fehlt – die API antwortet dann ehrlich mit 503
 * und tut NICHT so, als sei etwas versendet worden. Wirft `MailConfigError`,
 * wenn `MAIL_PROVIDER=dry-run` dort gesetzt ist, wo es nicht erlaubt ist.
 *
 * Dry-Run validiert die Anfrage komplett, versendet aber nichts (Antwort enthält `dryRun: true`).
 */
export function getMailConfig(env: NodeJS.ProcessEnv = process.env): MailConfig | null {
  const kind = (env.MAIL_PROVIDER ?? 'brevo').toLowerCase();
  const fromEmail = env.MAIL_FROM?.trim();
  const to = env.MAIL_TO?.trim();
  const name = env.MAIL_FROM_NAME?.trim() || 'ING Gutachten Website';

  if (kind === 'dry-run' && !isDryRunAllowed(env)) {
    // Nur bekannte Labels ausgeben – nie rohe Umgebungswerte ins Log schreiben.
    const label = ['production', 'preview', 'development'].includes(env.VERCEL_ENV ?? '') ? env.VERCEL_ENV : env.VERCEL_ENV ? 'unbekannt' : 'lokal';
    throw new MailConfigError(
      `MAIL_PROVIDER=dry-run ist hier nicht erlaubt (Umgebung: ${label}). ` +
        'Preview: ALLOW_PREVIEW_DRY_RUN=true setzen. Production: echten Provider (brevo/resend) konfigurieren.',
      'dry_run_forbidden',
    );
  }

  if (!fromEmail || !to) return null;

  if (kind === 'dry-run') {
    return { provider: { id: 'dry-run', async send() {} }, from: { email: fromEmail, name }, to };
  }
  if (kind === 'brevo') {
    const key = env.BREVO_API_KEY?.trim();
    return key ? { provider: brevoProvider(key), from: { email: fromEmail, name }, to } : null;
  }
  if (kind === 'resend') {
    const key = env.RESEND_API_KEY?.trim();
    return key ? { provider: resendProvider(key), from: { email: fromEmail, name }, to } : null;
  }
  return null;
}
