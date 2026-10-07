/**
 * Bühnen-Rückzug: am Ende einer dunklen Filmbühne skaliert die Stage leicht
 * herunter und rundet ihre Ecken – dahinter wird der helle Seitenkörper frei.
 * `t` läuft 0 → 1 (Fortschritt innerhalb des Rückzugsfensters).
 * Nur transform + border-radius, direkt auf den DOM-Knoten geschrieben.
 */
export const RETREAT_START = 0.94;

export function retreatT(progress: number, start = RETREAT_START): number {
  return Math.min(1, Math.max(0, (progress - start) / (1 - start)));
}

export function applyRetreat(el: HTMLElement | null, t: number, opts: { scale?: number; radius?: number } = {}): void {
  if (!el) return;
  const { scale = 0.075, radius = 34 } = opts;
  if (t <= 0) {
    if (el.style.transform) {
      el.style.transform = '';
      el.style.borderRadius = '';
    }
    return;
  }
  const e = 1 - Math.pow(1 - t, 3);
  el.style.transform = `scale(${(1 - e * scale).toFixed(4)})`;
  el.style.borderRadius = `${(e * radius).toFixed(1)}px`;
}
