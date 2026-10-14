'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Läuft nur, wenn die Seite als Fenster im ING Studio eingebettet ist (gleicher Ursprung).
 * Meldet Adresse und Titel an das Studio, leitet Tastenkürzel und Rechtsklick auf Links weiter und
 * ermöglicht „In neuem Fenster öffnen“. Außerhalb des Studios (kein Elternfenster) tut diese Komponente nichts.
 */
// Tastenkürzel nach `code` (auf dem Mac verändert Alt die Zeichen) – Strg+Alt + Pfeile/W/Tab/J/D
const CODES = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'Tab', 'KeyJ', 'KeyD']);

export function EmbedBridge() {
  const pathname = usePathname();
  const search = useSearchParams();
  const href = `${pathname}${search.toString() ? `?${search.toString()}` : ''}`;

  useEffect(() => {
    if (window.self === window.top) return;
    const post = (msg: Record<string, unknown>) => window.parent.postMessage({ source: 'ing-embed', ...msg }, window.location.origin);
    if (pathname.replace(/\/+$/, '') === '/admin/login') { post({ type: 'auth' }); return; }
    const sendNav = () => post({ type: 'nav', href, title: document.title });
    sendNav();
    const titleEl = document.querySelector('title');
    const mo = titleEl ? new MutationObserver(sendNav) : null;
    if (titleEl && mo) mo.observe(titleEl, { childList: true, characterData: true, subtree: true });
    return () => mo?.disconnect();
  }, [href, pathname]);

  useEffect(() => {
    if (window.self === window.top) return;
    const post = (msg: Record<string, unknown>) => window.parent.postMessage({ source: 'ing-embed', ...msg }, window.location.origin);
    const internalLink = (t: EventTarget | null): HTMLAnchorElement | null => {
      const a = (t as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.origin !== window.location.origin) return null;
      return /^\/admin(\/|$)/.test(a.pathname) && !a.pathname.startsWith('/admin/login') ? a : null;
    };
    const open = (a: HTMLAnchorElement) => post({ type: 'open', href: a.pathname + a.search, label: (a.textContent ?? '').trim().slice(0, 60) });
    const onDown = () => post({ type: 'focus' });
    const onClick = (e: MouseEvent) => {
      const a = internalLink(e.target);
      if (a && (e.ctrlKey || e.metaKey || e.shiftKey)) { e.preventDefault(); e.stopPropagation(); open(a); }
    };
    const onAux = (e: MouseEvent) => {
      if (e.button !== 1) return;
      const a = internalLink(e.target);
      if (a) { e.preventDefault(); open(a); }
    };
    const onCtx = (e: MouseEvent) => {
      const a = internalLink(e.target);
      if (!a) return;
      e.preventDefault();
      post({ type: 'ctx', href: a.pathname + a.search, label: (a.textContent ?? '').trim().slice(0, 60), x: e.clientX, y: e.clientY });
    };
    const onKey = (e: KeyboardEvent) => {
      const cmdK = (e.metaKey || e.ctrlKey) && e.code === 'KeyK';
      const combo = e.ctrlKey && e.altKey && CODES.has(e.code);
      if (cmdK || combo) { e.preventDefault(); post({ type: 'key', code: e.code, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey }); }
    };
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return;
      const d = e.data as { source?: string; type?: string; value?: string } | null;
      if (d?.source !== 'ing-studio') return;
      if (d.type === 'theme' && (d.value === 'dark' || d.value === 'light' || d.value === 'system')) document.querySelector('.adm-root')?.setAttribute('data-theme', d.value);
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('auxclick', onAux, true);
    document.addEventListener('contextmenu', onCtx, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('message', onMsg);
    // Bereitmeldung: das Studio antwortet mit der aktuellen Darstellung (auch wenn sie sich geändert hat, während die Seite lud)
    post({ type: 'ready' });
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('auxclick', onAux, true);
      document.removeEventListener('contextmenu', onCtx, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('message', onMsg);
    };
  }, []);

  return null;
}
