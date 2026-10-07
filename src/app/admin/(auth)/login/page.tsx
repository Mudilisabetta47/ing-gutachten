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
    <div className="grid min-h-[100svh] place-items-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-signal font-display text-[.9rem] font-bold text-white">ING</span>
          <div>
            <p className="font-display text-[1.15rem] font-bold leading-tight tracking-[-.02em]">Operating System</p>
            <p className="font-mono text-[.62rem] uppercase tracking-[.14em] text-fg-mute">Interner Bereich</p>
          </div>
        </div>
        <div className="adm-card !p-6">
          <h1 className="mb-5 font-display text-[1.4rem] font-semibold tracking-[-.02em]">Anmelden</h1>
          {configured ? (
            <LoginForm next={weiter ? safeNext(weiter) : undefined} />
          ) : (
            <p role="alert" className="rounded-[10px] border border-line px-3.5 py-3 text-[.92rem] text-fg-dim">
              Das System ist hier noch nicht eingerichtet: <code className="font-mono text-[.85em]">DATABASE_URL</code> fehlt. Die öffentliche Website ist davon nicht betroffen.
            </p>
          )}
        </div>
        <p className="mt-6 text-center text-[.78rem] text-fg-mute">Zugang nur für Mitarbeiter von ING Gutachten.</p>
      </div>
    </div>
  );
}
