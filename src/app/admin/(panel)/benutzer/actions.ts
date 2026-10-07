'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorize } from '@/server/auth/guards';
import { requestMeta } from '@/server/http';
import { createUser, resetPassword, updateUser } from '@/server/users';
import { bool, echo, toFormState, type FormState } from '@/server/admin/form';

export async function createUserAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = echo(fd);
  try {
    const actor = await authorize('users.write');
    await createUser(actor, {
      email: fd.get('email'),
      firstName: fd.get('firstName'),
      lastName: fd.get('lastName'),
      role: fd.get('role'),
      isExpert: bool(fd.get('isExpert')),
      password: fd.get('password'),
    }, await requestMeta());
  } catch (e) {
    return toFormState(e, values);
  }
  revalidatePath('/admin/benutzer');
  redirect('/admin/benutzer');
}

export async function updateUserAction(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const actor = await authorize('users.write');
    await updateUser(actor, {
      id: fd.get('id'),
      role: fd.get('role'),
      isActive: bool(fd.get('isActive')),
      isExpert: bool(fd.get('isExpert')),
    }, await requestMeta());
  } catch (e) {
    return toFormState(e);
  }
  revalidatePath('/admin/benutzer');
  return { ok: true, message: 'Gespeichert. Laufende Sitzungen wurden bei Rollen- oder Statusänderung beendet.' };
}

export async function resetPasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const actor = await authorize('users.write');
    await resetPassword(actor, String(fd.get('id') ?? ''), String(fd.get('password') ?? ''), await requestMeta());
  } catch (e) {
    return toFormState(e);
  }
  return { ok: true, message: 'Passwort gesetzt. Beim nächsten Login muss es geändert werden; alle Sitzungen wurden beendet.' };
}
