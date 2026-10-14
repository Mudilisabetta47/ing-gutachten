'use client';

import { useEffect, useRef } from 'react';
import { SysIcon } from './StudioIcon';

export type Notice = { id: string; label: string; href: string; count: number; tone: 'info' | 'warn' | 'danger' };
export type Notif = { id: string; text: string; href: string | null; read: boolean; at: string };

const when = (iso: string) => new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(new Date(iso));

/** Benachrichtigungszentrale: offene Hinweise (Zähler aus echten Daten) und persönliche Benachrichtigungen (Zuweisungen, Erwähnungen). */
export function NotificationCenter({ notices, notifications, loaded, onOpen, onMarkRead, onRefresh, onClose }: {
  notices: Notice[]; notifications: Notif[]; loaded: boolean; onOpen: (href: string, label: string) => void; onMarkRead: () => void; onRefresh: () => void; onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (!root.current?.contains(t) && !t.closest('[data-notif-toggle]')) onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down, true); document.removeEventListener('keydown', key); };
  }, [onClose]);
  const unread = notifications.filter((n) => !n.read).length;
  return (
    <div ref={root} className="st-notif" role="dialog" aria-label="Benachrichtigungen">
      <header>
        <h3>Benachrichtigungen</h3>
        <button type="button" className="st-iconbtn" aria-label="Aktualisieren" title="Aktualisieren" onClick={onRefresh}><SysIcon name="refresh" /></button>
      </header>
      <div className="st-notif-scroll">
        <h4>Offene Hinweise</h4>
        {!loaded ? <p className="st-start-msg">Lädt …</p> : notices.length === 0 ? <p className="st-start-msg">Alles erledigt – keine offenen Hinweise.</p> : (
          <ul>
            {notices.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => { onOpen(n.href, n.label); onClose(); }}>
                  <i className={`st-dot is-${n.tone}`} aria-hidden="true" />
                  <span>{n.label}</span>
                  <b>{n.count}</b>
                </button>
              </li>
            ))}
          </ul>
        )}
        <h4>
          Persönlich{unread ? ` · ${unread} neu` : ''}
          {unread > 0 && <button type="button" className="st-link" onClick={onMarkRead}>Alle gelesen</button>}
        </h4>
        {notifications.length === 0 ? <p className="st-start-msg">Keine Benachrichtigungen.</p> : (
          <ul>
            {notifications.map((n) => (
              <li key={n.id} className={n.read ? 'is-read' : ''}>
                <button type="button" disabled={!n.href} onClick={() => { if (n.href) { onOpen(n.href, 'Benachrichtigung'); onClose(); } }}>
                  <i className={`st-dot ${n.read ? 'is-muted' : 'is-info'}`} aria-hidden="true" />
                  <span>{n.text}<small>{when(n.at)}</small></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
