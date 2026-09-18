'use client';

import { useEffect, useRef } from 'react';
import { clamp, easeInOutCubic, easeSmooth, lerp, norm, shakeDecay } from '@/lib/easing';

/* =====================================================================
   ROSE CAFÉ — Canvas 2D "3D"-System.

   Eigene Lochkamera-Projektion statt WebGL/Three.js:

     world x/y/z → camera → projection → screen x/y

   Alle Zustände sind reine Funktionen des Scroll-Fortschritts `p` (0…1) —
   keine zeitabhängigen Tween-Ketten. Steht der Nutzer mitten in der
   Bewegung still, bleibt exakt dieser Frame stehen; beim Hochscrollen
   läuft die Szene exakt rückwärts, weil nichts außer `p` den Zustand
   bestimmt.

   Licht entsteht über gemalte Verläufe (Lampen, Fensterlicht, Glanz auf
   der Tasse), nicht über ein 3D-Lichtsystem. Partikel (Dampf, Lichtstaub,
   Rosenblätter) sind ebenfalls reine Funktionen von `p`.
   ===================================================================== */

type Cam = { x: number; y: number; z: number; focal: number };

const clampV = clamp;

function project(wx: number, wy: number, wz: number, cam: Cam, w: number, h: number) {
  const dz = Math.max(wz - cam.z, 40);
  const scale = cam.focal / dz;
  return { x: w / 2 + (wx - cam.x) * scale, y: h / 2 + (wy - cam.y) * scale, scale };
}

/** Kamerafahrt: Totale → Tisch → Tasse im Fokus → Rückzug. */
function cameraAt(p: number, variant: 'hero' | 'signature'): Cam {
  if (variant === 'signature') {
    const focal = lerp(520, 640, easeInOutCubic(norm(p, 0, 0.7))) - easeInOutCubic(norm(p, 0.85, 1)) * 40;
    const z = lerp(430, 500, easeInOutCubic(norm(p, 0, 0.75))) - easeInOutCubic(norm(p, 0.86, 1)) * 60;
    const drift = shakeDecay(p * 0.6, 1.4, 1) * 3;
    return { x: drift, y: -6 + Math.sin(p * Math.PI) * 4, z, focal };
  }

  const totale = easeInOutCubic(norm(p, 0, 0.2));
  const approach = easeInOutCubic(norm(p, 0.2, 0.5));
  const table = easeInOutCubic(norm(p, 0.5, 0.7));
  const cup = easeInOutCubic(norm(p, 0.7, 0.85));
  const retreat = easeInOutCubic(norm(p, 0.85, 1));

  let z = lerp(-40, 40, totale);
  z = lerp(z, 190, approach);
  z = lerp(z, 340, table);
  z = lerp(z, 470, cup);
  z = lerp(z, 210, retreat);

  let focal = lerp(330, 350, totale);
  focal = lerp(focal, 370, approach);
  focal = lerp(focal, 410, table);
  focal = lerp(focal, 470, cup);
  focal = lerp(focal, 400, retreat);

  let x = lerp(0, -6, approach);
  x = lerp(x, -34, table);
  x = lerp(x, -46, cup);
  x = lerp(x, -10, retreat);

  let y = lerp(-70, -40, totale);
  y = lerp(y, -6, approach);
  y = lerp(y, 30, table);
  y = lerp(y, 46, cup);
  y = lerp(y, 10, retreat);

  const driftAmt = (1 - retreat) * 2.2;
  x += shakeDecay(p * 0.35, 1.1, 0.6) * driftAmt;
  y += shakeDecay(p * 0.3 + 0.4, 0.9, 0.6) * driftAmt * 0.6;

  return { x, y, z, focal };
}

