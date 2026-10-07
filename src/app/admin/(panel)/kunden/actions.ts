'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorize } from '@/server/auth/guards';
import { echo, toFormState, type FormState } from '@/server/admin/form';
import { addCustomerNote, archiveCustomer, createCustomer, restoreCustomer, updateCustomer } from '@/server/pipeline/customers';
import { createVehicle } from '@/server/pipeline/vehicles';
import { customerFields, str, vehicleFields } from '@/server/admin/fields';

export async function createCustomerAction(_p: FormState, fd: FormData): Promise<FormState> {
  const values = echo(fd);
  let id: string;
  try {
    const user = await authorize('customers.write');
    id = (await createCustomer(user, customerFields(fd))).id;
  } catch (e) {
    return toFormState(e, values);
  }
  revalidatePath('/admin/kunden');
  redirect(`/admin/kunden/${id}/`);
}

export async function updateCustomerAction(_p: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, 'id');
  const values = echo(fd);
  try {
    const user = await authorize('customers.write');
    await updateCustomer(user, id, customerFields(fd));
  } catch (e) {
    return toFormState(e, values);
  }
  revalidatePath(`/admin/kunden/${id}`);
  redirect(`/admin/kunden/${id}/`);
}

export async function customerNoteAction(_p: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, 'id');
  try {
    const user = await authorize('customers.write');
    await addCustomerNote(user, id, { body: str(fd, 'body'), kind: str(fd, 'kind') === 'PHONE_CALL' ? 'PHONE_CALL' : 'NOTE' });
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath(`/admin/kunden/${id}`);
  return { ok: true, message: 'Notiz gespeichert.' };
}

export async function archiveCustomerAction(_p: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, 'id');
  try {
    const user = await authorize('customers.delete');
    await archiveCustomer(user, id);
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath('/admin/kunden');
  redirect('/admin/kunden/');
}

export async function restoreCustomerAction(_p: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, 'id');
  try {
    const user = await authorize('customers.delete');
    await restoreCustomer(user, id);
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath('/admin/kunden');
  redirect(`/admin/kunden/${id}/`);
}

export async function createVehicleAction(_p: FormState, fd: FormData): Promise<FormState> {
  const customerId = str(fd, 'customerId');
  const values = echo(fd);
  try {
    const user = await authorize('vehicles.write');
    await createVehicle(user, customerId, vehicleFields(fd));
  } catch (e) {
    return toFormState(e, values);
  }
  revalidatePath(`/admin/kunden/${customerId}`);
  redirect(`/admin/kunden/${customerId}/?tab=fahrzeuge`);
}
