'use client';

import { useActionState } from 'react';
import { Field } from '@/components/admin/ui';
import { FormError, SubmitRow, useFormFeedback } from '@/components/admin/forms';
import type { FormState } from '@/server/admin/form';
import { assignExpertAction, caseStatusAction } from '../actions';

export function CaseStatusForm({ id, caseNumber, current, options }: { id: string; caseNumber: string; current: string; options: { value: string; label: string; needsReason: boolean }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(caseStatusAction, {});
  useFormFeedback(state);
  return (
    <form action={action} className="adm-fieldset">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="caseNumber" value={caseNumber} />
      <p className="t-2" style={{ margin: 0 }}>Aktueller Status: <b>{current}</b></p>
      <Field label="Neuer Status">
        <select name="status" className="adm-input" required defaultValue="">
          <option value="" disabled>Wählen …</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}{o.needsReason ? ' (Begründung nötig)' : ''}</option>)}
        </select>
      </Field>
      <Field label="Begründung" hint="Pflicht bei Storno und beim Wiederöffnen abgeschlossener Fälle.">
        <input name="reason" className="adm-input" maxLength={500} autoComplete="off" />
      </Field>
      <FormError state={state} />
      <SubmitRow pending={pending} label="Status ändern" />
    </form>
  );
}

export function AssignForm({ id, caseNumber, current, experts }: { id: string; caseNumber: string; current: string | null; experts: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(assignExpertAction, {});
  useFormFeedback(state);
  return (
    <form action={action} className="adm-fieldset">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="caseNumber" value={caseNumber} />
      <Field label="Sachverständiger">
        <select name="expertId" defaultValue={current ?? ''} className="adm-input">
          <option value="">Niemand</option>
          {experts.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </Field>
      <FormError state={state} />
      <SubmitRow pending={pending} label="Zuweisen" />
    </form>
  );
}
