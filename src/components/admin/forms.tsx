'use client';

import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Field } from './ui';
import { ConfirmModal, useDrawerClose } from './Overlay';
import { useToast } from './Toast';
import type { FormState } from '@/server/admin/form';
import { CLAIM_LABELS, FUEL_LABELS, PRIORITY_LABELS, SERVICE_LABELS } from '@/lib/workflow';
import { VehicleIdentify, recordToVehicleValues } from './VehicleIdentify';

export type Act = (prev: FormState, fd: FormData) => Promise<FormState>;

/** Erfolg → Toast (und Drawer schließen); Fehler bleiben sichtbar direkt am Formular. */
export function useFormFeedback(state: FormState) {
  const toast = useToast();
  const close = useDrawerClose();
  const last = useRef<FormState | null>(null);
  useEffect(() => {
    if (last.current === state) return;
    last.current = state;
    if (state.ok && state.message) {
      toast(state.message, 'ok');
      close();
    }
  }, [state, toast, close]);
}

export const FormError = ({ state }: { state: FormState }) =>
  state.error ? <div aria-live="polite"><Alert tone="danger">{state.error}</Alert></div> : <div aria-live="polite" />;

export function SubmitRow({ pending, label, busy = 'Speichert …', secondary }: { pending: boolean; label: string; busy?: string; secondary?: ReactNode }) {
  return (
    <div className="adm-actions" style={{ marginTop: 4 }}>
      <button type="submit" className="adm-btn" disabled={pending} aria-busy={pending}>{pending ? busy : label}</button>
      {secondary}
    </div>
  );
}

type Vals = Record<string, string | null | undefined>;
const useVals = (state: FormState, initial: Vals) => (k: string) => state.values?.[k] ?? initial[k] ?? '';

/** Einheitliche Eingabe: Label, Hilfetext, Fehler, gleiche Höhe. */
function useInp(state: FormState, initial: Vals) {
  const f = state.fields ?? {};
  const v = useVals(state, initial);
  return function inp(name: string, label: string, extra: Record<string, unknown> & { hint?: string; mono?: boolean } = {}) {
    const { hint, mono, ...rest } = extra;
    return (
      <Field label={label} error={f[name]} hint={hint}>
        <input name={name} defaultValue={v(name)} className={`adm-input ${mono ? 'mono' : ''}`} aria-invalid={Boolean(f[name])} autoComplete="off" {...rest} />
      </Field>
    );
  };
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="adm-fgroup" style={{ border: 0, margin: 0, minWidth: 0 }}>
      <h3>{title}</h3>
      {hint ? <p>{hint}</p> : null}
      <div className="adm-form-grid">{children}</div>
    </fieldset>
  );
}

/* ------------------------------------------------------------------ Kunde ------------------------------------------------------------------ */
export function CustomerForm({ action, initial = {}, hidden = {}, submitLabel }: { action: Act; initial?: Vals; hidden?: Record<string, string>; submitLabel: string }) {
  const [state, run, pending] = useActionState<FormState, FormData>(action, {});
  useFormFeedback(state);
  const inp = useInp(state, initial);
  const v = useVals(state, initial);
  const [type, setType] = useState(initial.type ?? 'PRIVATE');
  return (
    <form action={run} className="adm-panel" style={{ maxWidth: 820 }} noValidate>
      {Object.entries(hidden).map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}
      <Group title="Kundendaten">
        <Field label="Kundenart">
          <select name="type" defaultValue={v('type') || 'PRIVATE'} onChange={(e) => setType(e.target.value)} className="adm-input">
            <option value="PRIVATE">Privatkunde</option>
            <option value="BUSINESS">Firmenkunde</option>
          </select>
        </Field>
        {inp('company', type === 'BUSINESS' ? 'Firma' : 'Firma (optional)', { required: type === 'BUSINESS' })}
        {inp('firstName', 'Vorname')}
        {inp('lastName', 'Nachname', { required: true })}
      </Group>
      <Group title="Kontakt">
        {inp('email', 'E-Mail', { type: 'email', inputMode: 'email', placeholder: 'name@beispiel.de' })}
        {inp('phone', 'Telefon', { type: 'tel', inputMode: 'tel', placeholder: '0511 …' })}
      </Group>
      <Group title="Anschrift">
        <div className="span-2">{inp('street', 'Straße und Hausnummer')}</div>
        {inp('postalCode', 'PLZ', { inputMode: 'numeric', maxLength: 10 })}
        {inp('city', 'Ort')}
        {inp('country', 'Land (Kürzel)', { maxLength: 2, placeholder: 'DE', hint: 'Zweistelliger Ländercode' })}
      </Group>
      <FormError state={state} />
      <SubmitRow pending={pending} label={submitLabel} />
    </form>
  );
}

