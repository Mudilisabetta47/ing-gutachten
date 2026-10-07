import Link from 'next/link';
import type { ReactNode } from 'react';

export function PageHeader({ title, intro, actions }: { title: string; intro?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-1.5">
        <h1 className="adm-h1">{title}</h1>
        {intro && <p className="max-w-[60ch] text-[.95rem] text-fg-dim">{intro}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Serverseitige Seitennavigation – hält die Filter in der URL. */
export function Pagination({ total, page, pageSize, basePath, params }: { total: number; page: number; pageSize: number; basePath: string; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return <p className="mt-4 font-mono text-[.66rem] uppercase tracking-[.12em] text-fg-mute">{total} Einträge</p>;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set('seite', String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <nav className="mt-4 flex flex-wrap items-center justify-between gap-3" aria-label="Seiten">
      <p className="font-mono text-[.66rem] uppercase tracking-[.12em] text-fg-mute">
        {total} Einträge · Seite {page} von {pages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className="adm-btn adm-btn-ghost">
            ← Zurück
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={href(page + 1)} className="adm-btn adm-btn-ghost">
            Weiter →
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="grid gap-0.5">
      <span className="adm-label">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="mt-1 text-[.8rem] text-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'ok'; children: ReactNode }) {
  const color = tone === 'error' ? 'border-danger/50 text-danger' : tone === 'ok' ? 'border-ok/40 text-ok' : 'border-line text-fg-dim';
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-[10px] border px-3.5 py-2.5 text-[.9rem] ${color}`}>
      {children}
    </p>
  );
}

export const fmtDateTime = (d: Date | null | undefined) =>
  d ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(d) : '–';
