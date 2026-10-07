import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';
import { getSetting } from '@/server/settings';
import { getStorage, newStorageKey } from '@/server/storage';
import type { AuthUser } from '@/server/auth/session-types';
import { ForbiddenError } from '@/server/auth/errors';
import { DomainError, notFoundError } from '@/server/errors';
import { DOC_MIME, PHOTO_MIME, detectType } from '@/lib/request-schema';
import { canOnCase, loadCaseFor } from './case-access';
import { has } from './access';

export const PHOTO_CATEGORIES = ['OVERVIEW', 'DAMAGE', 'DETAIL', 'PLATE', 'VIN', 'ODOMETER', 'INTERIOR', 'UNDERBODY', 'REQUEST', 'OTHER'] as const;
export const DOCUMENT_CATEGORIES = ['REGISTRATION', 'INSURANCE_LETTER', 'POWER_OF_ATTORNEY', 'ASSIGNMENT', 'REPAIR_INVOICE', 'REPORT', 'OTHER'] as const;
export const PHOTO_LABELS: Record<string, string> = {
  OVERVIEW: 'Gesamtansicht', DAMAGE: 'Schadenstelle', DETAIL: 'Detail', PLATE: 'Kennzeichen', VIN: 'Fahrgestellnummer', ODOMETER: 'Tacho', INTERIOR: 'Innenraum', UNDERBODY: 'Unterboden', REQUEST: 'Aus der Anfrage', OTHER: 'Sonstiges',
};
export const DOCUMENT_LABELS: Record<string, string> = {
  REGISTRATION: 'Fahrzeugschein', INSURANCE_LETTER: 'Versicherungsschreiben', POWER_OF_ATTORNEY: 'Vollmacht', ASSIGNMENT: 'Auftrag', REPAIR_INVOICE: 'Reparaturrechnung', REPORT: 'Gutachten', OTHER: 'Sonstiges',
};

const MAX_THUMB_BYTES = 250_000;
const MAX_PHOTOS_PER_CASE = 300;

const photoMetaSchema = z.object({
  category: z.enum(PHOTO_CATEGORIES).default('DAMAGE'),
  title: z.string().trim().max(120).optional().nullable().transform((v) => v || null),
  description: z.string().trim().max(1000).optional().nullable().transform((v) => v || null),
  damageId: z.string().trim().optional().nullable().transform((v) => v || null),
});
const documentMetaSchema = z.object({
  category: z.enum(DOCUMENT_CATEGORIES).default('OTHER'),
  title: z.string().trim().min(1, 'Bitte einen Titel angeben.').max(160),
});

export type UploadFile = { bytes: Uint8Array; thumb?: Uint8Array | null };

function inspect(bytes: Uint8Array, kind: 'photo' | 'document', maxBytes: number) {
  if (bytes.byteLength === 0) throw new DomainError('Die Datei ist leer.');
  if (bytes.byteLength > maxBytes) throw new DomainError(`Die Datei ist größer als ${(maxBytes / 1024 / 1024).toFixed(0)} MB.`);
  // Typ aus dem Inhalt, nie aus Dateiname oder Browser-Angabe. SVG/HTML/EXE fallen hier raus.
  const type = detectType(bytes);
  const allowed: readonly string[] = kind === 'photo' ? PHOTO_MIME : DOC_MIME;
  if (!type || !allowed.includes(type.mime)) throw new DomainError(`Dieses Format ist nicht erlaubt (erlaubt: JPG, PNG, WebP${kind === 'document' ? ', PDF' : ''}).`);
  return type;
}

