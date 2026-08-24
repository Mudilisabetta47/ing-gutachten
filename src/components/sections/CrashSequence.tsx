'use client';

import Link from 'next/link';
import { useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Arrow } from '@/components/ui/Icon';

/* =====================================================================
   Kollisionsrekonstruktion — scroll-gescrubbte Sequenz.

   Bewusst kein WebGL: eine Szene aus SVG-Ebenen mit einer eigenen
   kleinen Kamera erreicht denselben cinematischen Eindruck bei einem
   Bruchteil der Last, läuft auf jedem Telefon und bleibt in der
   technischen Bildsprache der Seite.

   Performance-Prinzip: React rendert diese Sektion genau einmal.
   Der Scrollfortschritt wird über eine einzige Subscription gelesen und
   direkt als transform/opacity auf die DOM-Knoten geschrieben – kein
   State, kein Re-Render, ausschließlich Compositing-Eigenschaften.
   ===================================================================== */

/* --- Szenen-Geometrie (SVG-Einheiten, 100 px = 1 m) ------------------- */
const VIEW_W = 1600;
const VIEW_H = 900;
const GROUND = 812;
const CAR_LEN = 526;
const CAR_B_X = 980;        // linke (hintere) Kante des vorderen Fahrzeugs
const CONTACT_X = CAR_B_X + 16;
const START_X = -600;       // Startposition des auffahrenden Fahrzeugs
const CONTACT_A_X = CONTACT_X - CAR_LEN;
const IMPACT_PT = { x: CONTACT_X + 10, y: GROUND - 66 };

/* --- Phasen ----------------------------------------------------------- */
const P_IMPACT = 0.42;
const P_SETTLE = 0.5;
const P_REST = 0.68;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const norm = (v: number, a: number, b: number) => clamp((v - a) / (b - a));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Weg des auffahrenden Fahrzeugs. Erst beschleunigen, dann kurz vor dem
 * Kontakt minimal strecken – dieses Zögern erzeugt die Spannung, nicht
 * ein lauterer Effekt.
 */
function carAx(p: number) {
  const t = clamp(p / P_IMPACT);
  const travel = t < 0.86 ? Math.pow(t / 0.86, 1.85) * 0.94 : 0.94 + easeOut((t - 0.86) / 0.14) * 0.06;
  return lerp(START_X, CONTACT_A_X, travel);
}

/* Geschwindigkeit numerisch – zustandslos, damit Vor- und Rückwärtsscrollen
   dieselben Werte liefern. */
function speedAt(p: number) {
  const d = 0.004;
  return Math.abs(carAx(Math.min(p + d, P_IMPACT)) - carAx(Math.max(p - d, 0))) / (2 * d);
}

/* --- Deformierbares Heck (identische Kommandofolge, damit interpolierbar) */
const REAR_INTACT = [16, -30, 10, -20, 10, -10, 16, -2, 52, -4, 54, -30];
const REAR_CRUSHED = [34, -27, 28, -18, 29, -9, 36, -4, 62, -9, 56, -29];
const FRONT_INTACT = [528, -30, 532, -20, 532, -12, 526, -4, 494, -6, 492, -30];
const FRONT_CRUSHED = [510, -27, 513, -18, 514, -10, 508, -7, 484, -12, 489, -29];

/** Zwei Zustände mit identischer Kommandofolge – dazwischen wird interpoliert. */
const morph = (a: number[], b: number[], k: number) => {
  const n = a.map((v, i) => lerp(v, b[i], k).toFixed(1));
  return `M ${n[0]} ${n[1]} C ${n[2]} ${n[3]} ${n[4]} ${n[5]} ${n[6]} ${n[7]} L ${n[8]} ${n[9]} L ${n[10]} ${n[11]} Z`;
};
const rearPath = (k: number) => morph(REAR_INTACT, REAR_CRUSHED, k);
const frontPath = (k: number) => morph(FRONT_INTACT, FRONT_CRUSHED, k);

/* --- Partikel --------------------------------------------------------- */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Particle = { vx: number; vy: number; ox: number; oy: number; spin: number; size: number; glass: boolean; life: number };

