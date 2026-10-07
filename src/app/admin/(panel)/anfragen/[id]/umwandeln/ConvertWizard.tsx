'use client';

import { useActionState, useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { Field, Notice } from '@/components/admin/ui';
import type { FormState } from '@/server/admin/form';
import { CLAIM_LABELS, FUEL_LABELS, PRIORITY_LABELS, SERVICE_LABELS } from '@/lib/workflow';
import { convertLeadAction } from '../actions';
import { VehicleIdentify, recordToVehicleValues } from '@/components/admin/VehicleIdentify';

type Existing = { id: string; label: string; vehicles: { id: string; label: string }[] };
const STEPS = ['Kunde', 'Fahrzeug', 'Fall', 'Prüfen', 'Umwandeln'] as const;

/** Muss AUSSERHALB der Wizard-Komponente stehen: eine im Render definierte Komponente wäre bei jedem Re-Render ein neuer Typ,
 *  React würde alle Eingabefelder neu aufbauen und die Eingaben verlieren. */
function Step({ n, current, children }: { n: number; current: number; children: ReactNode }) {
  return (
    <div data-step={n} hidden={current !== n} className="grid gap-4">
      {children}
    </div>
  );
}

/**
 * Fünf Schritte, EIN Formular: Alle Eingaben bleiben im selben <form>, Schritte blenden nur um.
 * Abgesendet wird erst im letzten Schritt – über startTransition statt <form action>, damit React
 * das Formular nach einem Fehler nicht zurücksetzt (sonst gingen alle Eingaben verloren).
 */
export function ConvertWizard({ leadId, existing, experts, canAssign, init, refs, canIdentify = false }: { canIdentify?: boolean; leadId: string; existing: Existing[]; experts: { id: string; name: string }[]; canAssign: boolean; init: Record<string, string>; refs: { locations: { id: string; name: string }[]; insurances: { id: string; name: string }[] } }) {
  const [state, action, pending] = useActionState<FormState, FormData>(convertLeadAction, {});
  const [, startTransition] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(1);
  const [customerMode, setCustomerMode] = useState<'new' | 'existing'>('new');
  const [vehicleMode, setVehicleMode] = useState<'new' | 'existing'>('new');
  const [customerId, setCustomerId] = useState(existing[0]?.id ?? '');
  const [summary, setSummary] = useState<[string, string][]>([]);
  // Übernahme aus der HSN/TSN-Identifikation (füllt die Fahrzeugfelder; `stamp` baut die Felder neu auf)
  const [ov, setOv] = useState<Record<string, string>>({});
  const [stamp, setStamp] = useState(0);
  const f = state.fields ?? {};

  // Fehler vom Server → zum ersten betroffenen Schritt springen.
  useEffect(() => {
    const keys = Object.keys(state.fields ?? {});
    if (!keys.length) return;
    const first = keys.find((k) => k.startsWith('c_') || k === 'customerId') ? 1 : keys.find((k) => k.startsWith('v_') || k === 'vehicleId') ? 2 : 3;
    setStep(first);
  }, [state]);

  const vehiclesOfCustomer = existing.find((c) => c.id === customerId)?.vehicles ?? [];
  const section = (n: number) => form.current?.querySelector<HTMLElement>(`[data-step="${n}"]`);

  const validate = (n: number) => {
    const fields = section(n)?.querySelectorAll<HTMLInputElement>('input,select,textarea') ?? [];
    for (const el of Array.from(fields)) {
      if (el.disabled) continue;
      if (!el.checkValidity()) {
        el.reportValidity();
        return false;
      }
    }
    return true;
  };

  const collect = () => {
    const fd = new FormData(form.current!);
    const g = (k: string) => String(fd.get(k) ?? '').trim();
    const rows: [string, string][] = [];
    if (customerMode === 'existing') rows.push(['Kunde', `Bestehender Kunde: ${existing.find((c) => c.id === g('customerId'))?.label ?? '–'}`]);
    else rows.push(['Kunde', [g('c_company'), `${g('c_firstName')} ${g('c_lastName')}`.trim(), g('c_email'), g('c_phone'), [g('c_street'), `${g('c_postalCode')} ${g('c_city')}`.trim()].filter(Boolean).join(', ')].filter(Boolean).join(' · ')]);
    if (vehicleMode === 'existing') rows.push(['Fahrzeug', `Bestehendes Fahrzeug: ${vehiclesOfCustomer.find((v) => v.id === g('vehicleId'))?.label ?? '–'}`]);
    else rows.push(['Fahrzeug', [`${g('v_manufacturer')} ${g('v_model')} ${g('v_variant')}`.trim(), g('v_licensePlate'), g('v_vin') && `FIN ${g('v_vin')}`, g('v_fuelType') && FUEL_LABELS[g('v_fuelType')]].filter(Boolean).join(' · ')]);
    rows.push(['Fall', [SERVICE_LABELS[g('k_serviceType')], g('k_inspectionLocation'), g('k_insuranceName') && `Versicherung ${g('k_insuranceName')}`, g('k_assignedExpertId') ? `Sachverständiger: ${experts.find((e) => e.id === g('k_assignedExpertId'))?.name}` : 'Noch kein Sachverständiger'].filter(Boolean).join(' · ')]);
    return rows;
  };

  const next = () => {
    if (!validate(step)) return;
    if (step === 3) setSummary(collect());
    setStep((s) => Math.min(5, s + 1));
  };

  const val = (k: string) => (k.startsWith('v_') && ov[k.slice(2)] !== undefined ? ov[k.slice(2)] : undefined) ?? state.values?.[k] ?? init[k] ?? '';
  const text = (name: string, label: string, extra: Record<string, unknown> = {}) => (
    <Field label={label} error={f[name]}>
      <input key={`${name}-${stamp}`} name={name} defaultValue={val(name)} className="adm-input" aria-invalid={Boolean(f[name])} autoComplete="off" {...extra} />
    </Field>
  );
  return (
    <form
      ref={form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (step < 5) return next();
        startTransition(() => action(new FormData(e.currentTarget)));
      }}
      className="max-w-[760px]"
    >
      <input type="hidden" name="id" value={leadId} />
      <input type="hidden" name="customerMode" value={customerMode} />
      <input type="hidden" name="vehicleMode" value={vehicleMode} />

      <ol className="adm-steps" aria-label="Fortschritt">
        {STEPS.map((s, i) => (
          <li key={s} className="adm-step" aria-current={step === i + 1 ? 'step' : undefined} data-done={step > i + 1}>
            <b>0{i + 1}</b>
            {s}
          </li>
        ))}
      </ol>

      {state.error && <div className="mb-4"><Notice tone="error">{state.error}</Notice></div>}

      <div className="adm-card">
        <Step current={step} n={1}>
          <h2 className="font-display text-[1.15rem] font-semibold">Kunde</h2>
          {existing.length > 0 && (
            <fieldset className="grid gap-2 rounded-[10px] border border-line/70 p-3">
              <legend className="adm-label px-1">Möglicher bestehender Kunde</legend>
              <label className="flex items-center gap-2.5 text-[.92rem]"><input type="radio" checked={customerMode === 'new'} onChange={() => { setCustomerMode('new'); setVehicleMode('new'); }} className="accent-[#1f6fe0]" /> Neuer Kunde</label>
              <label className="flex items-center gap-2.5 text-[.92rem]"><input type="radio" checked={customerMode === 'existing'} onChange={() => setCustomerMode('existing')} className="accent-[#1f6fe0]" /> Bestehenden Kunden verwenden (nichts wird überschrieben)</label>
              {customerMode === 'existing' && (
                <Field label="Kunde" error={f.customerId}>
                  <select name="customerId" value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="adm-input" required>
                    {existing.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </Field>
              )}
            </fieldset>
          )}
          <fieldset disabled={customerMode === 'existing'} className="m-0 grid gap-4 border-0 p-0 disabled:opacity-40">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Art" error={f.c_type}>
                <select name="c_type" defaultValue={val('c_type') || 'PRIVATE'} className="adm-input"><option value="PRIVATE">Privatkunde</option><option value="BUSINESS">Firmenkunde</option></select>
              </Field>
              {text('c_company', 'Firma (bei Firmenkunden)')}
              {text('c_firstName', 'Vorname')}
              {text('c_lastName', 'Nachname', { required: true })}
              {text('c_email', 'E-Mail', { type: 'email' })}
              {text('c_phone', 'Telefon', { inputMode: 'tel' })}
              {text('c_street', 'Straße und Hausnummer')}
              <div className="grid grid-cols-[110px_1fr] gap-3">
                {text('c_postalCode', 'PLZ', { inputMode: 'numeric', maxLength: 10 })}
                {text('c_city', 'Ort')}
              </div>
            </div>
          </fieldset>
        </Step>

        <Step current={step} n={2}>
          <h2 className="font-display text-[1.15rem] font-semibold">Fahrzeug</h2>
          {customerMode === 'existing' && vehiclesOfCustomer.length > 0 && (
            <fieldset className="grid gap-2 rounded-[10px] border border-line/70 p-3">
              <legend className="adm-label px-1">Fahrzeuge dieses Kunden</legend>
              <label className="flex items-center gap-2.5 text-[.92rem]"><input type="radio" checked={vehicleMode === 'new'} onChange={() => setVehicleMode('new')} className="accent-[#1f6fe0]" /> Neues Fahrzeug erfassen</label>
              <label className="flex items-center gap-2.5 text-[.92rem]"><input type="radio" checked={vehicleMode === 'existing'} onChange={() => setVehicleMode('existing')} className="accent-[#1f6fe0]" /> Bestehendes Fahrzeug verwenden</label>
              {vehicleMode === 'existing' && (
                <Field label="Fahrzeug" error={f.vehicleId}>
                  <select key={customerId} name="vehicleId" className="adm-input" required defaultValue={vehiclesOfCustomer[0]?.id}>
                    {vehiclesOfCustomer.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </select>
                </Field>
              )}
            </fieldset>
          )}
          <fieldset disabled={vehicleMode === 'existing'} className="m-0 grid gap-4 border-0 p-0 disabled:opacity-40">
            {canIdentify && vehicleMode === 'new' && (
              <details className="vi-embedded" open>
                <summary><span aria-hidden>🔎</span> Fahrzeug per HSN/TSN, FIN oder Fahrzeugschein identifizieren{ov.hsnTsnId ? <span className="adm-badge adm-badge-ok">übernommen: {ov.manufacturer} {ov.model}</span> : null}</summary>
                <VehicleIdentify variant="embedded" onApply={(r) => { setOv((cur) => ({ ...cur, ...recordToVehicleValues(r) })); setStamp((n) => n + 1); }} />
              </details>
            )}
            {(['hsnTsnId', 'powerKw', 'powerHp', 'displacementCc', 'engineName', 'bodyStyle', 'driveType', 'transmission', 'vehicleClass'] as const).map((k) => <input key={`${k}-${stamp}`} type="hidden" name={`v_${k}`} defaultValue={val(`v_${k}`)} />)}
            <div className="grid gap-4 sm:grid-cols-2">
              {text('v_hsn', 'HSN (Feld 2.1)', { maxLength: 4, placeholder: '0588', autoCapitalize: 'characters' })}
              {text('v_tsn', 'TSN (Feld 2.2)', { maxLength: 4, placeholder: 'ABC', autoCapitalize: 'characters' })}
              {text('v_manufacturer', 'Hersteller', { required: true })}
              {text('v_model', 'Modell', { required: true })}
              {text('v_variant', 'Variante')}
              {text('v_licensePlate', 'Kennzeichen', { placeholder: 'H-AB 123', autoCapitalize: 'characters' })}
              {text('v_vin', 'Fahrgestellnummer (optional)', { autoCapitalize: 'characters', maxLength: 30 })}
              {text('v_firstRegistration', 'Erstzulassung', { type: 'date' })}
              {text('v_mileage', 'Kilometerstand', { inputMode: 'numeric' })}
              <Field label="Antrieb" error={f.v_fuelType}>
                <select key={`fuel-${stamp}`} name="v_fuelType" defaultValue={val('v_fuelType')} className="adm-input">
                  <option value="">Unbekannt</option>
                  {Object.entries(FUEL_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </Field>
              {text('v_color', 'Farbe')}
            </div>
          </fieldset>
        </Step>

        <Step current={step} n={3}>
          <h2 className="font-display text-[1.15rem] font-semibold">Fall</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Gutachtenart" error={f.k_serviceType}>
              <select name="k_serviceType" defaultValue={val('k_serviceType')} className="adm-input">
                {Object.entries(SERVICE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            {canAssign ? (
              <Field label="Sachverständiger" error={f.k_assignedExpertId}>
                <select name="k_assignedExpertId" defaultValue={val('k_assignedExpertId')} className="adm-input">
                  <option value="">Später zuweisen</option>
                  {experts.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </Field>
            ) : <input type="hidden" name="k_assignedExpertId" value="" />}
            <Field label="Schadenart" error={f.k_claimType}>
              <select name="k_claimType" defaultValue={val('k_claimType')} className="adm-input"><option value="">Nicht festgelegt</option>{Object.entries(CLAIM_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </Field>
            <Field label="Priorität" error={f.k_priority}>
              <select name="k_priority" defaultValue={val('k_priority') || 'NORMAL'} className="adm-input">{Object.entries(PRIORITY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </Field>
            {refs.locations.length > 0 && (
              <Field label="Standort" error={f.k_locationId}>
                <select name="k_locationId" defaultValue={val('k_locationId')} className="adm-input"><option value="">Automatisch</option>{refs.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
              </Field>
            )}
            {refs.insurances.length > 0 && (
              <Field label="Versicherung (Stammdaten)" error={f.k_insuranceOrgId}>
                <select name="k_insuranceOrgId" defaultValue={val('k_insuranceOrgId')} className="adm-input"><option value="">Keine Auswahl</option>{refs.insurances.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
              </Field>
            )}
            {text('k_inspectionLocation', 'Besichtigungsort')}
            {text('k_damageDate', 'Schadendatum', { type: 'date' })}
            {text('k_accidentDate', 'Unfalldatum', { type: 'date' })}
            {text('k_insuranceName', 'Versicherung')}
            {text('k_insuranceClaimNumber', 'Schadennummer')}
            {text('k_opposingInsurance', 'Gegnerische Versicherung')}
            {text('k_lawyer', 'Rechtsanwalt')}
            {text('k_repairShop', 'Werkstatt')}
          </div>
          <Field label="Beschreibung" error={f.k_description}>
            <textarea name="k_description" rows={4} defaultValue={val('k_description')} className="adm-input" maxLength={5000} />
          </Field>
        </Step>

        <Step current={step} n={4}>
          <h2 className="font-display text-[1.15rem] font-semibold">Prüfen</h2>
          <dl className="adm-kv !grid-cols-1 m-0">
            {summary.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || '–'}</dd></div>)}
          </dl>
          <p className="text-[.85rem] text-fg-mute">Stimmt etwas nicht, zurück zum jeweiligen Schritt. Die Originalangaben der Anfrage bleiben in jedem Fall unverändert erhalten.</p>
        </Step>

        <Step current={step} n={5}>
          <h2 className="font-display text-[1.15rem] font-semibold">Umwandeln</h2>
          <p className="text-[.95rem] text-fg-dim">Jetzt werden Kunde, Fahrzeug und Fall angelegt und die Fallnummer vergeben – in einem Schritt: Gelingt etwas nicht, wird nichts angelegt. Die Anfrage bleibt erhalten und verweist auf den neuen Fall.</p>
          <ul className="grid gap-1 text-[.9rem]">{summary.map(([k, v]) => <li key={k}><b>{k}:</b> <span className="text-fg-dim">{v || '–'}</span></li>)}</ul>
        </Step>
      </div>

      <div className="mt-5 flex flex-wrap justify-between gap-3">
        <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1 || pending}>Zurück</button>
        {step < 5 ? (
          <button type="button" className="adm-btn" onClick={next}>Weiter</button>
        ) : (
          <button type="submit" className="adm-btn" disabled={pending}>{pending ? 'Wird angelegt …' : 'Jetzt umwandeln'}</button>
        )}
      </div>
    </form>
  );
}
