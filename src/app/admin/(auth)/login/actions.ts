'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { isDbConfigured } from '@/server/db';
import { authenticate } from '@/server/auth/login';
import { setSessionCookie } from '@/server/auth/session';
import { requestMeta } from '@/server/http';
import { safeNext } from '@/server/admin/safe-next';

export type LoginState = { error?: string; email?: string };

const schema = z.object({
  email: z.string().trim().min(1).max(200),
  password: z.string().min(1).max(200),
  weiter: z.string().max(300).optional(),
});

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
  await setSessionCookie(result.token, result.expiresAt);
  redirect(result.mustChangePassword ? '/admin/profil?pflicht=1' : safeNext(parsed.data.weiter));
}
