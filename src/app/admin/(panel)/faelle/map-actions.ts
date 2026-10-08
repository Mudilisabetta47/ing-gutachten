'use server';

import { revalidatePath } from 'next/cache';
import { authorize } from '@/server/auth/guards';
import { toFormState } from '@/server/admin/form';
import { addDamage, deleteDamage, setDamagePhotos, updateDamage } from '@/server/pipeline/damages';

export type MapResult = { ok: boolean; error?: string; fields?: Record<string, string>; id?: string; message?: string };

const clean = (data: Record<string, unknown>) => Object.fromEntries(Object.entries(data).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, String(v).slice(0, 2100)]));

/** Schaden von der visuellen Karte speichern (neu oder ändern) und Fotos verknüpfen. */
export async function saveMapDamageAction(input: { caseId: string; caseNumber: string; id?: string | null; data: Record<string, string>; photoIds: string[] }): Promise<MapResult> {
  try {
    const user = await authorize('cases.write.all', 'cases.write.own');
    const data = clean(input.data);
    let id = input.id ?? null;
    if (id) await updateDamage(user, id, data);
    else id = (await addDamage(user, String(input.caseId), data)).id;
    await setDamagePhotos(user, id, Array.isArray(input.photoIds) ? input.photoIds.map(String) : []);
    revalidatePath(`/admin/faelle/${input.caseNumber}`);
    return { ok: true, id, message: input.id ? 'Schaden geändert.' : 'Schaden erfasst.' };
  } catch (e) {
    const s = toFormState(e);
    return { ok: false, error: s.error, fields: s.fields };
  }
}

export async function deleteMapDamageAction(input: { id: string; caseNumber: string }): Promise<MapResult> {
  try {
    const user = await authorize('cases.write.all', 'cases.write.own');
    await deleteDamage(user, String(input.id));
    revalidatePath(`/admin/faelle/${input.caseNumber}`);
    return { ok: true, message: 'Schaden gelöscht.' };
  } catch (e) {
    return { ok: false, error: toFormState(e).error };
  }
}
