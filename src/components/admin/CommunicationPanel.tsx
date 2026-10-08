'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { AdminIcon } from './AdminIcon';
import { useToast } from './Toast';
import { Badge } from './ui';
import { addCommunicationAction, setPinnedAction } from '@/app/admin/(panel)/faelle/communication-actions';

export type CNote = { id: string; kind: 'NOTE' | 'PHONE_CALL'; body: string; pinned: boolean; external: boolean; createdAt: string; author: string | null; mentions: string[]; call: { direction: 'INBOUND' | 'OUTBOUND' | null; phone: string | null; outcome: string | null } | null };
type Person = { id: string; name: string };
const when = (iso: string) => new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(iso));

/** Text mit hervorgehobenen @Erwähnungen (nur die tatsächlich erwähnten Personen). */
function Body({ text, mentions }: { text: string; mentions: string[] }) {
  if (!mentions.length) return <p>{text}</p>;
  const parts: (string | { m: string })[] = [text];
  for (const m of mentions) {
    const token = `@${m}`;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (typeof p !== 'string' || !p.includes(token)) continue;
      const [a, ...rest] = p.split(token);
      parts.splice(i, 1, a, { m }, rest.join(token));
    }
  }
  return <p>{parts.map((p, i) => (typeof p === 'string' ? p : <span key={i} className="com-mention">@{p.m}</span>))}</p>;
}

