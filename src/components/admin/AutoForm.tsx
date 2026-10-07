'use client';

import type { ReactNode } from 'react';

/** Filterformular (GET): Auswahlfelder, Datum und Häkchen wenden den Filter sofort an; Textsuche per Enter/Button. */
export function AutoForm({ action, children, className = 'adm-toolbar' }: { action: string; children: ReactNode; className?: string }) {
  return (
    <form
      method="get"
      action={action}
      className={className}
      role="search"
      onChange={(e) => {
        const t = e.target as HTMLElement;
        if (t instanceof HTMLSelectElement || (t instanceof HTMLInputElement && (t.type === 'date' || t.type === 'checkbox'))) e.currentTarget.requestSubmit();
      }}
    >
      {children}
    </form>
  );
}
