'use client';

import { useActionState } from 'react';
import { Field, Notice } from '@/components/admin/ui';
import type { FormState } from '@/server/admin/form';
import { saveNumberingAction, saveUploadsAction } from './actions';

function Result({ state }: { state: FormState }) {
  return (
    <div aria-live="polite">
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.ok && state.message ? <Notice tone="ok">{state.message}</Notice> : null}
    </div>
  );
}

export function NumberingForm({ value, readOnly }: { value: { casePrefix: string; caseDigits: number; invoicePrefix: string; invoiceDigits: number }; readOnly: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveNumberingAction, {});
  const f = state.fields ?? {};
  return (
    <form action={action} className="adm-card grid gap-4" noValidate>
      <h2 className="font-display text-[1.1rem] font-semibold">Nummernkreise</h2>
      <p className="text-[.88rem] text-fg-mute">Beispiel Fallnummer: {value.casePrefix}-{new Date().getFullYear()}-{'0'.repeat(Math.max(0, value.caseDigits - 1))}1. Gilt für neu angelegte Vorgänge.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Präfix Fälle" error={f.casePrefix}>
          <input name="casePrefix" defaultValue={state.values?.casePrefix ?? value.casePrefix} className="adm-input" disabled={readOnly} />
        </Field>
        <Field label="Stellen Fälle" error={f.caseDigits}>
          <input name="caseDigits" type="number" min={3} max={8} defaultValue={state.values?.caseDigits ?? value.caseDigits} className="adm-input" disabled={readOnly} />
        </Field>
        <Field label="Präfix Rechnungen" error={f.invoicePrefix}>
          <input name="invoicePrefix" defaultValue={state.values?.invoicePrefix ?? value.invoicePrefix} className="adm-input" disabled={readOnly} />
        </Field>
        <Field label="Stellen Rechnungen" error={f.invoiceDigits}>
          <input name="invoiceDigits" type="number" min={3} max={8} defaultValue={state.values?.invoiceDigits ?? value.invoiceDigits} className="adm-input" disabled={readOnly} />
        </Field>
      </div>
      <Result state={state} />
      {!readOnly && (
        <div>
          <button type="submit" className="adm-btn" disabled={pending}>
            {pending ? 'Speichert …' : 'Speichern'}
          </button>
        </div>
      )}
    </form>
  );
}

export function UploadsForm({ value, readOnly }: { value: { maxPhotoMb: number; maxDocumentMb: number; maxFilesPerUpload: number }; readOnly: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveUploadsAction, {});
  const f = state.fields ?? {};
  return (
    <form action={action} className="adm-card grid gap-4" noValidate>
      <h2 className="font-display text-[1.1rem] font-semibold">Datei-Limits</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Foto max. (MB)" error={f.maxPhotoMb}>
          <input name="maxPhotoMb" type="number" step="0.5" min={1} max={50} defaultValue={state.values?.maxPhotoMb ?? value.maxPhotoMb} className="adm-input" disabled={readOnly} />
        </Field>
        <Field label="Dokument max. (MB)" error={f.maxDocumentMb}>
          <input name="maxDocumentMb" type="number" step="0.5" min={1} max={100} defaultValue={state.values?.maxDocumentMb ?? value.maxDocumentMb} className="adm-input" disabled={readOnly} />
        </Field>
        <Field label="Dateien je Upload" error={f.maxFilesPerUpload}>
          <input name="maxFilesPerUpload" type="number" min={1} max={50} defaultValue={state.values?.maxFilesPerUpload ?? value.maxFilesPerUpload} className="adm-input" disabled={readOnly} />
        </Field>
      </div>
      <Result state={state} />
      {!readOnly && (
        <div>
          <button type="submit" className="adm-btn" disabled={pending}>
            {pending ? 'Speichert …' : 'Speichern'}
          </button>
        </div>
      )}
    </form>
  );
}
