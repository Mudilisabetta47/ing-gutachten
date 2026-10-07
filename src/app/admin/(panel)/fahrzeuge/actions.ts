'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorize } from '@/server/auth/guards';
import { echo, toFormState, type FormState } from '@/server/admin/form';
import { archiveVehicle, updateVehicle } from '@/server/pipeline/vehicles';
import { str, vehicleFields } from '@/server/admin/fields';
import { applyRecordToVehicle, confirmVehicleField, saveRegistration, setVehicleVin, TRACKED_FIELDS } from '@/server/vehicledata/apply';
import { createManualRecord } from '@/server/vehicledata/catalog';

export async function updateVehicleAction(_p: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, 'id');
  const values = echo(fd);
  try {
    const user = await authorize('vehicles.write');
    const { warning } = await updateVehicle(user, id, vehicleFields(fd));
    revalidatePath(`/admin/fahrzeuge/${id}`);
    return { ok: true, message: warning ? `Gespeichert. Hinweis: ${warning}` : 'Gespeichert.', values };
  } catch (e) {
    return toFormState(e, values);
  }
}

export async function archiveVehicleAction(_p: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await authorize('vehicles.delete');
    await archiveVehicle(user, str(fd, 'id'));
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath('/admin/fahrzeuge');
  redirect('/admin/fahrzeuge/');
}

/* ------------------------------------------------------------ Fahrzeugdaten (HSN/TSN) – aus Client-Komponenten aufgerufen */

export type DataActionResult = { ok: boolean; message?: string; error?: string; detail?: string[]; id?: string };

const fail = (e: unknown): DataActionResult => {
  const s = toFormState(e);
  return { ok: false, error: s.fields ? `${s.error} ${Object.values(s.fields).join(' ')}` : s.error };
};

export async function applyRecordAction(vehicleId: string, recordId: string): Promise<DataActionResult> {
  try {
    const user = await authorize('vehicledata.write');
    const r = await applyRecordToVehicle(user, String(vehicleId), String(recordId));
    revalidatePath(`/admin/fahrzeuge/${vehicleId}`);
    return {
      ok: true,
      message: r.kept.length ? `Fahrzeug übernommen – ${r.kept.length} bestätigte Angabe(n) blieben unverändert.` : 'Fahrzeug übernommen.',
      detail: r.kept.map((k) => `${TRACKED_FIELDS[k.field]}: ${k.reason}`),
    };
  } catch (e) { return fail(e); }
}

export async function createManualRecordAction(input: Record<string, string>): Promise<DataActionResult & { recordId?: string }> {
  try {
    const user = await authorize('vehicledata.write');
    const r = await createManualRecord(user, input);
    return { ok: true, message: r.message, recordId: r.record.id };
  } catch (e) { return fail(e); }
}

export async function setVinAction(vehicleId: string, vin: string): Promise<DataActionResult> {
  try {
    const user = await authorize('vehicles.write');
    await setVehicleVin(user, String(vehicleId), String(vin));
    revalidatePath(`/admin/fahrzeuge/${vehicleId}`);
    return { ok: true, message: 'FIN ergänzt.' };
  } catch (e) { return fail(e); }
}

export async function confirmFieldAction(vehicleId: string, field: string): Promise<DataActionResult> {
  try {
    const user = await authorize('vehicles.write');
    await confirmVehicleField(user, String(vehicleId), String(field));
    revalidatePath(`/admin/fahrzeuge/${vehicleId}`);
    return { ok: true, message: 'Als bestätigt gespeichert.' };
  } catch (e) { return fail(e); }
}

export async function saveRegistrationAction(_p: FormState, fd: FormData): Promise<FormState> {
  const vehicleId = str(fd, 'id');
  const values = echo(fd);
  try {
    const user = await authorize('vehicles.write');
    const { rows, note } = await saveRegistration(user, vehicleId, Object.fromEntries([...fd.entries()].filter(([k, v]) => typeof v === 'string' && k !== 'id' && !k.startsWith('$'))));
    revalidatePath(`/admin/fahrzeuge/${vehicleId}`);
    const dev = rows.filter((r) => r.state === 'deviation').length;
    return { ok: true, message: note ?? (dev ? `Fahrzeugschein gespeichert – ${dev} Abweichung(en) festgestellt.` : 'Fahrzeugschein gespeichert und abgeglichen.'), values };
  } catch (e) { return toFormState(e, values); }
}
