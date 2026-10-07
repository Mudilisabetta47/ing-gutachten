import Link from 'next/link';
import type { ReactNode } from 'react';
import { AdminIcon, type IconName } from './AdminIcon';

/* ======================================================================
   Admin-Komponenten (Server Components). Alle Optik kommt aus admin.css.
   ====================================================================== */

/* ------------------------------------------------------------ Formatierung */
const TZ = 'Europe/Berlin';
export const fmtDateTime = (d: Date | null | undefined) => (d ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: TZ }).format(d) : '–');
export const fmtDate = (d: Date | null | undefined) => (d ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeZone: TZ }).format(d) : '–');
const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
const hm = (d: Date) => new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(d);

/** „Heute · 15:22“, „Gestern · 09:10“ oder „07.10.2026 · 15:22“ */
export function fmtWhen(d: Date | null | undefined): string {
  if (!d) return '–';
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000));
  const k = dayKey(d);
  const day = k === today ? 'Heute' : k === yesterday ? 'Gestern' : new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeZone: TZ }).format(d);
  return `${day} · ${hm(d)}`;
}

/** Kurze technische Kennung aus einer ID, z. B. „ANF-3F9K2“ – bewusst nicht der Klartext der DB-ID. */
export const shortRef = (id: string, prefix: string) => `${prefix}-${id.slice(-5).toUpperCase()}`;

export const phoneHref = (p: string | null | undefined) => (p ? `tel:${p.replace(/[^\d+]/g, '')}` : undefined);
export const mapsHref = (q: string | null | undefined) => (q ? `https://maps.google.com/?q=${encodeURIComponent(q)}` : undefined);

/** Seitenparameter sicher lesen (Next liefert string | string[] | undefined). */
export const qp = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v) || undefined;
export const qpage = (v: string | string[] | undefined): number => Math.max(1, Math.min(10_000, Number.parseInt(qp(v) ?? '1', 10) || 1));

/* ------------------------------------------------------------ Kopfbereiche */
export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="adm-crumbs" aria-label="Brotkrumen">
      {items.map((c, i) => (
        <span key={`${c.label}${i}`} style={{ display: 'contents' }}>
          {i > 0 && <span className="sep" aria-hidden="true">/</span>}
          {c.href ? <Link href={c.href}>{c.label}</Link> : <span aria-current="page" className={i === items.length - 1 ? 'mono' : undefined}>{c.label}</span>}
        </span>
      ))}
    </nav>
  );
}

/** Standardkopf für Listen- und Verwaltungsseiten. */
export function PageHeader({ title, intro, actions, crumbs }: { title: string; intro?: ReactNode; actions?: ReactNode; crumbs?: Crumb[] }) {
  return (
    <header>
      {crumbs ? <Breadcrumbs items={crumbs} /> : null}
      <div className="adm-page-head">
        <div className="titles">
          <h1>{title}</h1>
          {intro ? <p className="sub">{intro}</p> : null}
        </div>
        {actions ? <div className="adm-actions">{actions}</div> : null}
      </div>
    </header>
  );
}

