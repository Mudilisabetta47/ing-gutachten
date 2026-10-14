import type { StudioSettings } from '@/lib/studio';

/** ING-Hintergründe: reine CSS-/SVG-Verläufe (kein Bild-Download, keine Fremdgrafik), Premium-Automotive in ING-Blau. */
export function Wallpaper({ kind }: { kind: StudioSettings['wallpaper'] }) {
  return (
    <div className="st-wall" data-wall={kind} aria-hidden="true">
      <svg className="st-wall-art" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="stStreak" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#4f8cff" stopOpacity="0" />
            <stop offset=".55" stopColor="#7fb0ff" stopOpacity=".7" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="stCar" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#9db8e8" stopOpacity=".34" />
            <stop offset="1" stopColor="#3b6fe8" stopOpacity=".04" />
          </linearGradient>
        </defs>
        <g className="st-wall-streaks" fill="none" stroke="url(#stStreak)" strokeLinecap="round">
          <path d="M-100 640 C 380 560, 900 600, 1700 470" strokeWidth="2" />
          <path d="M-100 700 C 420 630, 980 690, 1700 560" strokeWidth="1.2" />
          <path d="M-100 580 C 300 520, 800 520, 1700 400" strokeWidth="1" />
          <path d="M-100 760 C 500 700, 1100 780, 1700 650" strokeWidth="2.4" />
        </g>
        <g className="st-wall-car" transform="translate(-170 4)">
          <ellipse cx="1280" cy="826" rx="470" ry="14" fill="#000" opacity=".28" />
          <path fill="url(#stCar)" d="M880 770v-34c0-24 10-38 30-46l40-14c52-6 92-10 126-30 46-44 112-90 190-104 76-12 176-10 226 14 30 14 54 42 88 66 46 8 84 22 90 62l2 46c0 14-8 36-30 40z" />
          <path fill="none" stroke="#bcd3ff" strokeOpacity=".28" strokeWidth="2" d="M1088 662c42-42 100-82 168-94 70-10 160-8 206 12 24 12 44 36 72 58" />
          <path fill="none" stroke="#bcd3ff" strokeOpacity=".2" strokeWidth="1.6" d="M1268 568l-8 150M1090 700h380" />
          <circle cx="1040" cy="776" r="54" fill="#050b18" />
          <circle cx="1500" cy="776" r="54" fill="#050b18" />
          <circle cx="1040" cy="776" r="34" fill="none" stroke="#9fc0ff" strokeOpacity=".4" strokeWidth="3" />
          <circle cx="1500" cy="776" r="34" fill="none" stroke="#9fc0ff" strokeOpacity=".4" strokeWidth="3" />
          <circle cx="1040" cy="776" r="9" fill="#9fc0ff" fillOpacity=".4" />
          <circle cx="1500" cy="776" r="9" fill="#9fc0ff" fillOpacity=".4" />
          <path d="M1624 716l34 6" stroke="#cfe0ff" strokeWidth="5" strokeLinecap="round" opacity=".8" />
          <path d="M884 712l-4 14" stroke="#ff5d6a" strokeWidth="5" strokeLinecap="round" opacity=".7" />
        </g>
      </svg>
      <div className="st-wall-grain" />
    </div>
  );
}
