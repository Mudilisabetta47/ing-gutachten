import { MailError, type MailMessage, type MailProvider } from './types';

/** Resend – https://resend.com/docs/api-reference/emails/send-email */
export function resendProvider(apiKey: string): MailProvider {
  return {
    id: 'resend',
    async send(m: MailMessage) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from: `${m.from.name} <${m.from.email}>`,
          to: [m.to],
          ...(m.replyTo ? { reply_to: m.replyTo.email } : {}),
          subject: m.subject,
          html: m.html,
          text: m.text,
          ...(m.attachments.length ? { attachments: m.attachments.map((a) => ({ filename: a.filename, content: a.contentBase64 })) } : {}),
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new MailError(`Resend antwortete mit ${res.status}`, res.status);
    },
  };
}
