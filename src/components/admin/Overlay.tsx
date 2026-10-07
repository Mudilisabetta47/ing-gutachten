'use client';

import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AdminIcon, type IconName } from './AdminIcon';

/* ------------------------------------------------------------------ Drawer ------------------------------------------------------------------ */

const OpenCtx = createContext<(id: string) => void>(() => {});
const CloseCtx = createContext<() => void>(() => {});
export const useOpenDrawer = () => useContext(OpenCtx);
/** Aus einem Formular im Drawer heraus: Drawer nach Erfolg schließen. */
export const useDrawerClose = () => useContext(CloseCtx);

export type DrawerDef = { id: string; title: string; content: ReactNode };

/**
 * Hält alle Drawer einer Seite (native <dialog>: Fokusfalle, Esc, Hintergrund-Sperre gratis).
 * Inhalte werden erst beim Öffnen gerendert – so startet jedes Formular frisch.
 * Mobil wird der Drawer zum Bottom Sheet (CSS).
 */
export function DrawerHost({ drawers, children }: { drawers: DrawerDef[]; children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const refs = useRef<Record<string, HTMLDialogElement | null>>({});
  const open = useCallback((id: string) => {
    setOpenId(id);
    const el = refs.current[id];
    if (el && !el.open) el.showModal();
  }, []);
  return (
    <OpenCtx.Provider value={open}>
      {children}
      {drawers.map((d) => (
        <dialog
          key={d.id}
          ref={(el) => { refs.current[d.id] = el; }}
          className="adm-dialog adm-drawer"
          aria-labelledby={`drawer-${d.id}-h`}
          onClose={() => setOpenId((cur) => (cur === d.id ? null : cur))}
          onClick={(e) => { if (e.target === refs.current[d.id]) refs.current[d.id]?.close(); }}
        >
          <div className="adm-drawer-head">
            <h2 id={`drawer-${d.id}-h`}>{d.title}</h2>
            <button type="button" className="adm-btn adm-btn-quiet adm-btn-icon adm-btn-sm" onClick={() => refs.current[d.id]?.close()} aria-label="Schließen">
              <AdminIcon name="x" />
            </button>
          </div>
          <div className="adm-drawer-body">
            {openId === d.id ? <CloseCtx.Provider value={() => refs.current[d.id]?.close()}>{d.content}</CloseCtx.Provider> : null}
          </div>
        </dialog>
      ))}
    </OpenCtx.Provider>
  );
}

export function OpenDrawer({ id, children, className = 'adm-btn adm-btn-secondary', icon }: { id: string; children: ReactNode; className?: string; icon?: IconName }) {
  const open = useOpenDrawer();
  return (
    <button type="button" className={className} onClick={() => open(id)}>
      {icon ? <AdminIcon name={icon} /> : null}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ Popover / Menü ------------------------------------------------------------------ */

export function Popover({ trigger, label, children, align = 'right', up = false, triggerClassName = 'adm-btn adm-btn-quiet adm-btn-icon', badge }: { trigger: ReactNode; label: string; children: ReactNode | ((close: () => void) => ReactNode); align?: 'left' | 'right'; up?: boolean; triggerClassName?: string; badge?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className="adm-menu-wrap" ref={wrap}>
      <button type="button" className={triggerClassName} aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} style={{ position: 'relative' }}>
        {trigger}
        {badge}
      </button>
      {open && (
        <div className={`adm-menu ${up ? 'adm-menu-up' : ''}`} data-align={align} role="menu" onClick={(e) => { if ((e.target as HTMLElement).closest('a,[data-close]')) setOpen(false); }}>
          {typeof children === 'function' ? children(close) : children}
        </div>
      )}
    </div>
  );
}

export type MenuEntry =
  | { kind: 'link'; label: string; href: string; icon?: IconName }
  | { kind: 'drawer'; label: string; drawer: string; icon?: IconName }
  | { kind: 'label'; label: string }
  | { kind: 'sep' };

export function Menu({ entries, ...rest }: { entries: MenuEntry[]; label: string; trigger: ReactNode; align?: 'left' | 'right'; up?: boolean; triggerClassName?: string; badge?: ReactNode }) {
  const open = useOpenDrawer();
  return (
    <Popover {...rest}>
      {entries.map((e, i) =>
        e.kind === 'sep' ? <div key={i} className="adm-menu-sep" role="separator" /> :
        e.kind === 'label' ? <p key={i} className="adm-menu-label">{e.label}</p> :
        e.kind === 'link' ? (
          <Link key={i} href={e.href} role="menuitem" className="adm-menu-item">{e.icon ? <AdminIcon name={e.icon} /> : null}{e.label}</Link>
        ) : (
          <button key={i} type="button" role="menuitem" data-close className="adm-menu-item" onClick={() => open(e.drawer)}>{e.icon ? <AdminIcon name={e.icon} /> : null}{e.label}</button>
        ),
      )}
    </Popover>
  );
}

/* ------------------------------------------------------------------ Bestätigung (Modal) ------------------------------------------------------------------ */

/** Modal nur für kurze, kritische Entscheidungen. `children` = das Formular mit der Server Action. */
export function ConfirmModal({ trigger, title, text, children, triggerClassName = 'adm-btn adm-btn-danger' }: { trigger: ReactNode; title: string; text: string; children: (close: () => void) => ReactNode; triggerClassName?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => { setOpen(true); ref.current?.showModal(); }}>{trigger}</button>
      <dialog
        ref={ref}
        className="adm-dialog adm-modal"
        aria-labelledby="confirm-h"
        onClose={() => setOpen(false)}
        onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
      >
        <h2 id="confirm-h">{title}</h2>
        <p>{text}</p>
        {open ? children(() => ref.current?.close()) : null}
      </dialog>
    </>
  );
}
