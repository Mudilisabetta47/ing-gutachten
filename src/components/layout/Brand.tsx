import Link from 'next/link';

/** Wortmarke — Kaffeetasse-Signet (aus dem Rose-Café-Logo) + Schriftzug. */
export function Brand({ compact = false, night = false }: { compact?: boolean; night?: boolean } = {}) {
  const size = compact ? 24 : 30;
  return (
    <Link
      href="/"
      className="flex flex-none cursor-none items-center gap-[.6rem] font-display text-[1.05rem] font-medium tracking-[.01em]"
      aria-label="Rose Café – zur Startseite"
      data-cursor="cta"
      data-cursor-label="HOME"
    >
      <CupMark size={size} tone={night ? '#e3b567' : '#7d2f3a'} />
      <span className={night ? 'text-bone' : 'text-ink'}>
        Rose Café
        <small className="mt-[1px] block font-mono text-[.52rem] font-normal uppercase tracking-[.26em] text-fg-mute">
          Bremen
        </small>
      </span>
    </Link>
  );
}

/** Kaffeetasse mit Dampf — das Signet aus dem Rose-Café-Logo, freigestellt. */
export function CupMark({ size = 28, tone = '#7d2f3a' }: { size?: number; tone?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M20 5c-1.3 1.6-1.1 3 .3 4.6 1.7 1.9 3.9 2 5.6.3 1.1-1.1 2.7-1.2 3.7 0"
        stroke={tone}
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
        opacity=".9"
      />
      <path
        d="M11 19h22.5c1.9 0 2.9 2.2 1.6 3.6l-1.1 1.2c-.6.6-.9 1.4-.9 2.3v.4c0 4.6-4.2 8.3-9.4 8.3h-3.3c-5.2 0-9.4-3.7-9.4-8.3V19Z"
        fill={tone}
      />
      <path
        d="M33 22.2c1.7.1 3 1.1 3 2.5 0 1.5-1.6 2.7-3.6 2.7"
        stroke={tone}
        strokeWidth="2"
        fill="none"
      />
      <rect x="9" y="35.5" width="26" height="2.6" rx="1.3" fill={tone} />
    </svg>
  );
}

/** Vollständiges Hexagon-Wappen (Icon + Schriftzug) — für Loader, Footer, Favicon. */
export function RoseCafeBadge({ size = 120, tone = 'gold' }: { size?: number; tone?: 'gold' | 'ink' | 'bone' }) {
  const stroke = tone === 'gold' ? 'url(#rcGoldStroke)' : tone === 'ink' ? '#1a130f' : '#f8f2ea';
  const fill = tone === 'gold' ? 'url(#rcGoldFill)' : tone === 'ink' ? '#1a130f' : '#f8f2ea';
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" aria-hidden="true" focusable="false">
      {tone === 'gold' && (
        <defs>
          <linearGradient id="rcGoldFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#9c7a3d" />
            <stop offset="0.5" stopColor="#f3d98b" />
            <stop offset="1" stopColor="#9c7a3d" />
          </linearGradient>
          <linearGradient id="rcGoldStroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#c9a463" />
            <stop offset="1" stopColor="#f3d98b" />
          </linearGradient>
        </defs>
      )}
      {/* Hexagon-Rahmen, oben/unten offen (wie im Original) */}
      <path d="M18 76 100 16l82 60" stroke={stroke} strokeWidth="4" fill="none" strokeLinecap="square" />
      <path d="M18 124 100 184l82-60" stroke={stroke} strokeWidth="4" fill="none" strokeLinecap="square" />

      {/* Schriftzug */}
      <text x="10" y="107" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" fontSize="25" letterSpacing="1" fill={fill}>
        ROSE
      </text>
      <text x="128" y="107" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" fontSize="25" letterSpacing="1" fill={fill}>
        CAFÉ
      </text>

      {/* Tasse mit Dampf, zentriert */}
      <g transform="translate(82 62) scale(0.78)">
        <path
          d="M4 1c-1.3 1.6-1.1 3 .3 4.6 1.7 1.9 3.9 2 5.6.3 1.1-1.1 2.7-1.2 3.7 0"
          stroke={fill}
          strokeWidth="1.7"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M-5 15h22.5c1.9 0 2.9 2.2 1.6 3.6l-1.1 1.2c-.6.6-.9 1.4-.9 2.3v.4c0 4.6-4.2 8.3-9.4 8.3H3.9c-5.2 0-9.4-3.7-9.4-8.3V15Z"
          fill={fill}
        />
        <path d="M17 18.2c1.7.1 3 1.1 3 2.5 0 1.5-1.6 2.7-3.6 2.7" stroke={fill} strokeWidth="2" fill="none" />
        <rect x="-7" y="31.5" width="26" height="2.6" rx="1.3" fill={fill} />
      </g>
    </svg>
  );
}
