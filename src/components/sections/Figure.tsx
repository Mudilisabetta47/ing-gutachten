/** Einzelbild mit technischer Rahmung und Bildunterschrift. */
export function Figure({
  src,
  alt,
  caption,
  ratio = '4 / 3',
}: {
  src: string;
  alt: string;
  caption?: string;
  ratio?: string;
}) {
  return (
    <figure className="relative">
      <div className="relative overflow-hidden rounded-[22px] border border-line" style={{ aspectRatio: ratio }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        <span
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{ background: 'linear-gradient(180deg, rgba(8,9,11,.05) 40%, rgba(8,9,11,.55) 100%)' }}
        />
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">
          <g stroke="#ffb43c" strokeOpacity=".45" strokeWidth="1.2" fill="none">
            <path d="M18 34 v-16 h16 M382 34 v-16 h-16 M18 266 v16 h16 M382 266 v16 h-16" />
          </g>
        </svg>
      </div>
      {caption && (
        <figcaption className="mt-3 font-mono text-[.62rem] uppercase tracking-[.18em] text-fg-mute">{caption}</figcaption>
      )}
    </figure>
  );
}
