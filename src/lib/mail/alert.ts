import { getMailConfig, MailConfigError } from './index';

/** Empfänger für Betriebsmeldungen: ALERT_EMAIL_TO (kommagetrennt, höchstens 3). In Staging gilt zusätzlich die Positivliste. */
export function alertRecipients(env: NodeJS.ProcessEnv = process.env): string[] {
  return (env.ALERT_EMAIL_TO ?? '').split(',').map((x) => x.trim()).filter((x) => /^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/.test(x)).slice(0, 3);
}

export type AlertMailer = (subject: string, text: string) => Promise<boolean>;

/** Sendet eine Betriebsmeldung per Mail über den konfigurierten Anbieter. Wirft nie; `false`, wenn nichts gesendet wurde. */
export function alertMailer(env: NodeJS.ProcessEnv = process.env): AlertMailer {
  return async (subject, text) => {
    try {
      const to = alertRecipients(env);
      if (!to.length) return false;
      const cfg = getMailConfig(env);
      if (!cfg) return false;
      const safe = text.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]!);
      let sent = false;
      for (const addr of to) {
        try { await cfg.provider.send({ to: addr, from: cfg.from, subject: subject.slice(0, 200), text, html: `<pre style="font-family:inherit">${safe}</pre>`, attachments: [] }); sent = true; } catch { /* nächster Empfänger */ }
      }
      return sent;
    } catch (e) {
      if (!(e instanceof MailConfigError)) console.error('[alert] Mailversand fehlgeschlagen');
      return false;
    }
  };
}
