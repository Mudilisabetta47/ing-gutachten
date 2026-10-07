import 'server-only';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';
import type { AuthUser } from '@/server/auth/session-types';
import { ForbiddenError } from '@/server/auth/errors';
import { DomainError, notFoundError } from '@/server/errors';
import { ORG_KINDS, ORG_LABELS, type OrgKindKey } from '@/lib/workflow';
import { normalizePhone } from '@/lib/normalize';
import { parseEuroToCents } from '@/lib/money';
import { has } from './access';
import { changedKeys } from './schemas';
import { PAGE_SIZE } from './leads';

/* ------------------------------------------------------------ Organisationen */

const opt = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));
const optEmail = z.string().trim().max(200).optional().nullable().transform((v) => (v ? v : null)).refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v), 'Bitte eine gültige E-Mail-Adresse angeben.');
const optUrl = z.string().trim().max(300).optional().nullable().transform((v) => (v ? v : null)).refine((v) => v === null || /^https?:\/\/\S+$/i.test(v), 'Bitte mit https:// angeben.');
const cents = z.union([z.string(), z.number(), z.null(), z.undefined()]).transform((v, ctx) => {
  const c = parseEuroToCents(v);
  if (Number.isNaN(c)) { ctx.addIssue({ code: 'custom', message: 'Bitte einen gültigen Betrag angeben.' }); return null; }
  return c;
}).optional();
/** Prozent („10“, „7,5“) → Basispunkte. */
const pctToBp = z.union([z.string(), z.number(), z.null(), z.undefined()]).transform((v, ctx) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 500) { ctx.addIssue({ code: 'custom', message: 'Bitte einen gültigen Prozentwert angeben.' }); return null; }
  return Math.round(n * 100);
}).optional();

export const organizationSchema = z.object({
  name: z.string().trim().min(2, 'Bitte einen Namen angeben.').max(160),
  contactName: opt(120), street: opt(160), postalCode: opt(10), city: opt(120),
  phone: opt(40), fax: opt(40), email: optEmail, claimsEmail: optEmail, portalUrl: optUrl, notes: opt(4000),
  rateMechanicCents: cents, rateBodyCents: cents, rateElectricCents: cents, ratePaintCents: cents, shippingCents: cents,
  partsMarkupBp: pctToBp, paintMaterialBp: pctToBp,
});
export type OrganizationInput = z.infer<typeof organizationSchema>;

function readScope(user: AuthUser) {
  if (!has(user, 'masterdata.read') && !has(user, 'masterdata.write')) throw new ForbiddenError();
}
function writeScope(user: AuthUser) {
  if (!has(user, 'masterdata.write')) throw new ForbiddenError();
}
const kindOk = (k: string): OrgKindKey => {
  if (!(ORG_KINDS as readonly string[]).includes(k)) throw new DomainError('Unbekannte Art.');
  return k as OrgKindKey;
};

export type OrgListQuery = { kind: OrgKindKey; q?: string; page?: number; archiv?: boolean; limit?: number; sort?: string; dir?: string };

export async function listOrganizations(user: AuthUser, query: OrgListQuery) {
  readScope(user);
  const page = Math.max(1, query.page ?? 1);
  const size = Math.min(query.limit ?? PAGE_SIZE, 200);
  const term = query.q?.trim();
  const phone = term ? normalizePhone(term) : null;
  const where: Prisma.OrganizationWhereInput = {
    kind: query.kind,
    deletedAt: query.archiv && has(user, 'masterdata.write') ? { not: null } : null,
    ...(term ? { OR: [{ name: { contains: term, mode: 'insensitive' } }, { contactName: { contains: term, mode: 'insensitive' } }, { city: { contains: term, mode: 'insensitive' } }, { email: { contains: term, mode: 'insensitive' } }, ...(phone ? [{ phone: { contains: term } }] : [])] } : {}),
  };
  const d = query.dir === 'desc' ? 'desc' : 'asc';
  const orderBy: Prisma.OrganizationOrderByWithRelationInput[] = query.sort === 'ort' ? [{ city: d }, { name: 'asc' }] : query.sort === 'neu' ? [{ createdAt: d === 'asc' ? 'asc' : 'desc' }] : [{ name: d }];
  const [rows, total] = await Promise.all([
    db.organization.findMany({
      where, orderBy, skip: (page - 1) * size, take: size,
      select: {
        id: true, kind: true, name: true, contactName: true, city: true, phone: true, email: true, deletedAt: true, updatedAt: true,
        _count: { select: { casesInsurance: true, casesLawyer: true, casesWorkshop: true, casesDealership: true, casesPartner: true } },
      },
    }),
    db.organization.count({ where }),
  ]);
  return { rows, total, page, pageSize: size };
}