function makeParticles(count: number): Particle[] {
  const rnd = mulberry32(20260823);
  return Array.from({ length: count }, () => {
    const glass = rnd() > 0.42;
    const angle = -Math.PI * (0.12 + rnd() * 0.76);
    const power = 140 + rnd() * (glass ? 520 : 260);
    return {
      ox: (rnd() - 0.5) * 46,
      oy: (rnd() - 0.5) * 70,
      vx: Math.cos(angle) * power * (rnd() > 0.22 ? 1 : -0.45),
      vy: Math.sin(angle) * power,
      spin: (rnd() - 0.5) * 900,
      size: glass ? 2.4 + rnd() * 4.4 : 3 + rnd() * 7,
      glass,
      life: 0.62 + rnd() * 0.5,
    };
  });
}

/* --- Messmarken nach dem Aufprall ------------------------------------- */
const CALLOUTS = [
  { dx: -70, dy: -150, label: 'HECKABSCHLUSSBLECH', value: 'Δ 118 mm' },
  { dx: 150, dy: -34, label: 'STOSSFÄNGERTRÄGER', value: 'Δ 64 mm' },
  { dx: -130, dy: 62, label: 'LÄNGSTRÄGER RECHTS', value: 'PRÜFEN' },
];

export function CrashSequence() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [mobile, setMobile] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setMobile(mq.matches);
    apply();
    setReady(true);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const particles = useRef<Particle[]>([]);
  if (particles.current.length === 0) particles.current = makeParticles(36);
  const activeParticles = mobile ? 12 : 36;

  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] });

  /* Knoten einmalig einsammeln – querySelector pro Frame wäre Verschwendung. */
  const nodes = useRef(new Map<string, SVGElement | HTMLElement>());
  const pick = useCallback((id: string) => {
    const cache = nodes.current;
    const hit = cache.get(id);
    if (hit) return hit;
    const el = stage.current?.querySelector<SVGElement | HTMLElement>(`#${id}`);
    if (el) cache.set(id, el);
    return el ?? null;
  }, []);

  const render = useCallback(
    (p: number) => {
      if (!stage.current) return;
      const set = (id: string, transform?: string, opacity?: number) => {
        const el = pick(id);
        if (!el) return;
        if (transform !== undefined) el.style.transform = transform;
        if (opacity !== undefined) el.style.opacity = String(opacity);
      };

      /* --- Fahrzeuge ------------------------------------------------- */
      const xA = carAx(p);
      const crush = easeOut(norm(p, P_IMPACT, P_SETTLE));
      const settle = norm(p, P_SETTLE, P_REST);

      /* Rückstoß: A wird gebremst, B nach vorn geschoben. */
      const pushB = 46 * easeOut(norm(p, P_IMPACT, P_REST));
      const reboundA = -14 * Math.sin(Math.PI * norm(p, P_IMPACT, P_REST));

      /* Nicken um den Radaufstandspunkt, danach ausschwingen. */
      const damp = Math.exp(-4.5 * settle);
      const pitchA = -2.4 * crush * damp;
      const pitchB = 1.9 * crush * damp;
      const bounce = 7 * Math.sin(settle * Math.PI * 2.4) * damp;

      set('carA', `translate(${(xA + reboundA).toFixed(1)}px, ${GROUND - bounce * 0.4}px) rotate(${pitchA.toFixed(2)}deg)`);
      set('carB', `translate(${(CAR_B_X + pushB).toFixed(1)}px, ${GROUND - bounce}px) rotate(${pitchB.toFixed(2)}deg)`);

      /* Front des auffahrenden Fahrzeugs staucht sich. */
      const front = pick('carA-front') as SVGPathElement | null;
      if (front) front.setAttribute('d', frontPath(crush));
      set('carA-hood', undefined, 0.15 + 0.85 * crush);
      set('carA-crushshadow', undefined, 0.4 * crush);

      const rear = pick('carB-rear') as SVGPathElement | null;
      if (rear) rear.setAttribute('d', rearPath(crush));
      set('carB-folds', undefined, crush);
      set('carB-shadow', undefined, 0.35 * crush);

      /* Räder drehen mit dem zurückgelegten Weg. */
      const roll = ((xA - START_X) / 40) * (180 / Math.PI);
      ['carA-w1', 'carA-w2'].forEach((id) => set(id, `rotate(${roll.toFixed(1)}deg)`));

      /* --- Bewegungsunschärfe ---------------------------------------- */
      if (!mobile) {
        const blur = pick('mblur');
        if (blur) {
          const s = clamp(speedAt(p) / 2600) * 9 * (p < P_IMPACT ? 1 : 0);
          blur.setAttribute('stdDeviation', `${s.toFixed(2)} 0`);
        }
      }

      /* --- Kamera ------------------------------------------------------ */
      const push = easeInOut(norm(p, 0, P_IMPACT)) * 0.09;
      const dolly = easeInOut(norm(p, P_REST, 1));
      const scale = 1 + push + dolly * 1.0;
      const lookX = lerp(lerp(VIEW_W / 2, 880, easeInOut(norm(p, 0, P_IMPACT))), IMPACT_PT.x, dolly);
      const lookY = lerp(lerp(VIEW_H / 2, 560, easeInOut(norm(p, 0, P_IMPACT))), IMPACT_PT.y, dolly);

      /* Sehr kurzer, gedämpfter Kamerastoß – zwei Frames Wucht, kein Wackeln. */
      const shakeT = norm(p, P_IMPACT, P_IMPACT + 0.05);
      const shake = mobile || reduced ? 0 : Math.sin(shakeT * Math.PI * 6) * 7 * (1 - shakeT);

      const cam = pick('cam');
      if (cam) {
        cam.setAttribute(
          'transform',
          `translate(${(VIEW_W / 2 - lookX * scale + shake).toFixed(2)} ${(VIEW_H / 2 - lookY * scale + shake * 0.4).toFixed(2)}) scale(${scale.toFixed(4)})`,
        );
      }

      /* --- Aufprall: Lichtblitz und Druckring -------------------------- */
      const flashT = norm(p, P_IMPACT, P_IMPACT + 0.045);
      set('flash', undefined, flashT > 0 && flashT < 1 ? Math.sin(flashT * Math.PI) * 0.5 : 0);
      const ringT = norm(p, P_IMPACT, P_IMPACT + 0.12);
      set(
        'ring',
        `translate(${IMPACT_PT.x}px, ${IMPACT_PT.y}px) scale(${(0.2 + ringT * 3.4).toFixed(3)})`,
        ringT > 0 && ringT < 1 ? (1 - ringT) * 0.55 : 0,
      );

      /* --- Partikel ----------------------------------------------------- */
      const tau = Math.max(0, (p - P_IMPACT)) * 3.4;
      for (let i = 0; i < particles.current.length; i++) {
        const id = `pt-${i}`;
        if (i >= activeParticles) {
          set(id, undefined, 0);
          continue;
        }
        const q = particles.current[i];
        if (tau <= 0) {
          set(id, undefined, 0);
          continue;
        }
        const t = Math.min(tau, q.life);
        const x = IMPACT_PT.x + q.ox + q.vx * t;
        const y = IMPACT_PT.y + q.oy + q.vy * t + 620 * t * t;
        const grounded = y > GROUND - 4;
        set(
          id,
          `translate(${x.toFixed(1)}px, ${Math.min(y, GROUND - 4).toFixed(1)}px) rotate(${(q.spin * t).toFixed(1)}deg)`,
          tau > q.life + 0.35 ? 0 : grounded ? clamp(1 - (tau - q.life) / 0.5) * 0.5 : clamp(1.2 - tau / (q.life * 1.6)),
        );
      }

      /* --- Staubwolke ---------------------------------------------------- */
      const dustT = norm(p, P_IMPACT, P_REST);
      set(
        'dust',
        `translate(${IMPACT_PT.x}px, ${IMPACT_PT.y + 30}px) scale(${(0.4 + dustT * 1.9).toFixed(3)})`,
        dustT > 0 ? (1 - dustT) * 0.3 : 0,
      );

      /* --- HUD ----------------------------------------------------------- */
      const gapM = Math.max(0, (CONTACT_A_X - xA) / 100);
      const kmh = Math.round(clamp(speedAt(p) / 2600) * 34 * (p < P_IMPACT ? 1 : 0));
      const gapEl = pick('hud-gap');
      if (gapEl) gapEl.textContent = `${gapM.toFixed(2)} m`;
      const speedEl = pick('hud-speed');
      if (speedEl) speedEl.textContent = `${p < P_IMPACT ? kmh : 0} km/h`;
      const phaseEl = pick('hud-phase');
      if (phaseEl) {
        phaseEl.textContent =
          p < 0.34 ? 'ANNÄHERUNG' : p < P_IMPACT ? 'KONTAKT IN KÜRZE' : p < P_SETTLE ? 'AUFPRALL' : p < P_REST ? 'AUSSCHWINGEN' : 'BEFUNDAUFNAHME';
      }
      set('hud-approach', undefined, 1 - norm(p, 0.3, P_IMPACT));
      set('hud-marks', undefined, norm(p, P_REST + 0.06, 0.86));

      /* --- Textebenen ------------------------------------------------------ */
      set('copy-before', `translateY(${(-30 * norm(p, 0.24, 0.4)).toFixed(1)}px)`, 1 - norm(p, 0.2, 0.36));
      set('copy-after', `translateY(${(28 * (1 - norm(p, 0.7, 0.86))).toFixed(1)}px)`, norm(p, 0.7, 0.86));

      /* Am Ende sanft abdunkeln, damit der Übergang zur nächsten Sektion sitzt. */
      set('fade-out', undefined, norm(p, 0.93, 1) * 0.9);
    },
    [pick, mobile, reduced, activeParticles],
  );

  useMotionValueEvent(scrollYProgress, 'change', render);

  useEffect(() => {
    nodes.current.clear();
    if (reduced) {
      render(0.82); // ruhiger Endzustand: Schaden sichtbar, keine Bewegung
      return;
    }
    render(scrollYProgress.get());
  }, [render, reduced, scrollYProgress, mobile, ready]);

  const scrubHeight = reduced ? 'auto' : mobile ? '260vh' : '340vh';

  return (
    <section
      ref={section}
      id="kollision"
      aria-labelledby="crash-h"
      className="relative border-y border-line bg-ink-900"
      style={{ height: scrubHeight }}
    >
      <div
        ref={stage}
        className={`relative overflow-hidden ${reduced ? '' : 'sticky top-0'}`}
        style={reduced ? { height: 'min(70vh, 620px)' } : { height: '100svh' }}
      >
        {/* Bühne */}
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
          role="presentation"
        >
          <defs>
            <linearGradient id="crashSky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0a0d11" />
              <stop offset="0.55" stopColor="#111823" />
              <stop offset="1" stopColor="#080a0d" />
            </linearGradient>
            <linearGradient id="crashFloor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#141b23" />
              <stop offset="1" stopColor="#0a0d11" />
            </linearGradient>
            <linearGradient id="carPaintA" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#39434f" />
              <stop offset="0.55" stopColor="#1d242c" />
              <stop offset="1" stopColor="#0d1116" />
            </linearGradient>
            <linearGradient id="carPaintB" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#4a5563" />
              <stop offset="0.55" stopColor="#242c36" />
              <stop offset="1" stopColor="#0f1318" />
            </linearGradient>
            <linearGradient id="rimLight" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#5ac8e8" stopOpacity=".45" />
              <stop offset="0.5" stopColor="#ffffff" stopOpacity=".22" />
              <stop offset="1" stopColor="#ffb43c" stopOpacity=".8" />
            </linearGradient>
            <radialGradient id="lampGlow">
              <stop offset="0" stopColor="#fff3d8" stopOpacity=".9" />
              <stop offset="1" stopColor="#ffb43c" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="dustGrad">
              <stop offset="0" stopColor="#c9d3dd" stopOpacity=".55" />
              <stop offset="1" stopColor="#c9d3dd" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="contactShadow">
              <stop offset="0" stopColor="#000" stopOpacity=".7" />
              <stop offset="1" stopColor="#000" stopOpacity="0" />
            </radialGradient>
            {!mobile && (
              <filter id="motionBlur" x="-25%" y="-25%" width="150%" height="150%">
                <feGaussianBlur id="mblur" in="SourceGraphic" stdDeviation="0 0" />
              </filter>
            )}
          </defs>

          <rect width={VIEW_W} height={VIEW_H} fill="url(#crashSky)" />

          <g id="cam" style={{ willChange: 'transform' }}>
            {/* Prüffläche mit Messraster */}
            <rect x={-900} y={GROUND - 4} width={3400} height={VIEW_H} fill="url(#crashFloor)" />
            <g stroke="#5ac8e8" strokeOpacity=".16" strokeWidth="1">
              <path d={`M -900 ${GROUND} H 2500`} strokeOpacity=".4" />
              {Array.from({ length: mobile ? 9 : 17 }, (_, i) => {
                const x = -800 + i * 200;
                return <path key={x} d={`M ${x} ${GROUND} V ${GROUND + 26}`} />;
              })}
              {Array.from({ length: mobile ? 3 : 5 }, (_, i) => (
                <path key={i} d={`M -900 ${GROUND + 40 + i * 34} H 2500`} strokeOpacity={0.09 - i * 0.015} />
              ))}
            </g>
            <g fill="#5ac8e8" fillOpacity=".45" fontFamily="monospace" fontSize="15" letterSpacing="2">
              {Array.from({ length: mobile ? 5 : 9 }, (_, i) => {
                const x = -800 + i * 400;
                return (
                  <text key={x} x={x} y={GROUND + 48} textAnchor="middle">
                    {((x - CONTACT_X) / 100).toFixed(0)} m
                  </text>
                );
              })}
            </g>

            {/* Deckenlicht als Reflexionsquelle */}
            <ellipse cx={CONTACT_X} cy={210} rx={520} ry={90} fill="url(#lampGlow)" opacity=".28" />

            {/* Bodenschatten */}
            <ellipse cx={CONTACT_X} cy={GROUND + 6} rx={420} ry={26} fill="url(#contactShadow)" />

            {/* Getroffenes Fahrzeug */}
            <g id="carB" style={{ transformBox: 'fill-box', transformOrigin: '20% 100%', willChange: 'transform' }}>
              <CarBody paint="url(#carPaintB)" idPrefix="carB" />
              <path id="carB-rear" d={rearPath(0)} fill="#0e1319" stroke="url(#rimLight)" strokeWidth="1.6" />
              <g id="carB-folds" opacity="0" stroke="#ffb43c" strokeOpacity=".55" strokeWidth="1.2" fill="none">
                <path d="M 40 -104 L 62 -78 L 44 -56" />
                <path d="M 58 -112 L 78 -86" />
                <path d="M 30 -70 L 54 -48" />
              </g>
              <ellipse id="carB-shadow" cx="46" cy="-58" rx="46" ry="52" fill="#05070a" opacity="0" />
            </g>

            {/* Auffahrendes Fahrzeug */}
            <g
              id="carA"
              style={{ transformBox: 'fill-box', transformOrigin: '80% 100%', willChange: 'transform' }}
              filter={mobile ? undefined : 'url(#motionBlur)'}
            >
              <CarBody paint="url(#carPaintA)" idPrefix="carA" />
              <path id="carA-front" d={frontPath(0)} fill="#0e1319" stroke="url(#rimLight)" strokeWidth="1.6" />
              <ellipse id="carA-crushshadow" cx="500" cy="-52" rx="40" ry="46" fill="#05070a" opacity="0" />
              <g id="carA-hood" opacity="0" stroke="#ffb43c" strokeOpacity=".5" strokeWidth="1.2" fill="none">
                <path d="M 470 -96 L 494 -74 L 470 -58" />
                <path d="M 440 -104 L 462 -84" />
              </g>
            </g>

            {/* Aufprall */}
            <ellipse id="flash" cx={IMPACT_PT.x} cy={IMPACT_PT.y} rx={190} ry={150} fill="#fff6e4" opacity="0" />
            <circle
              id="ring"
              r="40"
              fill="none"
              stroke="#ffb43c"
              strokeWidth="2"
              opacity="0"
              style={{ transformBox: 'view-box' }}
            />
            <ellipse id="dust" rx="150" ry="90" fill="url(#dustGrad)" opacity="0" style={{ transformBox: 'view-box' }} />

            <g id="particles">
              {particles.current.map((q, i) => (
                <g key={i} id={`pt-${i}`} opacity="0" style={{ transformBox: 'view-box', willChange: 'transform' }}>
                  {q.glass ? (
                    <polygon
                      points={`0,${-q.size} ${q.size * 0.8},0 0,${q.size * 0.7} ${-q.size * 0.7},${q.size * 0.2}`}
                      fill="#9fdcf0"
                      fillOpacity=".8"
                    />
                  ) : (
                    <circle r={q.size * 0.5} fill="#8b98a4" fillOpacity=".45" />
                  )}
                </g>
              ))}
            </g>

            {/* Messmarken der Befundaufnahme */}
            <g id="hud-marks" opacity="0" style={{ willChange: 'opacity' }}>
              {CALLOUTS.map((c) => (
                <g key={c.label}>
                  <path
                    d={`M ${IMPACT_PT.x} ${IMPACT_PT.y} L ${IMPACT_PT.x + c.dx} ${IMPACT_PT.y + c.dy}`}
                    stroke="#ffb43c"
                    strokeOpacity=".5"
                    strokeWidth="1"
                    strokeDasharray="4 5"
                  />
                  <circle cx={IMPACT_PT.x + c.dx} cy={IMPACT_PT.y + c.dy} r="3.5" fill="#ffb43c" />
                  <text
                    x={IMPACT_PT.x + c.dx + (c.dx < 0 ? -12 : 12)}
                    y={IMPACT_PT.y + c.dy - 8}
                    textAnchor={c.dx < 0 ? 'end' : 'start'}
                    fontFamily="monospace"
                    fontSize="13"
                    letterSpacing="1.6"
                    fill="#edf1f4"
                    fillOpacity=".9"
                  >
                    {c.label}
                  </text>
                  <text
                    x={IMPACT_PT.x + c.dx + (c.dx < 0 ? -12 : 12)}
                    y={IMPACT_PT.y + c.dy + 10}
                    textAnchor={c.dx < 0 ? 'end' : 'start'}
                    fontFamily="monospace"
                    fontSize="13"
                    letterSpacing="1.6"
                    fill="#ffb43c"
                  >
                    {c.value}
                  </text>
                </g>
              ))}
            </g>
          </g>

          {/* Abschluss-Abdunklung für den Übergang */}
          <rect id="fade-out" width={VIEW_W} height={VIEW_H} fill="#08090b" opacity="0" />
        </svg>

        {/* Vignette über der Bühne */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{ background: 'radial-gradient(120% 85% at 50% 45%, transparent 40%, rgba(8,9,11,.82) 100%)' }}
        />

        {/* HUD */}
        <div className="pointer-events-none absolute inset-0" style={{ paddingInline: 'var(--pad)' }} aria-hidden="true">
          <div className="mx-auto flex h-full max-w-shell flex-col justify-between py-6 sm:py-10">
            <div className="flex items-start justify-between font-mono text-[.62rem] uppercase tracking-[.22em] text-fg-mute">
              <span>Sequenz 01 · Kollisionsrekonstruktion</span>
              <span id="hud-phase" className="text-signal">
                ANNÄHERUNG
              </span>
            </div>
            <div id="hud-approach" className="flex gap-8 font-mono text-[.62rem] uppercase tracking-[.2em] text-fg-mute">
              <span>
                Abstand <b id="hud-gap" className="ml-2 text-base tracking-normal text-measure">10.30 m</b>
              </span>
              <span>
                Δv <b id="hud-speed" className="ml-2 text-base tracking-normal text-signal">0 km/h</b>
              </span>
            </div>
          </div>
        </div>

        {/* Textebenen */}
        <div className="pointer-events-none absolute inset-0 flex items-center" style={{ paddingInline: 'var(--pad)' }}>
          <div className="mx-auto w-full max-w-shell">
            <div id="copy-before" className="max-w-[24ch]" style={{ willChange: 'transform, opacity' }}>
              <p className="eyebrow mb-4">Was in 120 Millisekunden passiert</p>
              <h2 id="crash-h" className="display text-[clamp(1.9rem,5vw,4rem)]">
                Der Aufprall dauert
                <br />
                einen Wimpernschlag.
              </h2>
            </div>

            <div
              id="copy-after"
              className="pointer-events-auto absolute bottom-[16%] max-w-[34ch] opacity-0 sm:bottom-[18%]"
              style={{ willChange: 'transform, opacity' }}
            >
              <p className="eyebrow mb-4">Befundaufnahme</p>
              <h3 className="display mb-4 text-[clamp(1.5rem,3.4vw,2.6rem)]">Die Folgen bleiben messbar.</h3>
              <p className="text-[.95rem] text-fg-dim">
                Was hier in Millisekunden geschieht, rekonstruieren wir in Millimetern: Verformung, Kraftverlauf,
                betroffene Baugruppen. Genau das steht später im Gutachten.
              </p>
              <Link href="/unfallgutachten" className="tlink mt-5 text-signal">
                Unfallgutachten ansehen <Arrow />
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll-Hinweis, verschwindet mit dem ersten Scrollen */}
        {!reduced && (
          <div
            className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-[.6rem] uppercase tracking-[.24em] text-fg-mute"
            aria-hidden="true"
          >
            Scrollen steuert die Szene
          </div>
        )}
      </div>
    </section>
  );
}

