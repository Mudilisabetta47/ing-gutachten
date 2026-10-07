/** FormData → Rohobjekte für die Zod-Schemas (Validierung passiert im Service, nie hier). Kein 'use server'. */
export const str = (fd: FormData, k: string): string => (typeof fd.get(k) === 'string' ? (fd.get(k) as string) : '');

export const customerFields = (fd: FormData) => ({
  type: str(fd, 'type') || 'PRIVATE', company: str(fd, 'company'), firstName: str(fd, 'firstName'), lastName: str(fd, 'lastName'),
  email: str(fd, 'email'), phone: str(fd, 'phone'), street: str(fd, 'street'), postalCode: str(fd, 'postalCode'), city: str(fd, 'city'), country: str(fd, 'country') || 'DE',
});

export const vehicleFields = (fd: FormData) => ({
  manufacturer: str(fd, 'manufacturer'), model: str(fd, 'model'), variant: str(fd, 'variant'), licensePlate: str(fd, 'licensePlate'), vin: str(fd, 'vin'),
  firstRegistration: str(fd, 'firstRegistration'), mileage: str(fd, 'mileage'), fuelType: str(fd, 'fuelType'), color: str(fd, 'color'),
});

const CASE_KEYS = [
  'serviceType', 'assignedExpertId', 'damageDate', 'accidentDate', 'inspectionLocation', 'insuranceName', 'insuranceClaimNumber',
  'opposingInsurance', 'opposingClaimNumber', 'lawyer', 'repairShop', 'description',
  'priority', 'claimType', 'accidentPlace', 'locationId', 'insuranceOrgId', 'lawyerOrgId', 'workshopOrgId', 'dealershipOrgId', 'partnerOrgId',
  'insurancePolicyNumber', 'adjusterName', 'adjusterPhone', 'adjusterEmail', 'lawyerReference', 'pinnedNote',
] as const;

/** Nur Felder, die das Formular wirklich gesendet hat – so überschreibt ein Teilformular nie fremde Felder. */
export const caseFields = (fd: FormData): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const k of CASE_KEYS) if (fd.has(k)) out[k] = str(fd, k);
  return out;
};

import { berlinLocalToDate } from '@/lib/berlin';

/** Terminformular: Beginn (datetime-local, Berliner Zeit) + Dauer in Minuten → Beginn/Ende. */
export function appointmentFields(fd: FormData) {
  const start = berlinLocalToDate(str(fd, 'startsAt'));
  const minutes = Math.min(720, Math.max(5, Number.parseInt(str(fd, 'duration') || '60', 10) || 60));
  return {
    start,
    input: {
      expertId: str(fd, 'expertId'),
      kind: (str(fd, 'kind') || 'INSPECTION') as 'INSPECTION' | 'CONSULTATION' | 'OTHER',
      startsAt: start ?? new Date(NaN),
      endsAt: start ? new Date(start.getTime() + minutes * 60_000) : new Date(NaN),
      location: str(fd, 'location'),
      notes: str(fd, 'notes'),
    },
  };
}

export const damageFields = (fd: FormData) => ({
  area: str(fd, 'area'), component: str(fd, 'component'), damageType: str(fd, 'damageType'), description: str(fd, 'description'), repairKind: str(fd, 'repairKind'),
});

export const inspectionFields = (fd: FormData) => ({ weather: str(fd, 'weather'), odometer: str(fd, 'odometer'), note: str(fd, 'note') });

const ORG_KEYS = ['name', 'contactName', 'street', 'postalCode', 'city', 'phone', 'fax', 'email', 'claimsEmail', 'portalUrl', 'notes', 'rateMechanicCents', 'rateBodyCents', 'rateElectricCents', 'ratePaintCents', 'shippingCents', 'partsMarkupBp', 'paintMaterialBp'] as const;
export const orgFields = (fd: FormData): Record<string, string> => Object.fromEntries(ORG_KEYS.map((k) => [k, str(fd, k)]));
export const locationFields = (fd: FormData) => ({
  name: str(fd, 'name'), street: str(fd, 'street'), postalCode: str(fd, 'postalCode'), city: str(fd, 'city'), phone: str(fd, 'phone'), email: str(fd, 'email'),
  openingHours: str(fd, 'openingHours'), isDefault: fd.get('isDefault') === 'on',
});