export async function getOrganization(user: AuthUser, id: string) {
  readScope(user);
  const o = await db.organization.findFirst({ where: { id }, include: { _count: { select: { casesInsurance: true, casesLawyer: true, casesWorkshop: true, casesDealership: true, casesPartner: true } } } });
  if (!o || (o.deletedAt && !has(user, 'masterdata.write'))) throw notFoundError(ORG_LABELS[(o?.kind ?? 'INSURANCE') as OrgKindKey].one);
  return o;
}

/** Fälle einer Organisation (nur, was die Rolle sehen darf, sonst leer). */
export async function organizationCases(user: AuthUser, id: string, kind: OrgKindKey) {
  if (!has(user, 'cases.read.all')) return [];
  const field = { INSURANCE: 'insuranceOrgId', LAWYER: 'lawyerOrgId', WORKSHOP: 'workshopOrgId', DEALERSHIP: 'dealershipOrgId', PARTNER: 'partnerOrgId' }[kind];
  return db.case.findMany({
    where: { [field]: id, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 50,
    select: { id: true, caseNumber: true, status: true, createdAt: true, customer: { select: { firstName: true, lastName: true, company: true } }, vehicle: { select: { licensePlate: true, manufacturer: true, model: true } } },
  });
}

export async function createOrganization(user: AuthUser, kind: string, raw: unknown) {
  writeScope(user);
  const k = kindOk(kind);
  const data = organizationSchema.parse(raw);
  if (k !== 'WORKSHOP') for (const f of ['rateMechanicCents', 'rateBodyCents', 'rateElectricCents', 'ratePaintCents', 'shippingCents', 'partsMarkupBp', 'paintMaterialBp'] as const) data[f] = null;
  return db.$transaction(async (tx) => {
    const o = await tx.organization.create({ data: { ...data, kind: k } });
    await writeAudit({ actorId: user.id, action: 'masterdata.create', entityType: 'Organization', entityId: o.id, summary: `${ORG_LABELS[k].one} angelegt`, after: { kind: k } }, tx);
    return o;
  });
}

export async function updateOrganization(user: AuthUser, id: string, raw: unknown) {
  writeScope(user);
  const data = organizationSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const before = await tx.organization.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw notFoundError('Eintrag');
    if (before.kind !== 'WORKSHOP') for (const f of ['rateMechanicCents', 'rateBodyCents', 'rateElectricCents', 'ratePaintCents', 'shippingCents', 'partsMarkupBp', 'paintMaterialBp'] as const) data[f] = null;
    await tx.organization.update({ where: { id }, data });
    const keys = changedKeys(before as unknown as Record<string, unknown>, data);
    if (keys.length) await writeAudit({ actorId: user.id, action: 'masterdata.update', entityType: 'Organization', entityId: id, summary: `${ORG_LABELS[before.kind].one} bearbeitet (${keys.join(', ')})`, after: { changed: keys } }, tx);
    return keys;
  });
}

export async function archiveOrganization(user: AuthUser, id: string) {
  writeScope(user);
  return db.$transaction(async (tx) => {
    const o = await tx.organization.findFirst({ where: { id, deletedAt: null }, select: { id: true, kind: true } });
    if (!o) throw notFoundError('Eintrag');
    await tx.organization.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAudit({ actorId: user.id, action: 'masterdata.archive', entityType: 'Organization', entityId: id, summary: `${ORG_LABELS[o.kind].one} archiviert` }, tx);
  });
}

export async function restoreOrganization(user: AuthUser, id: string) {
  writeScope(user);
  return db.$transaction(async (tx) => {
    const r = await tx.organization.updateMany({ where: { id, deletedAt: { not: null } }, data: { deletedAt: null } });
    if (r.count !== 1) throw notFoundError('Archivierter Eintrag');
    await writeAudit({ actorId: user.id, action: 'masterdata.restore', entityType: 'Organization', entityId: id, summary: 'Eintrag wiederhergestellt' }, tx);
  });
}

