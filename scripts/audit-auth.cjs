/**
 * Statische Berechtigungsprüfung: Jede Schnittstelle, jede Server-Action und jede Admin-Seite muss die Anmeldung/Rechte prüfen –
 * Ausnahmen stehen ausdrücklich in der Liste unten (mit Begründung). Ein neuer Endpunkt ohne Prüfung lässt diesen Lauf (und den Test) scheitern.
 *   node scripts/audit-auth.cjs      (Exit-Code 1 bei Befund)
 */
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'src');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const rel = (f) => path.relative(path.join(__dirname, '..'), f);
const AUTH = /\b(authorize|requireUser|requirePagePermission|getAuthUser)\s*\(/;
// Hilfsfunktionen, die ihrerseits authorize()/getAuthUser() aufrufen (z. B. `const auth = () => authorize(…)`), zählen, wenn sie in derselben Datei so definiert sind
const helperNames = (src) => [...src.matchAll(/(?:const (\w+) = (?:async )?\(\) =>|async function (\w+)\(\))[\s\S]{0,160}?(?:authorize|getAuthUser)\(/g)].map((m) => m[1] || m[2]);
const hasAuth = (part, src) => AUTH.test(part) || helperNames(src).some((h) => new RegExp(`\\b${h}\\(\\)`).test(part));

// bewusst öffentlich oder selbst absichernd
const PUBLIC_ROUTES = {
  'src/app/api/anfrage/route.ts': 'öffentliches Formular: Origin-Prüfung, Honeypot, Mindestzeit, Rate-Limit, Dateityp aus Inhalt, Größenlimits',
  'src/app/api/health/route.ts': 'Betriebsprüfung ohne Daten; Details nur mit HEALTH_TOKEN',
};
const PUBLIC_ACTIONS = {
  'src/app/admin/(auth)/login/actions.ts': 'Anmeldung selbst (Drosselung, Sperre, Zwei-Faktor-Aufgabe)',
};
const PUBLIC_PAGES = {
  'src/app/admin/(auth)/login/page.tsx': 'Anmeldeseite',
};

const problems = [];
const info = { routes: 0, actions: 0, pages: 0 };

// 1) Route Handler
for (const f of walk(path.join(root, 'app', 'api')).filter((x) => /route\.tsx?$/.test(x))) {
  info.routes++;
  const src = fs.readFileSync(f, 'utf8');
  if (PUBLIC_ROUTES[rel(f)]) continue;
  if (!AUTH.test(src)) problems.push(`Schnittstelle ohne Rechteprüfung: ${rel(f)}`);
}

// 2) Server Actions: jede exportierte async-Funktion prüft Rechte (selbst oder über einen Dienst, der erkennbar prüft)
for (const f of walk(path.join(root, 'app')).filter((x) => /\.(ts|tsx)$/.test(x))) {
  const src = fs.readFileSync(f, 'utf8');
  if (!/^['"]use server['"]/m.test(src.slice(0, 200))) continue;
  if (PUBLIC_ACTIONS[rel(f)]) continue;
  const parts = src.split(/\n(?=export async function )/).slice(1);
  for (const part of parts) {
    info.actions++;
    const name = part.match(/export async function (\w+)/)[1];
    if (!hasAuth(part, src)) problems.push(`Server-Action ohne Rechteprüfung: ${rel(f)} → ${name}`);
  }
}

// 3) Admin-Seiten: Layout erzwingt Anmeldung, jede Seite braucht zusätzlich eine eigene Prüfung (Recht oder zumindest Anmeldung)
const layout = fs.readFileSync(path.join(root, 'app', 'admin', '(panel)', 'layout.tsx'), 'utf8');
if (!/requireUser\s*\(/.test(layout)) problems.push('Admin-Layout (panel) erzwingt keine Anmeldung');
const SELF_ONLY = new Set(['src/app/admin/(panel)/profil/page.tsx', 'src/app/admin/(panel)/page.tsx', 'src/app/admin/(panel)/loading.tsx']);
for (const f of walk(path.join(root, 'app', 'admin', '(panel)')).filter((x) => /page\.tsx$/.test(x))) {
  info.pages++;
  const src = fs.readFileSync(f, 'utf8');
  if (!AUTH.test(src) && !SELF_ONLY.has(rel(f))) problems.push(`Admin-Seite ohne eigene Prüfung: ${rel(f)}`);
}
for (const f of walk(path.join(root, 'app', 'studio')).filter((x) => /page\.tsx$/.test(x))) {
  info.pages++;
  if (!AUTH.test(fs.readFileSync(f, 'utf8'))) problems.push(`Studio-Seite ohne Anmeldeprüfung: ${rel(f)}`);
}

// 4) Middleware deckt /admin und /studio ab
const mw = fs.readFileSync(path.join(root, 'middleware.ts'), 'utf8');
if (!/\/admin\/:path\*/.test(mw) || !/\/studio/.test(mw)) problems.push('Middleware deckt /admin und /studio nicht beide ab');

if (require.main === module) {
  console.log(`Geprüft: ${info.routes} Schnittstellen, ${info.actions} Server-Actions, ${info.pages} Seiten.`);
  if (problems.length) { for (const p of problems) console.log('✖ ' + p); process.exit(1); }
  console.log('✔ Alles geprüft, keine ungeschützten Endpunkte.');
}
module.exports = { problems, info };