export function CafeCanvas({
  progress,
  variant = 'hero',
  className,
  announceReady = false,
}: {
  progress: number;
  variant?: 'hero' | 'signature';
  className?: string;
  announceReady?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(true);
  const progressRef = useRef(progress);
  const reducedRef = useRef(false);
  const readyRef = useRef(false);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  progressRef.current = progress;

  useEffect(() => {
    reducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  /* Viewport Activation: nur zeichnen, wenn die Szene sichtbar ist. */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      activeRef.current = entry.isIntersecting;
      if (activeRef.current) draw(progressRef.current);
    }, { threshold: 0.02 });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Pixelbudget: großen Displays kein volles natives DPR geben. */
  const resize = () => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const area = w * h;
    const budgetDpr = area > 1_600_000 ? 1.25 : area > 800_000 ? 1.5 : 2;
    const dpr = Math.min(window.devicePixelRatio || 1, budgetDpr);
    sizeRef.current = { w, h, dpr };
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    draw(progressRef.current);
  };

  useEffect(() => {
    resize();
    const ro = new ResizeObserver(resize);
    if (wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener('orientationchange', resize);
    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeRef.current) return;
    draw(progress);
    if (announceReady && !readyRef.current) {
      readyRef.current = true;
      document.dispatchEvent(new CustomEvent('rose:hero-ready'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  function draw(pRaw: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { w, h, dpr } = sizeRef.current;
    if (w === 0 || h === 0) return;
    const p = reducedRef.current ? (variant === 'signature' ? 0.4 : 0.36) : clampV(pRaw);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const cam = cameraAt(p, variant);
    const pr = (wx: number, wy: number, wz: number) => project(wx, wy, wz, cam, w, h);

    /* ---- Hintergrund: Nachthimmel-Café-Ton mit Fensterlicht -------- */
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1c1210');
    bg.addColorStop(0.55, '#140f0d');
    bg.addColorStop(1, '#0d0908');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    /* Fensterlicht — weicher linearer Verlauf, weit hinten */
    const win = pr(220, -120, 1500);
    const winGrad = ctx.createRadialGradient(win.x, win.y, 0, win.x, win.y, 640 * win.scale);
    winGrad.addColorStop(0, 'rgba(255,214,170,.30)');
    winGrad.addColorStop(1, 'rgba(255,214,170,0)');
    ctx.fillStyle = winGrad;
    ctx.fillRect(0, 0, w, h);

    /* Café-Lampen — Radial Gradients als "gemaltes Licht" */
    drawLamp(ctx, pr(-320, -260, 900), '#ffce9c');
    drawLamp(ctx, pr(260, -300, 1050), '#ffb98a');
    drawLamp(ctx, pr(30, -340, 1300), '#ffdcb0');

    /* Regal-Silhouette links, sehr weich */
    const shelf = pr(-520, -20, 1100);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(0, 0, Math.max(0, shelf.x + 40), h);

    /* Lichtstaub / Bokeh — wenige große, weiche Punkte statt Partikelmenge */
    drawDust(ctx, pr, p);

    /* ---- Tisch ------------------------------------------------------ */
    const table = pr(0, 260, 560);
    ctx.save();
    ctx.translate(table.x, table.y);
    ctx.scale(table.scale, table.scale);
    const tableGrad = ctx.createLinearGradient(-420, -30, 420, 60);
    tableGrad.addColorStop(0, '#3a241c');
    tableGrad.addColorStop(0.5, '#4a2e22');
    tableGrad.addColorStop(1, '#301d16');
    ctx.fillStyle = tableGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 460, 130, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    /* Rose in kleiner Vase */
    drawRose(ctx, pr(-190, 150, 520), p);

    /* Croissant auf Teller */
    drawCroissant(ctx, pr(150, 175, 545));

    /* Tasse mit Untertasse + Dampf */
    drawCup(ctx, pr(-30, 165, 500), p);

    /* ---- Vignette + Filmkorn ----------------------------------------- */
    const vig = ctx.createRadialGradient(w / 2, h * 0.46, h * 0.2, w / 2, h * 0.5, h * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(8,5,4,.62)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  return (
    <div ref={wrapRef} className={className} aria-hidden="true" role="presentation">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}

function drawLamp(ctx: CanvasRenderingContext2D, pt: { x: number; y: number; scale: number }, color: string) {
  const r = 260 * pt.scale;
  if (r < 1) return;
  const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r);
  g.addColorStop(0, `${color}55`);
  g.addColorStop(0.35, `${color}22`);
  g.addColorStop(1, `${color}00`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,244,225,.9)';
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, Math.max(1.4, 4.2 * pt.scale), 0, Math.PI * 2);
  ctx.fill();
}

function drawCup(
  ctx: CanvasRenderingContext2D,
  pt: { x: number; y: number; scale: number },
  p: number,
) {
  const s = pt.scale;
  ctx.save();
  ctx.translate(pt.x, pt.y);
  ctx.scale(s, s);

  /* Untertasse */
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath();
  ctx.ellipse(4, 30, 96, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#efe3d3';
  ctx.beginPath();
  ctx.ellipse(0, 24, 92, 24, 0, 0, Math.PI * 2);
  ctx.fill();

  /* Tasse */
  const cupGrad = ctx.createLinearGradient(-56, -46, 56, 20);
  cupGrad.addColorStop(0, '#fbf4e9');
  cupGrad.addColorStop(1, '#e9d9bf');
  ctx.fillStyle = cupGrad;
  ctx.beginPath();
  ctx.moveTo(-58, -34);
  ctx.quadraticCurveTo(-62, 12, -46, 20);
  ctx.lineTo(46, 20);
  ctx.quadraticCurveTo(62, 12, 58, -34);
  ctx.closePath();
  ctx.fill();

  /* Henkel */
  ctx.strokeStyle = '#e9d9bf';
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.ellipse(74, -8, 20, 24, 0, -0.9, 1.6);
  ctx.stroke();

  /* Kaffeeoberfläche */
  ctx.fillStyle = '#3a2213';
  ctx.beginPath();
  ctx.ellipse(0, -34, 52, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.16)';
  ctx.beginPath();
  ctx.ellipse(-14, -37, 20, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  /* Dampf — reine Funktion von p, friert exakt ein */
  drawSteam(ctx, pt, p);
}

function drawSteam(ctx: CanvasRenderingContext2D, pt: { x: number; y: number; scale: number }, p: number) {
  const s = pt.scale;
  const strands = 3;
  for (let i = 0; i < strands; i++) {
    const phase = ((p * 26 + i * 0.42) % 1);
    const baseX = pt.x + (i - 1) * 22 * s;
    const rise = 130 * s * phase;
    const sway = Math.sin(phase * Math.PI * 2 + i) * 14 * s;
    const opacity = Math.sin(phase * Math.PI) * 0.22;
    if (opacity <= 0.01) continue;
    ctx.strokeStyle = `rgba(255,255,255,${opacity.toFixed(3)})`;
    ctx.lineWidth = 5 * s * (1 - phase * 0.5);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(baseX, pt.y - 40 * s);
    ctx.quadraticCurveTo(baseX + sway, pt.y - 40 * s - rise * 0.6, baseX + sway * 0.4, pt.y - 40 * s - rise);
    ctx.stroke();
  }
}

function drawCroissant(ctx: CanvasRenderingContext2D, pt: { x: number; y: number; scale: number }) {
  const s = pt.scale;
  ctx.save();
  ctx.translate(pt.x, pt.y);
  ctx.scale(s, s);

  ctx.fillStyle = '#efe3d3';
  ctx.beginPath();
  ctx.ellipse(0, 14, 80, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  const grad = ctx.createLinearGradient(-60, -20, 60, 10);
  grad.addColorStop(0, '#d9a35c');
  grad.addColorStop(1, '#a8672f');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-58, 8);
  ctx.quadraticCurveTo(-30, -34, 0, -16);
  ctx.quadraticCurveTo(30, -34, 58, 8);
  ctx.quadraticCurveTo(20, 2, 0, 10);
  ctx.quadraticCurveTo(-20, 2, -58, 8);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawRose(ctx: CanvasRenderingContext2D, pt: { x: number; y: number; scale: number }, p: number) {
  const s = pt.scale;
  const sway = Math.sin(p * Math.PI * 2) * 3;
  ctx.save();
  ctx.translate(pt.x, pt.y);
  ctx.scale(s, s);
  ctx.rotate((sway * Math.PI) / 180);

  /* Vase */
  ctx.fillStyle = 'rgba(255,255,255,.14)';
  ctx.beginPath();
  ctx.moveTo(-14, 40);
  ctx.lineTo(-10, -6);
  ctx.quadraticCurveTo(0, -14, 10, -6);
  ctx.lineTo(14, 40);
  ctx.closePath();
  ctx.fill();

  /* Stiel */
  ctx.strokeStyle = '#5c6a45';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.quadraticCurveTo(6, -46, -2, -78);
  ctx.stroke();

  /* Blüte — wenige weiche Bezier-Blütenblätter */
  const petals = 5;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    ctx.fillStyle = i % 2 === 0 ? '#c47786' : '#b8636f';
    ctx.beginPath();
    ctx.ellipse(-2 + Math.cos(a) * 9, -80 + Math.sin(a) * 9, 12, 8, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#e9c9c9';
  ctx.beginPath();
  ctx.arc(-2, -80, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawDust(
  ctx: CanvasRenderingContext2D,
  pr: (x: number, y: number, z: number) => { x: number; y: number; scale: number },
  p: number,
) {
  const motes = [
    { x: -180, y: -60, z: 620, r: 3.2, sp: 0.6 },
    { x: 140, y: -140, z: 780, r: 2.4, sp: 0.9 },
    { x: -60, y: -220, z: 900, r: 2, sp: 0.4 },
    { x: 260, y: -40, z: 700, r: 2.8, sp: 0.7 },
  ];
  for (const m of motes) {
    const t = ((p * m.sp + m.x) % 1 + 1) % 1;
    const pt = pr(m.x + Math.sin(t * Math.PI * 2) * 30, m.y - t * 90, m.z);
    const alpha = Math.sin(t * Math.PI) * 0.35;
    if (alpha <= 0.01) continue;
    ctx.fillStyle = `rgba(255,224,180,${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, Math.max(0.6, m.r * pt.scale), 0, Math.PI * 2);
    ctx.fill();
  }
}
