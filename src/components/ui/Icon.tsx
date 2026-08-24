import type { ReactNode } from 'react';
import type { IconName } from '@/lib/content';

const PATHS: Record<IconName, ReactNode> = {
  car: (
    <>
      <path d="M6 30h36M11 30l3-9c.6-1.8 2.3-3 4.2-3h11.6c1.9 0 3.6 1.2 4.2 3l3 9M11 30v6M37 30v6M16 30h16" />
      <circle cx="16" cy="35" r="3" />
      <circle cx="32" cy="35" r="3" />
    </>
  ),
  truck: (
    <>
      <path d="M4 33V13h24v20M28 20h8l6 7v6M4 33h4M20 33h10M42 33h2" />
      <circle cx="12" cy="35" r="3" />
      <circle cx="34" cy="35" r="3" />
    </>
  ),
  bolt: <path d="M26 4 12 27h10l-2 17 16-24H26z" />,
  bike: (
    <>
      <circle cx="11" cy="31" r="8" />
      <circle cx="37" cy="31" r="8" />
      <path d="M11 31l8-13h9l4 6M19 18h-5M28 18l9 13M24 31h8" />
    </>
  ),
  classic: (
    <>
      <path d="M5 31h38M9 31l4-10h22l6 10M9 31v4M39 31v4M17 21v10M29 21v10" />
      <circle cx="15" cy="34" r="3.5" />
      <circle cx="33" cy="34" r="3.5" />
    </>
  ),
  dent: (
    <>
      <path d="M8 34c6-3 8-12 16-12s10 9 16 12" />
      <path d="M24 8v8M32 12l-4 6M16 12l4 6" />
    </>
  ),
  shield: (
    <>
      <path d="M24 5l15 6v11c0 10-6 17-15 21-9-4-15-11-15-21V11z" />
      <path d="M17 24l5 5 10-11" />
    </>
  ),
  clock: (
    <>
      <circle cx="24" cy="24" r="18" />
      <path d="M24 13v11l7 5" />
    </>
  ),
  pin: (
    <>
      <path d="M24 43s14-13 14-24A14 14 0 1 0 10 19c0 11 14 24 14 24z" />
      <circle cx="24" cy="19" r="5" />
    </>
  ),
  scale: <path d="M24 8v32M12 40h24M8 18h32M8 18l-5 11a6 6 0 0 0 10 0zM40 18l5 11a6 6 0 0 1-10 0z" />,
  doc: (
    <>
      <path d="M12 5h16l8 8v30H12z" />
      <path d="M28 5v9h8M18 24h12M18 31h12M18 17h6" />
    </>
  ),
  ruler: (
    <>
      <path d="M6 30 30 6l12 12-24 24z" />
      <path d="M14 22l4 4M20 16l4 4M26 10l4 4" />
    </>
  ),
};

export function Icon({ name, size = 34, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}

export function Arrow() {
  return (
    <span className="arw" aria-hidden="true">
      →
    </span>
  );
}
