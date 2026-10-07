'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminIcon } from '@/components/admin/AdminIcon';

type Hit = { id: string; label: string; sub: string };

/** Kunde suchen (gleiche Suche wie ⌘K, also mit denselben Zugriffsregeln) und zur Fahrzeugerfassung weiterleiten. */
export function CustomerPicker() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q.trim())}`, { credentials: 'same-origin' });
        if (res.ok) setHits(((await res.json()).customers ?? []) as Hit[]);
      } catch { setHits([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="adm-card" style={{ maxWidth: 640, display: 'grid', gap: 12 }}>
      <label className="adm-field"><span className="adm-label">Kunde suchen</span>
        <div className="adm-input-group"><AdminIcon name="search" /><input className="adm-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, Firma, Telefon oder E-Mail" autoComplete="off" autoFocus /></div>
      </label>
      {hits.length > 0 ? (
        <ul className="adm-list">{hits.map((h) => <li key={h.id}><span className="main"><Link href={`/admin/kunden/${h.id}/fahrzeug-neu/`} className="stretch">{h.label}</Link><span className="secondary">{h.sub}</span></span></li>)}</ul>
      ) : q.trim().length >= 2 ? <p className="t-3" style={{ margin: 0 }}>Kein Kunde gefunden.</p> : null}
      <p className="t-3" style={{ margin: 0, fontSize: 13 }}>Noch kein Kunde? Unter <Link href="/admin/kunden" className="adm-link">Kunden</Link> anlegen oder eine Anfrage umwandeln.</p>
    </div>
  );
}
