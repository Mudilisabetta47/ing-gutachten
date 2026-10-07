'use server';

import { revalidatePath } from 'next/cache';
import { authorize } from '@/server/auth/guards';
import { echo, toFormState, type FormState } from '@/server/admin/form';
import { locationFields, str } from '@/server/admin/fields';
import { archiveLocation, saveLocation } from '@/server/pipeline/masterdata';

export async function saveLocationAction(_p: FormState, fd: FormData): Promise<FormState> {
  const values = echo(fd);
  try {
    const user = await authorize('locations.write');
    await saveLocation(user, str(fd, 'id') || null, locationFields(fd));
  } catch (e) {
    return toFormState(e, values);
  }
  revalidatePath('/admin/standorte');
  return { ok: true, message: 'Standort gespeichert.' };
}

export async function archiveLocationAction(_p: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await authorize('locations.write');
    await archiveLocation(user, str(fd, 'id'));
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath('/admin/standorte');
  return { ok: true, message: 'Standort archiviert.' };
}