/** Kopf für Detailseiten: Brotkrumen, Titel, Status, Meta-Zeile, Aktionen (genau EINE Primäraktion). */
export function DetailHeader({ crumbs, title, badge, meta, actions, lead }: { crumbs: Crumb[]; title: ReactNode; badge?: ReactNode; meta?: ReactNode[]; actions?: ReactNode; lead?: ReactNode }) {
  return (
    <header className="adm-detail-head">
      <Breadcrumbs items={crumbs} />
      <div className="row1">
        <div style={{ minWidth: 0, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          {lead}
          <div style={{ minWidth: 0 }}>
            <h1 style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px' }}>
              <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{title}</span>
              {badge}
            </h1>
            {meta && meta.length > 0 ? (
              <div className="adm-detail-meta">
                {meta.map((m, i) => <span key={i} className={i > 0 ? 'dotsep' : undefined}>{m}</span>)}
              </div>
            ) : null}
          </div>
        </div>
        {actions ? <div className="adm-actions">{actions}</div> : null}
      </div>
    </header>
  );
}

export function SummaryBar({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="adm-summary">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v === null || v === undefined || v === '' ? <span className="t-3">–</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Kpis({ children }: { children: ReactNode }) {
  return <section className="adm-kpis" aria-label="Kennzahlen">{children}</section>;
}
export function Kpi({ label, value, href, note, warn, testId }: { label: string; value: number | string; href?: string; note?: string; warn?: boolean; testId?: string }) {
  const body = (
    <>
      <span className="k">{label}</span>
      <span className="v" data-testid={testId}>{value}</span>
      {note ? <span className={`n ${warn ? 'warn' : ''}`}>{note}</span> : <span className="n">&nbsp;</span>}
    </>
  );
  return href ? <Link href={href} className="adm-kpi">{body}</Link> : <div className="adm-kpi">{body}</div>;
}

/* ------------------------------------------------------------ Status */
const LEAD_TONE: Record<string, string> = { NEW: 'info', CONTACTED: 'muted', APPOINTMENT_PENDING: 'warn', APPOINTMENT_SET: 'ok', CONVERTED: 'ok', CLOSED: 'muted', SPAM: 'danger' };
const CASE_TONE: Record<string, string> = {
  NEW: 'info', APPOINTMENT_PENDING: 'warn', APPOINTMENT_SET: 'info', INSPECTED: 'info', DOCUMENTS_MISSING: 'warn', IN_PROGRESS: 'info',
  REPORT_READY: 'ok', REPORT_SENT: 'ok', INVOICED: 'ok', CLOSED: 'muted', CANCELLED: 'danger',
};

/** Hochwertige, zurückhaltende Status-Pille: Blau = aktiv/neu, Amber = wartet, Grün = erledigt, Rot = Abbruch, Grau = ruhend. */
export function StatusPill({ kind, status, label, large }: { kind: 'lead' | 'case'; status: string; label: string; large?: boolean }) {
  const tone = (kind === 'lead' ? LEAD_TONE : CASE_TONE)[status] ?? 'muted';
  return <span className={`adm-badge adm-badge-${tone} ${large ? 'adm-pill-lg' : ''}`}>{label}</span>;
}
export const StatusBadge = StatusPill;

export function Badge({ tone = 'muted', children }: { tone?: 'info' | 'ok' | 'warn' | 'danger' | 'muted'; children: ReactNode }) {
  return <span className={`adm-badge adm-badge-${tone}`}>{children}</span>;
}

export function Avatar({ name, size }: { name: string; size?: 'sm' | 'lg' }) {
  const i = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
  return <span className={`adm-avatar ${size === 'lg' ? 'adm-avatar-lg' : size === 'sm' ? 'adm-avatar-sm' : ''}`} aria-hidden="true">{i}</span>;
}

/* ------------------------------------------------------------ Reiter */
export type TabItem = { key: string; label: string; href: string; count?: number; disabled?: boolean };
export function Tabs({ items, active, label }: { items: TabItem[]; active: string; label: string }) {
  return (
    <nav className="adm-tabs" aria-label={label}>
      {items.map((t) => (
        <Link key={t.key} href={t.href} className="adm-tab" aria-current={t.key === active ? 'page' : undefined} scroll={false}>
          {t.label}
          {t.count ? <span className="n">{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------ Inhalt: Sektionen & Reihen */
export function Section({ id, title, children, aside }: { id?: string; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section id={id} className="adm-section" aria-labelledby={id ? `${id}-h` : undefined}>
      <div className="adm-section-h">
        <h2 id={id ? `${id}-h` : undefined}>{title}</h2>
        {aside ? <span className="aside">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

/** Definitionsreihen: Label links gedämpft, Wert rechts – statt einer Karten-Wüste. */
export function Rows({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="adm-rows">
      {items.map(([k, v]) => (
        <div key={k} className="adm-row">
          <dt>{k}</dt>
          <dd>{v === null || v === undefined || v === '' ? <span className="t-3">–</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}
export const Kv = Rows;

export function AsideBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="adm-aside-block">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function Panel({ children, flush, className = '' }: { children: ReactNode; flush?: boolean; className?: string }) {
  return <div className={`adm-panel ${flush ? 'adm-panel-flush' : ''} ${className}`}>{children}</div>;
}

/* ------------------------------------------------------------ Zeitleiste */
export type TimelineItem = { id: string; at: Date; actor: string | null; text: string; kind: 'status' | 'note' | 'system'; detail?: string | null; /** Ereignis ohne handelnde Person („Anfrage über die Website eingegangen“) */ plain?: boolean };
export function Timeline({ items, empty = 'Noch keine Aktivität.' }: { items: TimelineItem[]; empty?: string }) {
  if (items.length === 0) return <p className="t-3" style={{ margin: 0 }}>{empty}</p>;
  const today = dayKey(new Date());
  return (
    <ol className="adm-timeline">
      {items.map((i) => (
        <li key={i.id} data-kind={i.kind}>
          <span className="time">
            {hm(i.at)}
            {dayKey(i.at) !== today ? <small>{new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', timeZone: TZ }).format(i.at)}.</small> : null}
          </span>
          <span className="body">
            {i.plain ? null : <><span className="who">{i.actor ?? 'System'}</span>{' '}</>}{i.text}
            {i.detail ? <span className="detail">{i.detail}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------ Zustände */
export function EmptyState({ title, children, action, icon = 'info' }: { title: string; children?: ReactNode; action?: ReactNode; icon?: IconName }) {
  return (
    <div className="adm-empty">
      <span className="ico"><AdminIcon name={icon} /></span>
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action ? <div className="act">{action}</div> : null}
    </div>
  );
}

export function Alert({ tone = 'info', children, icon }: { tone?: 'info' | 'warn' | 'danger' | 'ok'; children: ReactNode; icon?: IconName }) {
  const ico: IconName = icon ?? (tone === 'ok' ? 'check' : tone === 'info' ? 'info' : 'alert');
  return (
    <div className={`adm-alert ${tone === 'info' ? '' : `adm-alert-${tone}`}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <AdminIcon name={ico} />
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}
/** Kompatibilität: ältere Seiten nutzen <Notice tone="error|ok|info"> */
export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'ok'; children: ReactNode }) {
  return <Alert tone={tone === 'error' ? 'danger' : tone}>{children}</Alert>;
}

/* ------------------------------------------------------------ Formularfelder */
export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="adm-field">
      <span className="adm-label">{label}</span>
      {children}
      {hint && !error ? <span className="adm-hint">{hint}</span> : null}
      {error ? <span role="alert" className="adm-error">{error}</span> : null}
    </label>
  );
}

/* ------------------------------------------------------------ Tabellen-Werkzeuge */
const qs = (params: Record<string, string | undefined>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  return sp.toString();
};
export const hrefWith = (basePath: string, params: Record<string, string | undefined>) => {
  const s = qs(params);
  return s ? `${basePath}?${s}` : basePath;
};

/** Sortierbare Spaltenüberschrift (serverseitig: Link mit ?sort=…&dir=…). */
export function SortTh({ label, field, sort, dir, basePath, params, className }: { label: string; field: string; sort?: string; dir?: string; basePath: string; params: Record<string, string | undefined>; className?: string }) {
  const on = sort === field;
  const nextDir = on && dir === 'asc' ? 'desc' : 'asc';
  return (
    <th className={className} aria-sort={on ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      <Link href={hrefWith(basePath, { ...params, sort: field, dir: nextDir, seite: undefined })} scroll={false}>
        {label}
        {on ? <AdminIcon name={dir === 'asc' ? 'arrowUp' : 'arrowDown'} /> : null}
      </Link>
    </th>
  );
}

export type Chip = { label: string; value: string; href: string };
/** Aktive Filter als entfernbare Chips + „Alle löschen“. */
export function FilterChips({ chips, clearHref }: { chips: Chip[]; clearHref: string }) {
  if (chips.length === 0) return null;
  return (
    <div className="adm-chips" aria-label="Aktive Filter">
      {chips.map((c) => (
        <span key={c.label + c.value} className="adm-chip">
          <b>{c.label}:</b> {c.value}
          <Link href={c.href} aria-label={`Filter ${c.label} entfernen`}><AdminIcon name="x" /></Link>
        </span>
      ))}
      {chips.length > 1 ? <Link href={clearHref} className="adm-link" style={{ fontSize: 12, marginLeft: 4 }}>Alle löschen</Link> : null}
    </div>
  );
}

/** Serverseitige Seitennavigation – hält Filter und Sortierung in der URL. */
export function Pagination({ total, page, pageSize, basePath, params, noun = 'Einträge' }: { total: number; page: number; pageSize: number; basePath: string; params: Record<string, string | undefined>; noun?: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => hrefWith(basePath, { ...params, seite: p > 1 ? String(p) : undefined });
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className="dt-foot" aria-label="Seiten">
      <span>{total === 0 ? `Keine ${noun}` : `${from}–${to} von ${total} ${noun}`}</span>
      {pages > 1 ? (
        <div className="pager">
          {page > 1 ? <Link href={href(page - 1)} className="adm-btn adm-btn-secondary adm-btn-sm"><AdminIcon name="chevronRight" className="h-3.5 w-3.5 rotate-180" />Zurück</Link> : null}
          <span style={{ alignSelf: 'center' }}>Seite {page} von {pages}</span>
          {page < pages ? <Link href={href(page + 1)} className="adm-btn adm-btn-secondary adm-btn-sm">Weiter<AdminIcon name="chevronRight" className="h-3.5 w-3.5" /></Link> : null}
        </div>
      ) : null}
    </nav>
  );
}

export function Skeleton({ w = '100%', h = 14, r }: { w?: string | number; h?: number; r?: number }) {
  return <span className="adm-skel" style={{ width: w, height: h, borderRadius: r }} aria-hidden="true" />;
}
