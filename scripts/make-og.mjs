/**
 * Erzeugt das Open-Graph-Bild (1200×630) im ING-Branding:
 * dunkles Navy, ING-Blau, Fahrzeug als technische Messgrafik.
 * Aufruf: node scripts/make-og.mjs
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const BODY = 'M 18 0 C 8 -8 6 -22 14 -34 L 60 -52 C 84 -92 128 -114 186 -118 L 330 -120 C 386 -118 424 -100 452 -70 L 508 -56 C 522 -50 528 -38 526 -24 L 524 -6 C 523 -2 519 0 514 0 Z';
const CABIN = 'M 96 -56 C 116 -88 152 -104 196 -107 L 322 -108 C 366 -106 396 -92 418 -66 Z';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#06143a"/><stop offset="1" stop-color="#03081a"/></linearGradient>
    <radialGradient id="glow" cx="0.78" cy="0.55" r="0.55"><stop offset="0" stop-color="#1f6fe0" stop-opacity=".42"/><stop offset="1" stop-color="#1f6fe0" stop-opacity="0"/></radialGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#6ba8ff" stroke-opacity=".13"/></pattern>
    <pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V9" stroke="#6ba8ff" stroke-opacity=".8" stroke-width="1.6"/></pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <!-- Fahrzeug als technische Zeichnung -->
  <g transform="translate(470 470) scale(1.34)" fill="none" stroke="#9cc6ff" stroke-width="1.6" stroke-linejoin="round">
    <path d="${BODY}"/>
    <path d="${CABIN}" stroke-opacity=".75"/>
    <circle cx="120" cy="-38" r="38"/><circle cx="404" cy="-38" r="38"/>
    <circle cx="120" cy="-38" r="22" stroke-dasharray="3 5" stroke-opacity=".6"/><circle cx="404" cy="-38" r="22" stroke-dasharray="3 5" stroke-opacity=".6"/>
    <path d="M 120 -38 H 404" stroke-dasharray="2 7" stroke-opacity=".6"/>
    <path d="M 438 -74 L 508 -56 C 522 -50 528 -38 526 -24 L 524 -4 L 468 -4 Z" fill="url(#hatch)" stroke="#6ba8ff" stroke-dasharray="5 4"/>
  </g>
  <g stroke="#6ba8ff" stroke-opacity=".7" stroke-dasharray="3 6" fill="none"><path d="M1130 395 L1010 305"/></g>
  <g fill="#6ba8ff"><circle cx="1010" cy="305" r="5"/></g>
  <g font-family="Menlo, Courier New, monospace" font-size="15" letter-spacing="3" fill="#bcd9ff">
    <text x="840" y="290">MESSPUNKT 03</text>
  </g>
  <line x1="498" y1="520" x2="1128" y2="520" stroke="#bcd9ff" stroke-opacity=".5"/><text x="813" y="548" text-anchor="middle" font-family="Menlo, Courier New, monospace" font-size="14" letter-spacing="3" fill="#bcd9ff">FAHRZEUGLÄNGE · VERMESSEN</text>

  <!-- Marke -->
  <g font-family="Helvetica Neue, Arial, sans-serif" fill="#edf1f4">
    <rect x="72" y="72" width="64" height="4" fill="#1f6fe0"/>
    <text x="72" y="190" font-size="92" font-weight="800" letter-spacing="-3">ING</text>
    <text x="72" y="282" font-size="92" font-weight="800" letter-spacing="-3">GUTACHTEN</text>
    <text x="74" y="340" font-size="30" font-weight="400" fill="#bcd9ff">Kfz-Sachverständigenbüro Hannover</text>
  </g>
  <g font-family="Menlo, Courier New, monospace" font-size="18" letter-spacing="4" fill="#6ba8ff">
    <text x="74" y="560">UNFALLGUTACHTEN · SCHADENGUTACHTEN</text>
    <text x="74" y="592" fill="#8b98a4">ING-GUTACHTEN.DE</text>
  </g>
</svg>`;

const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
writeFileSync('public/assets/img/og-ing-gutachten.png', png);
console.log('og-ing-gutachten.png', png.length, 'bytes');
