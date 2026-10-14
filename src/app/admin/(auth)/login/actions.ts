'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { isDbConfigured } from '@/server/db';
import { authenticate } from '@/server/auth/login';
import { completeChallenge } from '@/server/auth/mfa';
import { setSessionCookie } from '@/server/auth/session';
import { requestMeta } from '@/server/http';
import { safeNext } from '@/server/admin/safe-next';

export type LoginState = { error?: string; email?: string; mfa?: boolean; next?: string };

const PROD = process.env.NODE_ENV === 'production';
const MFA_COOKIE = PROD ? '__Host-ing_mfa' : 'ing_mfa';
const mfaCookieOpts = { httpOnly: true, secure: PROD, sameSite: 'lax' as const, path: '/' };

const schema = z.object({
  email: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(200),
  weiter: z.string().max(300).optional(),
});

const target = (mustChange: boolean, weiter?: string) => (mustChange ? '/admin/profil?pflicht=1' : weiter ? safeNext(weiter) : '/studio/');

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!isDbConfigured()) return { error: 'Das System ist noch nicht konfiguriert (Datenbank fehlt).' };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Bitte E-Mail und Passwort eingeben.', email: String(formData.get('email') ?? '') };

  const meta = await requestMeta();
  const result = await authenticate(parsed.data.email, parsed.data.password, meta);
  if (!result.ok) {
    return {
      error:
        result.reason === 'throttled'
          ? 'Zu viele Versuche. Bitte in einigen Minuten erneut versuchen.'
          : 'E-Mail oder Passwort stimmt nicht.',
      email: parsed.data.email,
    };
  }
  if (result.mfa) {
    // Zweiter Schritt: die einmalige Aufgabe liegt nur in diesem httpOnly-Cookie (5 Minuten).
    (await cookies()).set(MFA_COOKIE, result.challenge, { ...mfaCookieOpts, maxAge: 5 * 60 });
    return { mfa: true, email: parsed.data.email, next: parsed.data.weiter };
  }
  await setSessionCookie(result.token, result.expiresAt);
  redirect(target(result.mustChangePassword, parsed.data.weiter));
}

export async function verifyMfaAction(prev: LoginState, formData: FormData): Promise<LoginState> {
  const jar = await cookies();
  const challenge = jar.get(MFA_COOKIE)?.value;
  const next = String(formData.get('weiter') ?? '') || undefined;
  if (!challenge) return { error: 'Die Anmeldung ist abgelaufen. Bitte neu anmelden.', email: prev.email };
  const code = String(formData.get('code') ?? '').slice(0, 40);
  if (!code.trim()) return { mfa: true, error: 'Bitte den Code eingeben.', email: prev.email, next };
  const r = await completeChallenge(challenge, code, await requestMeta());
  if (!r.ok) {
    if (r.reason === 'invalid') return { mfa: true, error: 'Der Code stimmt nicht. Bitte erneut versuchen.', email: prev.email, next };
    jar.set(MFA_COOKIE, '', { ...mfaCookieOpts, maxAge: 0 });
    return { error: r.reason === 'locked' ? 'Zu viele Versuche. Das Konto ist kurz gesperrt – bitte später erneut versuchen.' : 'Die Anmeldung ist abgelaufen. Bitte neu anmelden.', email: prev.email };
  }
  jar.set(MFA_COOKIE, '', { ...mfaCookieOpts, maxAge: 0 });
  await setSessionCookie(r.token, r.expiresAt);
  redirect(target(r.mustChangePassword, next));
}

export async function cancelMfaAction(): Promise<LoginState> {
  (await cookies()).set(MFA_COOKIE, '', { ...mfaCookieOpts, maxAge: 0 });
  return {};
}
