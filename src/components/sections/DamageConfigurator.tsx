'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { DAMAGE_ZONES } from '@/lib/content';
import { BATTERY_ITEMS, LAYERS, SENSOR_ITEMS, STRUCTURE_ITEMS, type LayerItem, type LayerKey } from '@/lib/vehicle-model';
import { Reveal } from '@/components/ui/Reveal';
import { Slug } from '@/components/ui/Slug';
import { ReviewNote } from '@/components/ui/ReviewNote';
import { Arrow } from '@/components/ui/Icon';

const VB_W = 400;
const VB_H = 720;

const NOTES: Record<LayerKey, string> = {
  zones: '',
  sensors: 'Typische Positionen. Anzahl, Lage und Ausstattung unterscheiden sich je nach Hersteller, Modell und Baujahr.',
  battery: 'Schematisch. Nur bei Elektro- und Plug-in-Hybridfahrzeugen; Form, Größe und Lage der Batterie sind modellabhängig.',
  structure: 'Schematische Darstellung der typischen Heckstruktur – kein Hinweis auf einen Schaden. Der Aufbau ist je Modell unterschiedlich.',
};
const LINKS: Record<LayerKey, { href: string; label: string }> = {
  zones: { href: '/unfallgutachten', label: 'Unfallgutachten anfordern' },
  sensors: { href: '/pkw-gutachten', label: 'Mehr zum PKW-Gutachten' },
  battery: { href: '/e-auto-hybrid-gutachten', label: 'Mehr zu Elektro & Hybrid' },
  structure: { href: '/pkw-gutachten', label: 'Mehr zum PKW-Gutachten' },
};

