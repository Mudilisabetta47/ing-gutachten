'use client';

import { useActionState } from 'react';
import { Field } from './ui';
import { FormError, SubmitRow, useFormFeedback, type Act } from './forms';
import type { FormState } from '@/server/admin/form';

type Vals = Record<string, string | null | undefined>;

/** Stammdaten-Formular (Versicherung, Kanzlei, Werkstatt, Autohaus, Partner). Werkstätten haben zusätzlich ihre Konditionen. */
export function OrganizationForm({ action, slug, workshop, id, initial = {}, submitLabel, bare = false }: { action: Act; slug: string; workshop: boolean; id?: string; initial?: Vals; submitLabel: string; bare?: boolean }) {
  const [state, run, pending] = useActionState<FormState, FormData>(action, {});
  useFormFeedback(state);
  const f = state.fields ?? {};
  const v = (k: string) => state.values?.[k] ?? initial[k] ?? '';
  const inp = (name: string, label: string, extra: Record<string, unknown> & { hint?: string } = {}) => {
    const { hint, ...rest } = extra;
    return (
      <Field label={label} error={f[name]} hint={hint}>
        <input name={name} defaultValue={v(name)} className="adm-input" aria-invalid={Boolean(f[name])} autoComplete="off" {...rest} />
      </Field>
    );
  };
  return (
    <form action={run} className={bare ? '' : 'adm-panel'} style={bare ? undefined : { maxWidth: 820 }} noValidate>
      <input type="hidden" name="kind" value={slug} />
      {id && <input type="hidden" name="id" value={id} />}
      <fieldset className="adm-fgroup" style={{ border: 0, margin: 0, minWidth: 0 }}>
        <h3>Stammdaten</h3>
        <div className="adm-form-grid">
          <div className="span-2">{inp('name', 'Name', { required: true, maxLength: 160 })}</div>
          {inp('contactName', 'Ansprechpartner')}
          {inp('phone', 'Telefon', { type: 'tel' })}
          {inp('email', 'E-Mail', { type: 'email' })}
          {inp('fax', 'Fax')}
        </div>
      </fieldset>
      <fieldset className="adm-fgroup" style={{ border: 0, margin: 0, minWidth: 0 }}>
        <h3>Adresse</h3>
        <div className="adm-form-grid">
          <div className="span-2">{inp('street', 'Straße und Hausnummer')}</div>
          {inp('postalCode', 'PLZ', { inputMode: 'numeric', maxLength: 10 })}
          {inp('city', 'Ort')}
        </div>
      </fieldset>
      {(slug === 'versicherungen' || slug === 'rechtsanwaelte') && (
        <fieldset className="adm-fgroup" style={{ border: 0, margin: 0, minWidth: 0 }}>
          <h3>{slug === 'versicherungen' ? 'Schadenservice' : 'Kanzlei'}</h3>
          <div className="adm-form-grid">
            {inp('claimsEmail', slug === 'versicherungen' ? 'E-Mail Schadenservice' : 'E-Mail Sekretariat', { type: 'email' })}
            {inp('portalUrl', 'Portal-Link', { placeholder: 'https://…' })}
          </div>
        </fieldset>
      )}
      {workshop && (
        <fieldset className="adm-fgroup" style={{ border: 0, margin: 0, minWidth: 0 }}>
          <h3>Konditionen</h3>
          <p>Stundensätze netto je Stunde. Sie werden in der Kalkulation als Vorschlag verwendet.</p>
          <div className="adm-form-grid">
            {inp('rateBodyCents', 'Karosserie (€/h)', { inputMode: 'decimal', placeholder: '185,00' })}
            {inp('rateMechanicCents', 'Mechanik (€/h)', { inputMode: 'decimal', placeholder: '175,00' })}
            {inp('rateElectricCents', 'Elektrik (€/h)', { inputMode: 'decimal', placeholder: '195,00' })}
            {inp('ratePaintCents', 'Lack (€/h)', { inputMode: 'decimal', placeholder: '190,00' })}
            {inp('shippingCents', 'Verbringungskosten (€)', { inputMode: 'decimal' })}
            {inp('partsMarkupBp', 'Ersatzteilaufschlag (%)', { inputMode: 'decimal', placeholder: '10' })}
            {inp('paintMaterialBp', 'Lackmaterial (% vom Lacklohn)', { inputMode: 'decimal', placeholder: '45' })}
          </div>
        </fieldset>
      )}
      <fieldset className="adm-fgroup" style={{ border: 0, margin: 0, minWidth: 0 }}>
        <h3>Notizen</h3>
        <Field label="Interne Hinweise" error={f.notes}><textarea name="notes" rows={4} defaultValue={v('notes')} className="adm-input" maxLength={4000} /></Field>
      </fieldset>
      <FormError state={state} />
      <SubmitRow pending={pending} label={submitLabel} />
    </form>
  );
}
