import { TICKER_ITEMS } from '@/lib/content';

/** Endlos-Laufband. Der Track ist doppelt gefüllt, damit die Schleife nahtlos ist. */
export function Ticker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="overflow-hidden border-y border-line bg-ink-850 py-[.9rem]" aria-hidden="true">
      <div className="flex w-max animate-ticker gap-14 hover:[animation-play-state:paused]">
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="flex items-center gap-14 whitespace-nowrap font-mono text-[.72rem] uppercase tracking-[.24em] text-fg-mute"
          >
            {item}
            <span className="h-1 w-1 rounded-full bg-signal-line" />
          </span>
        ))}
      </div>
    </div>
  );
}
