'use client';

import qrcode from 'qrcode-generator';
import { useMemo } from 'react';

/**
 * QR-Code als SVG, vollständig im Browser erzeugt (nichts wird an einen Dienst gesendet – der Inhalt enthält das geheime Schlüsselmaterial).
 * Dunkle Module auf weißem Grund mit Ruhezone, damit Kamera-Apps ihn auch im Dunkelmodus sicher lesen.
 */
export function QrCode({ value, label = 'QR-Code', size = 200 }: { value: string; label?: string; size?: number }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, 'M'); // Typ automatisch, mittlere Fehlerkorrektur
    qr.addData(value, 'Byte');
    qr.make();
    const n = qr.getModuleCount();
    const quiet = 4;
    let path = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    const dim = n + quiet * 2;
    return { dim, path };
  }, [value]);
  return (
    <svg role="img" aria-label={label} width={size} height={size} viewBox={`0 0 ${svg.dim} ${svg.dim}`} shapeRendering="crispEdges" style={{ background: '#fff', borderRadius: 8, display: 'block' }} data-qr-modules={svg.dim - 8}>
      <rect width={svg.dim} height={svg.dim} fill="#fff" />
      <path d={svg.path} fill="#000" />
    </svg>
  );
}