/** Speicher zuerst, dann Datenbankzeile; scheitert die Zeile, wird das Objekt wieder entfernt (keine Datei-Leichen). */
export async function putMedia(uploadedById: string | null, file: UploadFile, kind: 'photo' | 'document') {
  const storage = getStorage();
  if (!storage) throw new DomainError('Der Dateispeicher ist nicht eingerichtet.');
  const cfg = await getSetting('uploads');
  const type = inspect(file.bytes, kind, (kind === 'photo' ? cfg.maxPhotoMb : cfg.maxDocumentMb) * 1024 * 1024);
  if (file.thumb) {
    if (file.thumb.byteLength > MAX_THUMB_BYTES || detectType(file.thumb)?.mime !== 'image/jpeg') throw new DomainError('Die Vorschau ist ungültig.');
  }
  const key = newStorageKey(kind === 'photo' ? 'p' : 'd');
  const thumbKey = file.thumb ? newStorageKey('t') : null;
  await storage.put(key, file.bytes, type.mime);
  if (thumbKey && file.thumb) await storage.put(thumbKey, file.thumb, 'image/jpeg');
  try {
    return await db.media.create({
      data: { storageKey: key, thumbKey, bucket: 'PRIVATE', mimeType: type.mime, sizeBytes: file.bytes.byteLength, sha256: createHash('sha256').update(file.bytes).digest('hex'), uploadedById },
    });
  } catch (e) {
    await storage.delete(key).catch(() => {});
    if (thumbKey) await storage.delete(thumbKey).catch(() => {});
    throw e;
  }
}

/* ------------------------------------------------------------------ Fotos */

export async function addCasePhoto(user: AuthUser, caseId: string, file: UploadFile, rawMeta: unknown) {
  const c = await loadCaseFor(user, caseId, 'write');
  if (!canOnCase(user, 'photos', 'write', c)) throw new ForbiddenError();
  const meta = photoMetaSchema.parse(rawMeta);
  if ((await db.casePhoto.count({ where: { caseId, deletedAt: null } })) >= MAX_PHOTOS_PER_CASE) throw new DomainError(`Pro Fall sind höchstens ${MAX_PHOTOS_PER_CASE} Fotos möglich.`);
  if (meta.damageId && !(await db.damage.findFirst({ where: { id: meta.damageId, caseId, deletedAt: null }, select: { id: true } }))) throw new DomainError('Dieser Schaden gehört nicht zum Fall.');
  const media = await putMedia(user.id, file, 'photo');
  const last = await db.casePhoto.aggregate({ where: { caseId }, _max: { sortOrder: true } });
  return db.$transaction(async (tx) => {
    const photo = await tx.casePhoto.create({ data: { mediaId: media.id, caseId, sortOrder: (last._max.sortOrder ?? 0) + 1, ...meta } });
    await writeAudit({ actorId: user.id, action: 'photo.add', entityType: 'Case', entityId: caseId, summary: `Foto hinzugefügt (${meta.category})`, after: { photoId: photo.id, category: meta.category } }, tx);
    return photo;
  });
}

const photoSelect = {
  id: true, category: true, title: true, description: true, sortOrder: true, createdAt: true, mediaId: true, damageId: true,
  media: { select: { sizeBytes: true, thumbKey: true, uploadedBy: { select: { firstName: true, lastName: true } } } },
  damage: { select: { id: true, component: true } },
} as const;

export async function listCasePhotos(user: AuthUser, caseId: string) {
  const c = await loadCaseFor(user, caseId, 'read');
  if (!canOnCase(user, 'photos', 'read', c)) throw new ForbiddenError();
  return db.casePhoto.findMany({ where: { caseId, deletedAt: null, media: { deletedAt: null } }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: photoSelect, take: MAX_PHOTOS_PER_CASE });
}

async function photoForWrite(user: AuthUser, photoId: string) {
  const photo = await db.casePhoto.findFirst({ where: { id: photoId, deletedAt: null }, select: { id: true, caseId: true, mediaId: true } });
  if (!photo) throw notFoundError('Foto');
  const c = await loadCaseFor(user, photo.caseId, 'write');
  if (!canOnCase(user, 'photos', 'write', c)) throw new ForbiddenError();
  return { photo, c };
}

