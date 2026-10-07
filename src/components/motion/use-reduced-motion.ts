'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/**
 * prefers-reduced-motion, hydration-sicher: Server und erster Client-Render
 * liefern `false` (identisches HTML), direkt danach wird der echte Wert
 * übernommen. Framers eigener Hook liefert auf dem Client schon im ersten
 * Render `true` – das erzeugt bei strukturell abweichendem Markup einen
 * Hydration-Fehler (React #418).
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
