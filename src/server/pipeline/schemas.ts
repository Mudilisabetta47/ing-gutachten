import { z } from 'zod';
import { formatPlate, normalizePlate, parseVin } from '@/lib/normalize';
import { berlinLocalToDate } from '@/lib/berlin';
import { normalizeHsn, normalizeTsn } from '@/lib/vehicle-data';

/** Leere Eingaben aus Formularen werden zu null. */
const opt = (max: number) =>
  z.string().trim().max(max, `Höchstens ${max} Zeichen.`).optional().nullable().transform((v) => (v ? v : null));

const optEmail = z
  .string()
  .trim()
  .max(200)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v), 'Bitte eine gültige E-Mail-Adresse angeben.');

const optDate = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), 'Bitte ein gültiges Datum angeben.')
  .transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : null));

const pastDate = optDate.refine((d) => d === null || d.getTime() <= Date.now() + 86_400_000, 'Das Datum liegt in der Zukunft.');

export const customerSchema = z
  .object({
    type: z.enum(['PRIVATE', 'BUSINESS']).default('PRIVATE'),
    company: opt(160),
    firstName: z.string().trim().max(80).optional().nullable().transform((v) => v ?? ''),
    lastName: z.string().trim().min(1, 'Bitte den Nachnamen angeben.').max(120),
    email: optEmail,
    phone: opt(40),
    street: opt(160),
    postalCode: opt(10),
    city: opt(120),
    country: z.string().trim().toUpperCase().length(2, 'Zweistelliger Ländercode, z. B. DE.').optional().nullable().transform((v) => v || 'DE'),
  })
  .refine((c) => c.type !== 'BUSINESS' || Boolean(c.company), { message: 'Bei Firmenkunden bitte die Firma angeben.', path: ['company'] });
export type CustomerInput = z.infer<typeof customerSchema>;

const fuel = z.enum(['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'PLUG_IN_HYBRID', 'LPG', 'CNG', 'HYDROGEN', 'OTHER']);

const techText = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v === undefined ? undefined : v ? v : null));
const techInt = (min: number, max: number, msg: string) =>
  z.union([z.string(), z.number()]).optional().nullable()
    .transform((v) => (v === undefined ? undefined : v === '' || v === null ? null : Number(String(v).replace(/\./g, '').replace(',', '.'))))
    .refine((v) => v === undefined || v === null || (Number.isInteger(v) && v >= min && v <= max), msg);

export const vehicleSchema = z
  .object({
    manufacturer: z.string().trim().min(1, 'Bitte den Hersteller angeben.').max(80),
    model: z.string().trim().min(1, 'Bitte das Modell angeben.').max(120),
    variant: opt(120),
    licensePlate: opt(20),
    vin: opt(30),
    firstRegistration: pastDate,
    mileage: z
      .union([z.string(), z.number()])
      .optional()
      .nullable()
      .transform((v) => (v === '' || v === null || v === undefined ? null : Number(String(v).replace(/\./g, '').replace(',', '.'))))
      .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 3_000_000), 'Bitte einen gültigen Kilometerstand angeben.'),
    fuelType: z.union([fuel, z.literal('')]).optional().nullable().transform((v) => (v ? v : null)),
    color: opt(60),
    // Fahrzeugdaten (HSN/TSN): fehlt ein Feld im Formular, bleibt der gespeicherte Wert unverändert (undefined statt null)
    hsn: techText(10), tsn: techText(10), hsnTsnId: techText(40),
    engineName: techText(80), engineCode: techText(30), bodyStyle: techText(60), driveType: techText(40), transmission: techText(40), vehicleClass: techText(20),
    powerKw: techInt(1, 2000, 'Bitte eine gültige Leistung in kW angeben.'), powerHp: techInt(1, 3000, 'Bitte eine gültige Leistung in PS angeben.'),
    displacementCc: techInt(1, 20000, 'Bitte einen gültigen Hubraum in cm³ angeben.'), seats: techInt(1, 99, 'Bitte eine gültige Sitzplatzzahl angeben.'),
  })
  .transform((v, ctx) => {
    if (v.hsn) { const h = normalizeHsn(v.hsn); if (!h.value) ctx.addIssue({ code: 'custom', path: ['hsn'], message: h.error ?? 'Ungültige HSN.' }); else v.hsn = h.value; }
    if (v.tsn) { const t = normalizeTsn(v.tsn); if (!t.value) ctx.addIssue({ code: 'custom', path: ['tsn'], message: t.error ?? 'Ungültige TSN.' }); else v.tsn = t.value; }
    const plateNorm = normalizePlate(v.licensePlate);
    if (v.licensePlate && !plateNorm) ctx.addIssue({ code: 'custom', path: ['licensePlate'], message: 'Bitte ein gültiges Kennzeichen angeben.' });
    const vin = parseVin(v.vin);
    if (vin.error) ctx.addIssue({ code: 'custom', path: ['vin'], message: vin.error });
    return { ...v, licensePlate: formatPlate(v.licensePlate), licensePlateNorm: plateNorm, vin: vin.value, vinWarning: vin.warning ?? null };
  });
