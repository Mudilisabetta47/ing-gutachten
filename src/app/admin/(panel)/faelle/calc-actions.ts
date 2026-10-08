'use server';

import { revalidatePath } from 'next/cache';
import { authorize } from '@/server/auth/guards';
import { toFormState } from '@/server/admin/form';
import { appendFromDamages, createCalculation, deleteDraft, finalizeCalculation, saveCalculation } from '@/server/pipeline/calculations';

export type SuggestedRow = { ref: string; kind: string; laborCategory: string | null; description: string; partId: string | null; damageId: string | null };
export type CalcResult = { ok: boolean; error?: string; fields?: Record<string, string>; message?: string; updatedAt?: string; version?: number; added?: SuggestedRow[] };

const fail = (e: unknown): CalcResult => { const s = toFormState(e); return { ok: false, error: s.error, fields: s.fields }; };
const auth = () => authorize('calculations.write.all', 'calculations.write.own');
const refresh = (nr: string) => revalidatePath(`/admin/faelle/${nr}`);

export async function createCalcAction(input: { caseId: string; caseNumber: string; fromVersion?: number }): Promise<CalcResult> {
  try {
    const user = await auth();
    const c = await createCalculation(user, String(input.caseId), { fromVersion: input.fromVersion });
    refresh(input.caseNumber);
    return { ok: true, version: c.version, message: `Version ${c.version} angelegt.` };
  } catch (e) { return fail(e); }
}

/** Autosave: ganzen Entwurf speichern. */
export async function saveCalcAction(input: { calcId: string; caseNumber: string; data: unknown; token?: string }): Promise<CalcResult> {
  try {
    const user = await auth();
    const c = await saveCalculation(user, String(input.calcId), input.data, input.token);
    return { ok: true, updatedAt: c.updatedAt.toISOString(), version: c.version };
  } catch (e) { return fail(e); }
}

export async function finalizeCalcAction(input: { calcId: string; caseNumber: string }): Promise<CalcResult> {
  try {
    const user = await auth();
    const c = await finalizeCalculation(user, String(input.calcId));
    refresh(input.caseNumber);
    return { ok: true, version: c.version, message: `Version ${c.version} freigegeben.` };
  } catch (e) { return fail(e); }
}

export async function deleteDraftAction(input: { calcId: string; caseNumber: string }): Promise<CalcResult> {
  try {
    const user = await auth();
    await deleteDraft(user, String(input.calcId));
    refresh(input.caseNumber);
    return { ok: true, message: 'Entwurf verworfen.' };
  } catch (e) { return fail(e); }
}

export async function suggestCalcAction(input: { calcId: string; caseNumber: string }): Promise<CalcResult> {
  try {
    const user = await auth();
    const r = await appendFromDamages(user, String(input.calcId));
    refresh(input.caseNumber);
    const added: SuggestedRow[] = r.newItems.map((i) => ({ ref: i.ref, kind: i.kind, laborCategory: i.laborCategory ?? null, description: i.description, partId: i.partId, damageId: i.damageId }));
    return { ok: true, added, updatedAt: r.calc.updatedAt.toISOString(), message: r.added ? `${r.added} Positionen aus den Schäden vorgeschlagen.` : 'Keine neuen Positionen: Es gibt keine weiteren aktuellen Schäden mit Maßnahme.' };
  } catch (e) { return fail(e); }
}
