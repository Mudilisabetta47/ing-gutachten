'use server';

import { revalidatePath } from 'next/cache';
import { authorize } from '@/server/auth/guards';
import { toFormState } from '@/server/admin/form';
import { addCommunication, setPinned, type CommunicationInput } from '@/server/pipeline/communication';

export type ComResult = { ok: boolean; error?: string; message?: string };
const fail = (e: unknown): ComResult => { const s = toFormState(e); return { ok: false, error: s.fields ? `${s.error} ${Object.values(s.fields).join(' ')}` : s.error }; };
const refresh = (nr: string) => { revalidatePath(`/admin/faelle/${nr}`); revalidatePath('/admin/aufgaben'); revalidatePath('/admin'); };

export async function addCommunicationAction(input: { caseId: string; caseNumber: string; note: CommunicationInput }): Promise<ComResult> {
  try { const user = await authorize('communication.write.all', 'communication.write.own'); await addCommunication(user, String(input.caseId), input.note); refresh(input.caseNumber); return { ok: true, message: input.note.kind === 'PHONE_CALL' ? 'Anruf protokolliert.' : 'Notiz gespeichert.' }; } catch (e) { return fail(e); }
}
export async function setPinnedAction(input: { id: string; caseNumber: string; pinned: boolean }): Promise<ComResult> {
  try { const user = await authorize('communication.write.all', 'communication.write.own'); await setPinned(user, String(input.id), input.pinned); refresh(input.caseNumber); return { ok: true, message: input.pinned ? 'Angeheftet.' : 'Gelöst.' }; } catch (e) { return fail(e); }
}