export function CommunicationPanel({ caseId, caseNumber, notes, people, canWrite, defaultPhone }: { caseId: string; caseNumber: string; notes: CNote[]; people: Person[]; canWrite: boolean; defaultPhone?: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const area = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<'NOTE' | 'PHONE_CALL'>('NOTE');
  const [body, setBody] = useState('');
  const [external, setExternal] = useState(false);
  const [pinned, setPinnedNew] = useState(false);
  const [dir, setDir] = useState<'INBOUND' | 'OUTBOUND'>('INBOUND');
  const [phone, setPhone] = useState(defaultPhone ?? '');
  const [outcome, setOutcome] = useState('');
  const [mentioned, setMentioned] = useState<Person[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const insertMention = (id: string) => {
    const p = people.find((x) => x.id === id);
    if (!p) return;
    setMentioned((m) => (m.some((x) => x.id === p.id) ? m : [...m, p]));
    setBody((b) => `${b}${b && !/\s$/.test(b) ? ' ' : ''}@${p.name} `);
    area.current?.focus();
  };
  const submit = () => {
    setErr(null);
    start(async () => {
      const r = await addCommunicationAction({ caseId, caseNumber, note: { body, kind: mode, external, pinned, mentionIds: mentioned.filter((m) => body.includes(`@${m.name}`)).map((m) => m.id), call: mode === 'PHONE_CALL' ? { direction: dir, phone, outcome } : null } });
      if (!r.ok) { setErr(r.error ?? 'Das hat nicht geklappt.'); return; }
      toast(r.message ?? 'Gespeichert.', 'ok'); setBody(''); setMentioned([]); setOutcome(''); setPinnedNew(false); router.refresh();
    });
  };
  const pin = (n: CNote) => start(async () => { const r = await setPinnedAction({ id: n.id, caseNumber, pinned: !n.pinned }); toast(r.ok ? r.message ?? 'Gespeichert.' : r.error ?? 'Das hat nicht geklappt.', r.ok ? 'ok' : 'error'); if (r.ok) router.refresh(); });

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {canWrite && (
        <form className="adm-card" style={{ padding: 14, display: 'grid', gap: 10 }} onSubmit={(e) => { e.preventDefault(); submit(); }} aria-label="Neuer Eintrag">
          <div className="adm-seg" role="group" aria-label="Art des Eintrags" style={{ margin: 0 }}>
            <a role="button" tabIndex={0} aria-current={mode === 'NOTE' ? 'page' : undefined} onClick={() => setMode('NOTE')} onKeyDown={(e) => e.key === 'Enter' && setMode('NOTE')}><AdminIcon name="note" />Notiz</a>
            <a role="button" tabIndex={0} aria-current={mode === 'PHONE_CALL' ? 'page' : undefined} onClick={() => setMode('PHONE_CALL')} onKeyDown={(e) => e.key === 'Enter' && setMode('PHONE_CALL')}><AdminIcon name="phone" />Anruf protokollieren</a>
          </div>
          {mode === 'PHONE_CALL' && (
            <div className="adm-form-grid">
              <label className="adm-field"><span className="adm-label">Richtung</span><select className="adm-input" value={dir} onChange={(e) => setDir(e.target.value as 'INBOUND')}><option value="INBOUND">Eingehend</option><option value="OUTBOUND">Ausgehend</option></select></label>
              <label className="adm-field"><span className="adm-label">Rufnummer</span><input className="adm-input" value={phone} maxLength={40} onChange={(e) => setPhone(e.target.value)} /></label>
              <label className="adm-field span-2"><span className="adm-label">Ergebnis (optional)</span><input className="adm-input" value={outcome} maxLength={200} onChange={(e) => setOutcome(e.target.value)} placeholder="z. B. Rückruf vereinbart" /></label>
            </div>
          )}
          <label className="adm-field"><span className="adm-label">{mode === 'PHONE_CALL' ? 'Gesprächsnotiz' : 'Notiz'}</span><textarea ref={area} className="adm-input" rows={3} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} /></label>
          <div className="adm-actions" style={{ alignItems: 'center' }}>
            {people.length > 0 && (
              <select className="adm-input" style={{ maxWidth: 220 }} aria-label="Person erwähnen" value="" onChange={(e) => e.target.value && insertMention(e.target.value)}>
                <option value="">@ Person erwähnen …</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={external} onChange={(e) => setExternal(e.target.checked)} />Extern (darf an Dritte weitergegeben werden)</label>
            <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={pinned} onChange={(e) => setPinnedNew(e.target.checked)} />Oben anheften</label>
          </div>
          {err && <div className="adm-alert adm-alert-danger" role="alert"><AdminIcon name="alert" />{err}</div>}
          <div><button type="submit" className="adm-btn" disabled={pending}><AdminIcon name="check" />Speichern</button></div>
          <p className="vi-hint" style={{ margin: 0 }}>Standardmäßig sind Einträge intern. Das System versendet nichts – „extern“ markiert nur, dass der Text weitergegeben werden darf.</p>
        </form>
      )}
      {notes.length === 0 ? <p className="t-3" style={{ margin: 0 }}>Noch keine Einträge.</p> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {notes.map((n) => (
            <article key={n.id} className={`com-note${n.pinned ? ' is-pinned' : ''}`}>
              <header>
                {n.pinned && <Badge tone="warn">Angeheftet</Badge>}
                <Badge tone={n.kind === 'PHONE_CALL' ? 'info' : 'muted'}>{n.kind === 'PHONE_CALL' ? 'Anruf' : 'Notiz'}</Badge>
                <Badge tone={n.external ? 'ok' : 'muted'}>{n.external ? 'Extern' : 'Intern'}</Badge>
                <span>{n.author ?? 'System'} · {when(n.createdAt)}</span>
                {canWrite && <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" style={{ marginLeft: 'auto' }} disabled={pending} onClick={() => pin(n)}><AdminIcon name="pin" />{n.pinned ? 'Lösen' : 'Anheften'}</button>}
              </header>
              {n.call && <p className="t-2" style={{ fontSize: 12.5 }}>{n.call.direction === 'INBOUND' ? 'Eingehender' : 'Ausgehender'} Anruf{n.call.phone ? ` · ${n.call.phone}` : ''}{n.call.outcome ? ` · Ergebnis: ${n.call.outcome}` : ''}</p>}
              <Body text={n.body} mentions={n.mentions} />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
