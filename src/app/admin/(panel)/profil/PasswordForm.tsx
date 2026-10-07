'use client';

import { useActionState } from 'react';
import { Field, Notice } from '@/components/admin/ui';
import type { FormState } from '@/server/admin/form';
import { changePasswordAction } from './actions';

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePasswordAction, {});
  const f = state.fields ?? {};
  return (
    <form action={action} className="adm-card grid max-w-[520px] gap-4" noValidate>
      <h2 className="font-display text-[1.1rem] font-semibold">Passwort ändern</h2>
      <Field label="Aktuelles Passwort" error={f.current}>
        <input name="current" type="password" autoComplete="current-password" className="adm-input" required aria-invalid={Boolean(f.current)} />
      </Field>
      <Field label="Neues Passwort (min. 12 Zeichen)" error={f.next}>
        <input name="next" type="password" autoComplete="new-password" className="adm-input" required aria-invalid={Boolean(f.next)} />
      </Field>
      <Field label="Neues Passwort wiederholen" error={f.confirm}>
        <input name="confirm" type="password" autoComplete="new-password" className="adm-input" required aria-invalid={Boolean(f.confirm)} />
      </Field>
      <div aria-live="polite">
        {state.error ? <Notice tone="error">{state.error}</Notice> : null}
        {state.ok && state.message ? <Notice tone="ok">{state.message}</Notice> : null}
      </div>
      <div>
        <button type="submit" className="adm-btn" disabled={pending}>
          {pending ? 'Speichert …' : 'Passwort ändern'}
        </button>
      </div>
    </form>
  );
}
