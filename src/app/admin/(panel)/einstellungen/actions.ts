'use server';

import { revalidatePath } from 'next/cache';
import { authorize } from '@/server/auth/guards';
import { setSetting } from '@/server/settings';
import { echo, toFormState, type FormState } from '@/server/admin/form';

export async function saveNumberingAction(_p: FormState, fd: FormData): Promise<FormState> {
  const values = echo(fd);
  try {
    const actor = await authorize('settings.write');
    await setSetting('numbering', {
      casePrefix: fd.get('casePrefix'),
      caseDigits: Number(fd.get('caseDigits')),
      invoicePrefix: fd.get('invoicePrefix'),
      invoiceDigits: Number(fd.get('invoiceDigits')),
    }, actor.id);
  } catch (e) {
    return toFormState(e, values);
  }
  revalidatePath('/admin/einstellungen');
  return { ok: true, message: 'Nummernkreise gespeichert.' };
}

export async function saveUploadsAction(_p: FormState, fd: FormData): Promise<FormState> {
  const values = echo(fd);
  try {
    const actor = await authorize('settings.write');
    await setSetting('uploads', {
      maxPhotoMb: Number(fd.get('maxPhotoMb')),
      maxDocumentMb: Number(fd.get('maxDocumentMb')),
      maxFilesPerUpload: Number(fd.get('maxFilesPerUpload')),
    }, actor.id);
  } catch (e) {
    return toFormState(e, values);
  }
  revalidatePath('/admin/einstellungen');
  return { ok: true, message: 'Datei-Limits gespeichert.' };
}

export async function saveCompanyAction(_p: FormState, fd: FormData): Promise<FormState> {
  const values = echo(fd);
  try {
    const actor = await authorize('settings.write');
    const g = (k: string) => String(fd.get(k) ?? '');
    await setSetting('company', { name: g('name'), street: g('street'), postalCode: g('postalCode'), city: g('city'), phone: g('phone'), email: g('email'), website: g('website'), taxId: g('taxId'), bank: g('bank'), footer: g('footer') }, actor.id);
  } catch (e) {
    return toFormState(e, values);
  }
  revalidatePath('/admin/einstellungen');
  return { ok: true, message: 'Unternehmensdaten gespeichert.' };
}
