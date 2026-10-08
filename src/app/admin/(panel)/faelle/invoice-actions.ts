'use server';

import { revalidatePath } from 'next/cache';
import { authorize } from '@/server/auth/guards';
import { toFormState } from '@/server/admin/form';
import { addPayment, archiveService, cancelDunning, cancelInvoice, createDunning, createInvoice, deleteDraft, issueDunning, issueInvoice, reversePayment, saveInvoice, saveService, type DraftInput } from '@/server/pipeline/invoices';

export type InvResult = { ok: boolean; error?: string; message?: string; id?: string };
const fail = (e: unknown): InvResult => { const s = toFormState(e); return { ok: false, error: s.fields ? `${s.error} ${Object.values(s.fields).join(' ')}` : s.error }; };
const refresh = (nr?: string | null) => { if (nr) revalidatePath(`/admin/faelle/${nr}`); for (const p of ['/admin/rechnungen', '/admin/zahlungen', '/admin/mahnwesen', '/admin']) revalidatePath(p); };

export async function createInvoiceAction(input: { caseId: string; caseNumber: string; recipientKey?: string }): Promise<InvResult> {
  try { const user = await authorize('invoices.write'); const r = await createInvoice(user, { caseId: String(input.caseId), recipientKey: input.recipientKey }); refresh(input.caseNumber); return { ok: true, id: r.id, message: 'Rechnungsentwurf angelegt.' }; } catch (e) { return fail(e); }
}
export async function saveInvoiceAction(input: { id: string; caseNumber?: string | null; draft: DraftInput }): Promise<InvResult> {
  try { const user = await authorize('invoices.write'); await saveInvoice(user, String(input.id), input.draft); refresh(input.caseNumber); return { ok: true, message: 'Entwurf gespeichert.' }; } catch (e) { return fail(e); }
}
export async function deleteDraftAction(input: { id: string; caseNumber?: string | null }): Promise<InvResult> {
  try { const user = await authorize('invoices.write'); await deleteDraft(user, String(input.id)); refresh(input.caseNumber); return { ok: true, message: 'Entwurf gelöscht.' }; } catch (e) { return fail(e); }
}
export async function issueInvoiceAction(input: { id: string; caseNumber?: string | null; draft: DraftInput }): Promise<InvResult> {
  try {
    const user = await authorize('invoices.write');
    await saveInvoice(user, String(input.id), input.draft); // aktueller Stand wird zuerst gespeichert
    const r = await issueInvoice(user, String(input.id));
    refresh(input.caseNumber); return { ok: true, id: r.id, message: `Rechnung ${r.number} ausgestellt.` };
  } catch (e) { return fail(e); }
}
export async function cancelInvoiceAction(input: { id: string; caseNumber?: string | null; reason: string }): Promise<InvResult> {
  try { const user = await authorize('invoices.write'); await cancelInvoice(user, String(input.id), input.reason); refresh(input.caseNumber); return { ok: true, message: 'Rechnung storniert.' }; } catch (e) { return fail(e); }
}
export async function addPaymentAction(input: { id: string; caseNumber?: string | null; amountCents: number; paidOn: string; method: string; reference?: string; note?: string }): Promise<InvResult> {
  try {
    const user = await authorize('payments.write');
    const r = await addPayment(user, String(input.id), { amountCents: input.amountCents, paidOn: input.paidOn, method: input.method, reference: input.reference, note: input.note });
    refresh(input.caseNumber); return { ok: true, message: r.fullyPaid ? (r.caseClosed ? 'Rechnung vollständig bezahlt – Fall abgeschlossen.' : 'Rechnung vollständig bezahlt.') : 'Zahlung erfasst.' };
  } catch (e) { return fail(e); }
}
export async function reversePaymentAction(input: { id: string; caseNumber?: string | null; reason: string }): Promise<InvResult> {
  try { const user = await authorize('payments.write'); await reversePayment(user, String(input.id), input.reason); refresh(input.caseNumber); return { ok: true, message: 'Zahlung storniert.' }; } catch (e) { return fail(e); }
}
export async function createDunningAction(input: { invoiceId: string; caseNumber?: string | null; feeCents?: number; interestCents?: number; dueInDays?: number; text?: string }): Promise<InvResult> {
  try { const user = await authorize('dunning.write'); const r = await createDunning(user, String(input.invoiceId), { feeCents: input.feeCents, interestCents: input.interestCents, dueInDays: input.dueInDays, text: input.text }); refresh(input.caseNumber); return { ok: true, id: r.id, message: 'Mahnungsentwurf angelegt – bitte prüfen und ausstellen.' }; } catch (e) { return fail(e); }
}
export async function issueDunningAction(input: { id: string; caseNumber?: string | null }): Promise<InvResult> {
  try { const user = await authorize('dunning.write'); await issueDunning(user, String(input.id)); refresh(input.caseNumber); return { ok: true, message: 'Mahnung ausgestellt. Der Versand erfolgt bewusst manuell.' }; } catch (e) { return fail(e); }
}
export async function cancelDunningAction(input: { id: string; caseNumber?: string | null }): Promise<InvResult> {
  try { const user = await authorize('dunning.write'); await cancelDunning(user, String(input.id)); refresh(input.caseNumber); return { ok: true, message: 'Mahnung storniert.' }; } catch (e) { return fail(e); }
}
export async function saveServiceAction(input: { id?: string | null; name: string; description?: string; unit?: string; unitPriceCents: number; vatBp: number }): Promise<InvResult> {
  try { const user = await authorize('invoices.write'); await saveService(user, input.id ?? null, { name: input.name, description: input.description, unit: input.unit, unitPriceCents: input.unitPriceCents, vatBp: input.vatBp }); revalidatePath('/admin/leistungen'); return { ok: true, message: 'Leistung gespeichert.' }; } catch (e) { return fail(e); }
}
export async function archiveServiceAction(input: { id: string }): Promise<InvResult> {
  try { const user = await authorize('invoices.write'); await archiveService(user, String(input.id)); revalidatePath('/admin/leistungen'); return { ok: true, message: 'Leistung archiviert.' }; } catch (e) { return fail(e); }
}
