'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from 'react';
import { AdminIcon } from './AdminIcon';
import { useToast } from './Toast';
import { deleteMapDamageAction, saveMapDamageAction } from '@/app/admin/(panel)/faelle/map-actions';
import {
  DAMAGE_KINDS, KIND_META, PART_BY_ID, SEVERITIES, SEVERITY_LABELS, VIEWS, projectView, topKind, partLabel,
  type DamageKindKey, type SeverityKey, type ViewKey,
} from '@/lib/vehicle-model';

export type MapDamage = {
  id: string; partId: string | null; view: string | null; kind: DamageKindKey; severity: SeverityKey | null; component: string; area: string;
  damageType: string | null; repairKind: string | null; description: string | null; priorNote: string | null; photoIds: string[];
};
export type MapPhoto = { id: string; mediaId: string; label: string; damageId: string | null };

const SHADE_OPACITY: Record<number, [string, number]> = { 0: ['#fff', 0.38], 1: ['#fff', 0.18], 3: ['#000', 0.07], 4: ['#000', 0.15] };
const AREAS: [string, string][] = [['FRONT', 'Front'], ['REAR', 'Heck'], ['LEFT', 'Links'], ['RIGHT', 'Rechts'], ['ROOF', 'Dach'], ['UNDERBODY', 'Unterboden'], ['WHEELS', 'Räder/Fahrwerk'], ['GLASS', 'Scheiben'], ['INTERIOR', 'Innenraum'], ['OTHER', 'Sonstiges']];

/* ------------------------------------------------------------ SVG einer Ansicht */

