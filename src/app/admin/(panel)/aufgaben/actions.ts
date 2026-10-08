'use server';

import { revalidatePath } from 'next/cache';
import { authorize, requireUser } from '@/server/auth/guards';
import { toFormState } from '@/server/admin/form';
import { cancelTask, completeTask, createTask, markNotificationsRead, reopenTask, snoozeTask, updateTask, type TaskInput } from '@/server/pipeline/tasks';

export type TaskResult = { ok: boolean; error?: string; message?: string };
const fail = (e: unknown): TaskResult => { const s = toFormState(e); return { ok: false, error: s.fields ? `${s.error} ${Object.values(s.fields).join(' ')}` : s.error }; };
const refresh = (caseNumber?: string | null) => { for (const p of ['/admin/aufgaben', '/admin/wiedervorlagen', '/admin/heute', '/admin']) revalidatePath(p); if (caseNumber) revalidatePath(`/admin/faelle/${caseNumber}`); };

export async function createTaskAction(input: { task: TaskInput; caseNumber?: string | null }): Promise<TaskResult> {
  try { const user = await authorize('tasks.write.all', 'tasks.write.own'); const t = await createTask(user, input.task); refresh(input.caseNumber); return { ok: true, message: t.kind === 'FOLLOW_UP' ? 'Wiedervorlage angelegt.' : 'Aufgabe angelegt.' }; } catch (e) { return fail(e); }
}
export async function updateTaskAction(input: { id: string; task: TaskInput; caseNumber?: string | null }): Promise<TaskResult> {
  try { const user = await authorize('tasks.write.all', 'tasks.write.own'); await updateTask(user, String(input.id), input.task); refresh(input.caseNumber); return { ok: true, message: 'Gespeichert.' }; } catch (e) { return fail(e); }
}
export async function completeTaskAction(input: { id: string; caseNumber?: string | null }): Promise<TaskResult> {
  try { const user = await authorize('tasks.write.all', 'tasks.write.own'); await completeTask(user, String(input.id)); refresh(input.caseNumber); return { ok: true, message: 'Erledigt.' }; } catch (e) { return fail(e); }
}
export async function reopenTaskAction(input: { id: string; caseNumber?: string | null }): Promise<TaskResult> {
  try { const user = await authorize('tasks.write.all', 'tasks.write.own'); await reopenTask(user, String(input.id)); refresh(input.caseNumber); return { ok: true, message: 'Wieder geöffnet.' }; } catch (e) { return fail(e); }
}
export async function snoozeTaskAction(input: { id: string; days?: number; date?: string; caseNumber?: string | null }): Promise<TaskResult> {
  try { const user = await authorize('tasks.write.all', 'tasks.write.own'); const to = await snoozeTask(user, String(input.id), { days: input.days, date: input.date }); refresh(input.caseNumber); return { ok: true, message: `Verschoben auf ${to.split('-').reverse().join('.')}.` }; } catch (e) { return fail(e); }
}
export async function cancelTaskAction(input: { id: string; caseNumber?: string | null }): Promise<TaskResult> {
  try { const user = await authorize('tasks.write.all', 'tasks.write.own'); await cancelTask(user, String(input.id)); refresh(input.caseNumber); return { ok: true, message: 'Aufgabe abgebrochen.' }; } catch (e) { return fail(e); }
}
export async function markReadAction(input: { id?: string }): Promise<TaskResult> {
  try { const user = await requireUser(); await markNotificationsRead(user, input.id); revalidatePath('/admin/aufgaben'); revalidatePath('/admin'); return { ok: true }; } catch (e) { return fail(e); }
}
