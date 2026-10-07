import type { Metadata } from 'next';
import { db } from '@/server/db';
import { requireUser } from '@/server/auth/guards';
import { ROLE_LABELS } from '@/server/auth/permissions';
import { PageHeader, Notice, fmtDateTime } from '@/components/admin/ui';
import { PasswordForm } from './PasswordForm';
import { revokeOtherSessionsAction } from './actions';

export const metadata: Metadata = { title: 'Mein Profil' };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ pflicht?: string }> }) {
  const user = await requireUser({ allowPasswordChange: true });
  const { pflicht } = await searchParams;
  const sessions = await db.session.findMany({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: 'desc' }, take: 20 });

  return (
    <>
      <PageHeader title="Mein Profil" intro={`${user.firstName} ${user.lastName} · ${user.email} · ${ROLE_LABELS[user.role]}`} />
      {user.mustChangePassword || pflicht ? (
        <div className="mb-6">
          <Notice tone="info">Bitte vergeben Sie jetzt ein eigenes Passwort. Bis dahin ist der übrige Bereich gesperrt.</Notice>
        </div>
      ) : null}
      <div className="grid min-w-0 gap-6">
        <PasswordForm />
        <section className="adm-card min-w-0" aria-labelledby="sess-h">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 id="sess-h" className="font-display text-[1.1rem] font-semibold">
              Aktive Sitzungen
            </h2>
            {sessions.length > 1 ? (
              <form action={revokeOtherSessionsAction}>
                <button type="submit" className="adm-btn adm-btn-ghost">
                  Alle anderen beenden
                </button>
              </form>
            ) : null}
          </div>
          <ul className="divide-y divide-line/60 text-[.9rem]">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                <span className="min-w-0 max-w-full flex-1 truncate text-fg-dim">
                  {s.userAgent ?? 'Unbekanntes Gerät'}
                  {s.id === user.sessionId ? <span className="adm-pill adm-pill-ok ml-2">dieses Gerät</span> : null}
                </span>
                <span className="font-mono text-[.7rem] text-fg-mute">
                  {s.ip ?? '–'} · zuletzt {fmtDateTime(s.lastSeenAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
