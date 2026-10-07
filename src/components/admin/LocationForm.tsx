'use client';

import { useActionState } from 'react';
import { Field } from './ui';
import { FormError, SubmitRow, useFormFeedback, type Act } from './forms';
import type { FormState } from '@/server/admin/form';

export function LocationForm({ action, id, initial = {}, submitLabel }: { action: Act; id?: string; initial?: Record<string, string | boolean | null | undefined>; submitLabel: string }) {
  const [state, run, pending] = useActionState<FormState, FormData>(action, {});
  useFormFeedback(state);
  const f = state.fields ?? {};
  const v = (k: string) => String(state.values?.[k] ?? initial[k] ?? '');
  const inp = (name: string, label: string, extra: Record<string, unknown> = {}) => (
    <Field label={label} error={f[name]}>
      <input name={name} defaultValue={v(name)} className="adm-input" aria-invalid={Boolean(f[name])} autoComplete="off" {...extra} />
    </Field>
  );
  return (
    <form action={run} className="adm-fieldset" noValidate>
      {id && <input type="hidden" name="id" value={id} />}
      {inp('name', 'Name', { required: true })}
      {inp('street', 'Straße und Hausnummer')}
      <div className="adm-form-grid">
        {inp('postalCode', 'PLZ', { inputMode: 'numeric', maxLength: 10 })}
        {inp('city', 'Ort')}
        {inp('phone', 'Telefon', { type: 'tel' })}
        {inp('email', 'E-Mail', { type: 'email' })}
      </div>
      {inp('openingHours', 'Öffnungszeiten', { placeholder: 'Mo–Fr 8–17 Uhr' })}
      <label className="adm-check"><input type="checkbox" name="isDefault" defaultChecked={Boolean(initial.isDefault)} /> Hauptstandort (Vorgabe für neue Fälle)</label>
      <FormError state={state} />
      <SubmitRow pending={pending} label={submitLabel} />
    </form>
  );
}
