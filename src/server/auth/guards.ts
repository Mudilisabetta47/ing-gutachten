import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { getAuthUser, type AuthUser } from './session';
import { AuthRequiredError, ForbiddenError } from './errors';
import type { Permission } from './permissions';

export { ForbiddenError, AuthRequiredError, can, canAny } from './errors';

/** Seiten: nicht angemeldet → Login; Passwortwechsel offen → Profilseite. */
export async function requireUser(opts: { allowPasswordChange?: boolean } = {}): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) redirect('/admin/login');
  if (user.mustChangePassword && !opts.allowPasswordChange) redirect('/admin/profil?pflicht=1');
  return user;
}

/** Seiten: fehlende Berechtigung → 404 (verrät nicht, dass die Seite existiert). */
export async function requirePagePermission(...anyOf: Permission[]): Promise<AuthUser> {
  const user = await requireUser();
  if (!anyOf.some((p) => user.permissions.has(p))) notFound();
  return user;
}

/** Server Actions / Route Handler: wirft statt zu redirecten. */
export async function authorize(...anyOf: Permission[]): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) throw new AuthRequiredError();
  if (user.mustChangePassword) throw new ForbiddenError('Bitte zuerst das Passwort ändern.');
  if (anyOf.length && !anyOf.some((p) => user.permissions.has(p))) throw new ForbiddenError();
  return user;
}
