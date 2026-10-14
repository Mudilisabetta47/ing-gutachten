'use client';

import { useActionState } from 'react';
import { cancelMfaAction, loginAction, verifyMfaAction, type LoginState } from './actions';

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [mfaState, mfaAction, mfaPending] = useActionState<LoginState, FormData>(verifyMfaAction, {});
  // Zweiter Schritt sichtbar, solange der erste Schritt „mfa“ meldete und der zweite nicht abgelaufen/gesperrt ist
  const second = state.mfa && !(mfaState.error && !mfaState.mfa);
  const err = second ? mfaState.error : (mfaState.error && !mfaState.mfa ? mfaState.error : state.error);

  if (second) {
    return (
      <form action={mfaAction} className="grid gap-4" noValidate>
        <input type="hidden" name="weiter" value={state.next ?? next ?? ''} />
        <p className="text-[.92rem]" style={{ margin: 0 }}>Zweiter Schritt: Bitte den 6-stelligen Code aus Ihrer Authenticator-App eingeben.</p>
        <label className="grid gap-0.5">
          <span className="adm-label">Code</span>
          <input name="code" inputMode="numeric" autoComplete="one-time-code" autoFocus required className="adm-input" aria-invalid={Boolean(mfaState.error)} placeholder="123 456" maxLength={40} />
          <span className="adm-hint">Kein Zugriff auf die App? Geben Sie stattdessen einen Wiederherstellungscode ein (xxxxx-xxxxx).</span>
        </label>
        <div aria-live="polite">
          {mfaState.error ? (
            <p role="alert" className="rounded-[10px] border border-danger/50 px-3.5 py-2.5 text-[.9rem] text-danger">{mfaState.error}</p>
          ) : null}
        </div>
        <button type="submit" className="adm-btn w-full" disabled={mfaPending}>{mfaPending ? 'Wird geprüft …' : 'Bestätigen'}</button>
        <button type="button" className="adm-btn adm-btn-ghost w-full" onClick={async () => { await cancelMfaAction(); window.location.assign('/admin/login/'); }}>Abbrechen</button>
      </form>
    );
  }
  return (
    <form action={action} className="grid gap-4" noValidate>
      {next ? <input type="hidden" name="weiter" value={next} /> : null}
      <label className="grid gap-0.5">
        <span className="adm-label">E-Mail</span>
        <input name="email" type="email" autoComplete="username" required autoFocus defaultValue={state.email ?? mfaState.email} className="adm-input" aria-invalid={Boolean(err)} />
      </label>
      <label className="grid gap-0.5">
        <span className="adm-label">Passwort</span>
        <input name="password" type="password" autoComplete="current-password" required className="adm-input" aria-invalid={Boolean(err)} />
      </label>
      <div aria-live="polite">
        {err ? (
          <p role="alert" className="rounded-[10px] border border-danger/50 px-3.5 py-2.5 text-[.9rem] text-danger">
            {err}
          </p>
        ) : null}
      </div>
      <button type="submit" className="adm-btn w-full" disabled={pending}>
        {pending ? 'Wird geprüft …' : 'Anmelden'}
      </button>
    </form>
  );
}
