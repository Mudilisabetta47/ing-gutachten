'use server';

import { revalidatePath } from 'next/cache';
import { authorize } from '@/server/auth/guards';
import { toFormState } from '@/server/admin/form';
import { addComment, approveReport, archiveTextBlock, createReport, markSent, reopenReport, requestChanges, resolveComment, saveReport, saveTextBlock, submitReport } from '@/server/pipeline/reports';

export type RepResult = { ok: boolean; error?: string; fields?: Record<string, string>; message?: string; saveCounter?: number; id?: string };
const fail = (e: unknown): RepResult => { const s = toFormState(e); return { ok: false, error: s.fields ? `${s.error} ${Object.values(s.fields).join(' ')}` : s.error }; };
const refresh = (nr: string) => { revalidatePath(`/admin/faelle/${nr}`); revalidatePath('/admin/gutachten'); revalidatePath('/admin'); };

export async function createReportAction(input: { caseId: string; caseNumber: string }): Promise<RepResult> {
  try { const user = await authorize('reports.write.all', 'reports.write.own'); const r = await createReport(user, String(input.caseId)); refresh(input.caseNumber); return { ok: true, id: r.id, message: `Gutachten ${r.number} angelegt.` }; } catch (e) { return fail(e); }
}
export async function saveReportAction(input: { id: string; caseNumber: string; title: string | null; content: unknown; counter: number }): Promise<RepResult> {
  try { const user = await authorize('reports.write.all', 'reports.write.own'); const r = await saveReport(user, String(input.id), { title: input.title, content: input.content }, input.counter); return { ok: true, saveCounter: r.saveCounter }; } catch (e) { return fail(e); }
}
export async function submitReportAction(input: { id: string; caseNumber: string }): Promise<RepResult> {
  try { const user = await authorize('reports.write.all', 'reports.write.own'); await submitReport(user, String(input.id)); refresh(input.caseNumber); return { ok: true, message: 'Zur Prüfung eingereicht.' }; } catch (e) { return fail(e); }
}
export async function requestChangesAction(input: { id: string; caseNumber: string; note?: string }): Promise<RepResult> {
  try { const user = await authorize('reports.review'); await requestChanges(user, String(input.id), input.note); refresh(input.caseNumber); return { ok: true, message: 'Änderungen angefordert.' }; } catch (e) { return fail(e); }
}
export async function approveReportAction(input: { id: string; caseNumber: string }): Promise<RepResult> {
  try { const user = await authorize('reports.approve'); await approveReport(user, String(input.id)); refresh(input.caseNumber); return { ok: true, message: 'Gutachten freigegeben – PDF im Fall abgelegt.' }; } catch (e) { return fail(e); }
}
export async function markSentAction(input: { id: string; caseNumber: string; to: string; channel: string; note?: string }): Promise<RepResult> {
  try { const user = await authorize('reports.send'); await markSent(user, String(input.id), { to: input.to, channel: input.channel, note: input.note }); refresh(input.caseNumber); return { ok: true, message: 'Versand erfasst.' }; } catch (e) { return fail(e); }
}
export async function reopenReportAction(input: { id: string; caseNumber: string; reason: string }): Promise<RepResult> {
  try { const user = await authorize('reports.write.all', 'reports.write.own', 'reports.approve'); await reopenReport(user, String(input.id), input.reason); refresh(input.caseNumber); return { ok: true, message: 'Zur Überarbeitung geöffnet.' }; } catch (e) { return fail(e); }
}
export async function commentAction(input: { id: string; caseNumber: string; chapterKey?: string | null; body: string }): Promise<RepResult> {
  try { const user = await authorize('reports.review', 'reports.write.all', 'reports.write.own'); await addComment(user, String(input.id), { chapterKey: input.chapterKey, body: input.body }); refresh(input.caseNumber); return { ok: true, message: 'Kommentar gespeichert.' }; } catch (e) { return fail(e); }
}
export async function resolveCommentAction(input: { id: string; caseNumber: string; resolved: boolean }): Promise<RepResult> {
  try { const user = await authorize('reports.review', 'reports.write.all', 'reports.write.own'); await resolveComment(user, String(input.id), input.resolved); refresh(input.caseNumber); return { ok: true }; } catch (e) { return fail(e); }
}
export async function saveTextBlockAction(input: { id?: string | null; title: string; category?: string; body: string }): Promise<RepResult> {
  try { const user = await authorize('templates.write'); await saveTextBlock(user, input.id ?? null, { title: input.title, category: input.category, body: input.body }); revalidatePath('/admin/vorlagen'); return { ok: true, message: 'Textbaustein gespeichert.' }; } catch (e) { return fail(e); }
}
export async function archiveTextBlockAction(input: { id: string }): Promise<RepResult> {
  try { const user = await authorize('templates.write'); await archiveTextBlock(user, String(input.id)); revalidatePath('/admin/vorlagen'); return { ok: true, message: 'Textbaustein archiviert.' }; } catch (e) { return fail(e); }
}
