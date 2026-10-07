'use client';

import Link from 'next/link';
import { AdminIcon } from '@/components/admin/AdminIcon';

/** Fehlerzustand: freundlich, ohne Technik. Details stehen nur im Server-Log. */
export default function PanelError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="adm-empty" role="alert" style={{ marginTop: 48 }}>
      <span className="ico" style={{ color: 'rgb(var(--a-danger))' }}><AdminIcon name="alert" /></span>
      <h3>Die Seite konnte nicht geladen werden</h3>
      <p>Das ist auf unserer Seite etwas schiefgelaufen. Bitte versuchen Sie es erneut. Bleibt das Problem bestehen, geben Sie uns kurz Bescheid.</p>
      <div className="act">
        <button type="button" className="adm-btn" onClick={reset}>Erneut versuchen</button>
        <Link href="/admin" className="adm-btn adm-btn-secondary">Zum Dashboard</Link>
      </div>
    </div>
  );
}