export async function updateCasePhoto(user: AuthUser, photoId: string, rawMeta: unknown) {
  const { photo } = await photoForWrite(user, photoId);
  const meta = photoMetaSchema.parse(rawMeta);
  if (meta.damageId && !(await db.damage.findFirst({ where: { id: meta.damageId, caseId: photo.caseId, deletedAt: null }, select: { id: true } }))) throw new DomainError('Dieser Schaden gehört nicht zum Fall.');
  return db.$transaction(async (tx) => {
    await tx.casePhoto.update({ where: { id: photoId }, data: meta });
    await writeAudit({ actorId: user.id, action: 'photo.update', entityType: 'Case', entityId: photo.caseId, summary: 'Foto bearbeitet', after: { photoId, category: meta.category } }, tx);
  });
}

/** Löschen = ausblenden (Soft Delete). Das Objekt bleibt bis zur Bereinigung nach Aufbewahrungsfrist im Speicher. */
export async function deleteCasePhoto(user: AuthUser, photoId: string) {
  const { photo } = await photoForWrite(user, photoId);
  return db.$transaction(async (tx) => {
    const now = new Date();
    await tx.casePhoto.update({ where: { id: photoId }, data: { deletedAt: now } });
    await tx.media.update({ where: { id: photo.mediaId }, data: { deletedAt: now } });
    await writeAudit({ actorId: user.id, action: 'photo.delete', entityType: 'Case', entityId: photo.caseId, summary: 'Foto gelöscht', after: { photoId } }, tx);
  });
}

/* -------------------------------------------------------------- Dokumente */

export async function addDocument(user: AuthUser, target: { caseId?: string; customerId?: string }, file: UploadFile, rawMeta: unknown) {
  const meta = documentMetaSchema.parse(rawMeta);
  let caseId: string | null = null;
  let customerId: string | null = null;
  if (target.caseId) {
    const c = await loadCaseFor(user, target.caseId, 'write');
    if (!canOnCase(user, 'documents', 'write', c)) throw new ForbiddenError();
    caseId = c.id;
    customerId = c.customerId;
  } else if (target.customerId) {
    if (!has(user, 'documents.write.all')) throw new ForbiddenError();
    const cu = await db.customer.findFirst({ where: { id: target.customerId, deletedAt: null }, select: { id: true } });
    if (!cu) throw notFoundError('Kunde');
    customerId = cu.id;
  } else throw new DomainError('Ziel fehlt.');
  const media = await putMedia(user.id, file, 'document');
  return db.$transaction(async (tx) => {
    const doc = await tx.document.create({ data: { mediaId: media.id, caseId, customerId, category: meta.category, title: meta.title, createdById: user.id } });
    await writeAudit({ actorId: user.id, action: 'document.add', entityType: caseId ? 'Case' : 'Customer', entityId: caseId ?? customerId, summary: `Dokument hinzugefügt (${meta.category})`, after: { documentId: doc.id, category: meta.category } }, tx);
    return doc;
  });
}

const docSelect = { id: true, title: true, category: true, createdAt: true, mediaId: true, caseId: true, customerId: true, media: { select: { sizeBytes: true, mimeType: true } } } as const;

export async function listDocuments(user: AuthUser, target: { caseId?: string; customerId?: string }) {
  if (target.caseId) {
    const c = await loadCaseFor(user, target.caseId, 'read');
    if (!canOnCase(user, 'documents', 'read', c)) throw new ForbiddenError();
    return db.document.findMany({ where: { caseId: c.id, deletedAt: null, media: { deletedAt: null } }, orderBy: { createdAt: 'desc' }, select: docSelect, take: 200 });
  }
  if (target.customerId) {
    if (!has(user, 'documents.read.all')) throw new ForbiddenError();
    return db.document.findMany({ where: { customerId: target.customerId, deletedAt: null, media: { deletedAt: null } }, orderBy: { createdAt: 'desc' }, select: docSelect, take: 200 });
  }
  throw new DomainError('Ziel fehlt.');
}

