'use client';

import Link from 'next/link';
import { useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Arrow } from '@/components/ui/Icon';
import { applyRetreat, retreatT } from '@/components/motion/stage-retreat';

/* =====================================================================
   Vom Unfall zum Gutachten — scroll-gescrubbter Film in neun Akten.

   Prinzip (HANDOVER § 6): Jede Bewegung ist eine reine Funktion des
   Scrollfortschritts p (0..1). Kein Autoplay, keine Tweens, kein Zustand:
   Stoppt der Nutzer, steht exakt dieser Frame; zurückscrollen spielt die
   Sequenz framegenau rückwärts. Einzige Ausnahme: das Warnblinken läuft
   über die Uhr (CSS), sonst würde es bei stehendem Scroll einfrieren.

   Technik: SVG-Szene mit eigener Kamera, kein WebGL. React rendert die
   Sektion genau einmal; ein einziges `render(p)` schreibt transform/opacity
   direkt auf gecachte DOM-Knoten (kein Re-Render pro Frame, keine
   DOM-Lesezugriffe im Scroll-Pfad, identische Werte werden nicht erneut
   geschrieben).

   Akte:  01 FAHRT · 02 GEFAHR · 03 BREMSUNG · 04 AUFPRALL · 05 STILLSTAND
          06 GUTACHTER · 07 BEFUNDAUFNAHME · 08 TECHNISCHE ANALYSE · 09 ING
   Alle Messwerte im Film sind Beispielwerte – kein realer Fall.
   ===================================================================== */

/* --- Szenen-Geometrie (SVG-Einheiten, 100 px = 1 m) ------------------- */
const VIEW_W = 1600;
const VIEW_H = 900;
const GROUND = 812;
const CAR_LEN = 526;
const CAR_B_X = 980;
const CONTACT_X = CAR_B_X + 16;
const START_X = -1500;
const CONTACT_A_X = CONTACT_X - CAR_LEN;
const IMPACT_PT = { x: CONTACT_X + 10, y: GROUND - 66 };

/* --- Akte: Fortschrittsgrenzen ----------------------------------------- */
const P = {
  danger: 0.14,
  brake: 0.26,
  impact: 0.42,
  settle: 0.5,
  rest: 0.62,
  walkEnd: 0.74,
  find: 0.72,
  tech: 0.8,
  techEnd: 0.92,
  ing: 0.93,
  retreat: 0.955,
} as const;

const ACTS = [
  { key: 'FAHRT', a: 0, b: P.danger, word: 'Fahrt.', line: 'Ein ganz normaler Tag auf der Straße.' },
  { key: 'GEFAHR', a: P.danger, b: P.brake, word: 'Gefahr.', line: 'Das Fahrzeug voraus steht.' },
  { key: 'BREMSUNG', a: P.brake, b: 0.4, word: 'Bremsung.', line: 'Zu spät für einen Stopp.' },
  { key: 'AUFPRALL', a: 0.4, b: P.settle, word: 'Aufprall.', line: 'Millisekunden entscheiden.' },
  { key: 'STILLSTAND', a: P.settle, b: 0.6, word: 'Stillstand.', line: 'Fahrzeug steht.' },
  { key: 'GUTACHTER', a: 0.6, b: P.find, word: 'Gutachter.', line: 'Unabhängig vor Ort.' },
  { key: 'BEFUNDAUFNAHME', a: P.find, b: P.tech, word: 'Befund.', line: 'Jede Verformung wird erfasst.' },
  { key: 'TECHNISCHE ANALYSE', a: P.tech, b: P.ing, word: 'Analyse.', line: 'Aus Schaden werden Messwerte.' },
  { key: 'ING GUTACHTEN', a: P.ing, b: 1.01, word: '', line: '' },
] as const;

/* --- Hilfsfunktionen ---------------------------------------------------- */
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const norm = (v: number, a: number, b: number) => clamp((v - a) / (b - a));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** Fenster: blendet bei a ein, bei b aus (jeweils über `f` Fortschritt). */
const win = (p: number, a: number, b: number, f = 0.014) => clamp(Math.min((p - a) / f, (b - p) / f));

/* --- Geschwindigkeitsprofil → Wegstrecke (deterministisch) -------------- */
/** Relative Geschwindigkeit: konstant, dann Bremsung (Akt 03) bis ~40 % beim Aufprall. */
function speedRel(p: number) {
  if (p < P.brake) return 1;
  return 1 - 0.6 * easeOut(norm(p, P.brake, P.impact));
}
const TABLE_N = 480;
const DIST = (() => {
  const t = new Float64Array(TABLE_N + 1);
  for (let i = 1; i <= TABLE_N; i++) {
    const p0 = ((i - 1) / TABLE_N) * P.impact;
    const p1 = (i / TABLE_N) * P.impact;
    t[i] = t[i - 1] + ((speedRel(p0) + speedRel(p1)) / 2) * (p1 - p0);
  }
  return t;
})();
function distNorm(p: number) {
  const x = (clamp(p, 0, P.impact) / P.impact) * TABLE_N;
  const i = Math.min(TABLE_N - 1, Math.floor(x));
  return lerp(DIST[i], DIST[i + 1], x - i) / DIST[TABLE_N];
}
const carAx = (p: number) => lerp(START_X, CONTACT_A_X, distNorm(p));
/** Beispiel-Geschwindigkeit in km/h (Anfangswert exemplarisch). */
const V0_KMH = 72;

/* --- Deformierbares Heck/Front (identische Kommandofolge, interpolierbar) */
const REAR_INTACT = [16, -30, 10, -20, 10, -10, 16, -2, 52, -4, 54, -30];
const REAR_CRUSHED = [34, -27, 28, -18, 29, -9, 36, -4, 62, -9, 56, -29];
const FRONT_INTACT = [528, -30, 532, -20, 532, -12, 526, -4, 494, -6, 492, -30];
const FRONT_CRUSHED = [510, -27, 513, -18, 514, -10, 508, -7, 484, -12, 489, -29];
const morph = (a: number[], b: number[], k: number) => {
  const n = a.map((v, i) => lerp(v, b[i], k).toFixed(1));
  return `M ${n[0]} ${n[1]} C ${n[2]} ${n[3]} ${n[4]} ${n[5]} ${n[6]} ${n[7]} L ${n[8]} ${n[9]} L ${n[10]} ${n[11]} Z`;
};
const rearPath = (k: number) => morph(REAR_INTACT, REAR_CRUSHED, k);
const frontPath = (k: number) => morph(FRONT_INTACT, FRONT_CRUSHED, k);

