'use client';

import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Field } from './ui';
import { ConfirmModal, useDrawerClose } from './Overlay';
import { useToast } from './Toast';
import type { FormState } from '@/server/admin/form';
import { FUEL_LABELS, SERVICE_LABELS } from '@/lib/workflow';

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
export function VehicleForm({ action, initial = {}, hidden = {}, submitLabel }: { action: Act; initial?: Vals; hidden?: Record<string, string>; submitLabel: string }) {
  const [state, run, pending] = useActionState<FormState, FormData>(action, {});
  useFormFeedback(state);
  const inp = useInp(state, initial);
  const v = useVals(state, initial);
  const f = state.fields ?? {};
  return (
    <form action={run} className="adm-panel" style={{ maxWidth: 820 }} noValidate>
      {Object.entries(hidden).map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}
      <Group title="Fahrzeug">
        {inp('manufacturer', 'Hersteller', { required: true })}
        {inp('model', 'Modell', { required: true })}
        {inp('variant', 'Variante')}
        {inp('color', 'Farbe')}
      </Group>
      <Group title="Kennzeichen und Identifikation" hint="Das Kennzeichen wird in jeder Schreibweise gefunden. Die FIN ist optional und wird großzügig geprüft (historische Fahrzeuge).">
        {inp('licensePlate', 'Kennzeichen', { placeholder: 'H-AB 123', autoCapitalize: 'characters', mono: true })}
        {inp('vin', 'Fahrgestellnummer (FIN)', { autoCapitalize: 'characters', maxLength: 30, mono: true })}
      </Group>
      <Group title="Zustand und Antrieb">
        {inp('firstRegistration', 'Erstzulassung', { type: 'date' })}
        {inp('mileage', 'Kilometerstand', { inputMode: 'numeric', placeholder: '123.456' })}
        <Field label="Antrieb" error={f.fuelType}>
          <select name="fuelType" defaultValue={v('fuelType')} className="adm-input">
            <option value="">Unbekannt</option>
            {Object.entries(FUEL_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
      </Group>
      <FormError state={state} />
      <SubmitRow pending={pending} label={submitLabel} />
    </form>
  );
}

/* ------------------------------------------------------------------ Fall ------------------------------------------------------------------ */
export function CaseForm({ action, initial = {}, hidden = {}, experts, canAssign, submitLabel, internals = true, bare = false }: { action: Act; initial?: Vals; hidden?: Record<string, string>; experts: { id: string; name: string }[]; canAssign: boolean; submitLabel: string; internals?: boolean; bare?: boolean }) {
  const [state, run, pending] = useActionState<FormState, FormData>(action, {});
  useFormFeedback(state);
  const inp = useInp(state, initial);
  const v = useVals(state, initial);
  const f = state.fields ?? {};
  return (
    <form action={run} className={bare ? '' : 'adm-panel'} style={bare ? undefined : { maxWidth: 820 }} noValidate>
      {Object.entries(hidden).map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}
      <Group title="Auftrag">
        <Field label="Gutachtenart" error={f.serviceType}>
          <select name="serviceType" defaultValue={v('serviceType') || 'ACCIDENT_REPORT'} className="adm-input">
            {Object.entries(SERVICE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
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
        <div className="span-2">{inp('inspectionLocation', 'Besichtigungsort', { placeholder: 'Adresse oder Ort des Fahrzeugs' })}</div>
      </Group>
      {internals && (
        <Group title="Schaden">
          {inp('damageDate', 'Schadendatum', { type: 'date' })}
          {inp('accidentDate', 'Unfalldatum', { type: 'date' })}
          <div className="span-2">
            <Field label="Beschreibung / Unfallhergang" error={f.description}>
              <textarea name="description" rows={4} defaultValue={v('description')} className="adm-input" maxLength={5000} />
            </Field>
          </div>
        </Group>
      )}
      <Group title="Versicherung">
        {inp('insuranceName', 'Versicherung')}
        {inp('insuranceClaimNumber', 'Schadennummer', { mono: true })}
        {internals && (
          <>
            {inp('opposingInsurance', 'Gegnerische Versicherung')}
            {inp('opposingClaimNumber', 'Gegnerische Schadennummer', { mono: true })}
          </>
        )}
      </Group>
      {internals && (
        <Group title="Beteiligte">
          {inp('lawyer', 'Rechtsanwalt')}
          {inp('repairShop', 'Werkstatt')}
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
