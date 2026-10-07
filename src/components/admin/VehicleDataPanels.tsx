'use client';

import { useActionState, useState } from 'react';
import { AdminIcon } from './AdminIcon';
import { useToast } from './Toast';
import { Field } from './ui';
import { FormError, SubmitRow, useFormFeedback } from './forms';
import { confirmFieldAction, saveRegistrationAction, setVinAction } from '@/app/admin/(panel)/fahrzeuge/actions';
import { FUEL_LABELS, validateVin } from '@/lib/vehicle-data';
import type { FormState } from '@/server/admin/form';

/** FIN ergänzen: prüft sofort (17 Zeichen, kein I/O/Q) und speichert mit Historie. */
export function VinForm({ vehicleId, current }: { vehicleId: string; current: string | null }) {
  const toast = useToast();
  const [vin, setVin] = useState(current ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const check = validateVin(vin);
  const dirty = vin !== (current ?? '');
  const save = async () => {
    setBusy(true); setErr(null);
    const out = await setVinAction(vehicleId, vin);
    setBusy(false);
    if (out.ok) toast(out.message ?? 'Gespeichert.', 'ok'); else setErr(out.error ?? 'Das hat nicht geklappt.');
  };
  return (
    <div style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
      <label className="adm-field"><span className="adm-label">Fahrgestellnummer (FIN / VIN)</span>
        <input className="adm-input mono" value={vin} onChange={(e) => setVin(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 17))} placeholder="17 Zeichen" autoComplete="off" spellCheck={false} aria-invalid={vin.length >= 17 && Boolean(check.error)} />
      </label>
      <div className="t-3" style={{ fontSize: 12.5 }}>{vin.length === 0 ? 'Noch keine FIN erfasst.' : vin.length < 17 ? `${vin.length}/17 Zeichen` : check.error ?? `Formal gültig · Hersteller-Kennung (WMI) ${check.wmi}`}</div>
      {err && <div className="adm-alert adm-alert-danger" role="alert"><AdminIcon name="alert" />{err}</div>}
      <div><button type="button" className="adm-btn" disabled={busy || !dirty || !check.value} onClick={save}>{busy ? 'Speichert …' : current ? 'FIN ändern' : 'FIN ergänzen'}</button></div>
    </div>
  );
}

/** Der Gutachter bestätigt einen Wert (Herkunft → „vom Gutachter bestätigt“). */
export function ConfirmFieldButton({ vehicleId, field }: { vehicleId: string; field: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className="adm-btn adm-btn-ghost" style={{ height: 26, padding: '0 8px', fontSize: 12 }} disabled={busy} onClick={async () => {
      setBusy(true);
      const out = await confirmFieldAction(vehicleId, field);
      setBusy(false);
      toast(out.ok ? out.message ?? 'Bestätigt.' : out.error ?? 'Das hat nicht geklappt.', out.ok ? 'ok' : 'error');
    }}>Bestätigen</button>
  );
}

/** Fahrzeugschein erfassen und mit dem Datensatz abgleichen. */
export function RegistrationForm({ vehicleId, initial }: { vehicleId: string; initial: Record<string, string> }) {
  const [state, run, pending] = useActionState<FormState, FormData>(saveRegistrationAction, {});
  useFormFeedback(state);
  const f = state.fields ?? {};
  const v = (k: string) => state.values?.[k] ?? initial[k] ?? '';
  const inp = (name: string, label: string, extra: Record<string, unknown> = {}) => (
    <Field label={label} error={f[name]}><input name={name} defaultValue={v(name)} className="adm-input" aria-invalid={Boolean(f[name])} autoComplete="off" {...extra} /></Field>
  );
  return (
    <form action={run} className="adm-panel" noValidate>
      <input type="hidden" name="id" value={vehicleId} />
      <p className="vi-hint" style={{ marginBottom: 12 }}>Angaben aus der Zulassungsbescheinigung Teil I. Ein automatisches Auslesen per Foto (OCR) ist noch nicht angebunden.</p>
      <div className="adm-form-grid">
        {inp('hsn', 'HSN (2.1)', { maxLength: 8, className: 'adm-input mono' })}
        {inp('tsn', 'TSN (2.2)', { maxLength: 8, className: 'adm-input mono' })}
        {inp('manufacturer', 'Hersteller (D.1)')}
        {inp('typeCode', 'Typ (D.2)')}
        {inp('variantCode', 'Variante (D.2)')}
        {inp('versionCode', 'Version (D.2)')}
        {inp('vin', 'FIN (E)', { maxLength: 20, className: 'adm-input mono' })}
        {inp('vehicleClass', 'Fahrzeugklasse (J)')}
        {inp('firstRegistration', 'Erstzulassung (B)', { type: 'date' })}
        {inp('displacementCc', 'Hubraum cm³ (P.1)', { inputMode: 'numeric' })}
        {inp('powerKw', 'Leistung kW (P.2)', { inputMode: 'numeric' })}
        <Field label="Kraftstoff (P.3)" error={f.fuel}>
          <select name="fuel" defaultValue={v('fuel')} className="adm-input"><option value="">–</option>{Object.values(FUEL_LABELS).map((l) => <option key={l}>{l}</option>)}</select>
        </Field>
        {inp('seats', 'Sitzplätze (S.1)', { inputMode: 'numeric' })}
        <Field label="Genehmigungsart" error={f.approvalKind}>
          <select name="approvalKind" defaultValue={v('approvalKind')} className="adm-input"><option value="">Nicht bekannt</option><option value="EC_TYPE_APPROVAL">EG-Typgenehmigung</option><option value="ABE">ABE</option><option value="INDIVIDUAL">Einzelgenehmigung</option></select>
        </Field>
        {inp('approvalNumber', 'Genehmigungsnummer')}
      </div>
      <FormError state={state} />
      <SubmitRow pending={pending} label="Speichern und abgleichen" />
    </form>
  );
}
