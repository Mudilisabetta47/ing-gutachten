'use client';

import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useRef } from 'react';
import { DATA_READOUTS, EDR_STEPS } from '@/lib/content';

const EASE = [0.16, 1, 0.3, 1] as const;

/* --- 1. Datenfluss: Fahrzeug → Ereignis → Auslesen → Auswertung -------- */
export function DataFlowScene() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const reduced = useReducedMotion();

  const stops = [90, 250, 410, 545];

  return (
    <div ref={ref} className="stage-radial relative overflow-hidden rounded-[22px] p-[clamp(1rem,3vw,2rem)]">
      <svg viewBox="0 0 620 200" className="w-full" role="img" aria-label="Datenfluss von der Fahrzeugelektronik zur Auswertung">
        {/* Verbindungslinie */}
        <motion.path
          d="M90 100H545"
          stroke="#2a3540"
          strokeWidth="1.5"
          fill="none"
          initial={reduced ? false : { pathLength: 0 }}
          animate={inView ? { pathLength: 1 } : {}}
          transition={{ duration: 1.1, ease: EASE }}
        />

        {/* Impuls, der einmal durchläuft */}
        {!reduced && (
          <motion.circle
            r="4"
            fill="#6ba8ff"
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: [0, 1, 1, 0], cx: [90, 250, 410, 545], cy: 100 } : {}}
            transition={{ duration: 2.4, delay: 1, ease: 'easeInOut' }}
          />
        )}

        {stops.map((x, i) => (
          <motion.g
            key={x}
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.4 + i * 0.18, ease: EASE }}
          >
            <circle cx={x} cy={100} r="20" fill="#0d1319" stroke="#3d4a58" strokeWidth="1.4" />
            <circle cx={x} cy={100} r="6" fill="#6ba8ff" fillOpacity=".85" />
            <text
              x={x}
              y={62}
              textAnchor="middle"
              fontFamily="monospace"
              fontSize="11"
              letterSpacing="1.6"
              fill="#edf1f4"
            >
              {String(i + 1).padStart(2, '0')}
            </text>
            <text
              x={x}
              y={144}
              textAnchor="middle"
              fontFamily="monospace"
              fontSize="10.5"
              letterSpacing="1.2"
              fill="#7fa6c0"
            >
              {EDR_STEPS[i].title.toUpperCase()}
            </text>
          </motion.g>
        ))}
      </svg>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {EDR_STEPS.map((s, i) => (
          <motion.div
            key={s.title}
            initial={reduced ? false : { opacity: 0, y: 14 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.8 + i * 0.1, ease: EASE }}
            className="border-t border-line pt-3"
          >
            <h3 className="mb-1 font-display text-[1rem] font-semibold">{s.title}</h3>
            <p className="text-[.85rem] text-fg-mute">{s.text}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* --- 2. Datenpanel ----------------------------------------------------- */
export function DataPanel() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const reduced = useReducedMotion();

  return (
    <div ref={ref} className="panel rounded-[22px]">
      <div className="mb-5 flex items-center justify-between gap-4 border-b border-line pb-3">
        <span className="font-mono text-[.62rem] uppercase tracking-[.22em] text-fg-mute">Datenpanel</span>
        <span className="font-mono text-[.62rem] uppercase tracking-[.22em] text-signal-bright">Beispielwerte</span>
      </div>

      <dl className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
        {DATA_READOUTS.map((d, i) => (
          <motion.div
            key={d.label}
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45, delay: i * 0.07, ease: EASE }}
            className="bg-ink-900 px-4 py-4"
          >
            <dt className="font-mono text-[.6rem] uppercase tracking-[.18em] text-fg-mute">{d.label}</dt>
            <dd className="mt-1 font-display text-[1.5rem] font-semibold tabular text-fg">
              {d.value}
              {d.unit && <span className="ml-1 text-[.9rem] font-normal text-fg-mute">{d.unit}</span>}
            </dd>
          </motion.div>
        ))}
      </dl>

      <p className="mt-5 text-[.82rem] text-fg-mute">
        Die dargestellten Werte sind Beispiele zur Veranschaulichung. Welche Informationen tatsächlich vorliegen,
        hängt vom Fahrzeug, seinen Systemen und den verfügbaren Daten ab.
      </p>
    </div>
  );
}