function VehicleSvg({ view, state, counts, selected, hover, onSelect, onHover, interactive = true, markers = true, mini = false }: {
  view: ViewKey; state: Map<string, DamageKindKey>; counts: Map<string, number>; selected: string | null; hover: string | null;
  onSelect?: (id: string) => void; onHover?: (id: string | null) => void; interactive?: boolean; markers?: boolean; mini?: boolean;
}) {
  const pv = useMemo(() => projectView(view), [view]);
  return (
    <svg viewBox={pv.viewBox} className="dm-svg" role="group" aria-label={`Fahrzeugansicht ${pv.label}`} preserveAspectRatio="xMidYMid meet">
      {pv.shadow.ry > 0 && <ellipse cx={pv.shadow.cx} cy={pv.shadow.cy} rx={pv.shadow.rx} ry={pv.shadow.ry} className="dm-shadow" />}
      {pv.shapes.map((sh, i) => {
        const id = sh.part;
        const kind = id ? state.get(id) : undefined;
        const isSel = id !== null && id === selected;
        const isHover = id !== null && id === hover;
        const color = kind ? KIND_META[kind].color : undefined;
        const clickable = interactive && id !== null && pv.parts.includes(id);
        const fillStyle: CSSProperties | undefined = color && sh.tone !== 'dark' && sh.tone !== 'tire' ? { fill: color, fillOpacity: sh.tone === 'glass' ? 0.82 : 0.92 } : undefined;
        const cls = `dm-p dm-t-${sh.tone}${isSel ? ' is-sel' : ''}${isHover ? ' is-hover' : ''}${kind ? ' has-dmg' : ''}`;
        const body = (
          <>
            <path d={sh.d} className="dm-fill" style={fillStyle} />
            {sh.shades.map((s) => <path key={s.k} d={s.d} fill={SHADE_OPACITY[s.k][0]} opacity={SHADE_OPACITY[s.k][1]} className="dm-shade" />)}
            <path d={sh.e} className="dm-edge" style={color && (sh.tone === 'tire' || sh.tone === 'dark') ? { stroke: color, strokeWidth: 1.6 } : undefined} />
          </>
        );
        if (!clickable) return <g key={i} className={cls} aria-hidden="true">{body}</g>;
        const label = partLabel(id) ?? id!;
        const n = counts.get(id!) ?? 0;
        return (
          <g
            key={i} className={`${cls} is-click`} tabIndex={0} role="button"
            aria-label={`${label}${kind ? `, ${KIND_META[kind].label}${n > 1 ? `, ${n} Einträge` : ''}` : ', kein Eintrag'}`} aria-pressed={isSel}
            onClick={() => onSelect?.(id!)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(id!); } }}
            onMouseEnter={() => onHover?.(id!)} onMouseLeave={() => onHover?.(null)} onFocus={() => onHover?.(id!)} onBlur={() => onHover?.(null)}
          >
            <title>{label}</title>
            {body}
          </g>
        );
      })}
      {markers && !mini && [...state.entries()].map(([id, kind]) => {
        const at = pv.anchors[id];
        if (!at || !pv.parts.includes(id)) return null;
        const n = counts.get(id) ?? 1;
        return (
          <g key={`m-${id}`} className="dm-marker" transform={`translate(${at[0]} ${at[1]})`} pointerEvents="none" aria-hidden="true">
            <circle r="11" fill={KIND_META[kind].color} />
            <text y="4.5" textAnchor="middle">{KIND_META[kind].icon}</text>
            {n > 1 && <g transform="translate(9 -9)"><circle r="7" fill="#17202e" /><text y="3.5" textAnchor="middle" className="dm-n">{n}</text></g>}
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------ Hauptkomponente */

type Draft = { id: string | null; kind: DamageKindKey; severity: SeverityKey | ''; damageType: string; repairKind: string; description: string; priorNote: string; photoIds: string[]; component: string; area: string };
const blank = (): Draft => ({ id: null, kind: 'CURRENT', severity: '', damageType: '', repairKind: '', description: '', priorNote: '', photoIds: [], component: '', area: 'OTHER' });

export function DamageMap({ caseId, caseNumber, damages, photos, canWrite, damageTypes, repairKinds }: {
  caseId: string; caseNumber: string; damages: MapDamage[]; photos: MapPhoto[]; canWrite: boolean; damageTypes: readonly string[]; repairKinds: readonly string[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [view, setView] = useState<ViewKey>('FRONT_LEFT');
  const [all, setAll] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [freeText, setFreeText] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState<{ error?: string; fields?: Record<string, string> } | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  const byPart = useMemo(() => {
    const m = new Map<string, MapDamage[]>();
    for (const d of damages) if (d.partId) m.set(d.partId, [...(m.get(d.partId) ?? []), d]);
    return m;
  }, [damages]);
  const state = useMemo(() => new Map([...byPart].map(([id, l]) => [id, topKind(l.map((d) => d.kind))!])), [byPart]);
  const counts = useMemo(() => new Map([...byPart].map(([id, l]) => [id, l.length])), [byPart]);
  const free = damages.filter((d) => !d.partId);
  const kindCount = useMemo(() => Object.fromEntries(DAMAGE_KINDS.map((k) => [k, damages.filter((d) => d.kind === k).length])) as Record<DamageKindKey, number>, [damages]);

  const select = (id: string) => {
    setSel(id); setFreeText(false); setErr(null);
    const list = byPart.get(id) ?? [];
    setDraft(canWrite && list.length === 0 ? { ...blank(), component: partLabel(id) ?? '', area: PART_BY_ID[id]?.area ?? 'OTHER' } : null);
    setTimeout(() => panel.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50);
  };
  const edit = (d: MapDamage) => { setErr(null); setDraft({ id: d.id, kind: d.kind, severity: d.severity ?? '', damageType: d.damageType ?? '', repairKind: d.repairKind ?? '', description: d.description ?? '', priorNote: d.priorNote ?? '', photoIds: d.photoIds, component: d.component, area: d.area }); };
  const addNew = (partId: string | null) => { setErr(null); setDraft({ ...blank(), component: partId ? partLabel(partId) ?? '' : '', area: partId ? PART_BY_ID[partId]?.area ?? 'OTHER' : 'OTHER' }); };

  // Esc schließt das Formular
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setDraft(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const save = () => {
    if (!draft) return;
    setErr(null);
    const data: Record<string, string> = {
      partId: sel && !freeText ? sel : '', view: sel && !freeText ? view : '', kind: draft.kind, severity: draft.severity, damageType: draft.damageType, repairKind: draft.repairKind,
      description: draft.description, priorNote: draft.priorNote, component: sel && !freeText ? '' : draft.component, area: sel && !freeText ? '' : draft.area,
    };
    startTransition(async () => {
      const res = await saveMapDamageAction({ caseId, caseNumber, id: draft.id, data, photoIds: draft.photoIds });
      if (!res.ok) { setErr({ error: res.error, fields: res.fields }); return; }
      toast(res.message ?? 'Gespeichert.', 'ok');
      setDraft(null);
      router.refresh();
    });
  };
  const remove = (d: MapDamage) => {
    if (!window.confirm(`„${d.component}“ wirklich löschen?`)) return;
    startTransition(async () => {
      const res = await deleteMapDamageAction({ id: d.id, caseNumber });
      toast(res.ok ? res.message ?? 'Gelöscht.' : res.error ?? 'Das hat nicht geklappt.', res.ok ? 'ok' : 'error');
      if (res.ok) { setDraft(null); router.refresh(); }
    });
  };

  const hoverLabel = hover ? `${partLabel(hover)}${counts.get(hover) ? ` · ${counts.get(hover)} Eintrag${(counts.get(hover) ?? 0) > 1 ? 'e' : ''}` : ''}` : sel && !freeText ? `${partLabel(sel)} ausgewählt` : 'Bauteil anklicken, um einen Schaden zu erfassen';
  const entries = sel && !freeText ? byPart.get(sel) ?? [] : free;
  const f = err?.fields ?? {};

  return (
    <div className="dm">
      <div className="dm-main adm-card">
        <div className="dm-toolbar">
          <div className="vi-modes" role="group" aria-label="Ansicht">
            {VIEWS.map((v) => <button key={v.key} type="button" aria-pressed={!all && view === v.key} onClick={() => { setView(v.key); setAll(false); }}>{v.label}</button>)}
          </div>
          <button type="button" className={`adm-btn ${all ? '' : 'adm-btn-secondary'}`} aria-pressed={all} onClick={() => setAll((a) => !a)}>Alle Ansichten</button>
        </div>
        <ul className="dm-legend" aria-label="Legende">
          {DAMAGE_KINDS.map((k) => (
            <li key={k}><span className="dm-dot" style={{ background: KIND_META[k].color }}><span aria-hidden>{KIND_META[k].icon}</span></span>{KIND_META[k].label}<b>{kindCount[k]}</b></li>
          ))}
        </ul>
        {all ? (
          <div className="dm-grid">
            {VIEWS.map((v) => (
              <button key={v.key} type="button" className={`dm-thumb ${view === v.key ? 'is-on' : ''}`} onClick={() => { setView(v.key); setAll(false); }} aria-label={`Ansicht ${v.label} öffnen`}>
                <VehicleSvg view={v.key} state={state} counts={counts} selected={sel} hover={null} interactive={false} mini />
                <span>{v.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="dm-canvas">
            <VehicleSvg view={view} state={state} counts={counts} selected={freeText ? null : sel} hover={hover} onSelect={select} onHover={setHover} />
            <div className="dm-hint" aria-live="polite"><AdminIcon name="pin" />{hoverLabel}</div>
          </div>
        )}
      </div>

      <div className="dm-side adm-card" ref={panel}>
        {!sel && !freeText && !draft && (
          <>
            <div className="dm-side-head"><b>Erfasste Einträge</b><span className="t-3">{damages.length}</span></div>
            {damages.length === 0 ? (
              <p className="vi-hint">Noch kein Schaden erfasst. Klicken Sie auf ein Bauteil der Fahrzeugansicht – z. B. die Tür oder den Stoßfänger.</p>
            ) : (
              <ul className="dm-list">{damages.map((d) => (
                <li key={d.id}>
                  <button type="button" onClick={() => { if (d.partId) { setSel(d.partId); setFreeText(false); if (d.view && (VIEWS as readonly { key: string }[]).some((v) => v.key === d.view)) setView(d.view as ViewKey); } else { setFreeText(true); setSel(null); } }}>
                    <span className="dm-dot sm" style={{ background: KIND_META[d.kind].color }} aria-hidden>{KIND_META[d.kind].icon}</span>
                    <span className="main"><b>{d.component}</b><span className="t-3">{[KIND_META[d.kind].short, d.damageType, d.severity ? SEVERITY_LABELS[d.severity] : null, d.repairKind].filter(Boolean).join(' · ')}</span></span>
                    {d.photoIds.length > 0 && <span className="t-3" title="Verknüpfte Fotos"><AdminIcon name="photo" /> {d.photoIds.length}</span>}
                  </button>
                </li>
              ))}</ul>
            )}
            {canWrite && <button type="button" className="adm-btn adm-btn-secondary" onClick={() => { setFreeText(true); setSel(null); addNew(null); }}><AdminIcon name="plus" />Weiteres Bauteil (ohne Karte)</button>}
            <p className="vi-hint">Unterboden, Innenraum und Fahrwerk lassen sich nicht auf der Außenansicht markieren – dafür „Weiteres Bauteil“.</p>
          </>
        )}

        {(sel || freeText) && (
          <>
            <div className="dm-side-head">
              <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => { setSel(null); setFreeText(false); setDraft(null); }}>← Alle</button>
              <b>{freeText ? 'Weitere Bauteile' : partLabel(sel)}</b>
            </div>
            {entries.length === 0 && !draft && <p className="vi-hint">Zu diesem Bauteil gibt es noch keinen Eintrag.</p>}
            <ul className="dm-list">{entries.map((d) => (
              <li key={d.id} className={draft?.id === d.id ? 'is-on' : ''}>
                <div className="dm-entry">
                  <span className="dm-dot sm" style={{ background: KIND_META[d.kind].color }} aria-hidden>{KIND_META[d.kind].icon}</span>
                  <span className="main"><b>{freeText ? d.component : KIND_META[d.kind].label}</b><span className="t-3">{[freeText ? KIND_META[d.kind].short : null, d.damageType, d.severity ? SEVERITY_LABELS[d.severity] : null, d.repairKind].filter(Boolean).join(' · ') || '–'}</span>
                    {d.description && <span className="t-2" style={{ fontSize: 12.5 }}>{d.description}</span>}{d.priorNote && <span className="t-2" style={{ fontSize: 12.5 }}>Hinweis: {d.priorNote}</span>}</span>
                  {canWrite && <span className="dm-entry-actions"><button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => edit(d)}>Bearbeiten</button><button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => remove(d)} disabled={pending}>Löschen</button></span>}
                </div>
              </li>
            ))}</ul>
            {canWrite && !draft && <button type="button" className="adm-btn" onClick={() => addNew(freeText ? null : sel)}><AdminIcon name="plus" />Eintrag hinzufügen</button>}
            {!canWrite && <p className="vi-hint">Nur lesender Zugriff.</p>}

            {draft && canWrite && (
              <div className="dm-form" role="group" aria-label={draft.id ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}>
                <b style={{ fontSize: 13 }}>{draft.id ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}</b>
                {freeText && (
                  <div className="adm-form-grid">
                    <label className="adm-field"><span className="adm-label">Bauteil</span><input className="adm-input" value={draft.component} maxLength={120} onChange={(e) => setDraft({ ...draft, component: e.target.value })} placeholder="z. B. Unterboden, Armaturenbrett" aria-invalid={Boolean(f.component)} />{f.component && <span className="adm-error">{f.component}</span>}</label>
                    <label className="adm-field"><span className="adm-label">Bereich</span><select className="adm-input" value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })}>{AREAS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                  </div>
                )}
                <fieldset className="dm-kinds"><legend className="adm-label">Zustand</legend>
                  {DAMAGE_KINDS.map((k) => (
                    <label key={k} className={draft.kind === k ? 'is-on' : ''} style={{ ['--k' as string]: KIND_META[k].color }}>
                      <input type="radio" name="kind" checked={draft.kind === k} onChange={() => setDraft({ ...draft, kind: k })} />
                      <span className="dm-dot sm" style={{ background: KIND_META[k].color }} aria-hidden>{KIND_META[k].icon}</span>{KIND_META[k].label}
                    </label>
                  ))}
                </fieldset>
                <div className="adm-form-grid">
                  <label className="adm-field"><span className="adm-label">Schadenart</span>
                    <select className="adm-input" value={draft.damageType} onChange={(e) => setDraft({ ...draft, damageType: e.target.value })}><option value="">–</option>{damageTypes.map((t) => <option key={t}>{t}</option>)}</select></label>
                  <label className="adm-field"><span className="adm-label">Maßnahme</span>
                    <select className="adm-input" value={draft.repairKind} onChange={(e) => setDraft({ ...draft, repairKind: e.target.value })}><option value="">–</option>{repairKinds.map((t) => <option key={t}>{t}</option>)}</select></label>
                </div>
                <fieldset className="dm-sev"><legend className="adm-label">Schweregrad</legend>
                  {SEVERITIES.map((s) => <label key={s} className={draft.severity === s ? 'is-on' : ''}><input type="radio" name="sev" checked={draft.severity === s} onChange={() => setDraft({ ...draft, severity: s })} />{SEVERITY_LABELS[s]}</label>)}
                  <label className={draft.severity === '' ? 'is-on' : ''}><input type="radio" name="sev" checked={draft.severity === ''} onChange={() => setDraft({ ...draft, severity: '' })} />offen</label>
                </fieldset>
                {(draft.kind === 'PRIOR' || draft.kind === 'CHECK' || draft.kind === 'USAGE' || draft.kind === 'REPAIRED') && (
                  <label className="adm-field"><span className="adm-label">{draft.kind === 'PRIOR' ? 'Vorschaden: Hinweis (Herkunft, Reparatur?)' : draft.kind === 'CHECK' ? 'Was ist zu prüfen?' : draft.kind === 'REPAIRED' ? 'Reparaturnachweis' : 'Hinweis'}</span>
                    <input className="adm-input" value={draft.priorNote} maxLength={500} onChange={(e) => setDraft({ ...draft, priorNote: e.target.value })} /></label>
                )}
                <label className="adm-field"><span className="adm-label">Beschreibung</span><textarea className="adm-input" rows={3} maxLength={2000} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
                <div className="adm-field"><span className="adm-label">Fotos zum Schaden</span>
                  {photos.length === 0 ? <p className="vi-hint">Noch keine Fotos im Fall. Fotos laden Sie im Reiter „Fotos“ hoch und verknüpfen sie hier.</p> : (
                    <div className="dm-photos">{photos.map((p) => {
                      const on = draft.photoIds.includes(p.id);
                      return (
                        <label key={p.id} className={on ? 'is-on' : ''} title={p.label}>
                          <input type="checkbox" checked={on} onChange={() => setDraft({ ...draft, photoIds: on ? draft.photoIds.filter((x) => x !== p.id) : [...draft.photoIds, p.id] })} />
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/admin/media/${p.mediaId}?v=thumb`} alt={p.label} loading="lazy" width={96} height={72} />
                        </label>
                      );
                    })}</div>
                  )}
                </div>
                {err?.error && <div className="adm-alert adm-alert-danger" role="alert"><AdminIcon name="alert" />{err.error}</div>}
                <div className="adm-actions">
                  <button type="button" className="adm-btn" onClick={save} disabled={pending} aria-busy={pending}>{pending ? 'Speichert …' : draft.id ? 'Speichern' : 'Eintrag speichern'}</button>
                  <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setDraft(null)}>Abbrechen</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