/* ------------------------------------------------------------------ Fahrzeug ------------------------------------------------------------------ */
export function VehicleForm({ action, initial = {}, hidden = {}, submitLabel, canIdentify = false }: { action: Act; initial?: Vals; hidden?: Record<string, string>; submitLabel: string; canIdentify?: boolean }) {
  const [state, run, pending] = useActionState<FormState, FormData>(action, {});
  useFormFeedback(state);
  const f = state.fields ?? {};
  // Übernahme aus der HSN/TSN-Identifikation überschreibt die Anzeigewerte; `stamp` erzwingt das Neuzeichnen der Felder
  const [ov, setOv] = useState<Vals>({});
  const [stamp, setStamp] = useState(0);
  const v = (k: string) => ov[k] ?? state.values?.[k] ?? initial[k] ?? '';
  const inp = (name: string, label: string, extra: Record<string, unknown> & { hint?: string; mono?: boolean } = {}) => {
    const { hint, mono, ...rest } = extra;
    return (
      <Field label={label} error={f[name]} hint={hint}>
        <input key={`${name}-${stamp}`} name={name} defaultValue={v(name)} className={`adm-input ${mono ? 'mono' : ''}`} aria-invalid={Boolean(f[name])} autoComplete="off" {...rest} />
      </Field>
    );
  };
  const applied = ov.hsnTsnId ? `${ov.manufacturer} ${ov.model} (${ov.hsn}/${ov.tsn})` : null;
  return (
    <>
      {canIdentify && (
        <div style={{ maxWidth: 820, marginBottom: 16 }}>
          <details className="vi-embedded" open={!initial.hsn && !initial.model}>
            <summary><span aria-hidden>🔎</span> Fahrzeug per HSN/TSN, FIN oder Fahrzeugschein identifizieren {applied ? <span className="adm-badge adm-badge-ok">übernommen: {applied}</span> : null}</summary>
            <VehicleIdentify variant="embedded" onApply={(r) => { setOv((cur) => ({ ...cur, ...recordToVehicleValues(r) })); setStamp((n) => n + 1); }} />
          </details>
        </div>
      )}
      <form action={run} className="adm-panel" style={{ maxWidth: 820 }} noValidate>
        {Object.entries(hidden).map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}
        <input key={`hid-${stamp}`} type="hidden" name="hsnTsnId" defaultValue={v('hsnTsnId')} />
        <Group title="Fahrzeug">
          {inp('manufacturer', 'Hersteller', { required: true })}
          {inp('model', 'Modell', { required: true })}
          {inp('variant', 'Variante')}
          {inp('color', 'Farbe')}
        </Group>
        <Group title="Kennzeichen und Identifikation" hint="Das Kennzeichen wird in jeder Schreibweise gefunden. Die FIN ist optional und wird großzügig geprüft (historische Fahrzeuge).">
          {inp('licensePlate', 'Kennzeichen', { placeholder: 'H-AB 123', autoCapitalize: 'characters', mono: true })}
          {inp('vin', 'Fahrgestellnummer (FIN)', { autoCapitalize: 'characters', maxLength: 30, mono: true })}
          {inp('hsn', 'HSN (Feld 2.1)', { maxLength: 4, mono: true, placeholder: '0588', autoCapitalize: 'characters' })}
          {inp('tsn', 'TSN (Feld 2.2)', { maxLength: 4, mono: true, placeholder: 'ABC', autoCapitalize: 'characters' })}
        </Group>
        <Group title="Technische Daten" hint="Leere Felder bleiben „nicht verfügbar“ – es wird nichts geschätzt. Eigene Eingaben gelten als vom Gutachter bestätigt.">
          {inp('powerKw', 'Leistung (kW)', { inputMode: 'numeric' })}
          {inp('powerHp', 'Leistung (PS)', { inputMode: 'numeric' })}
          {inp('displacementCc', 'Hubraum (cm³)', { inputMode: 'numeric' })}
          {inp('engineName', 'Motor')}
          {inp('bodyStyle', 'Karosserie')}
          {inp('driveType', 'Antriebsart (z. B. Allrad)')}
          {inp('transmission', 'Getriebe')}
          {inp('vehicleClass', 'Fahrzeugklasse')}
          {inp('seats', 'Sitzplätze', { inputMode: 'numeric' })}
        </Group>
        <Group title="Zustand und Kraftstoff">
          {inp('firstRegistration', 'Erstzulassung', { type: 'date' })}
          {inp('mileage', 'Kilometerstand', { inputMode: 'numeric', placeholder: '123.456' })}
          <Field label="Kraftstoff" error={f.fuelType}>
            <select key={`fuel-${stamp}`} name="fuelType" defaultValue={v('fuelType')} className="adm-input">
              <option value="">Unbekannt</option>
              {Object.entries(FUEL_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
        </Group>
        <FormError state={state} />
        <SubmitRow pending={pending} label={submitLabel} />
      </form>
    </>
  );
}

/* ------------------------------------------------------------------ Fall ------------------------------------------------------------------ */
export type CaseRefsView = {
  locations: { id: string; name: string }[]; insurances: { id: string; name: string }[]; lawyers: { id: string; name: string }[];
  workshops: { id: string; name: string }[]; dealerships: { id: string; name: string }[]; partners: { id: string; name: string }[];
};

function RefSelect({ name, label, options, value, hint }: { name: string; label: string; options: { id: string; name: string }[]; value: string; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <select name={name} defaultValue={value} className="adm-input">
        <option value="">Keine Auswahl</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </Field>
  );
}

export function CaseForm({ action, initial = {}, hidden = {}, experts, canAssign, submitLabel, internals = true, bare = false, refs }: { action: Act; initial?: Vals; hidden?: Record<string, string>; experts: { id: string; name: string }[]; canAssign: boolean; submitLabel: string; internals?: boolean; bare?: boolean; refs?: CaseRefsView }) {
  const [state, run, pending] = useActionState<FormState, FormData>(action, {});
  useFormFeedback(state);
  const inp = useInp(state, initial);
  const v = useVals(state, initial);
  const f = state.fields ?? {};
  return (
    <form action={run} className={bare ? '' : 'adm-panel'} style={bare ? undefined : { maxWidth: 860 }} noValidate>
      {Object.entries(hidden).map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}
      <Group title="Auftrag">
        <Field label="Gutachtenart" error={f.serviceType}>
          <select name="serviceType" defaultValue={v('serviceType') || 'ACCIDENT_REPORT'} className="adm-input">
            {Object.entries(SERVICE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Schadenart">
          <select name="claimType" defaultValue={v('claimType')} className="adm-input">
            <option value="">Nicht festgelegt</option>
            {Object.entries(CLAIM_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Priorität">
          <select name="priority" defaultValue={v('priority') || 'NORMAL'} className="adm-input">
            {Object.entries(PRIORITY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        {canAssign ? (
          <Field label="Sachverständiger" error={f.assignedExpertId}>
            <select name="assignedExpertId" defaultValue={v('assignedExpertId')} className="adm-input">
              <option value="">Später zuweisen</option>
              {experts.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </Field>
        ) : null}
        {refs && refs.locations.length > 0 && <RefSelect name="locationId" label="Standort" options={refs.locations} value={v('locationId')} hint="Leer = Standort des Sachverständigen bzw. Hauptstandort" />}
        <div className="span-2">{inp('inspectionLocation', 'Besichtigungsort', { placeholder: 'Adresse oder Ort des Fahrzeugs' })}</div>
      </Group>
      {internals && (
        <Group title="Schaden">
          {inp('damageDate', 'Schadendatum', { type: 'date' })}
          {inp('accidentDate', 'Unfalldatum', { type: 'date' })}
          <div className="span-2">{inp('accidentPlace', 'Unfallort')}</div>
          <div className="span-2">
            <Field label="Beschreibung / Unfallhergang" error={f.description}>
              <textarea name="description" rows={4} defaultValue={v('description')} className="adm-input" maxLength={5000} />
            </Field>
          </div>
        </Group>
      )}
      <Group title="Versicherung" hint={refs && refs.insurances.length ? 'Aus den Stammdaten wählen. Der Freitext gilt nur, wenn die Versicherung dort fehlt.' : undefined}>
        {refs && refs.insurances.length > 0 && <RefSelect name="insuranceOrgId" label="Versicherung (Stammdaten)" options={refs.insurances} value={v('insuranceOrgId')} />}
        {inp('insuranceName', refs && refs.insurances.length ? 'Versicherung (Freitext)' : 'Versicherung')}
        {inp('insurancePolicyNumber', 'Versicherungsnummer', { mono: true })}
        {inp('insuranceClaimNumber', 'Schadennummer', { mono: true })}
        {inp('adjusterName', 'Sachbearbeiter')}
        {inp('adjusterPhone', 'Telefon Sachbearbeiter', { type: 'tel' })}
        {inp('adjusterEmail', 'E-Mail Sachbearbeiter', { type: 'email' })}
        {internals && (
          <>
            {inp('opposingInsurance', 'Gegnerische Versicherung')}
            {inp('opposingClaimNumber', 'Gegnerische Schadennummer', { mono: true })}
          </>
        )}
      </Group>
      {internals && (
        <Group title="Beteiligte">
          {refs && refs.lawyers.length > 0 ? <RefSelect name="lawyerOrgId" label="Rechtsanwalt (Stammdaten)" options={refs.lawyers} value={v('lawyerOrgId')} /> : null}
          {inp('lawyer', refs && refs.lawyers.length ? 'Rechtsanwalt (Freitext)' : 'Rechtsanwalt')}
          {inp('lawyerReference', 'Aktenzeichen Kanzlei')}
          {refs && refs.workshops.length > 0 ? <RefSelect name="workshopOrgId" label="Werkstatt (Stammdaten)" options={refs.workshops} value={v('workshopOrgId')} /> : null}
          {inp('repairShop', refs && refs.workshops.length ? 'Werkstatt (Freitext)' : 'Werkstatt')}
          {refs && refs.dealerships.length > 0 ? <RefSelect name="dealershipOrgId" label="Autohaus" options={refs.dealerships} value={v('dealershipOrgId')} /> : null}
          {refs && refs.partners.length > 0 ? <RefSelect name="partnerOrgId" label="Vermittler / Partner" options={refs.partners} value={v('partnerOrgId')} hint="Nur zur Herkunftsnachverfolgung" /> : null}
        </Group>
      )}
      {internals && (
        <Group title="Angeheftete Information" hint="Bleibt oben im Fall sichtbar, z. B. „Kunde nur nach 16 Uhr erreichbar“.">
          <div className="span-2">{inp('pinnedNote', 'Hinweis', { maxLength: 500 })}</div>
        </Group>
      )}
      <FormError state={state} />
      <SubmitRow pending={pending} label={submitLabel} />
    </form>
  );
}

/* ------------------------------------------------------------------ Notiz (Drawer) ------------------------------------------------------------------ */
export function NoteForm({ action, id, extra = {} }: { action: Act; id: string; extra?: Record<string, string> }) {
  const [state, run, pending] = useActionState<FormState, FormData>(action, {});
  useFormFeedback(state);
  return (
    <form action={run} className="adm-fieldset">
      <input type="hidden" name="id" value={id} />
      {Object.entries(extra).map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}
      <Field label="Notiz" hint="Nur intern sichtbar – nie für den Kunden.">
        <textarea name="body" rows={5} maxLength={4000} required className="adm-input" autoFocus />
      </Field>
      <label className="adm-check"><input type="checkbox" name="kind" value="PHONE_CALL" /> Als Telefonnotiz speichern</label>
      <FormError state={state} />
      <SubmitRow pending={pending} label="Notiz speichern" />
    </form>
  );
}

/* ------------------------------------------------------------------ Bestätigung (Modal) ------------------------------------------------------------------ */
export function ConfirmForm({ action, id, label, confirm, title, danger = false, primary = false, extra = {}, confirmLabel }: { action: Act; id: string; label: string; confirm: string; title?: string; danger?: boolean; primary?: boolean; extra?: Record<string, string>; confirmLabel?: string }) {
  return (
    <ConfirmModal trigger={label} title={title ?? label} text={confirm} triggerClassName={`adm-btn ${danger ? 'adm-btn-danger' : primary ? '' : 'adm-btn-secondary'}`}>
      {(close) => <ConfirmBody action={action} id={id} extra={extra} close={close} danger={danger} label={confirmLabel ?? label} />}
    </ConfirmModal>
  );
}
function ConfirmBody({ action, id, extra, close, danger, label }: { action: Act; id: string; extra: Record<string, string>; close: () => void; danger: boolean; label: string }) {
  const [state, run, pending] = useActionState<FormState, FormData>(action, {});
  useFormFeedback(state);
  return (
    <form action={run} style={{ display: 'grid', gap: 12 }}>
      <input type="hidden" name="id" value={id} />
      {Object.entries(extra).map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}
      <FormError state={state} />
      <div className="foot">
        <button type="button" className="adm-btn adm-btn-secondary" onClick={close}>Abbrechen</button>
        <button type="submit" className={`adm-btn ${danger ? 'adm-btn-danger' : ''}`} disabled={pending} autoFocus>{pending ? 'Bitte warten …' : label}</button>
      </div>
    </form>
  );
}
