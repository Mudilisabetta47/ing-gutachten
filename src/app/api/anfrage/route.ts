import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getMailConfig, MailConfigError, MailError, type MailAttachment } from '@/lib/mail';
import { rateLimit } from '@/lib/rate-limit';
import { isDbConfigured } from '@/server/db';
import { markNotification, persistInquiry, sanitizeTracking, type AttachmentMeta } from '@/server/pipeline/intake';
import {
  clean,
  detectType,
  DOC_MIME,
  LIMITS,
  PHOTO_MIME,
  validateFields,
  type RequestFields,
} from '@/lib/request-schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PHONE = '0511 – 543 00 976';

const fail = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ ok: false, error, ...extra }, { status, headers: { 'Cache-Control': 'no-store' } });

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export async function POST(req: Request) {
  // Gleiche Ursprungsseite? (zusätzlich zur Same-Origin-Policy des Browsers)
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return fail(403, 'forbidden');
    } catch {
      return fail(403, 'forbidden');
    }
  }

  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > LIMITS.maxTotalBytes + 200_000) {
    return fail(413, 'too_large', { message: 'Die Dateien sind zusammen zu groß. Bitte weniger oder kleinere Fotos senden.' });
  }

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const limit = rateLimit(`anfrage:${ip}`, 12);
  if (!limit.ok) {
    return fail(429, 'rate_limited', {
      message: `Zu viele Anfragen. Bitte versuchen Sie es später erneut oder rufen Sie uns an: ${PHONE}.`,
    });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, 'invalid_body', { message: 'Die Anfrage konnte nicht gelesen werden.' });
  }

  // Honeypot und Mindest-Ausfüllzeit: still verwerfen, Bot lernt nichts.
  const honeypot = form.get('website');
  const startedAt = Number(form.get('t'));
  if ((typeof honeypot === 'string' && honeypot.length > 0) || (Number.isFinite(startedAt) && startedAt > 0 && Date.now() - startedAt < LIMITS.minFillMs)) {
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const fields: RequestFields = {
    anlass: clean(form.get('anlass'), 60),
    fahrzeug: clean(form.get('fahrzeug'), 60),
    name: clean(form.get('name'), LIMITS.name),
    telefon: clean(form.get('telefon'), LIMITS.phone),
    email: clean(form.get('email'), LIMITS.email),
    standort: clean(form.get('standort'), LIMITS.place),
    nachricht: clean(form.get('nachricht'), LIMITS.message, true),
    datenschutz: form.get('datenschutz') === 'true',
  };
  const errors = validateFields(fields);
  if (Object.keys(errors).length) return fail(400, 'validation', { fields: errors, message: 'Bitte prüfen Sie Ihre Angaben.' });

  /* ---------- Dateien ---------- */
  const photos = form.getAll('foto').filter((v): v is File => typeof v !== 'string' && v.size > 0);
  const doc = form.get('fahrzeugschein');
  const docFile = typeof doc !== 'string' && doc && doc.size > 0 ? doc : null;

  if (photos.length > LIMITS.maxPhotos) return fail(400, 'too_many_files', { message: `Maximal ${LIMITS.maxPhotos} Fotos.` });

  const attachments: MailAttachment[] = [];
  const attachmentMeta: AttachmentMeta[] = [];
  let total = 0;

  const take = async (file: File, label: string, index: number, allowed: readonly string[], maxBytes: number) => {
    if (file.size > maxBytes) return `„${label}“ ist zu groß.`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = detectType(bytes);
    // Typ aus dem Dateiinhalt, nie aus Dateiname oder Browser-Angabe. SVG/HTML/EXE fallen hier raus.
    if (!kind || !allowed.includes(kind.mime)) return `„${label}“ hat ein nicht erlaubtes Format (erlaubt: JPG, PNG, WebP${allowed.includes('application/pdf') ? ', PDF' : ''}).`;
    total += bytes.byteLength;
    const filename = `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}${index ? `-${index}` : ''}.${kind.ext}`;
    attachments.push({ filename, contentBase64: Buffer.from(bytes).toString('base64'), mime: kind.mime });
    attachmentMeta.push({
      kind: label === 'Fahrzeugschein' ? 'registration' : 'photo',
      fileName: filename, // serverseitig vergeben, nie der Original-Dateiname
      mimeType: kind.mime,
      sizeBytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
    return null;
  };

  for (let i = 0; i < photos.length; i++) {
    const problem = await take(photos[i], 'Foto', i + 1, PHOTO_MIME, LIMITS.maxPhotoBytes);
    if (problem) return fail(400, 'invalid_file', { fields: { fotos: problem }, message: problem });
  }
  if (docFile) {
    const problem = await take(docFile, 'Fahrzeugschein', 0, DOC_MIME, LIMITS.maxDocBytes);
    if (problem) return fail(400, 'invalid_file', { fields: { fotos: problem }, message: problem });
  }
  if (total > LIMITS.maxTotalBytes) return fail(413, 'too_large', { message: 'Die Dateien sind zusammen zu groß. Bitte weniger oder kleinere Fotos senden.' });

  /* ---------- 1. Speichern (Datenbank ist die Hauptquelle) ---------- */
  const consentOk = fields.datenschutz; // validateFields hat die Zustimmung bereits erzwungen
  const tracking = sanitizeTracking(
    { utm_source: form.get('utm_source'), utm_medium: form.get('utm_medium'), utm_campaign: form.get('utm_campaign'), ref: form.get('ref'), lp: form.get('lp') },
    host,
  );
  type Persisted = { state: 'saved'; leadId: string } | { state: 'skipped' } | { state: 'failed' };
  let persisted: Persisted;
  if (!consentOk) {
    persisted = { state: 'skipped' };
  } else if (!isDbConfigured()) {
    persisted = { state: 'skipped' }; // z. B. Vercel-Preview ohne Datenbank: Verhalten wie bisher (nur Mail)
  } else {
    try {
      const res = await persistInquiry({ fields, attachments: attachmentMeta, tracking, ip });
      persisted = { state: 'saved', leadId: res.leadId };
    } catch (err) {
      // Nur Fehlerart ins Log – keine Formularinhalte, keine personenbezogenen Daten.
      console.error('[anfrage] DATABASE_PERSISTENCE_FAILED', err instanceof Error ? err.name : 'unknown', (err as { code?: string })?.code ?? '');
      persisted = { state: 'failed' };
    }
  }

  /* ---------- 2. Benachrichtigung per E-Mail ---------- */
  const mail = await notifyByMail(fields, attachments);

  /* ---------- 3. Ergebnis am Lead festhalten ---------- */
  if (persisted.state === 'saved') {
    try {
      if (mail.state === 'sent') await markNotification(persisted.leadId, 'SENT');
      else if (mail.state === 'dry-run' || mail.state === 'not_configured') await markNotification(persisted.leadId, 'SKIPPED', mail.state === 'dry-run' ? 'dry-run (nichts versendet)' : 'E-Mail-Versand nicht konfiguriert');
      else await markNotification(persisted.leadId, 'FAILED', mail.state === 'config_error' ? 'Konfigurationsfehler' : mail.reason);
    } catch (err) {
      console.error('[anfrage] Notification-Status konnte nicht gespeichert werden', err instanceof Error ? err.name : 'unknown');
    }
  }

  /* ---------- 4. Antwort an den Besucher ---------- */
  const ok = (extra: Record<string, unknown> = {}) => NextResponse.json({ ok: true, ...extra }, { headers: { 'Cache-Control': 'no-store' } });
  const dry = mail.state === 'dry-run' ? { dryRun: true } : {};

  // Gespeichert → Erfolg, auch wenn die Mail scheitert (der Admin sieht den Hinweis am Lead).
  if (persisted.state === 'saved') return ok(dry);
  // Mail ging raus, Speichern nicht → Erfolg; der Fehler steht im Server-Log (DATABASE_PERSISTENCE_FAILED).
  if (mail.state === 'sent' || mail.state === 'dry-run') return ok(dry);
  // Weder gespeichert noch versendet → ehrlicher Fehler mit Telefonnummer, KEIN falscher Erfolg.
  if (mail.state === 'config_error' || mail.state === 'not_configured') {
    return fail(503, mail.state === 'config_error' ? 'config_error' : 'not_configured', {
      message: `Der Versand ist momentan nicht verfügbar. Bitte rufen Sie uns direkt an: ${PHONE}.`,
    });
  }
  return fail(502, 'send_failed', { message: `Die Anfrage konnte nicht gesendet werden. Bitte rufen Sie uns an: ${PHONE}.` });
}

/** Mail-Benachrichtigung – wirft nie, liefert den Zustand zurück. */
type MailResult = { state: 'sent' } | { state: 'dry-run' } | { state: 'not_configured' } | { state: 'config_error' } | { state: 'failed'; reason: string };

async function notifyByMail(fields: RequestFields, attachments: MailAttachment[]): Promise<MailResult> {
  let config: ReturnType<typeof getMailConfig>;
  try {
    config = getMailConfig();
  } catch (err) {
    console.error('[anfrage] KONFIGURATIONSFEHLER:', err instanceof MailConfigError ? err.message : 'unbekannt');
    return { state: 'config_error' };
  }
  if (!config) {
    console.error('[anfrage] Mail-Versand nicht konfiguriert (MAIL_PROVIDER / API-Key / MAIL_FROM / MAIL_TO).');
    return { state: 'not_configured' };
  }

  const rows: [string, string][] = [
    ['Anlass', fields.anlass],
    ['Fahrzeug', fields.fahrzeug],
    ['Name', fields.name],
    ['Telefon', fields.telefon],
    ['E-Mail', fields.email],
    ['Standort', fields.standort || '–'],
    ['Anhänge', attachments.length ? `${attachments.length} Datei(en)` : 'keine'],
  ];
  const text = `${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nNachricht:\n${fields.nachricht || '–'}\n`;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111">
<h2 style="margin:0 0 12px">Neue Anfrage über ing-gutachten.de</h2>
<table style="border-collapse:collapse">${rows
    .map(([k, v]) => `<tr><td style="padding:4px 14px 4px 0;color:#555">${esc(k)}</td><td style="padding:4px 0"><b>${esc(v)}</b></td></tr>`)
    .join('')}</table>
<p style="margin:16px 0 4px;color:#555">Nachricht</p>
<p style="margin:0;white-space:pre-wrap">${esc(fields.nachricht || '–')}</p></div>`;

  try {
    await config.provider.send({
      to: config.to,
      from: config.from,
      replyTo: { email: fields.email, name: fields.name },
      subject: `Anfrage: ${fields.anlass} · ${fields.fahrzeug} · ${fields.name}`,
      html,
      text,
      attachments,
    });
  } catch (err) {
    console.error('[anfrage] Versand fehlgeschlagen:', err instanceof MailError ? err.message : 'unbekannter Fehler');
    return { state: 'failed', reason: err instanceof MailError ? 'Versand abgelehnt' : 'Versand fehlgeschlagen' };
  }
  return { state: config.provider.id === 'dry-run' ? 'dry-run' : 'sent' };
}

export function GET() {
  return fail(405, 'method_not_allowed');
}