/** Auswahl für Formulare (Fall: Versicherung, Anwalt …). */
export async function organizationOptions(user: AuthUser, kind: OrgKindKey) {
  readScope(user);
  return db.organization.findMany({ where: { kind, deletedAt: null }, orderBy: { name: 'asc' }, select: { id: true, name: true, city: true }, take: 500 });
}

/* ------------------------------------------------------------ Standorte */

export const locationSchema = z.object({
  name: z.string().trim().min(2, 'Bitte einen Namen angeben.').max(120),
  street: opt(160), postalCode: opt(10), city: opt(120), phone: opt(40), email: optEmail, openingHours: opt(300),
  isDefault: z.boolean().default(false),
});

export async function listLocations(user: AuthUser) {
  if (!has(user, 'masterdata.read') && !has(user, 'locations.write') && !has(user, 'cases.read.all') && !has(user, 'users.read')) throw new ForbiddenError();
  return db.location.findMany({ where: { deletedAt: null }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }], include: { _count: { select: { users: true, cases: true } } } });
}

export async function saveLocation(user: AuthUser, id: string | null, raw: unknown) {
  if (!has(user, 'locations.write')) throw new ForbiddenError();
  const data = locationSchema.parse(raw);
  return db.$transaction(async (tx) => {
    if (data.isDefault) await tx.location.updateMany({ where: { isDefault: true, ...(id ? { id: { not: id } } : {}) }, data: { isDefault: false } });
    let loc;
    if (id) {
      if (!(await tx.location.findFirst({ where: { id, deletedAt: null }, select: { id: true } }))) throw notFoundError('Standort');
      loc = await tx.location.update({ where: { id }, data });
    } else {
      loc = await tx.location.create({ data });
    }
    await writeAudit({ actorId: user.id, action: id ? 'location.update' : 'location.create', entityType: 'Location', entityId: loc.id, summary: id ? 'Standort bearbeitet' : 'Standort angelegt' }, tx);
    return loc;
  });
}

export async function archiveLocation(user: AuthUser, id: string) {
  if (!has(user, 'locations.write')) throw new ForbiddenError();
  return db.$transaction(async (tx) => {
    const l = await tx.location.findFirst({ where: { id, deletedAt: null }, include: { _count: { select: { users: { where: { isActive: true } }, cases: { where: { deletedAt: null, status: { notIn: ['CLOSED', 'CANCELLED'] } } } } } } });
    if (!l) throw notFoundError('Standort');
    if (l.isDefault) throw new DomainError('Der Hauptstandort kann nicht archiviert werden. Bitte zuerst einen anderen Standort zum Hauptstandort machen.');
    if (l._count.users > 0 || l._count.cases > 0) throw new DomainError(`Dem Standort sind noch ${l._count.users} Mitarbeiter und ${l._count.cases} offene Fälle zugeordnet.`, 'conflict');
    await tx.location.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAudit({ actorId: user.id, action: 'location.archive', entityType: 'Location', entityId: id, summary: 'Standort archiviert' }, tx);
  });
}

export type CaseRefs = {
  locations: { id: string; name: string }[];
  insurances: { id: string; name: string }[];
  lawyers: { id: string; name: string }[];
  workshops: { id: string; name: string }[];
  dealerships: { id: string; name: string }[];
  partners: { id: string; name: string }[];
};

/** Auswahllisten für das Falldaten-Formular. Wer keine Stammdaten sehen darf, bekommt leere Listen (Formular fällt auf Freitext zurück). */
export async function caseRefOptions(user: AuthUser): Promise<CaseRefs> {
  const empty: CaseRefs = { locations: [], insurances: [], lawyers: [], workshops: [], dealerships: [], partners: [] };
  if (!has(user, 'masterdata.read') && !has(user, 'masterdata.write') && !has(user, 'cases.read.all')) return empty;
  const [locations, orgs] = await Promise.all([
    db.location.findMany({ where: { deletedAt: null }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }], select: { id: true, name: true } }),
    has(user, 'masterdata.read') || has(user, 'masterdata.write') ? db.organization.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' }, select: { id: true, name: true, kind: true }, take: 2000 }) : Promise.resolve([]),
  ]);
  const by = (k: string) => orgs.filter((o) => o.kind === k).map(({ id, name }) => ({ id, name }));
  return { locations, insurances: by('INSURANCE'), lawyers: by('LAWYER'), workshops: by('WORKSHOP'), dealerships: by('DEALERSHIP'), partners: by('PARTNER') };
}
