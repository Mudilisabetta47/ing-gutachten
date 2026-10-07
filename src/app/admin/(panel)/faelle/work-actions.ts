'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorize } from '@/server/auth/guards';
import { echo, toFormState, type FormState } from '@/server/admin/form';
import { DomainError } from '@/server/errors';
import { appointmentFields, damageFields, inspectionFields, str } from '@/server/admin/fields';
import { createAppointment, rescheduleAppointment, setAppointmentStatus } from '@/server/pipeline/appointments';
import { finishInspection, startInspection, updateInspection } from '@/server/pipeline/inspection';
import { addDamage, deleteDamage, updateDamage } from '@/server/pipeline/damages';
import { deleteCasePhoto, deleteDocument, updateCasePhoto } from '@/server/pipeline/media';

const refresh = (fd: FormData) => {
  const nr = str(fd, 'caseNumber');
  if (nr) {
    revalidatePath(`/admin/faelle/${nr}`);
    revalidatePath(`/admin/faelle/${nr}/erfassung`);
  }
  revalidatePath('/admin/termine');
  revalidatePath('/admin/heute');
  revalidatePath('/admin');
};

/* ------------------------------------------------------------ Termine */
export async function createAppointmentAction(_p: FormState, fd: FormData): Promise<FormState> {
  const values = echo(fd);
  try {
    const user = await authorize('appointments.write.all', 'appointments.write.own');
    const { start, input } = appointmentFields(fd);
    if (!start) throw new DomainError('Bitte Datum und Uhrzeit angeben.');
    await createAppointment(user, str(fd, 'caseId'), input);
  } catch (e) {
    return toFormState(e, values);
  }
  refresh(fd);
  return { ok: true, message: 'Termin angelegt.' };
}

export async function rescheduleAppointmentAction(_p: FormState, fd: FormData): Promise<FormState> {
  const values = echo(fd);
  try {
    const user = await authorize('appointments.write.all', 'appointments.write.own');
    const { start, input } = appointmentFields(fd);
    if (!start) throw new DomainError('Bitte Datum und Uhrzeit angeben.');
    await rescheduleAppointment(user, str(fd, 'id'), input);
  } catch (e) {
    return toFormState(e, values);
  }
  refresh(fd);
  return { ok: true, message: 'Termin geändert.' };
}

export async function appointmentStatusAction(_p: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await authorize('appointments.write.all', 'appointments.write.own');
    const to = str(fd, 'status');
    if (!['CONFIRMED', 'DONE', 'CANCELLED', 'NO_SHOW'].includes(to)) throw new DomainError('Unbekannter Status.');
    await setAppointmentStatus(user, str(fd, 'id'), to as 'CONFIRMED' | 'DONE' | 'CANCELLED' | 'NO_SHOW', str(fd, 'reason'));
  } catch (e) {
    return toFormState(e);
  }
  refresh(fd);
  return { ok: true, message: str(fd, 'status') === 'CANCELLED' ? 'Termin abgesagt.' : 'Termin aktualisiert.' };
}

/* ------------------------------------------------------------ Besichtigung */
export async function startInspectionAction(_p: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await authorize('appointments.write.all', 'appointments.write.own');
    await startInspection(user, str(fd, 'appointmentId'));
  } catch (e) {
    return toFormState(e);
  }
  refresh(fd);
  return { ok: true, message: 'Besichtigung begonnen.' };
}

export async function saveInspectionAction(_p: FormState, fd: FormData): Promise<FormState> {
  const values = echo(fd);
  try {
    const user = await authorize('appointments.write.all', 'appointments.write.own');
    await updateInspection(user, str(fd, 'appointmentId'), inspectionFields(fd));
  } catch (e) {
    return toFormState(e, values);
  }
  return { ok: true, message: 'Gespeichert.', values };
}

export async function finishInspectionAction(_p: FormState, fd: FormData): Promise<FormState> {
  const values = echo(fd);
  try {
    const user = await authorize('appointments.write.all', 'appointments.write.own');
    await finishInspection(user, str(fd, 'appointmentId'), inspectionFields(fd));
  } catch (e) {
    return toFormState(e, values);
  }
  refresh(fd);
  redirect(`/admin/faelle/${str(fd, 'caseNumber')}/?fertig=1`);
}

/* ------------------------------------------------------------ Schäden */
export async function addDamageAction(_p: FormState, fd: FormData): Promise<FormState> {
  const values = echo(fd);
  try {
    const user = await authorize('cases.write.all', 'cases.write.own');
    await addDamage(user, str(fd, 'caseId'), damageFields(fd));
  } catch (e) {
    return toFormState(e, values);
  }
  refresh(fd);
  return { ok: true, message: 'Schaden erfasst.' };
}

export async function updateDamageAction(_p: FormState, fd: FormData): Promise<FormState> {
  const values = echo(fd);
  try {
    const user = await authorize('cases.write.all', 'cases.write.own');
    await updateDamage(user, str(fd, 'id'), damageFields(fd));
  } catch (e) {
    return toFormState(e, values);
  }
  refresh(fd);
  return { ok: true, message: 'Schaden geändert.' };
}

export async function deleteDamageAction(_p: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await authorize('cases.write.all', 'cases.write.own');
    await deleteDamage(user, str(fd, 'id'));
  } catch (e) {
    return toFormState(e);
  }
  refresh(fd);
  return { ok: true, message: 'Schaden gelöscht.' };
}

/* ------------------------------------------------------------ Fotos & Dokumente */
export async function updatePhotoAction(_p: FormState, fd: FormData): Promise<FormState> {
  const values = echo(fd);
  try {
    const user = await authorize('photos.write.all', 'photos.write.own');
    await updateCasePhoto(user, str(fd, 'id'), { category: str(fd, 'category') || undefined, title: str(fd, 'title'), description: str(fd, 'description'), damageId: str(fd, 'damageId') });
  } catch (e) {
    return toFormState(e, values);
  }
  refresh(fd);
  return { ok: true, message: 'Foto gespeichert.', values };
}

export async function deletePhotoAction(_p: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await authorize('photos.write.all', 'photos.write.own');
    await deleteCasePhoto(user, str(fd, 'id'));
  } catch (e) {
    return toFormState(e);
  }
  refresh(fd);
  return { ok: true, message: 'Foto gelöscht.' };
}

export async function deleteDocumentAction(_p: FormState, fd: FormData): Promise<FormState> {
  try {
    const user = await authorize('documents.delete');
    await deleteDocument(user, str(fd, 'id'));
  } catch (e) {
    return toFormState(e);
  }
  refresh(fd);
  revalidatePath('/admin/kunden');
  return { ok: true, message: 'Dokument gelöscht.' };
}
