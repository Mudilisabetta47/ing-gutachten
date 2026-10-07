import { NextResponse, type NextRequest } from 'next/server';

/**
 * Schnelle Vorprüfung für /admin: ohne Sitzungs-Cookie geht es direkt zum Login.
 * Das ist nur Komfort (Edge-Laufzeit, kein Datenbankzugriff). Die ECHTE Prüfung
 * läuft in jeder Seite und jeder Action über requireUser()/authorize().
 */
const COOKIES = ['__Host-ing_session', 'ing_session'];

export function middleware(req: NextRequest) {
  // trailingSlash: true → Pfade kommen als "/admin/login/"; für den Vergleich normalisieren.
  const pathname = req.nextUrl.pathname.replace(/\/+$/, '') || '/';
  const hasCookie = COOKIES.some((c) => req.cookies.has(c));

  // Die Login-Seite prüft selbst, ob die Sitzung gültig ist (ein veraltetes Cookie darf keine Umleitungsschleife auslösen).
  if (pathname === '/admin/login') return NextResponse.next();
  if (!hasCookie) {
    const url = new URL('/admin/login', req.url);
    if (pathname !== '/admin') url.searchParams.set('weiter', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*'] };
