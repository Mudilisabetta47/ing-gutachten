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

export const caseFields = (fd: FormData) => ({
  serviceType: str(fd, 'serviceType') || 'ACCIDENT_REPORT', assignedExpertId: str(fd, 'assignedExpertId'),
  damageDate: str(fd, 'damageDate'), accidentDate: str(fd, 'accidentDate'), inspectionLocation: str(fd, 'inspectionLocation'),
  insuranceName: str(fd, 'insuranceName'), insuranceClaimNumber: str(fd, 'insuranceClaimNumber'),
  opposingInsurance: str(fd, 'opposingInsurance'), opposingClaimNumber: str(fd, 'opposingClaimNumber'),
  lawyer: str(fd, 'lawyer'), repairShop: str(fd, 'repairShop'), description: str(fd, 'description'),
});
