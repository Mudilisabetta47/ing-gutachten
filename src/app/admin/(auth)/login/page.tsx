import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isDbConfigured } from '@/server/db';
import { getAuthUser } from '@/server/auth/session';
import { LoginForm } from './LoginForm';
import { safeNext } from '@/server/admin/safe-next';

export const metadata: Metadata = { title: 'Anmelden' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ weiter?: string }> }) {
  const configured = isDbConfigured();
  const { weiter } = await searchParams;
  if (configured && (await getAuthUser())) redirect(safeNext(weiter));

  return (
    <div className="adm-login">
      <div className="adm-login-box">
        <div className="adm-login-brand">
          <span className="adm-logo adm-logo-lg" role="img" aria-label="ING Gutachten" />
          <small>Operating System · Interner Bereich</small>
        </div>
        <div className="adm-panel" style={{ padding: 24 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, letterSpacing: '-.02em' }}>Anmelden</h1>
          <p className="t-2" style={{ margin: '0 0 20px' }}>Mit Ihrer geschäftlichen E-Mail-Adresse.</p>
          {configured ? (
            <LoginForm next={weiter ? safeNext(weiter) : undefined} />
          ) : (
            <p role="alert" className="adm-alert">Das System ist hier noch nicht eingerichtet: <code className="mono">DATABASE_URL</code> fehlt. Die öffentliche Website ist davon nicht betroffen.</p>
          )}
        </div>
        <p className="t-3" style={{ textAlign: 'center', fontSize: 12, margin: '20px 0 0' }}>Zugang nur für Mitarbeiter von ING Gutachten.</p>
      </div>
    </div>
  );
}
