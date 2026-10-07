import 'server-only';
import { createHmac } from 'node:crypto';
import { db } from '@/server/db';
import { getStorage } from '@/server/storage';
import { putMedia } from './media';
import { writeAudit } from '@/server/audit';
import { normalizePhone } from '@/lib/normalize';
import { FORM_VERSION, PRIVACY_VERSION, type RequestFields } from '@/lib/request-schema';

export type AttachmentMeta = { kind: 'photo' | 'registration'; fileName: string; mimeType: string; sizeBytes: number; sha256: string };

export type Tracking = { utmSource: string | null; utmMedium: string | null; utmCampaign: string | null; referrerHost: string | null; landingPath: string | null };

const TOKEN = /^[\w .\-+/]{1,80}$/;

/**
 * Herkunftsangaben nur, wenn sinnvoll und harmlos: UTM-Werte (kurze Tokens), externe Referrer-HOST
 * (nie die volle URL, nie Query), Einstiegspfad ohne Query. Alles andere wird verworfen.
 */
export function sanitizeTracking(raw: { utm_source?: unknown; utm_medium?: unknown; utm_campaign?: unknown; ref?: unknown; lp?: unknown }, ownHost: string | null): Tracking {
  const tok = (v: unknown) => (typeof v === 'string' && TOKEN.test(v.trim()) ? v.trim() : null);
  let referrerHost: string | null = null;
  if (typeof raw.ref === 'string' && raw.ref) {
    try {
      const h = new URL(raw.ref).hostname.toLowerCase().slice(0, 120);
      if (h && h !== ownHost?.split(':')[0]?.toLowerCase()) referrerHost = h;
    } catch { /* ungültig → verwerfen */ }
  }
  const lp = typeof raw.lp === 'string' && /^\/[A-Za-z0-9\-_/]{0,118}$/.test(raw.lp) ? raw.lp : null;
  return { utmSource: tok(raw.utm_source), utmMedium: tok(raw.utm_medium), utmCampaign: tok(raw.utm_campaign), referrerHost, landingPath: lp };
}

/** Gesalzener Hash der IP – nur zur Missbrauchserkennung; ohne konfiguriertes Salz wird gar nichts gespeichert. */
export function hashIp(ip: string): string | null {
  const salt = process.env.IP_HASH_SALT;
  if (!salt || salt.length < 16 || !ip || ip === 'unknown') return null;
  return createHmac('sha256', salt).update(ip).digest('hex').slice(0, 32);
}

export type IntakeInput = {
  fields: RequestFields;
  attachments: AttachmentMeta[];
  tracking: Tracking;
  ip: string;
  now?: Date;
};

/**
 * Speichert Anfrage (unveränderlich) + Lead (bearbeitbar) + Anhangs-Metadaten in EINER Transaktion.
 * Bilddateien selbst landen NICHT in Postgres (kein Base64) – dafür kommt in Phase 3 der private Speicher.
 * Bis dahin sind sie nur per E-Mail zugestellt (`MAIL_ONLY`) oder – wenn auch das scheitert – nicht gesichert.
 */
export async function persistInquiry(input: IntakeInput): Promise<{ inquiryId: string; leadId: string }> {
  const { fields: f, tracking: t } = input;
  const now = input.now ?? new Date();
  return db.$transaction(async (tx) => {
    const inquiry = await tx.inquiry.create({
      data: {
        receivedAt: now,
        formVersion: FORM_VERSION,
        reason: f.anlass,
        vehicleKind: f.fahrzeug,
        name: f.name,
        email: f.email,
        phone: f.telefon,
        location: f.standort || null,
        message: f.nachricht || null,
        consentAt: now,
        privacyVersion: PRIVACY_VERSION,
        ...t,
        ipHash: hashIp(input.ip),
        attachments: { create: input.attachments.map((a) => ({ ...a, status: 'NOT_STORED' as const })) },
      },
    });
    const lead = await tx.lead.create({
      data: {
        inquiryId: inquiry.id,
        status: 'NEW',
        name: f.name,
        email: f.email,
        phone: f.telefon,
        phoneNorm: normalizePhone(f.telefon),
        location: f.standort || null,
        reason: f.anlass,
        vehicleKind: f.fahrzeug,
        message: f.nachricht || null,
        createdAt: now,
      },
    });
    await tx.leadStatusHistory.create({ data: { leadId: lead.id, fromStatus: null, toStatus: 'NEW', actorId: null, reason: 'Über das Formular eingegangen' } });
    await writeAudit({ actorId: null, action: 'lead.create', entityType: 'Lead', entityId: lead.id, summary: 'Neue Anfrage über die Website', after: { source: 'website_form', attachments: input.attachments.length } }, tx);
    return { inquiryId: inquiry.id, leadId: lead.id };
  });
}

/** Ergebnis der Mail-Benachrichtigung am Lead festhalten (Fehlertext ohne personenbezogene Daten). */
export async function markNotification(leadId: string, state: 'SENT' | 'FAILED' | 'SKIPPED', detail?: string) {
  await db.$transaction(async (tx) => {
    const lead = await tx.lead.update({
      where: { id: leadId },
      data: { notificationStatus: state, notificationError: state === 'SENT' ? null : (detail ?? null)?.slice(0, 200) ?? null, notifiedAt: state === 'SENT' ? new Date() : null },
      select: { inquiryId: true },
    });
    // Nur wenn die Mail mit Anhängen wirklich rausging, sind die Dateien beim Büro angekommen.
    if (state === 'SENT' && lead.inquiryId) await tx.inquiryAttachment.updateMany({ where: { inquiryId: lead.inquiryId, status: 'NOT_STORED' }, data: { status: 'MAIL_ONLY' } });
    if (state === 'FAILED') await writeAudit({ actorId: null, action: 'lead.notification_failed', entityType: 'Lead', entityId: leadId, summary: 'E-Mail-Benachrichtigung fehlgeschlagen' }, tx);
  });
}


export type IntakeFile = AttachmentMeta & { bytes: Uint8Array };

/**
 * Legt die mit der Anfrage gesendeten Dateien im privaten Speicher ab (wenn einer eingerichtet ist) und verknüpft sie mit den
 * Anhangs-Metadaten (Status STORED). Best effort: scheitert eine Datei, bleibt sie „nicht gesichert“/„nur per E-Mail“ –
 * die Anfrage selbst ist bereits gespeichert und wird dadurch nie gefährdet.
 */
export async function storeInquiryFiles(inquiryId: string, files: IntakeFile[]): Promise<number> {
  if (!getStorage() || files.length === 0) return 0;
  let stored = 0;
  for (const f of files) {
    try {
      const media = await putMedia(null, { bytes: f.bytes }, f.mimeType === 'application/pdf' ? 'document' : 'photo');
      const res = await db.inquiryAttachment.updateMany({ where: { inquiryId, fileName: f.fileName, mediaId: null }, data: { mediaId: media.id, storageKey: media.storageKey, status: 'STORED' } });
      if (res.count === 1) stored += 1;
    } catch (err) {
      console.error('[anfrage] Datei konnte nicht im Speicher abgelegt werden', err instanceof Error ? err.name : 'unbekannt');
    }
  }
  return stored;
}