export async function deleteDocument(user: AuthUser, documentId: string) {
  if (!has(user, 'documents.delete')) throw new ForbiddenError();
  return db.$transaction(async (tx) => {
    const doc = await tx.document.findFirst({ where: { id: documentId, deletedAt: null }, select: { id: true, mediaId: true, caseId: true, customerId: true } });
    if (!doc) throw notFoundError('Dokument');
    const now = new Date();
    await tx.document.update({ where: { id: documentId }, data: { deletedAt: now } });
    await tx.media.update({ where: { id: doc.mediaId }, data: { deletedAt: now } });
    await writeAudit({ actorId: user.id, action: 'document.delete', entityType: doc.caseId ? 'Case' : 'Customer', entityId: doc.caseId ?? doc.customerId, summary: 'Dokument gelöscht', after: { documentId } }, tx);
  });
}

/* ---------------------------------------------------------------- Abruf */

export type MediaDelivery = { mimeType: string; fileName: string; bytes: Uint8Array | null; signedUrl: string | null };

/**
 * Datei ausliefern – NUR nach Rechteprüfung am zugehörigen Fall bzw. Kunden. Für Dokumente und Originalfotos entsteht
 * ein Audit-Eintrag (Vorschaubilder nicht, sonst würde jede Galerie das Protokoll fluten).
 */
export async function readMedia(user: AuthUser, mediaId: string, variant: 'full' | 'thumb' = 'full'): Promise<MediaDelivery> {
  const m = await db.media.findFirst({
    where: { id: mediaId, deletedAt: null },
    select: {
      id: true, storageKey: true, thumbKey: true, mimeType: true,
      photo: { select: { id: true, caseId: true, deletedAt: true, title: true } },
      document: { select: { id: true, caseId: true, customerId: true, deletedAt: true, title: true } },
    },
  });
  if (!m) throw notFoundError('Datei');
  let entityType = 'Case';
  let entityId: string | null = null;
  let name = 'datei';
  if (m.photo && !m.photo.deletedAt) {
    const c = await loadCaseFor(user, m.photo.caseId, 'read');
    if (!canOnCase(user, 'photos', 'read', c)) throw new ForbiddenError();
    entityId = c.id;
    name = `${c.caseNumber}-foto`;
  } else if (m.document && !m.document.deletedAt) {
    if (m.document.caseId) {
      const c = await loadCaseFor(user, m.document.caseId, 'read');
      if (!canOnCase(user, 'documents', 'read', c)) throw new ForbiddenError();
      entityId = c.id;
      name = `${c.caseNumber}-${m.document.title}`;
    } else if (m.document.customerId) {
      if (!has(user, 'documents.read.all')) throw new ForbiddenError();
      entityType = 'Customer';
      entityId = m.document.customerId;
      name = m.document.title;
    }
  } else {
    // Anhänge aus Anfragen (noch nicht umgewandelt): nur für Rollen mit Zugriff auf Anfragen
    const att = await db.inquiryAttachment.findFirst({ where: { mediaId: m.id }, select: { inquiry: { select: { lead: { select: { id: true } } } } } });
    if (!att || !has(user, 'leads.read')) throw notFoundError('Datei');
    entityType = 'Lead';
    entityId = att.inquiry.lead?.id ?? null;
    name = 'anfrage-datei';
  }
  const storage = getStorage();
  if (!storage) throw new DomainError('Der Dateispeicher ist nicht eingerichtet.');
  const useThumb = variant === 'thumb' && m.thumbKey;
  const key = useThumb ? m.thumbKey! : m.storageKey;
  const mimeType = useThumb ? 'image/jpeg' : m.mimeType;
  if (!useThumb) await writeAudit({ actorId: user.id, action: 'media.download', entityType, entityId, summary: m.document ? 'Dokument abgerufen' : 'Foto abgerufen', after: { mediaId: m.id } });
  const ext = mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const fileName = `${name.replace(/[^\w.\- äöüÄÖÜß]/g, '_').slice(0, 80)}.${ext}`;
  const signedUrl = await storage.signedUrl(key, { expiresInSeconds: 90, fileName, mimeType });
  if (signedUrl) return { mimeType, fileName, bytes: null, signedUrl };
  const bytes = await storage.get(key);
  if (!bytes) throw notFoundError('Datei');
  return { mimeType, fileName, bytes, signedUrl: null };
}