/* --- Partikel ----------------------------------------------------------- */
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
    const power = 120 + rnd() * (glass ? 440 : 230);
    return {
      ox: (rnd() - 0.5) * 46,
      oy: (rnd() - 0.5) * 70,
      vx: Math.cos(angle) * power * (rnd() > 0.22 ? 1 : -0.45),
      vy: Math.sin(angle) * power,
      spin: (rnd() - 0.5) * 900,
      size: glass ? 2.2 + rnd() * 3.8 : 3 + rnd() * 6,
      glass,
      life: 0.62 + rnd() * 0.5,
    };
  });
}

/* --- Messmarken (Beispielwerte) ------------------------------------------ */
const CALLOUTS = [
  { dx: 70, dy: -168, label: 'HECKABSCHLUSSBLECH', value: 'Δ 118 mm · BSP.', mdx: 40, mlabel: 'HECKBLECH' },
  { dx: -60, dy: -214, label: 'STOSSFÄNGERTRÄGER', value: 'Δ 64 mm · BSP.', mdx: -40, mlabel: 'STOSSFÄNGER' },
  { dx: -190, dy: 74, label: 'LÄNGSTRÄGER', value: 'PRÜFEN · BSP.', mdx: -120, mlabel: 'LÄNGSTRÄGER' },
];

/* --- Kamera-Keyframes ------------------------------------------------------ */
type CamTarget = { x: number; y: number };
const camTrack = (p: number): CamTarget => ({ x: carAx(p) + lerp(560, 860, easeInOut(norm(p, 0.07, P.danger + 0.02))), y: GROUND - 205 });
const CAM_IMPACT: CamTarget = { x: IMPACT_PT.x - 40, y: GROUND - 190 };
const CAM_WIDE: CamTarget = { x: IMPACT_PT.x + 120, y: GROUND - 175 };
const CAM_DAMAGE: CamTarget = { x: IMPACT_PT.x - 10, y: IMPACT_PT.y - 6 };
const CAM_TECH: CamTarget = { x: IMPACT_PT.x, y: IMPACT_PT.y - 16 };

type Key = { p: number; at: (p: number) => CamTarget; s: number };
const CAM_KEYS: Key[] = [
  { p: 0, at: camTrack, s: 1.0 },
  { p: P.danger, at: camTrack, s: 0.94 },
  { p: P.brake, at: camTrack, s: 1.04 },
  { p: P.impact - 0.012, at: () => CAM_IMPACT, s: 1.24 },
  { p: P.rest, at: () => CAM_IMPACT, s: 1.1 },
  { p: P.walkEnd, at: () => CAM_WIDE, s: 1.12 },
  { p: P.find + 0.07, at: () => CAM_DAMAGE, s: 2.05 },
  { p: P.techEnd, at: () => CAM_TECH, s: 1.62 },
  { p: 1, at: () => CAM_TECH, s: 1.6 },
];
function camAt(p: number) {
  let i = 0;
  while (i < CAM_KEYS.length - 2 && p > CAM_KEYS[i + 1].p) i++;
  const a = CAM_KEYS[i];
  const b = CAM_KEYS[i + 1];
  const t = easeInOut(norm(p, a.p, b.p));
  const pa = a.at(p);
  const pb = b.at(p);
  return { x: lerp(pa.x, pb.x, t), y: lerp(pa.y, pb.y, t), s: lerp(a.s, b.s, t) };
}

/* --- Gutachter-Laufweg ------------------------------------------------------ */
const INSP_FROM = 1900;
const INSP_TO = 1250;
const INSP_Y = GROUND + 44;

