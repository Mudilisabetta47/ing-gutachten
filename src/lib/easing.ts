/**
 * Zentrale Easing-Bibliothek der Motion Engine.
 * Jede Kurve hat eine Bedeutung — nicht überall dieselbe Ease verwenden.
 *
 * cinematic   lange, weiche Kamera- und Bühnenbewegungen
 * impact      kurzer, harter Einsatz (Lichtblitz, Betonung)
 * swift       schnelle UI-Reaktionen (Cursor, Hover)
 * expo        Ein-/Ausblenden großer Flächen
 * smooth      Standard-Reveal von Text und Karten
 * shakeDecay  gedämpftes Ausschwingen (Kamera-Drift, Federn)
 */

export const cubic = {
  cinematic: [0.16, 1, 0.3, 1] as const,
  impact: [0.65, 0, 0.35, 1] as const,
  swift: [0.22, 1, 0.36, 1] as const,
  expo: [0.87, 0, 0.13, 1] as const,
  smooth: [0.25, 0.1, 0.25, 1] as const,
};

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Normiert v aus [a,b] nach [0,1], geklemmt. */
export const norm = (v: number, a: number, b: number) => clamp((v - a) / (b - a));

export function easeOutExpo(t: number) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeSmooth(t: number) {
  return t * t * (3 - 2 * t);
}

/** Gedämpfte Schwingung, z. B. für sehr subtilen Kamera-Drift. */
export function shakeDecay(t: number, freq = 3, decay = 4.5) {
  return Math.sin(t * Math.PI * freq) * Math.exp(-decay * t);
}
