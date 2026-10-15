'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { SHOWCASE_SCENES, type ShowcaseScene } from '@/lib/showcase';

/** Mount only the selected media. No source means a real poster, never a fake video URL. */
export function VideoShowcase({ scenes = SHOWCASE_SCENES }: { scenes?: ShowcaseScene[] }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [playback, setPlayback] = useState<'auto' | 'play' | 'pause'>('auto');
  const [failed, setFailed] = useState(false);
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const scene = scenes[index];

  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(preference.matches);
    sync(); preference.addEventListener('change', sync);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.15 });
    if (root.current) observer.observe(root.current);
    const hide = () => { if (document.hidden) video.current?.pause(); };
    document.addEventListener('visibilitychange', hide);
    return () => { observer.disconnect(); preference.removeEventListener('change', sync); document.removeEventListener('visibilitychange', hide); };
  }, []);

  useEffect(() => {
    const element = video.current;
    if (!element) { setPlaying(false); return; }
    if (visible && (playback === 'play' || (playback === 'auto' && !reduced)) && !document.hidden) void element.play().catch(() => setPlaying(false));
    else element.pause();
  }, [index, visible, reduced, playback, failed]);

  function select(next: number) {
    video.current?.pause(); setPlaying(false); setFailed(false);
    setIndex((next + scenes.length) % scenes.length);
  }
  function toggle() {
    if (!video.current) return;
    if (playing) { setPlayback('pause'); video.current.pause(); }
    else { setPlayback('play'); void video.current.play().catch(() => setPlaying(false)); }
  }
  if (!scene) return null;
  const hasVideo = scene.sources.length > 0 && !failed;
  return <section ref={root} className="theme-dark section" aria-labelledby="showcase-h" id="einblicke">
    <div className="shell">
      <div className="mb-10 grid gap-5 lg:grid-cols-[1fr_22rem] lg:items-end"><div><p className="eyebrow mb-4">03 / Einblicke</p><h2 id="showcase-h" className="display text-h2">Präzision,<br />die man sehen kann.</h2></div><p className="text-fg-dim">Jedes Detail zählt. Wir dokumentieren Schäden sorgfältig und schaffen eine nachvollziehbare Grundlage für Ihr Gutachten.</p></div>
      <div role="region" aria-roledescription="Karussell" aria-label="Schritte der Begutachtung">
        <div className="relative aspect-video overflow-hidden rounded-2xl border border-line bg-ink-800" role="group" aria-roledescription="Folie" aria-label={`${index + 1} von ${scenes.length}: ${scene.title}`}>
          <Image key={scene.poster} src={scene.poster} alt="" fill sizes="(min-width: 1440px) 1360px, 92vw" className="object-cover" />
          {hasVideo && visible && <video key={scene.id} ref={video} poster={scene.poster} muted playsInline loop preload="none" aria-label={scene.title} className="absolute inset-0 h-full w-full object-cover" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => { setFailed(true); setPlaying(false); }}>
            {scene.sources.map(source => <source key={source.src} src={source.src} type={source.type} />)}
          </video>}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/15" />
          <span className="absolute left-4 top-4 rounded-full border border-white/30 bg-black/50 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-white sm:left-7 sm:top-7">{hasVideo ? 'Illustrative Filmszene' : 'Bildvorschau'}</span>
          <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-3 sm:bottom-9 sm:left-9 sm:right-9"><p className="display max-w-[22ch] text-[clamp(1.3rem,3.5vw,3.5rem)] leading-tight text-white">{scene.title}</p>{hasVideo && <button type="button" onClick={toggle} aria-label={playing ? 'Video pausieren' : 'Video abspielen'} className="min-h-11 shrink-0 rounded-full border border-white/50 bg-black/60 px-5 text-sm text-white">{playing ? 'Pause' : 'Abspielen'}</button>}</div>
        </div>
        <div className="mt-5 flex items-center justify-between gap-4"><p aria-live="polite" aria-atomic="true" className="max-w-[54ch] text-sm text-fg-dim"><span className="mr-3 font-mono text-signal-bright">0{index + 1} / 0{scenes.length}</span>{scene.detail}{failed ? ' Die Filmdatei ist nicht erreichbar. Die Bildvorschau bleibt verfügbar.' : ''}</p><div className="flex shrink-0 gap-2"><button type="button" onClick={() => select(index - 1)} aria-label="Vorherige Szene" className="h-11 w-11 rounded-full border border-line hover:bg-ink-700">←</button><button type="button" onClick={() => select(index + 1)} aria-label="Nächste Szene" className="h-11 w-11 rounded-full border border-line hover:bg-ink-700">→</button></div></div>
        <div className="mt-7 grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Szene auswählen">{scenes.map((item, i) => <button key={item.id} type="button" onClick={() => select(i)} aria-pressed={i === index} className={`min-h-16 border-t-2 px-2 py-4 text-left text-sm transition-colors ${i === index ? 'border-signal-bright text-fg' : 'border-line text-fg-mute hover:text-fg'}`}><span className="mr-3 font-mono text-signal-bright">0{i + 1}</span>{item.title}</button>)}</div>
      </div>
      <p className="mt-5 max-w-[85ch] text-xs leading-relaxed text-fg-mute">Illustration der Arbeitsschritte. Die Bildvorschau nutzt vorhandenes Bildmaterial. Später ergänzte Filmszenen werden KI-generiert und zeigen keine tatsächlichen ING-Mitarbeiter oder Kunden.</p>
    </div>
  </section>;
}
