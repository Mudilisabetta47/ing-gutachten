import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/server/db';
import { requireUser, can } from '@/server/auth/guards';
import { ROLE_LABELS } from '@/server/auth/permissions';
import { getSystemStatus } from '@/server/admin/status';
import { upcomingNav } from '@/server/admin/nav';
import { PageHeader, fmtDateTime } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Dashboard' };

const ACTION_LABEL: Record<string, string> = {
  'auth.login': 'Angemeldet',
  'auth.logout': 'Abgemeldet',
  'auth.login_failed': 'Fehlgeschlagene Anmeldung',
  'auth.login_throttled': 'Anmeldung gedrosselt',
  'auth.password_change': 'Passwort geändert',
  'user.create': 'Benutzer angelegt',
  'user.update': 'Benutzer geändert',
  'user.role_change': 'Rolle geändert',
  'user.deactivate': 'Benutzer deaktiviert',
  'user.password_reset': 'Passwort zurückgesetzt',
  'settings.update': 'Einstellung geändert',
};

export default async function DashboardPage() {
  const user = await requireUser();
  const seeAll = can(user, 'audit.read');
  const status = getSystemStatus();

  const [activeUsers, activity, mySessions] = await Promise.all([
    can(user, 'users.read') ? db.user.count({ where: { isActive: true, deletedAt: null } }) : Promise.resolve(null),
    db.auditLog.findMany({
      where: seeAll ? {} : { actorId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { actor: { select: { firstName: true, lastName: true } } },
    }),
    db.session.count({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } } }),
  ]);
  const upcoming = upcomingNav((p) => user.permissions.has(p));

  return (
    <>
      <PageHeader title={`Guten Tag, ${user.firstName}`} intro={`Angemeldet als ${ROLE_LABELS[user.role]}. Das Dashboard zeigt nur echte Daten – die Fall-Kennzahlen erscheinen, sobald die Module gebaut sind.`} />

      <section aria-label="Kennzahlen" className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {activeUsers !== null && (
          <div className="adm-card">
            <p className="adm-label">Aktive Benutzer</p>
            <p className="font-display text-[2rem] font-semibold leading-none tracking-[-.03em]">{activeUsers}</p>
          </div>
        )}
        <div className="adm-card">
          <p className="adm-label">Meine Sitzungen</p>
          <p className="font-display text-[2rem] font-semibold leading-none tracking-[-.03em]">{mySessions}</p>
          <Link href="/admin/profil" className="adm-link mt-2 inline-block text-[.82rem]">
            Verwalten
          </Link>
        </div>
        {can(user, 'settings.read') && (
          <>
            <div className="adm-card">
              <p className="adm-label">E-Mail-Versand</p>
              <p className={`text-[.95rem] ${status.mail.ok ? 'text-ok' : 'text-fg-dim'}`}>{status.mail.label}</p>
            </div>
            <div className="adm-card">
              <p className="adm-label">Dateispeicher</p>
              <p className={`text-[.95rem] ${status.storage.ok ? 'text-ok' : 'text-fg-dim'}`}>{status.storage.label}</p>
            </div>
          </>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="adm-card" aria-labelledby="feed-h">
          <h2 id="feed-h" className="mb-3 font-display text-[1.1rem] font-semibold">
            Letzte Aktivität
          </h2>
          {activity.length === 0 ? (
            <p className="text-[.92rem] text-fg-mute">Noch keine Einträge.</p>
          ) : (
            <ul className="divide-y divide-line/60">
              {activity.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5 text-[.9rem]">
                  <span>
                    <span className="text-fg">{ACTION_LABEL[a.action] ?? a.action}</span>
                    {a.summary && a.summary !== (ACTION_LABEL[a.action] ?? a.action) ? <span className="text-fg-mute"> · {a.summary}</span> : null}
                  </span>
                  <span className="font-mono text-[.66rem] text-fg-mute">
                    {a.actor ? `${a.actor.firstName} ${a.actor.lastName} · ` : ''}
                    {fmtDateTime(a.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {can(user, 'audit.read') || can(user, 'audit.read.own') ? (
            <Link href="/admin/protokoll" className="adm-link mt-3 inline-block text-[.86rem]">
              Gesamtes Protokoll
            </Link>
          ) : null}
        </section>

        <section className="adm-card" aria-labelledby="road-h">
          <h2 id="road-h" className="mb-3 font-display text-[1.1rem] font-semibold">
            Im Aufbau
          </h2>
          <ul className="grid gap-2 text-[.9rem]">
            {upcoming.length === 0 ? <li className="text-fg-mute">Alle Module für Ihre Rolle sind verfügbar.</li> : null}
            {upcoming.map((m) => (
              <li key={m.href} className="flex justify-between gap-3 text-fg-dim">
                <span>{m.label}</span>
                <span className="adm-pill">Phase {m.phase}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
