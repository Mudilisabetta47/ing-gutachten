'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorize } from '@/server/auth/guards';
import { echo, toFormState, type FormState } from '@/server/admin/form';
import { DomainError } from '@/server/errors';
import { addCaseNote, archiveCase, assignExpert, changeCaseStatus, createCase, restoreCase, updateCase } from '@/server/pipeline/cases';
import { caseFields, str } from '@/server/admin/fields';
import { CASE_STATUSES, type CaseStatusKey } from '@/lib/workflow';

const refresh = (caseNumber: string) => {
  revalidatePath(`/admin/faelle/${caseNumber}`);
  revalidatePath('/admin/faelle');
};

export async function createCaseAction(_p: FormState, fd: FormData): Promise<FormState> {
  const values = echo(fd);
  let caseNumber: string;
  try {
    const user = await authorize('cases.write.all');
    const c = await createCase(user, { customerId: str(fd, 'customerId'), vehicleId: str(fd, 'vehicleId'), data: caseFields(fd) });
    caseNumber = c.caseNumber;
  } catch (e) {
    return toFormState(e, values);
  }
  revalidatePath('/admin/faelle');
  redirect(`/admin/faelle/${caseNumber}/?neu=1`);
}

export async function updateCaseAction(_p: FormState, fd: FormData): Promise<FormState> {
  const values = echo(fd);
  try {
    const user = await authorize('cases.write.all', 'cases.write.own');
    await updateCase(user, str(fd, 'id'), caseFields(fd));
  } catch (e) {
    return toFormState(e, values);
  }
  refresh(str(fd, 'caseNumber'));
  return { ok: true, message: 'Gespeichert.', values };
}

export async function caseStatusAction(_p: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await authorize('cases.status', 'cases.write.own');
    const to = str(fd, 'status') as CaseStatusKey;
    if (!(CASE_STATUSES as readonly string[]).includes(to)) throw new DomainError('Unbekannter Status.');
    await changeCaseStatus(user, str(fd, 'id'), to, str(fd, 'reason'));
  } catch (e) {
    return toFormState(e);
  }
  refresh(str(fd, 'caseNumber'));
  return { ok: true, message: 'Status gespeichert.' };
}

export async function assignExpertAction(_p: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await authorize('cases.assign');
    await assignExpert(user, str(fd, 'id'), str(fd, 'expertId') || null);
  } catch (e) {
    return toFormState(e);
  }
  refresh(str(fd, 'caseNumber'));
  return { ok: true, message: 'Zuweisung gespeichert.' };
}

export async function caseNoteAction(_p: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await authorize('cases.write.all', 'cases.write.own');
    await addCaseNote(user, str(fd, 'id'), { body: str(fd, 'body'), kind: str(fd, 'kind') === 'PHONE_CALL' ? 'PHONE_CALL' : 'NOTE' });
  } catch (e) {
    return toFormState(e);
  }
  refresh(str(fd, 'caseNumber'));
  return { ok: true, message: 'Notiz gespeichert.' };
}

export async function archiveCaseAction(_p: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await authorize('cases.delete');
    await archiveCase(user, str(fd, 'id'));
  } catch (e) {
    return toFormState(e);
  }
  refresh(str(fd, 'caseNumber'));
  redirect('/admin/faelle/');
}

export async function restoreCaseAction(_p: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await authorize('cases.delete');
    await restoreCase(user, str(fd, 'id'));
  } catch (e) {
    return toFormState(e);
  }
  refresh(str(fd, 'caseNumber'));
  redirect(`/admin/faelle/${str(fd, 'caseNumber')}/`);
}
