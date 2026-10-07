'use client';

import { useActionState } from 'react';
import { Field } from '@/components/admin/ui';
import { FormError, SubmitRow, useFormFeedback } from '@/components/admin/forms';
import type { FormState } from '@/server/admin/form';
import { leadAppointmentAction, leadNoteAction, leadStatusAction, leadUpdateAction } from './actions';

export function LeadStatusForm({ id, current, options }: { id: string; current: string; options: { value: string; label: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(leadStatusAction, {});
  useFormFeedback(state);
  return (
    <form action={action} className="adm-fieldset">
      <input type="hidden" name="id" value={id} />
      <p className="t-2" style={{ margin: 0 }}>Aktueller Status: <b>{current}</b></p>
      <Field label="Neuer Status">
        <select name="status" className="adm-input" required defaultValue="">
          <option value="" disabled>Wählen …</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
      <Field label="Grund oder Hinweis (optional)" hint="Wird in der Aktivität festgehalten, z. B. „Kunde meldet sich nicht“.">
        <input name="reason" className="adm-input" maxLength={500} autoComplete="off" />
      </Field>
      <FormError state={state} />
      <SubmitRow pending={pending} label="Status ändern" />
    </form>
  );
}

export function LeadNoteForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(leadNoteAction, {});
  useFormFeedback(state);
  return (
    <form action={action} className="adm-fieldset">
      <input type="hidden" name="id" value={id} />
      <Field label="Notiz" hint="Nur intern sichtbar – nie für den Kunden.">
        <textarea name="body" rows={5} maxLength={4000} required className="adm-input" autoFocus />
      </Field>
      <label className="adm-check"><input type="checkbox" name="kind" value="PHONE_CALL" /> Als Telefonnotiz speichern</label>
      <FormError state={state} />
      <SubmitRow pending={pending} label="Notiz speichern" />
    </form>
  );
}

export function LeadAppointmentForm({ id, value }: { id: string; value: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(leadAppointmentAction, {});
  useFormFeedback(state);
  return (
    <form action={action} className="adm-fieldset">
      <input type="hidden" name="id" value={id} />
      <Field label="Wiedervorlage oder Terminvorschlag" hint="Setzt eine Erinnerung (erscheint unter „Heute“) und stellt die Anfrage auf „Termin offen“. Der Kalender folgt in Phase 3.">
        <input type="datetime-local" name="nextActionAt" defaultValue={value} className="adm-input" required />
      </Field>
      <FormError state={state} />
      <SubmitRow pending={pending} label="Termin vorbereiten" />
    </form>
  );
}

export function LeadEditForm({
  lead, users, vehicleKinds,
}: {
  lead: { id: string; name: string; email: string | null; phone: string | null; location: string | null; licensePlate: string | null; vehicleKind: string; message: string | null; assignedToId: string | null; nextActionAt: string };
  users: { id: string; name: string }[];
  vehicleKinds: readonly string[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(leadUpdateAction, {});
  useFormFeedback(state);
  const f = state.fields ?? {};
  const v = (k: keyof typeof lead) => state.values?.[k] ?? (lead[k] ?? '');
  return (
    <form action={action} className="adm-fieldset" noValidate>
      <input type="hidden" name="id" value={lead.id} />
      <input type="hidden" name="nextActionAt" value={lead.nextActionAt} />
      <div className="adm-form-grid">
        <div className="span-2"><Field label="Name" error={f.name}><input name="name" defaultValue={v('name')} className="adm-input" required aria-invalid={Boolean(f.name)} /></Field></div>
        <Field label="Telefon" error={f.phone}><input name="phone" type="tel" defaultValue={v('phone')} className="adm-input" /></Field>
        <Field label="E-Mail" error={f.email}><input name="email" type="email" defaultValue={v('email')} className="adm-input" aria-invalid={Boolean(f.email)} /></Field>
        <Field label="Ort" error={f.location}><input name="location" defaultValue={v('location')} className="adm-input" /></Field>
        <Field label="Kennzeichen" error={f.licensePlate}><input name="licensePlate" defaultValue={v('licensePlate')} className="adm-input mono" placeholder="H-AB 123" autoCapitalize="characters" /></Field>
        <Field label="Fahrzeugart" error={f.vehicleKind}>
          <select name="vehicleKind" defaultValue={v('vehicleKind')} className="adm-input">
            {vehicleKinds.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </Field>
        <Field label="Zuständig">
          <select name="assignedToId" defaultValue={v('assignedToId')} className="adm-input">
            <option value="">Niemand</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        <div className="span-2">
          <Field label="Nachricht des Kunden (Arbeitskopie)" error={f.message} hint="Die Originalangaben aus dem Formular bleiben unverändert gespeichert.">
            <textarea name="message" rows={3} defaultValue={v('message')} className="adm-input" maxLength={2000} />
          </Field>
        </div>
      </div>
      <FormError state={state} />
      <SubmitRow pending={pending} label="Speichern" />
    </form>
  );
}
