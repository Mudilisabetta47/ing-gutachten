'use client';

import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useRef, useState } from 'react';
import { SENSOR_POINTS } from '@/lib/content';

/* =====================================================================
   Technische Fahrzeugszenen.

   Alle drei teilen dieselbe Silhouette und dasselbe Prinzip: eine ruhige
   Grundzeichnung, auf der beim Eintritt in den Viewport nacheinander
   technische Ebenen erscheinen. Kein Dauerloop — Bewegung hat einen
   Anfang und ein Ende, sonst wird sie zur Tapete.
   ===================================================================== */

const EASE = [0.16, 1, 0.3, 1] as const;

/** Fahrzeugumriss in Draufsicht, geteilt von allen Szenen. */
function TopSilhouette({ opacity = 1 }: { opacity?: number }) {
  return (
    <g opacity={opacity}>
      <path
        d="M120 40c-58 0-96 12-104 40l-8 30c-5 26-5 54 0 80l8 30c8 28 46 40 104 40h360c58 0 96-12 104-40l8-30c5-26 5-54 0-80l-8-30c-8-28-46-40-104-40Z"
        fill="#12181f"
        stroke="#3d4a58"
        strokeWidth="1.6"
      />
      <path d="M186 62h228l22 34H164Z" fill="#0b1016" stroke="#7fa6c0" strokeOpacity=".3" strokeWidth="1.2" />
      <path d="M164 204h272l-22 34H186Z" fill="#0b1016" stroke="#7fa6c0" strokeOpacity=".3" strokeWidth="1.2" />
      <rect x="196" y="106" width="208" height="88" rx="16" fill="#0d1319" stroke="#333f4b" strokeWidth="1.2" />
      <g stroke="#ffffff" strokeOpacity=".07" strokeWidth="1">
        <path d="M30 110h30M540 110h30M30 190h30M540 190h30" />
      </g>
      <rect x="8" y="128" width="16" height="44" rx="8" fill="#ff6a5e" fillOpacity=".28" />
      <rect x="576" y="128" width="16" height="44" rx="8" fill="#dbe9ff" fillOpacity=".55" />
    </g>
  );
}

/* --- 1. Assistenzsysteme und Sensorik --------------------------------- */
export function SensorScene() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });
  const reduced = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);

  return (
    <div ref={ref} className="stage-radial relative overflow-hidden rounded-[22px] p-[clamp(1rem,3vw,2rem)]">
      <svg viewBox="0 0 820 280" className="w-full" role="img" aria-label="Fahrzeug mit Sensorpositionen">
        <defs>
          <radialGradient id="radarField">
            <stop offset="0" stopColor="#6ba8ff" stopOpacity=".28" />
            <stop offset="1" stopColor="#6ba8ff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Radarkegel vorn */}
        <motion.path
          d="M596 150 L810 66 L810 234 Z"
          fill="url(#radarField)"
          initial={reduced ? false : { opacity: 0, scaleX: 0.4 }}
          animate={inView ? { opacity: 1, scaleX: 1 } : {}}
          transition={{ duration: 1.2, delay: 0.5, ease: EASE }}
          style={{ transformOrigin: '596px 150px' }}
        />

        <TopSilhouette />

        {SENSOR_POINTS.map((s, i) => {
          const cx = (s.x / 100) * 600;
          const cy = (s.y / 100) * 280;
          const on = active === s.label;
          const color = s.kind === 'radar' ? '#6ba8ff' : s.kind === 'kamera' ? '#bcd9ff' : '#7fa6c0';

          return (
            <motion.g
              key={s.label}
              initial={reduced ? false : { opacity: 0, scale: 0.4 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.5, delay: 0.3 + i * 0.09, ease: EASE }}
              style={{ transformOrigin: `${cx}px ${cy}px`, cursor: 'pointer' }}
              onMouseEnter={() => setActive(s.label)}
              onMouseLeave={() => setActive(null)}
            >
              {/* weiches Pulsieren, nur solange nichts ausgewählt ist */}
              {!reduced && (
                <motion.circle
                  cx={cx}
                  cy={cy}
                  r="6"
                  fill="none"
                  stroke={color}
                  strokeWidth="1"
                  animate={inView ? { r: [6, 17], opacity: [0.55, 0] } : {}}
                  transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3, ease: 'easeOut' }}
                />
              )}
              <circle cx={cx} cy={cy} r={on ? 6 : 4.5} fill={color} />
              <circle cx={cx} cy={cy} r="12" fill="transparent" />
              {on && (
                <g>
                  <path d={`M${cx} ${cy} L${cx} ${cy - 26}`} stroke={color} strokeWidth="1" strokeOpacity=".6" />
                  <text
                    x={cx}
                    y={cy - 32}
                    textAnchor="middle"
                    fontFamily="monospace"
                    fontSize="11"
                    letterSpacing="1.4"
                    fill="#edf1f4"
                  >
                    {s.label.toUpperCase()}
                  </text>
                </g>
              )}
            </motion.g>
          );
        })}
      </svg>

      <p className="mt-4 font-mono text-[.6rem] uppercase tracking-[.2em] text-fg-mute">
        Beispielhafte Sensorpositionen · Ausstattung ist fahrzeugabhängig
      </p>
    </div>
  );
}