/* --- 3. Unfallrekonstruktion ------------------------------------------- */
export function ReconstructionScene() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const reduced = useReducedMotion();

  /** Fahrzeugkörper in Draufsicht, klein und schematisch. */
  const Car = ({ x, y, rot, tone }: { x: number; y: number; rot: number; tone: string }) => (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect x="-34" y="-16" width="68" height="32" rx="7" fill="#111820" stroke={tone} strokeWidth="1.4" />
      <rect x="-14" y="-11" width="26" height="22" rx="4" fill="#0b1016" stroke={tone} strokeOpacity=".5" strokeWidth="1" />
      <rect x="30" y="-8" width="5" height="16" rx="2.5" fill={tone} fillOpacity=".7" />
    </g>
  );

  const step = (d: number) => ({
    initial: reduced ? false : { opacity: 0 },
    animate: inView ? { opacity: 1 } : {},
    transition: { duration: 0.6, delay: d, ease: EASE },
  });

  return (
    <div ref={ref} className="stage-radial relative overflow-hidden rounded-[22px] p-[clamp(1rem,3vw,2rem)]">
      <svg viewBox="0 0 620 320" className="w-full" role="img" aria-label="Schematische Rekonstruktion eines Unfallhergangs">
        {/* Fahrbahnraster */}
        <g stroke="#7fa6c0" strokeOpacity=".12" strokeWidth="1">
          <path d="M0 80h620M0 160h620M0 240h620" />
          <path d="M100 0v320M240 0v320M380 0v320M520 0v320" strokeDasharray="3 10" />
        </g>
        <path d="M0 160h620" stroke="#7fa6c0" strokeOpacity=".28" strokeWidth="1.4" strokeDasharray="16 14" />

        {/* Bewegungspfade */}
        <motion.path
          d="M40 200H300"
          stroke="#6ba8ff"
          strokeWidth="1.6"
          strokeDasharray="5 6"
          fill="none"
          initial={reduced ? false : { pathLength: 0 }}
          animate={inView ? { pathLength: 1 } : {}}
          transition={{ duration: 1, delay: 0.3, ease: EASE }}
        />
        <motion.path
          d="M580 96H340"
          stroke="#7fa6c0"
          strokeWidth="1.6"
          strokeDasharray="5 6"
          fill="none"
          initial={reduced ? false : { pathLength: 0 }}
          animate={inView ? { pathLength: 1 } : {}}
          transition={{ duration: 1, delay: 0.45, ease: EASE }}
        />

        {/* Ausgangspositionen */}
        <motion.g {...step(0.6)}>
          <Car x={70} y={200} rot={0} tone="#6ba8ff" />
          <text x={70} y={232} textAnchor="middle" fontFamily="monospace" fontSize="10" fill="#7fa6c0">
            FZG A
          </text>
        </motion.g>
        <motion.g {...step(0.75)}>
          <Car x={550} y={96} rot={180} tone="#7fa6c0" />
          <text x={550} y={128} textAnchor="middle" fontFamily="monospace" fontSize="10" fill="#7fa6c0">
            FZG B
          </text>
        </motion.g>

        {/* Kollisionspunkt */}
        <motion.g {...step(1.05)}>
          <circle cx={320} cy={148} r="9" fill="none" stroke="#6ba8ff" strokeWidth="1.6" />
          <path d="M320 130v-16M320 166v16M302 148h-16M338 148h16" stroke="#6ba8ff" strokeWidth="1.4" />
          <text x={320} y={104} textAnchor="middle" fontFamily="monospace" fontSize="10.5" letterSpacing="1.6" fill="#edf1f4">
            KOLLISIONSPUNKT
          </text>
        </motion.g>

        {/* Kraftvektoren */}
        <motion.g {...step(1.3)} stroke="#6ba8ff" strokeWidth="2" fill="none">
          <path d="M240 176l58 -22" markerEnd="url(#arw)" />
          <path d="M400 122l-58 22" markerEnd="url(#arw)" />
        </motion.g>
        <defs>
          <marker id="arw" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0 0l8 4-8 4z" fill="#6ba8ff" />
          </marker>
        </defs>

        {/* Winkelangabe */}
        <motion.g {...step(1.5)}>
          <path d="M320 148m-42 0a42 42 0 0 1 30 -40" fill="none" stroke="#7fa6c0" strokeOpacity=".6" strokeWidth="1" />
          <text x={262} y={116} fontFamily="monospace" fontSize="10.5" fill="#7fa6c0">
            KOLLISIONSWINKEL
          </text>
        </motion.g>
      </svg>

      <p className="mt-4 font-mono text-[.6rem] uppercase tracking-[.2em] text-fg-mute">
        Schematische Darstellung · ersetzt keine Einzelfallbetrachtung
      </p>
    </div>
  );
}