/* --- Fahrzeug in Seitenansicht ---------------------------------------- */
function CarBody({ paint, idPrefix }: { paint: string; idPrefix: string }) {
  return (
    <g>
      <path
        d="M 18 0 C 8 -8 6 -22 14 -34 L 60 -52 C 84 -92 128 -114 186 -118 L 330 -120 C 386 -118 424 -100 452 -70 L 508 -56 C 522 -50 528 -38 526 -24 L 524 -6 C 523 -2 519 0 514 0 Z"
        fill={paint}
        stroke="url(#rimLight)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M 96 -56 C 116 -88 152 -104 196 -107 L 322 -108 C 366 -106 396 -92 418 -66 Z"
        fill="#0a0f14"
        fillOpacity=".9"
        stroke="#5ac8e8"
        strokeOpacity=".3"
        strokeWidth="1.2"
      />
      <path d="M 256 -108 L 256 -57" stroke="#5ac8e8" strokeOpacity=".22" strokeWidth="1.2" />
      <path d="M 40 -44 C 180 -50 360 -50 500 -44" stroke="#ffffff" strokeOpacity=".09" strokeWidth="1.2" fill="none" />
      <path d="M 70 -18 C 200 -24 340 -24 480 -18" stroke="#ffffff" strokeOpacity=".06" strokeWidth="1.2" fill="none" />

      {/* Radhäuser und Räder */}
      <path d="M 78 0 A 42 42 0 0 1 162 0 Z" fill="#06080b" />
      <path d="M 362 0 A 42 42 0 0 1 446 0 Z" fill="#06080b" />
      <g id={`${idPrefix}-w1`} style={{ transformBox: 'fill-box', transformOrigin: 'center', willChange: 'transform' }}>
        <circle cx="120" cy="-38" r="38" fill="#0a0d11" stroke="#3b4551" strokeWidth="1.4" />
        <circle cx="120" cy="-38" r="22" fill="none" stroke="#5ac8e8" strokeOpacity=".3" strokeWidth="1.1" />
        <path
          d="M 120 -60 V -16 M 98 -38 H 142 M 104 -54 L 136 -22 M 104 -22 L 136 -54"
          stroke="#ffffff"
          strokeOpacity=".13"
          strokeWidth="1"
        />
      </g>
      <g id={`${idPrefix}-w2`} style={{ transformBox: 'fill-box', transformOrigin: 'center', willChange: 'transform' }}>
        <circle cx="404" cy="-38" r="38" fill="#0a0d11" stroke="#3b4551" strokeWidth="1.4" />
        <circle cx="404" cy="-38" r="22" fill="none" stroke="#5ac8e8" strokeOpacity=".3" strokeWidth="1.1" />
        <path
          d="M 404 -60 V -16 M 382 -38 H 426 M 388 -54 L 420 -22 M 388 -22 L 420 -54"
          stroke="#ffffff"
          strokeOpacity=".13"
          strokeWidth="1"
        />
      </g>

      {/* Leuchten */}
      <rect x="502" y="-44" width="26" height="9" rx="4.5" fill="#ffe6b8" opacity=".85" />
      <rect x="14" y="-42" width="22" height="8" rx="4" fill="#ff6a5e" opacity=".5" />
    </g>
  );
}
