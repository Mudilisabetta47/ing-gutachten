import { MailError, type MailMessage, type MailProvider } from './types';

/** Brevo Transactional API – https://developers.brevo.com/reference/sendtransacemail */
export function brevoProvider(apiKey: string): MailProvider {
  return {
    id: 'brevo',
    async send(m: MailMessage) {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: { email: m.from.email, name: m.from.name },
          to: [{ email: m.to }],
          ...(m.replyTo ? { replyTo: { email: m.replyTo.email, ...(m.replyTo.name ? { name: m.replyTo.name } : {}) } } : {}),
          subject: m.subject,
          htmlContent: m.html,
          textContent: m.text,
          ...(m.attachments.length ? { attachment: m.attachments.map((a) => ({ name: a.filename, content: a.contentBase64 })) } : {}),
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new MailError(`Brevo antwortete mit ${res.status}`, res.status);
    },
  };
}
