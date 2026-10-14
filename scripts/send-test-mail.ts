/**
 * Sendet EINE harmlose Testmail über den konfigurierten Anbieter – ausschließlich an freigegebene Testadressen.
 *   npm run mail:test -- --to tester@beispiel.de
 * Bedingungen: MAIL_ALLOWED_RECIPIENTS enthält die Adresse; Anbieter und Absender sind konfiguriert; nicht in Production,
 * außer mit --i-know-this-is-production. Es werden keine Kundendaten und keine Anhänge gesendet.
 */
import { MailConfigError, getMailConfig, isRecipientAllowed, parseAllowlist } from '../src/lib/mail';
import { ingEnv } from '../src/lib/env';

async function main() {
  const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
  const to = (arg('to') ?? '').trim();
  if (!to) throw new Error('Aufruf: npm run mail:test -- --to <freigegebene Testadresse>');
  const allow = parseAllowlist(process.env.MAIL_ALLOWED_RECIPIENTS);
  if (allow.length === 0) throw new Error('MAIL_ALLOWED_RECIPIENTS ist leer – ohne Positivliste wird nicht gesendet.');
  if (!isRecipientAllowed(to, allow)) throw new Error('Diese Adresse steht nicht in MAIL_ALLOWED_RECIPIENTS.');
  if (ingEnv() === 'production' && !process.argv.includes('--i-know-this-is-production')) throw new Error('In Production nicht ohne --i-know-this-is-production.');
  const cfg = getMailConfig();
  if (!cfg) throw new Error('Mail ist nicht konfiguriert (MAIL_PROVIDER, MAIL_FROM, MAIL_TO und Schlüssel des Anbieters).');
  await cfg.provider.send({
    to, from: cfg.from, subject: `ING Studio – Testmail (${ingEnv()})`, attachments: [],
    text: 'Dies ist eine automatische Testmail des ING Studios. Sie enthält keine Kundendaten. Bitte kurz bestätigen, dass sie angekommen ist und nicht im Spam gelandet ist.',
    html: '<p>Dies ist eine automatische Testmail des ING Studios. Sie enthält <b>keine Kundendaten</b>. Bitte kurz bestätigen, dass sie angekommen ist und nicht im Spam gelandet ist.</p>',
  });
  console.log(`Testmail über „${cfg.provider.id}“ an ${to.replace(/(.).+(@.+)/, '$1…$2')} übergeben (${ingEnv()}). Zustellung bitte im Postfach prüfen.`);
}
main().catch((e) => { console.error(e instanceof MailConfigError ? `Konfiguration: ${e.message}` : e instanceof Error ? e.message : e); process.exit(1); });
