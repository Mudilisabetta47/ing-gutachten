'use client';

import { useActionState } from 'react';
import { loginAction, type LoginState } from './actions';

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} className="grid gap-4" noValidate>
      {next ? <input type="hidden" name="weiter" value={next} /> : null}
      <label className="grid gap-0.5">
        <span className="adm-label">E-Mail</span>
        <input name="email" type="email" autoComplete="username" required autoFocus defaultValue={state.email} className="adm-input" aria-invalid={Boolean(state.error)} />
      </label>
      <label className="grid gap-0.5">
        <span className="adm-label">Passwort</span>
        <input name="password" type="password" autoComplete="current-password" required className="adm-input" aria-invalid={Boolean(state.error)} />
      </label>
      <div aria-live="polite">
        {state.error ? (
          <p role="alert" className="rounded-[10px] border border-danger/50 px-3.5 py-2.5 text-[.9rem] text-danger">
            {state.error}
          </p>
        ) : null}
      </div>
      <button type="submit" className="adm-btn w-full" disabled={pending}>
        {pending ? 'Wird geprüft …' : 'Anmelden'}
      </button>
    </form>
  );
}
