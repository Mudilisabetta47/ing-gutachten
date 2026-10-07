'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorize } from '@/server/auth/guards';
import { echo, toFormState, type FormState } from '@/server/admin/form';
import { DomainError } from '@/server/errors';
import { addLeadNote, changeLeadStatus, convertLead, updateLead } from '@/server/pipeline/leads';
import { customerSchema, vehicleSchema, caseSchema } from '@/server/pipeline/schemas';
import { LEAD_STATUSES, type LeadStatusKey } from '@/lib/workflow';
import { ZodError, type ZodType } from 'zod';
import { db } from '@/server/db';

const str = (fd: FormData, k: string) => (typeof fd.get(k) === 'string' ? (fd.get(k) as string) : '');
const refresh = (id: string) => {
  revalidatePath(`/admin/anfragen/${id}`);
  revalidatePath('/admin/anfragen');
};

export async function leadStatusAction(_p: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, 'id');
  try {
    const user = await authorize('leads.write');
    const to = str(fd, 'status') as LeadStatusKey;
    if (!(LEAD_STATUSES as readonly string[]).includes(to)) throw new DomainError('Unbekannter Status.');
    await changeLeadStatus(user, id, to, str(fd, 'reason'));
  } catch (e) {
    return toFormState(e);
  }
  refresh(id);
  return { ok: true, message: 'Status gespeichert.' };
}

export async function leadNoteAction(_p: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, 'id');
  try {
    const user = await authorize('leads.write');
    await addLeadNote(user, id, { body: str(fd, 'body'), kind: str(fd, 'kind') === 'PHONE_CALL' ? 'PHONE_CALL' : 'NOTE' });
  } catch (e) {
    return toFormState(e);
  }
  refresh(id);
  return { ok: true, message: 'Notiz gespeichert.' };
}

export async function leadUpdateAction(_p: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, 'id');
  const values = echo(fd);
  try {
    const user = await authorize('leads.write');
    await updateLead(user, id, {
      name: str(fd, 'name'), email: str(fd, 'email'), phone: str(fd, 'phone'), location: str(fd, 'location'),
      licensePlate: str(fd, 'licensePlate'), vehicleKind: str(fd, 'vehicleKind'), message: str(fd, 'message'),
      assignedToId: str(fd, 'assignedToId'), nextActionAt: str(fd, 'nextActionAt'),
    });
  } catch (e) {
    return toFormState(e, values);
  }
  refresh(id);
  return { ok: true, message: 'Gespeichert.', values };
}

/** „Termin vorbereiten“: Wiedervorlage setzen und – wenn erlaubt – auf „Termin offen“ stellen. */
export async function leadAppointmentAction(_p: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, 'id');
  try {
    const user = await authorize('leads.write');
    const when = str(fd, 'nextActionAt');
    if (!when) throw new DomainError('Bitte Datum und Uhrzeit für die Wiedervorlage angeben.');
    const lead = await db.lead.findFirst({ where: { id, deletedAt: null }, select: { status: true, name: true, email: true, phone: true, location: true, licensePlate: true, vehicleKind: true, message: true, assignedToId: true } });
    if (!lead) throw new DomainError('Anfrage nicht gefunden.', 'not_found');
    await updateLead(user, id, { ...lead, assignedToId: lead.assignedToId ?? '', nextActionAt: when });
    if (lead.status === 'NEW' || lead.status === 'CONTACTED') await changeLeadStatus(user, id, 'APPOINTMENT_PENDING', 'Termin wird vorbereitet');
  } catch (e) {
    return toFormState(e);
  }
  refresh(id);
  return { ok: true, message: 'Wiedervorlage gesetzt. Die Anfrage steht auf „Termin offen“.' };
}

/** Zuordnung der Eingabefelder (mit Präfix) zu einem Objekt; leere Felder bleiben leer. */
function pick(fd: FormData, prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (k.startsWith(prefix) && typeof v === 'string') out[k.slice(prefix.length)] = v;
  return out;
}

function parsePrefixed<T>(schema: ZodType<T>, data: unknown, prefix: string, errors: Record<string, string>): T | null {
  const res = schema.safeParse(data);
  if (res.success) return res.data;
  for (const issue of (res.error as ZodError).issues) errors[`${prefix}${String(issue.path[0] ?? '_')}`] ??= issue.message;
  return null;
}

export async function convertLeadAction(_p: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, 'id');
  const values = echo(fd);
  let caseNumber: string;
  try {
    const user = await authorize('leads.convert');
    const errors: Record<string, string> = {};
    const customerMode = str(fd, 'customerMode') === 'existing' ? 'existing' : 'new';
    const vehicleMode = str(fd, 'vehicleMode') === 'existing' ? 'existing' : 'new';

    const customer = customerMode === 'existing'
      ? ({ mode: 'existing', id: str(fd, 'customerId') } as const)
      : (() => { const d = parsePrefixed(customerSchema, pick(fd, 'c_'), 'c_', errors); return d && ({ mode: 'new', data: d } as const); })();
    const vehicle = vehicleMode === 'existing'
      ? ({ mode: 'existing', id: str(fd, 'vehicleId') } as const)
      : (() => { const d = parsePrefixed(vehicleSchema, pick(fd, 'v_'), 'v_', errors); return d && ({ mode: 'new', data: d } as const); })();
    const kase = parsePrefixed(caseSchema, pick(fd, 'k_'), 'k_', errors);

    if (customerMode === 'existing' && !str(fd, 'customerId')) errors.customerId = 'Bitte einen Kunden wählen.';
    if (vehicleMode === 'existing' && !str(fd, 'vehicleId')) errors.vehicleId = 'Bitte ein Fahrzeug wählen.';
    if (Object.keys(errors).length || !customer || !vehicle || !kase) return { error: 'Bitte die markierten Angaben prüfen.', fields: errors, values };

    const r = await convertLead(user, id, { customer, vehicle, case: kase });
    caseNumber = r.caseNumber;
  } catch (e) {
    return toFormState(e, values);
  }
  revalidatePath('/admin/anfragen');
  revalidatePath('/admin/faelle');
  revalidatePath('/admin/kunden');
  redirect(`/admin/faelle/${caseNumber}/?neu=1`);
}