/* --- 2. Struktur unter der Außenhaut ---------------------------------- */
export function StructureScene() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduced = useReducedMotion();

  const zones = [
    { d: 'M120 96h72v88h-72Z', label: 'Längsträger', delay: 0.7 },
    { d: 'M408 96h72v88h-72Z', label: 'Heckstruktur', delay: 0.9 },
    { d: 'M196 100h208v80h-208Z', label: 'Bodengruppe', delay: 1.1 },
  ];

  return (
    <div ref={ref} className="stage-radial relative overflow-hidden rounded-[22px] p-[clamp(1rem,3vw,2rem)]">
      <svg viewBox="0 0 600 280" className="w-full" role="img" aria-label="Fahrzeugstruktur unter der Außenhaut">
        {/* Außenhaut tritt zurück, sobald die Struktur erscheint */}
        <motion.g
          initial={reduced ? false : { opacity: 1 }}
          animate={inView ? { opacity: 0.28 } : {}}
          transition={{ duration: 1, delay: 0.4, ease: EASE }}
        >
          <TopSilhouette />
        </motion.g>

        {/* Tragende Struktur */}
        <motion.g
          initial={reduced ? false : { opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.5, ease: EASE }}
          stroke="#6ba8ff"
          strokeOpacity=".7"
          strokeWidth="1.4"
          fill="none"
        >
          <path d="M60 110h480M60 170h480" />
          <path d="M120 96v88M196 90v100M404 90v100M480 96v88" />
          <path d="M120 96l76 -6M480 96l-76 -6M120 184l76 6M480 184l-76 6" />
        </motion.g>

        {zones.map((z) => (
          <motion.g
            key={z.label}
            initial={reduced ? false : { opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: z.delay, ease: EASE }}
          >
            <path d={z.d} fill="#6ba8ff" fillOpacity=".1" stroke="#6ba8ff" strokeOpacity=".45" strokeDasharray="4 4" />
          </motion.g>
        ))}

        {/* Maßlinie */}
        <motion.g
          initial={reduced ? false : { opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 1.3 }}
          stroke="#7fa6c0"
          strokeOpacity=".5"
          strokeWidth="1"
        >
          <path d="M120 232v14M480 232v14M120 239h360" />
          <text x="300" y="262" textAnchor="middle" fontFamily="monospace" fontSize="11" fill="#7fa6c0" stroke="none">
            SOLLMASS ABGLEICH
          </text>
        </motion.g>
      </svg>

      <p className="mt-4 font-mono text-[.6rem] uppercase tracking-[.2em] text-fg-mute">
        Schematische Darstellung · tragende Bereiche
      </p>
    </div>
  );
}

/* --- 3. Hochvoltsystem ------------------------------------------------- */
export function BatteryScene() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduced = useReducedMotion();
  const cells = Array.from({ length: 24 });

  return (
    <div ref={ref} className="stage-radial relative overflow-hidden rounded-[22px] p-[clamp(1rem,3vw,2rem)]">
      <svg viewBox="0 0 600 280" className="w-full" role="img" aria-label="Hochvoltsystem und Batterie im Fahrzeug">
        <motion.g
          initial={reduced ? false : { opacity: 1 }}
          animate={inView ? { opacity: 0.32 } : {}}
          transition={{ duration: 1, delay: 0.3, ease: EASE }}
        >
          <TopSilhouette />
        </motion.g>

        {/* Batteriegehäuse */}
        <motion.rect
          x="150"
          y="86"
          width="300"
          height="108"
          rx="12"
          fill="#0c1219"
          stroke="#6ba8ff"
          strokeWidth="1.6"
          initial={reduced ? false : { opacity: 0, scale: 0.94 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.4, ease: EASE }}
          style={{ transformOrigin: '300px 140px' }}
        />

        {/* Zellen leuchten nacheinander an */}
        {cells.map((_, i) => {
          const col = i % 8;
          const row = Math.floor(i / 8);
          return (
            <motion.rect
              key={i}
              x={162 + col * 35}
              y={96 + row * 32}
              width="29"
              height="26"
              rx="4"
              fill="#6ba8ff"
              initial={reduced ? false : { fillOpacity: 0.06 }}
              animate={inView ? (reduced ? { fillOpacity: 0.2 } : { fillOpacity: [0.06, 0.42, 0.2] }) : {}}
              transition={{ duration: 1.4, delay: 0.6 + i * 0.035, ease: EASE }}
            />
          );
        })}

        {/* Hochvoltpfad */}
        <motion.path
          d="M150 140H96c-12 0-18-8-18-18V96"
          fill="none"
          stroke="#6ba8ff"
          strokeWidth="2"
          strokeLinecap="round"
          initial={reduced ? false : { pathLength: 0, opacity: 0 }}
          animate={inView ? { pathLength: 1, opacity: 1 } : {}}
          transition={{ duration: 1, delay: 1.2, ease: EASE }}
        />
        <motion.path
          d="M450 140h54c12 0 18-8 18-18V96"
          fill="none"
          stroke="#6ba8ff"
          strokeWidth="2"
          strokeLinecap="round"
          initial={reduced ? false : { pathLength: 0, opacity: 0 }}
          animate={inView ? { pathLength: 1, opacity: 1 } : {}}
          transition={{ duration: 1, delay: 1.35, ease: EASE }}
        />

        <motion.g
          initial={reduced ? false : { opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 1.7 }}
        >
          <text x="300" y="228" textAnchor="middle" fontFamily="monospace" fontSize="11" letterSpacing="2" fill="#6ba8ff">
            BATTERIEGEHÄUSE · UNTERBODEN
          </text>
          <text x="300" y="248" textAnchor="middle" fontFamily="monospace" fontSize="10" letterSpacing="1.6" fill="#7fa6c0">
            PRÜFUNG NACH HERSTELLERVORGABE
          </text>
        </motion.g>
      </svg>

      <p className="mt-4 font-mono text-[.6rem] uppercase tracking-[.2em] text-fg-mute">
        Schematisch · Aufbau je nach Fahrzeug unterschiedlich
      </p>
    </div>
  );
}
