'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AdminIcon } from './AdminIcon';

type Tone = 'ok' | 'error' | 'info';
type ToastItem = { id: number; tone: Tone; text: string };
type Push = (text: string, tone?: Tone) => void;

const Ctx = createContext<Push>(() => {});
export const useToast = (): Push => useContext(Ctx);

/** Rückmeldungen („Status geändert“, „Fehler beim Versand“) – nie ein Browser-alert(). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback<Push>(
    (text, tone = 'ok') => {
      const id = next.current++;
      setItems((l) => [...l.slice(-3), { id, tone, text }]);
      setTimeout(() => dismiss(id), tone === 'error' ? 9000 : 4500);
    },
    [dismiss],
  );
  const value = useMemo(() => push, [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="adm-toasts" role="region" aria-label="Benachrichtigungen" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="adm-toast" data-tone={t.tone} role={t.tone === 'error' ? 'alert' : 'status'}>
            <AdminIcon name={t.tone === 'ok' ? 'check' : t.tone === 'error' ? 'alert' : 'info'} />
            <span>{t.text}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Schließen">
              <AdminIcon name="x" className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

/** Zeigt beim Laden einer Seite einmal einen Toast (z. B. nach einer Weiterleitung) und räumt die URL auf. */
export function FlashToast({ text, tone = 'ok', param }: { text: string; tone?: Tone; param?: string }) {
  const push = useToast();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    push(text, tone);
    if (param) {
      const u = new URL(window.location.href);
      u.searchParams.delete(param);
      window.history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
    }
  }, [push, text, tone, param]);
  return null;
}
