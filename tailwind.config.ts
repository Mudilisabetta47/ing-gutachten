import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* Farb-Tokens laufen über CSS-Variablen (globals.css), damit helle
           Sektionen (.theme-light) dieselben Utilities ohne Umbau nutzen. */
        ink: {
          900: 'rgb(var(--c-ink-900) / <alpha-value>)',
          850: 'rgb(var(--c-ink-850) / <alpha-value>)',
          800: 'rgb(var(--c-ink-800) / <alpha-value>)',
          700: 'rgb(var(--c-ink-700) / <alpha-value>)',
          600: 'rgb(var(--c-ink-600) / <alpha-value>)',
        },
        line: { DEFAULT: 'rgb(var(--c-line) / <alpha-value>)', soft: 'var(--c-line-soft)' },
        fg: {
          DEFAULT: 'rgb(var(--c-fg) / <alpha-value>)',
          dim: 'rgb(var(--c-fg-dim) / <alpha-value>)',
          mute: 'rgb(var(--c-fg-mute) / <alpha-value>)',
        },
        signal: {
          DEFAULT: 'rgb(var(--c-signal) / <alpha-value>)',
          bright: 'rgb(var(--c-signal-bright) / <alpha-value>)',
          pale: '#bcd9ff',
          soft: 'var(--c-signal-soft)',
          line: 'var(--c-signal-line)',
        },
        measure: { DEFAULT: 'rgb(var(--c-measure) / <alpha-value>)', soft: 'rgba(127,166,192,.18)' },
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        ok: '#5fd6a4',
      },
      fontFamily: {
        display: ['var(--font-archivo)', 'Helvetica Neue', 'Arial', 'sans-serif'],
        body: ['var(--font-manrope)', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'Menlo', 'monospace'],
      },
      fontSize: {
        eyebrow: ['clamp(.66rem,.62rem + .18vw,.76rem)', { letterSpacing: '.22em' }],
        lead: ['clamp(1.1rem,1rem + .6vw,1.4rem)', { lineHeight: '1.5' }],
        h3: ['clamp(1.25rem,1.1rem + .8vw,1.75rem)', { lineHeight: '1.15', letterSpacing: '-.02em' }],
        h2: ['clamp(2rem,1.4rem + 3.1vw,4.25rem)', { lineHeight: '.96', letterSpacing: '-.035em' }],
        h1: ['clamp(2.6rem,1.5rem + 5.6vw,7.5rem)', { lineHeight: '.94', letterSpacing: '-.038em' }],
      },
      maxWidth: { shell: '1440px' },
      /* Bewusste Überschreibung: `ease-out` ist projektweit unsere
         Premium-Kurve, damit jede Bewegung dieselbe Handschrift hat. */
      transitionTimingFunction: {
        out: 'cubic-bezier(.16,1,.3,1)',
        inout: 'cubic-bezier(.65,0,.35,1)',
      },
      keyframes: {
        sweep: { '0%': { backgroundPosition: '130% 0' }, '55%,100%': { backgroundPosition: '-40% 0' } },
        ticker: { to: { transform: 'translateX(-50%)' } },
        pingSlow: {
          '0%': { transform: 'scale(1)', opacity: '.7' },
          '70%,100%': { transform: 'scale(2.05)', opacity: '0' },
        },
        scrollHint: {
          '0%,100%': { transform: 'scaleY(.35)', transformOrigin: 'top' },
          '50%': { transform: 'scaleY(1)', transformOrigin: 'top' },
        },
        fadeSwap: {
          from: { opacity: '0', transform: 'translateY(10px)', filter: 'blur(4px)' },
          to: { opacity: '1', transform: 'none', filter: 'blur(0)' },
        },
      },
      animation: {
        sweep: 'sweep 9s cubic-bezier(.65,0,.35,1) infinite',
        ticker: 'ticker 38s linear infinite',
        'ping-slow': 'pingSlow 2.6s cubic-bezier(.16,1,.3,1) infinite',
        'scroll-hint': 'scrollHint 2.2s cubic-bezier(.65,0,.35,1) infinite',
        'fade-swap': 'fadeSwap .5s cubic-bezier(.16,1,.3,1)',
      },
    },
  },
  plugins: [],
};

export default config;
