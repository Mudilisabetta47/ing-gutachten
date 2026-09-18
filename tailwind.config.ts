import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ---- ROSE CAFÉ Design-Token-System ------------------------------
           Ändert man die Markenfarbe (rose / rose-deep), verändert sich die
           gesamte visuelle Sprache der Website. */
        bone: '#f8f2ea',
        cream: '#efe3d3',
        ink: { DEFAULT: '#241a16', dim: '#5a4a41', mute: '#8d7a6d' },
        night: { DEFAULT: '#140f0d', 800: '#1a1310', 700: '#221a16', 600: '#2c221c' },
        rose: { DEFAULT: '#b8636f', deep: '#7d2f3a', pale: '#e9c9c9', line: 'rgba(184,99,111,.45)', soft: 'rgba(184,99,111,.14)' },
        gold: '#c9a463',
        line: { DEFAULT: 'rgba(36,26,22,.12)', night: 'rgba(255,246,236,.12)' },
        fg: { DEFAULT: '#241a16', dim: '#5a4a41', mute: '#8d7a6d', night: '#f8f2ea', 'night-dim': '#cdbfae' },
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'Georgia', 'serif'],
        body: ['var(--font-manrope)', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'Menlo', 'monospace'],
      },
      fontSize: {
        eyebrow: ['clamp(.64rem,.6rem + .18vw,.74rem)', { letterSpacing: '.24em' }],
        lead: ['clamp(1.1rem,1rem + .6vw,1.4rem)', { lineHeight: '1.55' }],
        h3: ['clamp(1.3rem,1.1rem + .9vw,1.9rem)', { lineHeight: '1.16', letterSpacing: '-.01em' }],
        h2: ['clamp(2.1rem,1.3rem + 3.6vw,4.6rem)', { lineHeight: '.98', letterSpacing: '-.02em' }],
        h1: ['clamp(3rem,1.3rem + 7.6vw,9rem)', { lineHeight: '.92', letterSpacing: '-.015em' }],
      },
      maxWidth: { shell: '1440px' },
      transitionTimingFunction: {
        cinematic: 'cubic-bezier(.16,1,.3,1)',
        impact: 'cubic-bezier(.65,0,.35,1)',
        swift: 'cubic-bezier(.22,1,.36,1)',
        expo: 'cubic-bezier(.87,0,.13,1)',
      },
      keyframes: {
        grain: { '0%,100%': { transform: 'translate(0,0)' }, '50%': { transform: 'translate(-2%,1%)' } },
        drift: { '0%,100%': { transform: 'translate3d(0,0,0)' }, '50%': { transform: 'translate3d(0,-10px,0)' } },
        steam: {
          '0%': { transform: 'translateY(0) scaleX(1)', opacity: '0' },
          '18%': { opacity: '.5' },
          '100%': { transform: 'translateY(-46px) scaleX(1.6)', opacity: '0' },
        },
        scrollHint: {
          '0%,100%': { transform: 'scaleY(.35)', transformOrigin: 'top' },
          '50%': { transform: 'scaleY(1)', transformOrigin: 'top' },
        },
        petal: {
          '0%': { transform: 'translate3d(0,-8vh,0) rotate(0deg)', opacity: '0' },
          '10%': { opacity: '.5' },
          '100%': { transform: 'translate3d(-6vw,110vh,0) rotate(220deg)', opacity: '0' },
        },
      },
      animation: {
        grain: 'grain 1.3s steps(2) infinite',
        drift: 'drift 7s ease-in-out infinite',
        steam: 'steam 4.5s ease-in infinite',
        'scroll-hint': 'scrollHint 2.2s cubic-bezier(.65,0,.35,1) infinite',
        petal: 'petal 14s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
