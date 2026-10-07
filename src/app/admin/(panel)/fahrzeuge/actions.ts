'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorize } from '@/server/auth/guards';
import { echo, toFormState, type FormState } from '@/server/admin/form';
import { archiveVehicle, updateVehicle } from '@/server/pipeline/vehicles';
import { str, vehicleFields } from '@/server/admin/fields';

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