export function DamageConfigurator() {
  const [layer, setLayer] = useState<LayerKey>('zones');
  const [activeKey, setActiveKey] = useState<Record<LayerKey, string>>({
    zones: DAMAGE_ZONES[0].key,
    sensors: SENSOR_ITEMS[0].key,
    battery: BATTERY_ITEMS[0].key,
    structure: STRUCTURE_ITEMS[0].key,
  });

  const items: LayerItem[] = useMemo(() => {
    if (layer === 'sensors') return SENSOR_ITEMS;
    if (layer === 'battery') return BATTERY_ITEMS;
    if (layer === 'structure') return STRUCTURE_ITEMS;
    return DAMAGE_ZONES.map((z) => ({
      key: z.key, index: z.index, title: z.title, text: z.text, points: z.points,
      markers: [{ x: (z.x / 100) * VB_W, y: (z.y / 100) * VB_H }],
    }));
  }, [layer]);

  const active = items.find((i) => i.key === activeKey[layer]) ?? items[0];
  const select = (key: string) => setActiveKey((prev) => ({ ...prev, [layer]: key }));
  const link = LINKS[layer];

  return (
    <section className="section border-y border-line bg-ink-850" id="schadenfall" aria-labelledby="dmg-h">
      <ReviewNote topic="Fahrzeugmodell (Sensorik, Hochvolt-Batterie, Heckstruktur; typische, schematische Lagen)" />
      <div className="shell">
        <Slug left="Schadenfall" right="Interaktives Fahrzeugmodell" />

        <div className="mb-[clamp(2.5rem,6vw,4.5rem)] grid max-w-4xl gap-[1.1rem]">
          <p className="eyebrow">Was wir uns ansehen</p>
          <Reveal>
            <h2 id="dmg-h" className="display text-h2">
              Sieben Zonen.
              <br />
              Ein vollständiges Bild.
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="lead">
              Wählen Sie einen Bereich – wir zeigen, was bei diesem Schadentyp geprüft wird und welche Positionen
              im Gutachten landen. Zusätzliche Ansichten zeigen Assistenzsysteme, die Hochvolt-Batterie und die Heckstruktur.
            </p>
          </Reveal>
        </div>

        <div className="mb-6 flex flex-wrap gap-[.4rem]" role="group" aria-label="Ansicht wählen">
          {LAYERS.map((l) => {
            const on = l.key === layer;
            return (
              <button
                key={l.key}
                type="button"
                onClick={() => setLayer(l.key)}
                aria-pressed={on}
                title={l.hint}
                className={`min-h-11 cursor-pointer rounded-full border-0 px-5 py-2 font-mono text-[.7rem] uppercase tracking-[.12em] transition-colors ${
                  on ? 'bg-signal text-white' : 'bg-transparent text-fg-dim hover:text-fg'
                }`}
                style={{ boxShadow: on ? 'none' : 'inset 0 0 0 1px #232b33' }}
              >
                {l.label}
              </button>
            );
          })}
        </div>

        <div className="grid items-center gap-6 lg:grid-cols-[1.25fr_.75fr] lg:gap-[clamp(2rem,4vw,4rem)]">
          <div className="stage-radial overflow-hidden rounded-[22px] p-[clamp(1rem,3vw,2.2rem)]">
            <div className="relative mx-auto w-full max-w-[420px]">
              <CarTopView layer={layer} />
              {items.flatMap((item) =>
                item.markers.map((m, mi) => {
                  const on = item.key === active.key;
                  return (
                    <button
                      key={`${layer}-${item.key}-${mi}`}
                      type="button"
                      onClick={() => select(item.key)}
                      onMouseEnter={() => select(item.key)}
                      aria-pressed={on}
                      aria-label={`${item.title} anzeigen`}
                      className="group absolute -translate-x-1/2 -translate-y-1/2 border-0 bg-transparent p-0"
                      style={{ left: `${(m.x / VB_W) * 100}%`, top: `${(m.y / VB_H) * 100}%` }}
                    >
                      <span
                        className={`relative grid place-items-center rounded-full transition-all duration-500 ease-out ${
                          layer === 'zones' ? 'h-10 w-10' : 'h-[34px] w-[34px]'
                        } ${on ? 'scale-110 bg-signal' : 'bg-signal-soft group-hover:scale-110 group-hover:bg-signal group-focus-visible:scale-110 group-focus-visible:bg-signal'}`}
                        style={{ boxShadow: on ? 'none' : 'inset 0 0 0 1px rgba(107,168,255,.38)' }}
                      >
                        {!on && <span className="absolute inset-0 animate-ping-slow rounded-full border border-signal-bright" />}
                        <i className={`block h-[7px] w-[7px] rounded-full ${on ? 'bg-ink-900' : 'bg-signal group-hover:bg-ink-900 group-focus-visible:bg-ink-900'}`} />
                      </span>
                      {mi === 0 && (
                        <span
                          className={`absolute left-[40px] top-1/2 hidden -translate-y-1/2 whitespace-nowrap font-mono text-[.62rem] uppercase tracking-[.16em] transition-opacity lg:block ${
                            on ? 'text-fg opacity-100' : 'text-fg-dim opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
                          }`}
                        >
                          {item.title}
                        </span>
                      )}
                    </button>
                  );
                }),
              )}
            </div>
          </div>

          <div>
            <div className="panel min-h-[270px]" role="region" aria-live="polite" aria-label="Details zur Auswahl">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${layer}-${active.key}`}
                  initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="grid content-start gap-[.9rem]"
                >
                  <span className="font-mono text-[.68rem] tracking-[.2em] text-signal-bright">{active.index}</span>
                  <h3 className="font-display text-2xl font-semibold tracking-[-.02em]">{active.title}</h3>
                  <p className="text-fg-mute">{active.text}</p>
                  <ul className="mt-[.3rem] grid gap-2">
                    {active.points.map((p) => (
                      <li key={p} className="flex gap-3 text-[.92rem] text-fg-dim">
                        <span className="mt-[.55em] h-[6px] w-[6px] flex-none rounded-full bg-measure" />
                        {p}
                      </li>
                    ))}
                  </ul>
                  <Link href={link.href} className="tlink mt-[.4rem] text-signal-bright">
                    {link.label} <Arrow />
                  </Link>
                </motion.div>
              </AnimatePresence>
            </div>

            {NOTES[layer] && <p className="mt-4 text-[.78rem] leading-relaxed text-fg-mute">{NOTES[layer]}</p>}

            <div className="mt-6 flex flex-wrap gap-[.4rem]" aria-label="Auswahl">
              {items.map((item) => {
                const on = item.key === active.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => select(item.key)}
                    aria-pressed={on}
                    className={`min-h-11 cursor-pointer rounded-full border-0 px-4 py-2 font-mono text-[.68rem] uppercase tracking-[.12em] transition-colors ${
                      on ? 'bg-signal text-white' : 'bg-transparent text-fg-mute hover:text-fg'
                    }`}
                    style={{ boxShadow: on ? 'none' : 'inset 0 0 0 1px #232b33' }}
                  >
                    {item.title}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Technische Draufsicht statt Stockfoto – passt zur Messtechnik-Positionierung. */
function CarTopView({ layer }: { layer: LayerKey }) {
  return (
    <svg viewBox="0 0 400 720" fill="none" aria-hidden="true" className="w-full">
      <defs>
        <linearGradient id="topBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#232b34" />
          <stop offset="1" stopColor="#0e1217" />
        </linearGradient>
      </defs>
      <g stroke="#5ac8e8" strokeOpacity=".14" strokeWidth="1">
        <path d="M200 6v708M20 360h360" />
        <circle cx="200" cy="360" r="230" strokeDasharray="3 9" />
      </g>
      <rect x="26" y="168" width="30" height="86" rx="10" fill="#0a0d11" stroke="#39434e" />
      <rect x="344" y="168" width="30" height="86" rx="10" fill="#0a0d11" stroke="#39434e" />
      <rect x="26" y="470" width="30" height="86" rx="10" fill="#0a0d11" stroke="#39434e" />
      <rect x="344" y="470" width="30" height="86" rx="10" fill="#0a0d11" stroke="#39434e" />
      <path
        d="M200 26c-72 0-118 34-128 108l-10 152c-6 84-6 176 0 258l8 92c4 34 44 48 130 48s126-14 130-48l8-92c6-82 6-174 0-258l-10-152C318 60 272 26 200 26Z"
        fill="url(#topBody)"
        stroke="#4a5663"
        strokeWidth="1.6"
      />
      <path d="M200 150c-46 0-74 16-84 44l-8 24h184l-8-24c-10-28-38-44-84-44Z" fill="#0b1016" stroke="#5ac8e8" strokeOpacity=".35" />
      <rect x="106" y="228" width="188" height="230" rx="26" fill="#0c1116" stroke="#3a4550" />
      <path d="M108 486h184l10 30c-30 12-64 16-102 16s-72-4-102-16Z" fill="#0b1016" stroke="#5ac8e8" strokeOpacity=".35" />
      <g stroke="#ffffff" strokeOpacity=".1">
        <path d="M70 300h34M296 300h34M70 470h34M296 470h34" />
        <path d="M104 232v224M296 232v224" />
      </g>
      <rect x="150" y="40" width="100" height="10" rx="5" fill="#6ba8ff" fillOpacity=".55" />
      <rect x="150" y="678" width="100" height="10" rx="5" fill="#ff6a5e" fillOpacity=".35" />
      <g fill="#5ac8e8" fillOpacity=".5" fontFamily="monospace" fontSize="11" letterSpacing="1.5">
        <text x="200" y="16" textAnchor="middle">FRONT</text>
        <text x="200" y="712" textAnchor="middle">HECK</text>
      </g>
      <g aria-hidden="true">
        {layer === 'sensors' && <SensorOverlay />}
        {layer === 'battery' && <BatteryOverlay />}
        {layer === 'structure' && <StructureOverlay />}
      </g>
    </svg>
  );
}

/* Sichtfelder und Schallkeulen – bewusst nur angedeutet. */
function SensorOverlay() {
  return (
    <g className="vm-pulse">
      <defs>
        <linearGradient id="fovFront" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#6ba8ff" stopOpacity=".38" /><stop offset="1" stopColor="#6ba8ff" stopOpacity="0" /></linearGradient>
        <linearGradient id="fovRear" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5ac8e8" stopOpacity=".3" /><stop offset="1" stopColor="#5ac8e8" stopOpacity="0" /></linearGradient>
      </defs>
      <path d="M200 46 L132 2 H268 Z" fill="url(#fovFront)" />
      <path d="M200 176 L150 96 H250 Z" fill="#5ac8e8" fillOpacity=".08" />
      <path d="M90 622 L16 690 V604 Z" fill="url(#fovRear)" />
      <path d="M310 622 L384 690 V604 Z" fill="url(#fovRear)" />
      <g stroke="#6ba8ff" strokeOpacity=".4" fill="none"><path d="M112 80 q-16 -12 -36 -6 M288 80 q16 -12 36 -6 M118 668 q-16 14 -36 8 M282 668 q16 14 36 8" /></g>
    </g>
  );
}

/* Hochvolt-Batterie im Unterboden, Zellraster und dezent fließender Strom. */
function BatteryOverlay() {
  const cols = [148, 180, 212, 244, 276];
  const rows = [292, 340, 388, 436];
  return (
    <g>
      <defs>
        <linearGradient id="packFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1f6fe0" stopOpacity=".28" /><stop offset="1" stopColor="#1f6fe0" stopOpacity=".10" /></linearGradient>
      </defs>
      <rect x="116" y="248" width="168" height="228" rx="16" fill="url(#packFill)" stroke="#6ba8ff" strokeOpacity=".7" strokeDasharray="5 5" />
      <g stroke="#6ba8ff" strokeOpacity=".22">{cols.map((x) => <path key={x} d={`M${x} 260V464`} />)}{rows.map((y) => <path key={y} d={`M128 ${y}H272`} />)}</g>
      {/* Hochvolt-Leitung (schematisch) zur Leistungselektronik/zum Antrieb vorn */}
      <path d="M200 248 V150" stroke="#ffb454" strokeOpacity=".75" strokeWidth="2.4" strokeLinecap="round" />
      <path className="vm-flow" d="M200 248 V150" stroke="#ffe3a8" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="4 18" fill="none" />
      <rect x="170" y="116" width="60" height="34" rx="8" fill="#0b1016" stroke="#6ba8ff" strokeOpacity=".5" />
      <path d="M200 124 l-7 11 h8 l-5 9" stroke="#ffe3a8" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" className="vm-glow" />
      <g className="vm-glow"><path d="M200 330 l-14 24 h16 l-10 22 l30 -32 h-18 l10 -14z" fill="#6ba8ff" fillOpacity=".55" /></g>
      <g fill="#5ac8e8" fillOpacity=".7" fontFamily="monospace" fontSize="10" letterSpacing="1.5"><text x="200" y="500" textAnchor="middle">BATTERIE · UNTERBODEN</text></g>
    </g>
  );
}

/* Typische Heckstruktur: Längsträger, Ladeboden, Querträger – ohne Schadensdarstellung. */
function StructureOverlay() {
  return (
    <g className="vm-pulse">
      <rect x="118" y="486" width="164" height="168" rx="14" fill="#5ac8e8" fillOpacity=".07" stroke="#5ac8e8" strokeOpacity=".4" strokeDasharray="4 6" />
      <path d="M152 486 V650 M248 486 V650" stroke="#6ba8ff" strokeOpacity=".85" strokeWidth="7" strokeLinecap="round" />
      <path d="M126 664 H274" stroke="#6ba8ff" strokeOpacity=".85" strokeWidth="9" strokeLinecap="round" />
      <path d="M118 680 H282" stroke="#5ac8e8" strokeOpacity=".5" strokeWidth="2" strokeLinecap="round" />
      <g fill="#5ac8e8" fillOpacity=".7" fontFamily="monospace" fontSize="10" letterSpacing="1.5"><text x="200" y="520" textAnchor="middle">LADEBODEN</text></g>
    </g>
  );
}
