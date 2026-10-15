'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { HeroScene } from '@/lib/showcase';

/**
 * Video-Hintergrund der Startseite (mit Slider, sobald mehrere Clips vorhanden sind).
 * - Poster zuerst (schnelle Darstellung), Video blendet ein, sobald es läuft
 * - stumm, playsInline, startet nur im sichtbaren Bereich, pausiert beim Wegscrollen/Tab-Wechsel
 * - kein Autoplay bei „Bewegung reduzieren“ oder aktivem Datensparmodus; sichtbarer Pause-/Abspielen-Knopf
 * - ein Clip: Schleife; mehrere Clips: nacheinander (Ende → nächster) mit Punkten zur Auswahl
 * - fällt das Video aus, bleibt das Poster stehen
 */
export function HeroMedia({ scenes }: { scenes: HeroScene[] }) {
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(true);
  const [saveData, setSaveData] = useState(false);
  const [visible, setVisible] = useState(true);
  const [userPaused, setUserPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const scene = scenes[index];
  const multi = scenes.length > 1;

  useEffect(() => {
    const pref = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(pref.matches);
    sync(); pref.addEventListener('change', sync);
    setSaveData(Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData));
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.05 });
    if (root.current) io.observe(root.current);
    return () => { pref.removeEventListener('change', sync); io.disconnect(); };
  }, []);

  const motionAllowed = !reduced && !saveData && !failed;
  const wantPlay = motionAllowed && visible && !userPaused;

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const onHide = () => { if (document.hidden) el.pause(); else if (wantPlay) void el.play().catch(() => undefined); };
    document.addEventListener('visibilitychange', onHide);
    if (wantPlay && !document.hidden) void el.play().catch(() => undefined); else el.pause();
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [wantPlay, index, motionAllowed]);

  const select = useCallback((next: number) => { setReady(false); setPlaying(false); setIndex((next + scenes.length) % scenes.length); }, [scenes.length]);
  const toggle = () => {
    const el = video.current;
    if (!el) { setUserPaused(false); return; }
    if (playing) { setUserPaused(true); el.pause(); } else { setUserPaused(false); void el.play().catch(() => undefined); }
  };
  if (!scene) return null;

  return (
    <>
      <div ref={root} className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <Image key={scene.poster} src={scene.poster} alt="" fill priority sizes="100vw" className="object-cover object-[68%_center]" />
        {motionAllowed && (
          <video
            key={scene.id}
            ref={video}
            className={`hero-video absolute inset-0 h-full w-full object-cover object-[68%_center]${ready ? ' is-ready' : ''}`}
            src={scene.src}
            poster={scene.poster}
            muted
            playsInline
            loop={!multi}
            preload="auto"
            tabIndex={-1}
            onCanPlay={() => setReady(true)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => { if (multi) select(index + 1); }}
            onError={() => setFailed(true)}
          />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,9,15,.94)_0%,rgba(6,9,15,.78)_38%,rgba(6,9,15,.38)_72%,rgba(6,9,15,.2)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#06090f] to-transparent" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#06090f]/80 to-transparent" />
      </div>
      <div className="absolute bottom-5 right-5 z-[3] flex items-center gap-3 sm:bottom-8 sm:right-8">
        {multi && (
          <div className="flex gap-2" role="group" aria-label="Szene wählen">
            {scenes.map((s, i) => (
              <button key={s.id} type="button" onClick={() => select(i)} aria-label={`Szene ${i + 1} von ${scenes.length}`} aria-pressed={i === index} className={`h-2.5 rounded-full border border-white/60 transition-all ${i === index ? 'w-8 bg-white' : 'w-2.5 bg-transparent hover:bg-white/40'}`} />
            ))}
          </div>
        )}
        {motionAllowed && (
          <button type="button" onClick={toggle} aria-label={playing ? 'Hintergrundvideo pausieren' : 'Hintergrundvideo abspielen'} className="min-h-11 rounded-full border border-white/40 bg-black/50 px-4 text-xs uppercase tracking-widest text-white backdrop-blur hover:bg-black/70">
            {playing ? 'Pause' : 'Abspielen'}
          </button>
        )}
      </div>
    </>
  );
}
