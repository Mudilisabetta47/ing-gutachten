import type { Metadata } from 'next';
import { db } from '@/server/db';
import { requireUser } from '@/server/auth/guards';
import { ROLE_LABELS } from '@/server/auth/permissions';
import { Alert, Badge, PageHeader, Section, fmtWhen } from '@/components/admin/ui';
import { PasswordForm } from './PasswordForm';
import { MfaSection } from './MfaSection';
import { mfaAvailable, mfaStatus } from '@/server/auth/mfa';
import { getSetting } from '@/server/settings';
import { revokeOtherSessionsAction } from './actions';

export const metadata: Metadata = { title: 'Mein Profil' };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ pflicht?: string; mfa?: string }> }) {
  const user = await requireUser({ allowPasswordChange: true });
  const { pflicht } = await searchParams;
  const [mfa, security] = await Promise.all([mfaStatus(user.id), getSetting('security')]);
  const enforced = (user.role === 'OWNER' || user.role === 'ADMIN') && security.requireMfaForAdmins;
  const sessions = await db.session.findMany({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: 'desc' }, take: 20 });

  return (
    <>
      <PageHeader title="Mein Profil" intro={`${user.firstName} ${user.lastName} · ${user.email} · ${ROLE_LABELS[user.role]}`} />
      {user.mustChangePassword || pflicht ? (
        <div style={{ marginBottom: 20 }}>
          <Alert tone="warn">Bitte vergeben Sie jetzt ein eigenes Passwort. Bis dahin ist der übrige Bereich gesperrt.</Alert>
        </div>
      ) : null}
      <div className="adm-grid-2" style={{ alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 20 }}>
          <PasswordForm />
          <MfaSection status={{ enabled: mfa.enabled, enabledAt: mfa.enabledAt?.toISOString() ?? null, pending: mfa.pending, recoveryLeft: mfa.recoveryLeft }} available={mfaAvailable()} enforced={enforced} />
        </div>
        <Section
          title="Aktive Sitzungen"
          aside={sessions.length > 1 ? (
            <form action={revokeOtherSessionsAction}><button type="submit" className="adm-btn adm-btn-secondary adm-btn-sm">Alle anderen beenden</button></form>
          ) : undefined}
        >
          <ul className="adm-list">
            {sessions.map((s) => (
              <li key={s.id}>
                <span className="main">
                  <span>{s.userAgent ? s.userAgent.slice(0, 70) : 'Unbekanntes Gerät'}</span>
                  <span className="secondary mono">{s.ip ?? '–'} · zuletzt {fmtWhen(s.lastSeenAt)}</span>
                </span>
                {s.id === user.sessionId ? <Badge tone="ok">Dieses Gerät</Badge> : null}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  );
}
