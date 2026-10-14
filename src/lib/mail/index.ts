import { brevoProvider } from './brevo';
import { resendProvider } from './resend';
import { MailError, type MailMessage, type MailProvider } from './types';
import { ingEnv } from '../env';

export type { MailMessage, MailProvider, MailAttachment } from './types';
export { MailError } from './types';

export type MailConfig = { provider: MailProvider; from: { email: string; name: string }; to: string };

/** Unzulässige Konfiguration (z. B. dry-run in Production). Wird serverseitig geloggt, nie dem Besucher gezeigt. */
export class MailConfigError extends Error {
  constructor(message: string, readonly code: 'dry_run_forbidden' | 'allowlist_required' | 'recipient_not_allowed') {
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

/** Empfänger-Positivliste: `MAIL_ALLOWED_RECIPIENTS=a@x.de,@firma.de` (Adresse oder @Domain). Leer = keine Einschränkung. */
export function parseAllowlist(raw: string | undefined): string[] {
  return (raw ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
}
export function isRecipientAllowed(email: string, list: string[]): boolean {
  if (list.length === 0) return true;
  const e = email.trim().toLowerCase();
  return list.some((a) => (a.startsWith('@') ? e.endsWith(a) : e === a));
}
/** Umhüllt einen Anbieter: es geht nur an freigegebene Adressen (Staging/Test) – alles andere wird vor dem Versand abgewiesen. */
export function withAllowlist(inner: MailProvider, list: string[]): MailProvider {
  if (list.length === 0) return inner;
  return {
    id: inner.id,
    async send(m: MailMessage) {
      if (!isRecipientAllowed(m.to, list)) throw new MailError('Empfänger ist nicht freigegeben (MAIL_ALLOWED_RECIPIENTS).');
      if (m.replyTo && /,|;/.test(m.replyTo.email)) throw new MailError('Ungültige Antwortadresse.');
      return inner.send(m);
    },
  };
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

  // Staging darf nur an ausdrücklich freigegebene Testadressen senden; die Zieladresse selbst muss freigegeben sein.
  const allow = parseAllowlist(env.MAIL_ALLOWED_RECIPIENTS);
  if (ingEnv(env) === 'staging' && kind !== 'dry-run' && allow.length === 0) throw new MailConfigError('In Staging ist MAIL_ALLOWED_RECIPIENTS Pflicht (nur freigegebene Testadressen).', 'allowlist_required');
  if (!isRecipientAllowed(to, allow)) throw new MailConfigError('MAIL_TO steht nicht in MAIL_ALLOWED_RECIPIENTS.', 'recipient_not_allowed');

  if (kind === 'dry-run') {
    return { provider: withAllowlist({ id: 'dry-run', async send() {} }, allow), from: { email: fromEmail, name }, to };
  }
  if (kind === 'brevo') {
    const key = env.BREVO_API_KEY?.trim();
    return key ? { provider: withAllowlist(brevoProvider(key), allow), from: { email: fromEmail, name }, to } : null;
  }
  if (kind === 'resend') {
    const key = env.RESEND_API_KEY?.trim();
    return key ? { provider: withAllowlist(resendProvider(key), allow), from: { email: fromEmail, name }, to } : null;
  }
  return null;
}