export function CrashSequence() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const particles = useRef<Particle[]>([]);
  if (particles.current.length === 0) particles.current = makeParticles(36);
  const activeParticles = mobile ? 12 : 36;

  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] });

  /* Knoten einmalig einsammeln – querySelector pro Frame wäre Verschwendung. */
  const nodes = useRef(new Map<string, Element>());
  const lastVal = useRef(new Map<string, string>());
  const lastAct = useRef(-1);
  const hazard = useRef(false);
  /** Seitenverhältnis-Faktor: auf Hochformat zoomt die Kamera heraus, damit beide Fahrzeuge ins Bild passen. */
  const fit = useRef(1);

  const pick = useCallback((id: string) => {
    const cache = nodes.current;
    const hit = cache.get(id);
    if (hit) return hit;
    const el = stage.current?.querySelector(`#${id}`);
    if (el) cache.set(id, el);
    return el ?? null;
  }, []);

  const render = useCallback(
    (p: number) => {
      if (!stage.current) return;

      const sty = (id: string, prop: 'transform' | 'opacity' | 'visibility' | 'strokeDashoffset', value: string) => {
        const key = `${id}|${prop}`;
        if (lastVal.current.get(key) === value) return;
        const el = pick(id) as HTMLElement | SVGElement | null;
        if (!el) return;
        lastVal.current.set(key, value);
        (el.style as unknown as Record<string, string>)[prop] = value;
      };
      const op = (id: string, v: number) => sty(id, 'opacity', (Math.round(v * 1000) / 1000).toString());
      const tf = (id: string, v: string) => sty(id, 'transform', v);
      const attr = (id: string, name: string, v: string) => {
        const key = `${id}@${name}`;
        if (lastVal.current.get(key) === v) return;
        const el = pick(id);
        if (!el) return;
        lastVal.current.set(key, v);
        el.setAttribute(name, v);
      };
      const text = (id: string, v: string) => {
        const key = `${id}#t`;
        if (lastVal.current.get(key) === v) return;
        const el = pick(id);
        if (!el) return;
        lastVal.current.set(key, v);
        el.textContent = v;
      };

      /* --- Kamera --------------------------------------------------------- */
      const cam = camAt(p);
      const s = cam.s * fit.current;
      const lookY = cam.y + (fit.current < 0.8 ? -90 : 0);

      /* --- Fahrzeug A: Weg aus dem Geschwindigkeitsprofil ------------------ */
      const xA = carAx(p);
      const crush = easeOut(norm(p, P.impact, P.settle));
      const settle = norm(p, P.settle, P.rest);
      const brakeAmt = easeOut(norm(p, P.brake, P.brake + 0.05)) * (1 - norm(p, P.impact, P.impact + 0.02));
      const pushB = 46 * easeOut(norm(p, P.impact, P.rest));
      const reboundA = -14 * Math.sin(Math.PI * norm(p, P.impact, P.rest));
      const damp = Math.exp(-4.5 * settle);
      /* Bremsnicken: Front taucht subtil ein (Uhrzeigersinn), nach dem Aufprall federt es aus. */
      const pitchA = 1.25 * brakeAmt * (p < P.impact ? 1 : 0) - 2.4 * crush * damp;
      const pitchB = 1.9 * crush * damp;
      const bounce = 7 * Math.sin(settle * Math.PI * 2.4) * damp;

      tf('carA', `translate(${(xA + reboundA).toFixed(1)}px, ${(GROUND - bounce * 0.4).toFixed(1)}px) rotate(${pitchA.toFixed(2)}deg)`);
      tf('carB', `translate(${(CAR_B_X + pushB).toFixed(1)}px, ${(GROUND - bounce).toFixed(1)}px) rotate(${pitchB.toFixed(2)}deg)`);

      attr('carA-front', 'd', frontPath(crush));
      op('carA-hood', 0.15 + 0.85 * crush);
      op('carA-crushshadow', 0.4 * crush);
      attr('carB-rear', 'd', rearPath(crush));
      op('carB-folds', crush);
      op('carB-shadow', 0.35 * crush);

      const roll = ((xA - START_X) / 40) * (180 / Math.PI);
      tf('carA-w1', `rotate(${roll.toFixed(1)}deg)`);
      tf('carA-w2', `rotate(${roll.toFixed(1)}deg)`);

      /* --- Lichter: Fahrzeug B steht (Bremslicht), A bremst, danach Warnblinker */
      const bBrake = easeOut(norm(p, P.danger - 0.05, P.danger));
      const aBrake = 0.3 + 0.7 * easeOut(norm(p, P.brake, P.brake + 0.04));
      op('carB-tail', 0.5 + 0.5 * bBrake);
      op('carB-glow', 0.9 * bBrake);
      op('carA-tail', p < P.brake ? 0.5 : p < P.impact + 0.02 ? aBrake : 0.9);
      op('carA-glow', p < P.brake ? 0 : p < P.impact + 0.02 ? aBrake * 0.9 : 0.35);

      const wantHazard = p > P.settle + 0.02 && p < P.tech + 0.05;
      if (wantHazard !== hazard.current) {
        hazard.current = wantHazard;
        stage.current.classList.toggle('film-blink', wantHazard);
        op('haz', wantHazard ? 1 : 0);
      }

      /* --- Bewegungsunschärfe (nur Desktop) ---------------------------------- */
      if (!mobile) {
        const blur = pick('mblur');
        if (blur) {
          const v = p < P.impact ? speedRel(p) * (1 - norm(p, P.brake, P.impact) * 0.2) : 0;
          attr('mblur', 'stdDeviation', `${(v * 4.2).toFixed(2)} 0`);
        }
      }

      /* --- Kamera anwenden (Stoß beim Aufprall: zwei Frames Wucht, kein Wackeln) */
      const shakeT = norm(p, P.impact, P.impact + 0.05);
      const shake = mobile || reduced ? 0 : Math.sin(shakeT * Math.PI * 6) * 6 * (1 - shakeT);
      attr('cam', 'transform', `translate(${(VIEW_W / 2 - cam.x * s + shake).toFixed(2)} ${(VIEW_H / 2 - lookY * s + shake * 0.4).toFixed(2)}) scale(${s.toFixed(4)})`);
      /* Ferne Häuserzeile mit geringer Parallaxe – vermittelt Tempo. */
      attr('far', 'transform', `translate(${(VIEW_W / 2 - cam.x * 0.22).toFixed(1)} ${(VIEW_H * 0.1).toFixed(1)}) scale(${(1 + (s - 1) * 0.28).toFixed(3)})`);

      /* --- Aufprall (dezent): Lichtimpuls, Druckring, Staub, Partikel ---------- */
      const flashT = norm(p, P.impact, P.impact + 0.04);
      op('flash', flashT > 0 && flashT < 1 ? Math.sin(flashT * Math.PI) * 0.7 : 0);
      const ringT = norm(p, P.impact, P.impact + 0.11);
      sty('ring', 'transform', `translate(${IMPACT_PT.x}px, ${IMPACT_PT.y}px) scale(${(0.2 + ringT * 3.2).toFixed(3)})`);
      op('ring', ringT > 0 && ringT < 1 ? (1 - ringT) * 0.5 : 0);

      const tau = Math.max(0, p - P.impact) * 3.4;
      for (let i = 0; i < particles.current.length; i++) {
        const id = `pt-${i}`;
        if (i >= activeParticles || tau <= 0) {
          op(id, 0);
          continue;
        }
        const q = particles.current[i];
        const t = Math.min(tau, q.life);
        const x = IMPACT_PT.x + q.ox + q.vx * t;
        const y = IMPACT_PT.y + q.oy + q.vy * t + 620 * t * t;
        const grounded = y > GROUND - 4;
        tf(id, `translate(${x.toFixed(1)}px, ${Math.min(y, GROUND - 4).toFixed(1)}px) rotate(${(q.spin * t).toFixed(1)}deg)`);
        op(id, tau > q.life + 0.5 ? 0 : grounded ? clamp(1 - (tau - q.life) / 0.7) * 0.5 : clamp(1.2 - tau / (q.life * 1.6)));
      }
      /* Staub klingt langsam aus und legt sich im Stillstand. */
      const dustT = norm(p, P.impact, P.rest + 0.03);
      tf('dust', `translate(${IMPACT_PT.x}px, ${IMPACT_PT.y + 30}px) scale(${(0.4 + dustT * 1.7).toFixed(3)})`);
      op('dust', dustT > 0 ? (1 - dustT) * 0.3 : 0);

      /* --- Gutachter: nähert sich, Tablet leuchtet ------------------------------ */
      const walk = easeInOut(norm(p, 0.6, P.walkEnd));
      const ix = lerp(INSP_FROM, INSP_TO, walk);
      const moving = walk > 0 && walk < 1;
      const phase = ix / 26;
      const bob = moving ? Math.abs(Math.sin(phase)) * 3 : 0;
      const isc = 1.12;
      tf('insp', `translate(${ix.toFixed(1)}px, ${(INSP_Y - bob).toFixed(1)}px) scale(${isc})`);
      attr('insp-l1', 'transform', `rotate(${moving ? (Math.sin(phase) * 17).toFixed(1) : 0} 0 -88)`);
      attr('insp-l2', 'transform', `rotate(${moving ? (-Math.sin(phase) * 17).toFixed(1) : 0} 0 -88)`);
      const raise = easeOut(norm(p, P.walkEnd - 0.04, P.find + 0.04));
      attr('insp-arm', 'transform', `rotate(${(-26 * raise).toFixed(1)} 10 -146)`);
      const techFade = 1 - easeInOut(norm(p, P.tech + 0.02, P.tech + 0.09));
      op('insp', win(p, 0.595, 2, 0.01) * techFade);
      op('insp-glow', 0.35 + 0.65 * raise);

      /* --- Befundaufnahme: Messmarken ------------------------------------------- */
      op('hud-marks', norm(p, P.find + 0.015, P.find + 0.075) * (1 - 0));

      /* --- Technische Analyse: der fließende Übergang ----------------------------
         Real → blauer Schleier → Messraster → Schadenszone → Messpunkte →
         Bemaßung → technische Darstellung. Kein Schnitt, alles Funktionen von p. */
      const veilT = norm(p, P.tech - 0.01, P.tech + 0.06);       // Schleier fährt ein
      const gridT = norm(p, P.tech + 0.02, P.tech + 0.07);       // Messraster
      const drawT = easeInOut(norm(p, P.tech + 0.03, P.tech + 0.1)); // Konturen zeichnen sich
      const hatchT = norm(p, P.tech + 0.06, P.tech + 0.1);       // Schadenszone
      const dimT = norm(p, P.tech + 0.08, P.techEnd);            // Bemaßung
      const realFade = easeInOut(norm(p, P.tech, P.tech + 0.09));

      tf('veil', `translate(${(lerp(-VIEW_W * 1.45, 0, easeInOut(veilT))).toFixed(1)}px, 0px)`);
      op('veil', veilT > 0 ? (p < P.tech + 0.1 ? 1 : 1 - norm(p, P.tech + 0.1, P.tech + 0.16) * 0.55) : 0);
      op('bpbg', easeInOut(norm(p, P.tech + 0.02, P.tech + 0.1)));
      op('world', 1 - realFade);
      op('far', 1 - realFade);
      op('carA-real', 1 - realFade * 0.82);
      op('carB-real', 1 - realFade * 0.82);
      op('bpgrid', gridT);
      op('carA-bp', drawT > 0 ? 1 : 0);
      op('carB-bp', drawT > 0 ? 1 : 0);
      const off = (1 - drawT).toFixed(3);
      ['carA', 'carB'].forEach((c) => {
        ['body', 'cabin', 'w1', 'w2'].forEach((part) => sty(`${c}-bp-${part}`, 'strokeDashoffset', off));
        op(`${c}-hatch`, hatchT);
      });
      op('dim', dimT);
      op('fx', 1 - realFade);

      /* --- Rückzug der Bühne am Ende --------------------------------------------- */
      applyRetreat(stage.current, retreatT(p, P.retreat));

      /* --- HUD: Abstand / Geschwindigkeit (Beispielwerte) ---------------------------- */
      const gapM = Math.max(0, (CONTACT_A_X - xA) / 100);
      const kmh = p < P.impact ? Math.round(V0_KMH * speedRel(p)) : 0;
      text('hud-gap', `${gapM.toFixed(1)} m`);
      text('hud-speed', `${kmh} km/h`);
      op('hud-approach', 1 - norm(p, P.impact - 0.02, P.impact + 0.02));

      /* --- Akt-Anzeige: nur bei Aktwechsel schreiben ---------------------------------- */
      let act = 0;
      for (let i = 0; i < ACTS.length; i++) if (p >= ACTS[i].a) act = i;
      if (act !== lastAct.current) {
        lastAct.current = act;
        text('hud-act', `ACT ${String(act + 1).padStart(2, '0')} / 09 · ${ACTS[act].key}`);
        for (let i = 0; i < ACTS.length; i++) op(`seg-${i}`, i === act ? 1 : i < act ? 0.55 : 0.2);
      }

      /* --- Akt-Titel --------------------------------------------------------------------- */
      for (let i = 0; i < ACTS.length - 1; i++) {
        const a = ACTS[i];
        const w = win(p, a.a + 0.004, a.b - 0.004, 0.012);
        op(`cap-${i}`, w);
        tf(`cap-${i}`, `translateY(${((1 - w) * 22).toFixed(1)}px)`);
      }
      /* ING-Finale */
      const ingT = easeOut(norm(p, P.ing, P.ing + 0.03));
      op('cap-ing', ingT);
      tf('cap-ing', `translateY(${((1 - ingT) * 26).toFixed(1)}px)`);
      sty('cap-ing', 'visibility', ingT > 0.02 ? 'visible' : 'hidden');
      op('legend', norm(p, P.find + 0.02, P.find + 0.07));
    },
    [pick, mobile, reduced, activeParticles],
  );

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (!reduced) render(v);
  });

  /* Seitenverhältnis messen (nur bei Größenänderung, nie im Scroll-Pfad). */
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => {
      const aspect = el.clientWidth / Math.max(1, el.clientHeight);
      fit.current = clamp(aspect, 0.4, 1);
      nodes.current.clear();
      lastVal.current.clear();
      lastAct.current = -1;
      render(reduced ? 0.9 : scrollYProgress.get());
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [render, reduced, scrollYProgress, mobile]);

  const track = reduced ? 'auto' : mobile ? '480vh' : '660vh';

  return (
    <section ref={section} id="kollision" aria-labelledby="crash-h" className="theme-light relative" style={{ height: track }}>
      <div
        ref={stage}
        className={`theme-dark stage-retreat relative overflow-hidden ${reduced ? '' : 'sticky top-0'}`}
        style={reduced ? { height: 'min(78vh, 680px)' } : { height: '100svh' }}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
          role="presentation"
        >
          <Defs mobile={mobile} />

          <rect width={VIEW_W} height={VIEW_H} fill="url(#crashSky)" />
          <g id="far" style={{ willChange: 'transform' }}>
            <Skyline mobile={mobile} />
          </g>
          <rect id="bpbg" width={VIEW_W} height={VIEW_H} fill="url(#bpGrad)" opacity="0" />

          <g id="cam" style={{ willChange: 'transform' }}>
            <World mobile={mobile} />

            {/* Messraster der technischen Darstellung */}
            <g id="bpgrid" opacity="0">
              <rect x={-2200} y={-400} width={5200} height={1700} fill="url(#bpGridPat)" />
              <g stroke="#6ba8ff" strokeOpacity=".35" strokeWidth="1.2">
                <path d={`M -2200 ${GROUND} H 3000`} />
                <path d={`M ${IMPACT_PT.x} -400 V 1300`} strokeDasharray="10 8" />
              </g>
            </g>

            {/* Getroffenes Fahrzeug (B) */}
            <g id="carB" style={{ transformBox: 'fill-box', transformOrigin: '20% 100%', willChange: 'transform' }}>
              <g id="carB-real">
                <CarBody paint="url(#carPaintB)" idPrefix="carB" />
                <path id="carB-rear" d={rearPath(0)} fill="#0e1319" stroke="url(#rimLight)" strokeWidth="1.6" />
                <g id="carB-folds" opacity="0" stroke="#6ba8ff" strokeOpacity=".55" strokeWidth="1.2" fill="none">
                  <path d="M 40 -104 L 62 -78 L 44 -56" />
                  <path d="M 58 -112 L 78 -86" />
                  <path d="M 30 -70 L 54 -48" />
                </g>
                <ellipse id="carB-shadow" cx="46" cy="-58" rx="46" ry="52" fill="#05070a" opacity="0" />
              </g>
              <Blueprint idPrefix="carB" zone="M 18 -30 C 8 -24 6 -22 14 -34 L 66 -56 L 84 -4 L 18 -4 Z" />
            </g>

            {/* Auffahrendes Fahrzeug (A) */}
            <g id="carA" style={{ transformBox: 'fill-box', transformOrigin: '80% 100%', willChange: 'transform' }} filter={mobile ? undefined : 'url(#motionBlur)'}>
              <g id="carA-real">
                <CarBody paint="url(#carPaintA)" idPrefix="carA" />
                <path id="carA-front" d={frontPath(0)} fill="#0e1319" stroke="url(#rimLight)" strokeWidth="1.6" />
                <ellipse id="carA-crushshadow" cx="500" cy="-52" rx="40" ry="46" fill="#05070a" opacity="0" />
                <g id="carA-hood" opacity="0" stroke="#6ba8ff" strokeOpacity=".5" strokeWidth="1.2" fill="none">
                  <path d="M 470 -96 L 494 -74 L 470 -58" />
                  <path d="M 440 -104 L 462 -84" />
                </g>
              </g>
              <Blueprint idPrefix="carA" zone="M 438 -74 L 508 -56 C 522 -50 528 -38 526 -24 L 524 -4 L 468 -4 Z" />
            </g>

            {/* Warnblinker (Uhr-getrieben, Sichtbarkeit scroll-gesteuert) */}
            <g id="haz" opacity="0">
              <HazardLights />
            </g>

            {/* Aufprall, Staub, Partikel */}
            <g id="fx">
              <ellipse id="flash" cx={IMPACT_PT.x} cy={IMPACT_PT.y} rx={150} ry={110} fill="url(#flashGrad)" opacity="0" />
              <circle id="ring" r="40" fill="none" stroke="#6ba8ff" strokeWidth="2" opacity="0" style={{ transformBox: 'view-box' }} />
              <ellipse id="dust" rx="150" ry="90" fill="url(#dustGrad)" opacity="0" style={{ transformBox: 'view-box' }} />
              {particles.current.map((q, i) => (
                <g key={i} id={`pt-${i}`} opacity="0" style={{ transformBox: 'view-box', willChange: 'transform' }}>
                  {q.glass ? (
                    <polygon points={`0,${-q.size} ${q.size * 0.8},0 0,${q.size * 0.7} ${-q.size * 0.7},${q.size * 0.2}`} fill="#9fdcf0" fillOpacity=".8" />
                  ) : (
                    <circle r={q.size * 0.5} fill="#8b98a4" fillOpacity=".45" />
                  )}
                </g>
              ))}
            </g>

            {/* Gutachter: Silhouette mit Tablet */}
            <Inspector />

            {/* Messmarken, Bemaßung (Beispielwerte) */}
            <g id="hud-marks" opacity="0">
              {CALLOUTS.map((c) => {
                const dx = mobile ? c.mdx : c.dx;
                const fs = mobile ? 11 : 13;
                return (
                  <g key={c.label}>
                    <path d={`M ${IMPACT_PT.x} ${IMPACT_PT.y} L ${IMPACT_PT.x + dx} ${IMPACT_PT.y + c.dy}`} stroke="#6ba8ff" strokeOpacity=".6" strokeWidth="1" strokeDasharray="4 5" />
                    <circle cx={IMPACT_PT.x + dx} cy={IMPACT_PT.y + c.dy} r="4" fill="#6ba8ff" />
                    <circle cx={IMPACT_PT.x + dx} cy={IMPACT_PT.y + c.dy} r="9" fill="none" stroke="#6ba8ff" strokeOpacity=".5" />
                    <text x={IMPACT_PT.x + dx + (dx < 0 ? -14 : 14)} y={IMPACT_PT.y + c.dy - 8} textAnchor={dx < 0 ? 'end' : 'start'} fontFamily="monospace" fontSize={fs} letterSpacing="1.6" fill="#edf1f4" fillOpacity=".92">
                      {mobile ? c.mlabel : c.label}
                    </text>
                    <text x={IMPACT_PT.x + dx + (dx < 0 ? -14 : 14)} y={IMPACT_PT.y + c.dy + 10} textAnchor={dx < 0 ? 'end' : 'start'} fontFamily="monospace" fontSize={fs} letterSpacing="1.6" fill="#6ba8ff">
                      {c.value}
                    </text>
                  </g>
                );
              })}
              {/* Bemaßung der Verformungstiefe */}
              <g id="dim" opacity="0" stroke="#bcd9ff" strokeWidth="1.3" fill="none">
                <path d={`M ${IMPACT_PT.x - 56} ${IMPACT_PT.y + 128} H ${IMPACT_PT.x + 56}`} />
                <path d={`M ${IMPACT_PT.x - 56} ${IMPACT_PT.y + 118} V ${IMPACT_PT.y + 138} M ${IMPACT_PT.x + 56} ${IMPACT_PT.y + 118} V ${IMPACT_PT.y + 138}`} />
                <path d={`M ${IMPACT_PT.x - 44} ${IMPACT_PT.y + 122} L ${IMPACT_PT.x - 56} ${IMPACT_PT.y + 128} L ${IMPACT_PT.x - 44} ${IMPACT_PT.y + 134} M ${IMPACT_PT.x + 44} ${IMPACT_PT.y + 122} L ${IMPACT_PT.x + 56} ${IMPACT_PT.y + 128} L ${IMPACT_PT.x + 44} ${IMPACT_PT.y + 134}`} />
                <text x={IMPACT_PT.x} y={IMPACT_PT.y + 154} textAnchor="middle" fontFamily="monospace" fontSize="13" letterSpacing="1.8" fill="#bcd9ff" stroke="none">
                  VERFORMUNGSTIEFE · BEISPIEL
                </text>
              </g>
            </g>
          </g>

          {/* Blauer technischer Schleier: fährt als weicher Verlauf über das Bild */}
          <rect id="veil" x="0" y="0" width={VIEW_W * 2.6} height={VIEW_H} fill="url(#veilGrad)" opacity="0" style={{ willChange: 'transform' }} />
        </svg>

        {/* Vignette */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true" style={{ background: 'radial-gradient(120% 85% at 50% 45%, transparent 38%, rgba(5,8,14,.78) 100%)' }} />

        {/* HUD */}
        <div className="pointer-events-none absolute inset-0" style={{ paddingInline: 'var(--pad)' }}>
          <div className="mx-auto flex h-full max-w-shell flex-col justify-between pb-[5.6rem] pt-5 sm:py-9">
            <div className="flex items-start justify-between gap-4 font-mono text-[.6rem] uppercase tracking-[.2em] text-fg-mute sm:text-[.64rem]">
              <h2 id="crash-h" className="font-mono text-[.6rem] font-normal uppercase tracking-[.2em] text-fg-mute sm:text-[.64rem]">
                Vom Unfall zum Gutachten
              </h2>
              <span id="hud-act" className="text-right text-signal-bright" aria-hidden="true">
                ACT 01 / 09 · FAHRT
              </span>
            </div>

            <div className="grid gap-4">
              <div id="hud-approach" className="flex flex-wrap gap-x-8 gap-y-1 font-mono text-[.6rem] uppercase tracking-[.2em] text-fg-mute" aria-hidden="true">
                <span>
                  Abstand <b id="hud-gap" className="ml-2 text-base tracking-normal text-measure">0 m</b>
                </span>
                <span>
                  Geschw. <b id="hud-speed" className="ml-2 text-base tracking-normal text-signal-bright">0 km/h</b>
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 font-mono text-[.56rem] uppercase tracking-[.18em] text-fg-mute/80">
                <span id="legend" style={{ opacity: 0 }} aria-hidden="true">Beispielhafte Rekonstruktion · Messwerte exemplarisch</span>
                <span className="flex gap-[3px]" aria-hidden="true">
                  {ACTS.map((a, i) => (
                    <i key={a.key} id={`seg-${i}`} className="block h-[3px] w-4 rounded-full bg-signal-bright sm:w-7" style={{ opacity: 0.2 }} />
                  ))}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Akt-Titel (dekorativ – die Inhalte stehen im Screenreader-Text unten) */}
        <div className="pointer-events-none absolute inset-0" style={{ paddingInline: 'var(--pad)' }} aria-hidden="true">
          <div className="relative mx-auto h-full w-full max-w-shell">
            {ACTS.slice(0, -1).map((a, i) => (
              <div key={a.key} id={`cap-${i}`} className={`absolute left-0 max-w-[22ch] ${i >= 6 ? 'bottom-[15%]' : 'top-[17%] sm:top-[19%]'}`} style={{ opacity: i === 0 ? 1 : 0, willChange: 'transform, opacity' }}>
                <p className="mono-label mb-3 text-signal-bright">{String(i + 1).padStart(2, '0')} / 09</p>
                <p className="display text-[clamp(2.6rem,1.2rem+6.4vw,7rem)] uppercase leading-[.88] tracking-[-.045em]">{a.word}</p>
                <p className="lead mt-3 max-w-[26ch] text-[clamp(1rem,.9rem+.5vw,1.25rem)]">{a.line}</p>
              </div>
            ))}

            <div id="cap-ing" className="pointer-events-auto absolute inset-x-0 bottom-[14%] grid justify-items-start gap-4 sm:bottom-[16%]" style={{ opacity: 0, visibility: 'hidden' }}>
              <span className="pointer-events-none absolute -bottom-[14%] -left-[var(--pad)] -top-[30%] z-0 w-[min(72vw,900px)] bg-[linear-gradient(90deg,rgba(4,16,44,.92),rgba(4,16,44,.6)_60%,transparent)]" aria-hidden="true" />
              <div className="relative z-[1] grid justify-items-start gap-4">
              <p className="mono-label text-signal-bright">09 / 09</p>
              <p className="display text-[clamp(2.8rem,1rem+8vw,9rem)] uppercase leading-[.86] tracking-[-.05em]">
                ING
                <br />
                Gutachten
              </p>
              <p className="lead max-w-[30ch]">Kfz-Sachverständigenbüro Hannover.</p>
              <Link href="#anfrage" className="btn" data-cursor="link" data-cursor-label="ANFRAGEN">
                Schaden melden <Arrow />
              </Link>
            
              </div></div>
          </div>
        </div>

        {/* Hinweis */}
        {!reduced && (
          <div className="pointer-events-none absolute bottom-14 left-1/2 hidden -translate-x-1/2 font-mono text-[.58rem] uppercase tracking-[.24em] text-fg-mute/70 sm:block" aria-hidden="true">
            Scrollen steuert den Film
          </div>
        )}

        {/* Screenreader: Inhalt der Szene als Text */}
        <p className="sr-only">
          Scroll-Animation in neun Akten: Fahrt, Gefahr, Bremsung, Aufprall, Stillstand, der Gutachter erscheint, Befundaufnahme am Schaden, technische Analyse mit Messpunkten und Bemaßung,
          schließlich ING Gutachten, Kfz-Sachverständigenbüro Hannover. Alle Werte im Film sind Beispielwerte.
        </p>
      </div>

      {/* Reduced Motion: informativer statischer Zustand mit erreichbarem CTA */}
      {reduced && (
        <div className="theme-dark">
          <div className="shell grid gap-4 py-10">
            <p className="display text-[clamp(1.8rem,1rem+3vw,3.2rem)] uppercase leading-none tracking-[-.04em]">Aus dem Unfall wird ein Gutachten.</p>
            <p className="lead">Aufnahme, Messung, Analyse – Beispielwerte, kein realer Fall.</p>
            <Link href="#anfrage" className="btn w-fit">
              Schaden melden <Arrow />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

/* ===================================================================== */

function Defs({ mobile }: { mobile: boolean }) {
  return (
    <defs>
      <linearGradient id="crashSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#070a10" />
        <stop offset="0.55" stopColor="#0f1722" />
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
        <stop offset="1" stopColor="#6ba8ff" stopOpacity=".8" />
      </linearGradient>
      <radialGradient id="lampGlow">
        <stop offset="0" stopColor="#eaf3ff" stopOpacity=".9" />
        <stop offset="1" stopColor="#6ba8ff" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="brakeGlow">
        <stop offset="0" stopColor="#ff2e1f" stopOpacity=".85" />
        <stop offset="1" stopColor="#ff2e1f" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="dustGrad">
        <stop offset="0" stopColor="#c9d3dd" stopOpacity=".55" />
        <stop offset="1" stopColor="#c9d3dd" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="contactShadow">
        <stop offset="0" stopColor="#000" stopOpacity=".7" />
        <stop offset="1" stopColor="#000" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="flashGrad">
        <stop offset="0" stopColor="#f4f9ff" stopOpacity=".95" />
        <stop offset="0.35" stopColor="#bcd9ff" stopOpacity=".35" />
        <stop offset="1" stopColor="#6ba8ff" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="hazGlow">
        <stop offset="0" stopColor="#ffb020" stopOpacity=".85" />
        <stop offset="1" stopColor="#ffb020" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="tabletGlow">
        <stop offset="0" stopColor="#bcd9ff" stopOpacity=".9" />
        <stop offset="1" stopColor="#6ba8ff" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="bpGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#06143a" />
        <stop offset="1" stopColor="#04102c" />
      </linearGradient>
      <linearGradient id="veilGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#0a2a66" stopOpacity="0" />
        <stop offset="0.28" stopColor="#0a2a66" stopOpacity=".55" />
        <stop offset="0.45" stopColor="#0b3a8c" stopOpacity=".72" />
        <stop offset="1" stopColor="#0a2a66" stopOpacity=".72" />
      </linearGradient>
      <pattern id="bpGridPat" width="50" height="50" patternUnits="userSpaceOnUse">
        <path d="M 50 0 H 0 V 50" fill="none" stroke="#6ba8ff" strokeOpacity=".16" strokeWidth="1" />
      </pattern>
      <pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <path d="M 0 0 V 9" stroke="#6ba8ff" strokeOpacity=".75" strokeWidth="1.6" />
      </pattern>
      {!mobile && (
        <filter id="motionBlur" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur id="mblur" in="SourceGraphic" stdDeviation="0 0" />
        </filter>
      )}
    </defs>
  );
}

/** Ferne Häuserzeile – deterministisch, wenige Rechtecke. */
function Skyline({ mobile }: { mobile: boolean }) {
  const rnd = mulberry32(77);
  const items: { x: number; w: number; h: number }[] = [];
  let x = -1400;
  while (x < 3000) {
    const w = 70 + rnd() * 150;
    items.push({ x, w, h: 90 + rnd() * 260 });
    x += w + 8 + rnd() * 30;
  }
  return (
    <g fill="#0b121b" opacity={mobile ? 0.8 : 1}>
      {items.map((b, i) => (
        <rect key={i} x={b.x} y={430 - b.h} width={b.w} height={b.h + 40} />
      ))}
    </g>
  );
}

/** Bodenebene mit Messraster, Straßenlampen (Tempo-Signal) und Bodenschatten. */
function World({ mobile }: { mobile: boolean }) {
  const lamp = mobile ? 760 : 460;
  const xs: number[] = [];
  for (let x = -2000; x < 2800; x += lamp) xs.push(x);
  const tick = mobile ? 400 : 200;
  const ticks: number[] = [];
  for (let x = -2000; x < 2800; x += tick) ticks.push(x);
  return (
    <g id="world">
      <rect x={-2200} y={GROUND - 4} width={5400} height={VIEW_H} fill="url(#crashFloor)" />
      <g stroke="#5ac8e8" strokeOpacity=".16" strokeWidth="1">
        <path d={`M -2200 ${GROUND} H 3000`} strokeOpacity=".4" />
        {ticks.map((x) => (
          <path key={x} d={`M ${x} ${GROUND} V ${GROUND + 26}`} />
        ))}
        {Array.from({ length: mobile ? 3 : 5 }, (_, i) => (
          <path key={i} d={`M -2200 ${GROUND + 40 + i * 34} H 3000`} strokeOpacity={0.09 - i * 0.015} />
        ))}
      </g>
      {/* Mittelstreifen */}
      <g stroke="#dbe9ff" strokeOpacity=".22" strokeWidth="3" strokeDasharray="70 90">
        <path d={`M -2200 ${GROUND + 78} H 3000`} />
      </g>
      <g fill="#5ac8e8" fillOpacity=".45" fontFamily="monospace" fontSize="15" letterSpacing="2">
        {ticks
          .filter((_, i) => i % 2 === 0)
          .map((x) => (
            <text key={x} x={x} y={GROUND + 48} textAnchor="middle">
              {((x - CONTACT_X) / 100).toFixed(0)} m
            </text>
          ))}
      </g>
      {/* Straßenlampen */}
      {xs.map((x) => (
        <g key={x}>
          <path d={`M ${x} ${GROUND} V 230`} stroke="#1c2733" strokeWidth="6" />
          <path d={`M ${x} 230 H ${x + 60}`} stroke="#1c2733" strokeWidth="6" />
          <ellipse cx={x + 60} cy={238} rx={140} ry={70} fill="url(#lampGlow)" opacity=".34" />
          <circle cx={x + 60} cy={234} r="6" fill="#eaf3ff" />
        </g>
      ))}
      <ellipse cx={CONTACT_X} cy={GROUND + 6} rx={520} ry={26} fill="url(#contactShadow)" />
    </g>
  );
}

const BODY_D = 'M 18 0 C 8 -8 6 -22 14 -34 L 60 -52 C 84 -92 128 -114 186 -118 L 330 -120 C 386 -118 424 -100 452 -70 L 508 -56 C 522 -50 528 -38 526 -24 L 524 -6 C 523 -2 519 0 514 0 Z';
const CABIN_D = 'M 96 -56 C 116 -88 152 -104 196 -107 L 322 -108 C 366 -106 396 -92 418 -66 Z';

/* --- Fahrzeug in Seitenansicht ---------------------------------------- */
function CarBody({ paint, idPrefix }: { paint: string; idPrefix: string }) {
  return (
    <g>
      <path d={BODY_D} fill={paint} stroke="url(#rimLight)" strokeWidth="1.6" strokeLinejoin="round" />
      <path d={CABIN_D} fill="#0a0f14" fillOpacity=".9" stroke="#5ac8e8" strokeOpacity=".3" strokeWidth="1.2" />
      <path d="M 256 -108 L 256 -57" stroke="#5ac8e8" strokeOpacity=".22" strokeWidth="1.2" />
      <path d="M 40 -44 C 180 -50 360 -50 500 -44" stroke="#ffffff" strokeOpacity=".09" strokeWidth="1.2" fill="none" />
      <path d="M 70 -18 C 200 -24 340 -24 480 -18" stroke="#ffffff" strokeOpacity=".06" strokeWidth="1.2" fill="none" />

      <path d="M 78 0 A 42 42 0 0 1 162 0 Z" fill="#06080b" />
      <path d="M 362 0 A 42 42 0 0 1 446 0 Z" fill="#06080b" />
      <g id={`${idPrefix}-w1`} style={{ transformBox: 'fill-box', transformOrigin: 'center', willChange: 'transform' }}>
        <circle cx="120" cy="-38" r="38" fill="#0a0d11" stroke="#3b4551" strokeWidth="1.4" />
        <circle cx="120" cy="-38" r="22" fill="none" stroke="#5ac8e8" strokeOpacity=".3" strokeWidth="1.1" />
        <path d="M 120 -60 V -16 M 98 -38 H 142 M 104 -54 L 136 -22 M 104 -22 L 136 -54" stroke="#ffffff" strokeOpacity=".13" strokeWidth="1" />
      </g>
      <g id={`${idPrefix}-w2`} style={{ transformBox: 'fill-box', transformOrigin: 'center', willChange: 'transform' }}>
        <circle cx="404" cy="-38" r="38" fill="#0a0d11" stroke="#3b4551" strokeWidth="1.4" />
        <circle cx="404" cy="-38" r="22" fill="none" stroke="#5ac8e8" strokeOpacity=".3" strokeWidth="1.1" />
        <path d="M 404 -60 V -16 M 382 -38 H 426 M 388 -54 L 420 -22 M 388 -22 L 420 -54" stroke="#ffffff" strokeOpacity=".13" strokeWidth="1" />
      </g>

      {/* Frontleuchte, Rücklicht mit Bremslicht-Glühen */}
      <rect x="502" y="-44" width="26" height="9" rx="4.5" fill="#dbe9ff" opacity=".85" />
      <ellipse id={`${idPrefix}-glow`} cx="6" cy="-38" rx="86" ry="46" fill="url(#brakeGlow)" opacity="0" />
      <rect id={`${idPrefix}-tail`} x="14" y="-42" width="22" height="8" rx="4" fill="#ff2e1f" opacity=".5" />
    </g>
  );
}

/** Warnblinker beider Fahrzeuge – laufen über die Uhr (CSS). */
function HazardLights() {
  return (
    <g>
      <HazardPair at="A" />
      <HazardPair at="B" />
    </g>
  );
}
function HazardPair({ at }: { at: 'A' | 'B' }) {
  // A (hinten, links): Heck bei x≈14 relativ zum Fahrzeug · B (vorn): Front bei x≈520
  // Position wird per Fahrzeug-Transform nicht gefolgt – daher feste Weltkoordinaten im Stillstand.
  const x = at === 'A' ? CONTACT_A_X - 8 : CAR_B_X + 46 + 528;
  return (
    <g data-hazard>
      <circle cx={x} cy={GROUND - 40} r="26" fill="url(#hazGlow)" />
      <circle cx={x} cy={GROUND - 40} r="6" fill="#ffb020" />
    </g>
  );
}

/** Technische Darstellung eines Fahrzeugs: zeichnet sich beim Übergang. */
function Blueprint({ idPrefix, zone }: { idPrefix: string; zone: string }) {
  const common = { fill: 'none', stroke: '#9cc6ff', strokeWidth: 1.7, strokeLinejoin: 'round' as const, vectorEffect: 'non-scaling-stroke' as const };
  return (
    <g id={`${idPrefix}-bp`} opacity="0">
      <path id={`${idPrefix}-bp-body`} d={BODY_D} pathLength={1} strokeDasharray="1" strokeDashoffset="1" {...common} />
      <path id={`${idPrefix}-bp-cabin`} d={CABIN_D} pathLength={1} strokeDasharray="1" strokeDashoffset="1" {...common} strokeOpacity=".8" />
      <circle id={`${idPrefix}-bp-w1`} cx="120" cy="-38" r="38" pathLength={1} strokeDasharray="1" strokeDashoffset="1" {...common} />
      <circle id={`${idPrefix}-bp-w2`} cx="404" cy="-38" r="38" pathLength={1} strokeDasharray="1" strokeDashoffset="1" {...common} />
      <circle cx="120" cy="-38" r="22" {...common} strokeOpacity=".5" strokeDasharray="3 5" />
      <circle cx="404" cy="-38" r="22" {...common} strokeOpacity=".5" strokeDasharray="3 5" />
      <path d="M 120 -38 H 404" {...common} strokeOpacity=".5" strokeDasharray="2 7" />
      <path id={`${idPrefix}-hatch`} d={zone} fill="url(#hatch)" stroke="#6ba8ff" strokeWidth="1.2" strokeDasharray="5 4" opacity="0" />
    </g>
  );
}

/** Gutachter: Silhouette mit Tablet als einziger Lichtquelle. Gehen = Funktion von p. */
function Inspector() {
  return (
    <g id="insp" opacity="0" style={{ willChange: 'transform, opacity' }}>
      <ellipse cx="0" cy="2" rx="46" ry="7" fill="#000" opacity=".5" />
      <g id="insp-l2" transform="rotate(0 0 -88)">
        <path d="M 4 -90 L 8 -46 L 6 -4" stroke="#0a1220" strokeWidth="13" strokeLinecap="round" fill="none" />
        <path d="M 4 -90 L 8 -46 L 6 -4" stroke="#6ba8ff" strokeOpacity=".25" strokeWidth="1" fill="none" />
      </g>
      <g id="insp-l1" transform="rotate(0 0 -88)">
        <path d="M -4 -90 L -8 -46 L -6 -4" stroke="#0d1727" strokeWidth="13" strokeLinecap="round" fill="none" />
        <path d="M -4 -90 L -8 -46 L -6 -4" stroke="#6ba8ff" strokeOpacity=".35" strokeWidth="1" fill="none" />
      </g>
      <path d="M -19 -150 Q 0 -160 19 -150 L 17 -86 L -17 -86 Z" fill="#0b1426" stroke="#6ba8ff" strokeOpacity=".55" strokeWidth="1.2" />
      <path d="M -17 -128 H 17" stroke="#6ba8ff" strokeOpacity=".7" strokeWidth="2" />
      <circle cx="0" cy="-170" r="11.5" fill="#0b1426" stroke="#6ba8ff" strokeOpacity=".55" strokeWidth="1.2" />
      <g id="insp-arm" transform="rotate(0 10 -146)">
        <path d="M 12 -146 L 38 -118" stroke="#0b1426" strokeWidth="9" strokeLinecap="round" fill="none" />
        <ellipse id="insp-glow" cx="48" cy="-124" rx="46" ry="34" fill="url(#tabletGlow)" opacity=".35" />
        <rect x="36" y="-134" width="28" height="19" rx="2.5" fill="#bcd9ff" fillOpacity=".92" stroke="#eaf3ff" strokeWidth="1" transform="rotate(-8 50 -124)" />
      </g>
    </g>
  );
}
