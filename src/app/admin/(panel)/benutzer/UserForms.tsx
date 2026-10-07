'use client';

import { useActionState } from 'react';
import { Field, Notice } from '@/components/admin/ui';
import type { FormState } from '@/server/admin/form';
import { createUserAction, resetPasswordAction, updateUserAction } from './actions';

const ROLE_OPTIONS = [
  ['OFFICE', 'Büro'],
  ['EXPERT', 'Sachverständiger'],
  ['ACCOUNTING', 'Buchhaltung'],
  ['REVIEWER', 'Prüfer'],
  ['CONTENT_MANAGER', 'Website & Inhalte'],
  ['ADMIN', 'Administrator'],
  ['OWNER', 'Inhaber'],
] as const;

function Result({ state }: { state: FormState }) {
  return (
    <div aria-live="polite" className="grid gap-2">
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.ok && state.message ? <Notice tone="ok">{state.message}</Notice> : null}
    </div>
  );
}

export function UserCreateForm({ canGrantOwner }: { canGrantOwner: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createUserAction, {});
  const f = state.fields ?? {};
  return (
    <form action={action} className="adm-card grid max-w-[640px] gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vorname" error={f.firstName}>
          <input name="firstName" defaultValue={state.values?.firstName} className="adm-input" required aria-invalid={Boolean(f.firstName)} autoComplete="off" />
        </Field>
        <Field label="Nachname" error={f.lastName}>
          <input name="lastName" defaultValue={state.values?.lastName} className="adm-input" required aria-invalid={Boolean(f.lastName)} autoComplete="off" />
        </Field>
      </div>
      <Field label="E-Mail" error={f.email}>
        <input name="email" type="email" defaultValue={state.values?.email} className="adm-input" required aria-invalid={Boolean(f.email)} autoComplete="off" />
      </Field>
      <Field label="Rolle" error={f.role}>
        <select name="role" className="adm-input" defaultValue={state.values?.role ?? 'OFFICE'}>
          {ROLE_OPTIONS.filter(([v]) => v !== 'OWNER' || canGrantOwner).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex items-center gap-2.5 text-[.92rem]">
        <input type="checkbox" name="isExpert" defaultChecked={state.values?.isExpert === 'on'} className="h-4 w-4 accent-[#1f6fe0]" />
        Darf als Sachverständiger Fällen und Terminen zugewiesen werden
      </label>
      <Field label="Startpasswort (min. 12 Zeichen)" error={f.password}>
        <input name="password" type="password" className="adm-input" required aria-invalid={Boolean(f.password)} autoComplete="new-password" />
      </Field>
      <p className="text-[.82rem] text-fg-mute">Die Person muss das Startpasswort bei der ersten Anmeldung ändern. Das Passwort bitte nicht per E-Mail versenden.</p>
      <Result state={state} />
      <div>
        <button type="submit" className="adm-btn" disabled={pending}>
          {pending ? 'Wird angelegt …' : 'Benutzer anlegen'}
        </button>
      </div>
    </form>
  );
}

export function UserEditForm({ user, isSelf, canGrantOwner }: { user: { id: string; role: string; isActive: boolean; isExpert: boolean }; isSelf: boolean; canGrantOwner: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateUserAction, {});
  return (
    <form action={action} className="adm-card grid max-w-[640px] gap-4">
      <input type="hidden" name="id" value={user.id} />
      <Field label="Rolle">
        <select name="role" className="adm-input" defaultValue={user.role} disabled={isSelf}>
          {ROLE_OPTIONS.filter(([v]) => v !== 'OWNER' || canGrantOwner || user.role === 'OWNER').map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        {isSelf ? <input type="hidden" name="role" value={user.role} /> : null}
      </Field>
      <label className="flex items-center gap-2.5 text-[.92rem]">
        <input type="checkbox" name="isActive" defaultChecked={user.isActive} disabled={isSelf} className="h-4 w-4 accent-[#1f6fe0]" />
        Konto aktiv
        {isSelf ? <input type="hidden" name="isActive" value="on" /> : null}
      </label>
      <label className="flex items-center gap-2.5 text-[.92rem]">
        <input type="checkbox" name="isExpert" defaultChecked={user.isExpert} className="h-4 w-4 accent-[#1f6fe0]" />
        Darf als Sachverständiger zugewiesen werden
      </label>
      {isSelf ? <p className="text-[.82rem] text-fg-mute">Das eigene Konto kann hier weder deaktiviert noch in der Rolle geändert werden.</p> : null}
      <Result state={state} />
      <div>
        <button type="submit" className="adm-btn" disabled={pending}>
          {pending ? 'Speichert …' : 'Speichern'}
        </button>
      </div>
    </form>
  );
}

export function ResetPasswordForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPasswordAction, {});
  return (
    <form action={action} className="adm-card grid max-w-[640px] gap-4">
      <h2 className="font-display text-[1.05rem] font-semibold">Passwort zurücksetzen</h2>
      <input type="hidden" name="id" value={userId} />
      <Field label="Neues Startpasswort (min. 12 Zeichen)" error={state.fields?.password}>
        <input name="password" type="password" className="adm-input" required autoComplete="new-password" aria-invalid={Boolean(state.fields?.password)} />
      </Field>
      <Result state={state} />
      <div>
        <button type="submit" className="adm-btn adm-btn-ghost" disabled={pending}>
          {pending ? 'Wird gesetzt …' : 'Passwort setzen'}
        </button>
      </div>
    </form>
  );
}
