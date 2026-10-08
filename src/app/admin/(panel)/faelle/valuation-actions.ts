'use server';

import { revalidatePath } from 'next/cache';
import { authorize } from '@/server/auth/guards';
import { toFormState } from '@/server/admin/form';
import { addComparable, addEntry, selectEntry, setComparable, withdrawEntry } from '@/server/pipeline/valuation';

export type ValResult = { ok: boolean; error?: string; fields?: Record<string, string>; message?: string };
const fail = (e: unknown): ValResult => { const s = toFormState(e); return { ok: false, error: s.error, fields: s.fields }; };
const auth = () => authorize('valuations.write.all', 'valuations.write.own');
const refresh = (nr: string) => revalidatePath(`/admin/faelle/${nr}`);

export async function addValuationEntryAction(input: { caseId: string; caseNumber: string; data: Record<string, unknown> }): Promise<ValResult> {
  try { const user = await auth(); await addEntry(user, String(input.caseId), input.data); refresh(input.caseNumber); return { ok: true, message: 'Wert gespeichert.' }; } catch (e) { return fail(e); }
}
export async function selectValuationEntryAction(input: { id: string; caseNumber: string }): Promise<ValResult> {
  try { const user = await auth(); await selectEntry(user, String(input.id)); refresh(input.caseNumber); return { ok: true, message: 'Wert gewählt.' }; } catch (e) { return fail(e); }
}
export async function withdrawValuationEntryAction(input: { id: string; caseNumber: string }): Promise<ValResult> {
  try { const user = await auth(); await withdrawEntry(user, String(input.id)); refresh(input.caseNumber); return { ok: true, message: 'Wert zurückgezogen.' }; } catch (e) { return fail(e); }
}
export async function addComparableAction(input: { caseId: string; caseNumber: string; data: Record<string, unknown> }): Promise<ValResult> {
  try { const user = await auth(); await addComparable(user, String(input.caseId), input.data); refresh(input.caseNumber); return { ok: true, message: 'Vergleichsfahrzeug erfasst.' }; } catch (e) { return fail(e); }
}
export async function comparableAction(input: { id: string; caseNumber: string; included?: boolean; remove?: boolean }): Promise<ValResult> {
  try { const user = await auth(); await setComparable(user, String(input.id), { included: input.included, remove: input.remove }); refresh(input.caseNumber); return { ok: true }; } catch (e) { return fail(e); }
}
