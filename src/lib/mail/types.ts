export type MailAttachment = { filename: string; contentBase64: string; mime: string };

export type MailMessage = {
  to: string;
  from: { email: string; name: string };
  replyTo?: { email: string; name?: string };
  subject: string;
  html: string;
  text: string;
  attachments: MailAttachment[];
};

export interface MailProvider {
  readonly id: string;
  send(message: MailMessage): Promise<void>;
}

export class MailError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}