export type VehicleInput = z.infer<typeof vehicleSchema>;

const service = z.enum(['ACCIDENT_REPORT', 'DAMAGE_REPORT', 'VALUATION', 'COST_ESTIMATE', 'ACCIDENT_ANALYSIS', 'RECONSTRUCTION', 'OTHER']);

const id = z.string().trim().optional().nullable().transform((v) => (v ? v : null));

export const caseSchema = z.object({
  serviceType: service.default('ACCIDENT_REPORT'),
  assignedExpertId: z.string().trim().optional().nullable().transform((v) => (v ? v : null)),
  damageDate: pastDate,
  accidentDate: pastDate,
  inspectionLocation: opt(200),
  insuranceName: opt(160),
  insuranceClaimNumber: opt(80),
  opposingInsurance: opt(160),
  opposingClaimNumber: opt(80),
  lawyer: opt(200),
  repairShop: opt(200),
  description: opt(5000),
  // Phase 4
  priority: z.enum(['NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  claimType: z.union([z.enum(['LIABILITY', 'COMPREHENSIVE', 'PARTIAL_COMPREHENSIVE', 'OWN_DAMAGE', 'VALUATION', 'EVIDENCE', 'OTHER']), z.literal('')]).optional().nullable().transform((v) => (v ? v : null)),
  accidentPlace: opt(200),
  locationId: id,
  insuranceOrgId: id,
  lawyerOrgId: id,
  workshopOrgId: id,
  dealershipOrgId: id,
  partnerOrgId: id,
  insurancePolicyNumber: opt(80),
  adjusterName: opt(120),
  adjusterPhone: opt(40),
  adjusterEmail: optEmail,
  lawyerReference: opt(80),
  pinnedNote: opt(500),
});
export type CaseInput = z.infer<typeof caseSchema>;

export const noteSchema = z.object({
  body: z.string().trim().min(1, 'Die Notiz ist leer.').max(4000, 'Höchstens 4000 Zeichen.'),
  kind: z.enum(['NOTE', 'PHONE_CALL']).default('NOTE'),
});

export const leadUpdateSchema = z.object({
  name: z.string().trim().min(2, 'Bitte einen Namen angeben.').max(120),
  email: optEmail,
  phone: opt(40),
  location: opt(200),
  licensePlate: opt(20),
  vehicleKind: z.string().trim().min(1).max(60),
  message: opt(2000),
  assignedToId: z.string().trim().optional().nullable().transform((v) => (v ? v : null)),
  nextActionAt: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || berlinLocalToDate(v) !== null, 'Bitte ein gültiges Datum angeben.')
    .transform((v) => (v ? berlinLocalToDate(v) : null)),
});

/** Schlüssel der geänderten Felder – für das Audit-Log ohne Klartext personenbezogener Werte. */
export function changedKeys(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const eq = (a: unknown, b: unknown) => (a instanceof Date || b instanceof Date ? String((a as Date)?.valueOf?.() ?? a) === String((b as Date)?.valueOf?.() ?? b) : (a ?? null) === (b ?? null));
  return Object.keys(after).filter((k) => k in before && !eq(before[k], after[k]));
}
