'use client';

import { useActionState } from 'react';
import { Field, Notice } from '@/components/admin/ui';
import type { FormState } from '@/server/admin/form';
import { saveCompanyAction, saveNumberingAction, saveUploadsAction } from './actions';

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

type Company = { name: string; street: string; postalCode: string; city: string; phone: string; email: string; website: string; taxId: string; bank: string; footer: string };
export function CompanyForm({ value, readOnly }: { value: Company; readOnly: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveCompanyAction, {});
  const f = state.fields ?? {};
  const v = (k: keyof Company) => state.values?.[k] ?? value[k];
  const row = (k: keyof Company, label: string, extra?: { hint?: string; area?: boolean }) => (
    <Field label={label} error={f[k]} hint={extra?.hint}>
      {extra?.area ? <textarea name={k} rows={2} defaultValue={v(k)} className="adm-input" disabled={readOnly} /> : <input name={k} defaultValue={v(k)} className="adm-input" disabled={readOnly} />}
    </Field>
  );
  return (
    <form action={action} className="adm-card grid gap-4" noValidate>
      <h2 className="font-display text-[1.1rem] font-semibold">Unternehmensdaten</h2>
      <p className="text-[.88rem] text-fg-mute">Erscheinen auf Rechnungen und Mahnungen. Ohne Name, Anschrift und Steuernummer lässt sich keine Rechnung ausstellen.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {row('name', 'Firmenname')}
        {row('taxId', 'Steuernummer / USt-IdNr.')}
        {row('street', 'Straße und Hausnummer')}
        <div className="grid gap-4" style={{ gridTemplateColumns: '110px 1fr' }}>{row('postalCode', 'PLZ')}{row('city', 'Ort')}</div>
        {row('phone', 'Telefon')}
        {row('email', 'E-Mail')}
        {row('website', 'Website')}
        {row('bank', 'Bankverbindung (IBAN, BIC, Bank)')}
      </div>
      {row('footer', 'Fußzeile (optional)', { area: true })}
      <Result state={state} />
      {!readOnly && <div><button type="submit" className="adm-btn" disabled={pending}>{pending ? 'Speichert …' : 'Speichern'}</button></div>}
    </form>
  );
}
