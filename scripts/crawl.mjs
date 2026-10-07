/**
 * Interner Crawl + SEO-Prüfung.
 *   npm run build && npx next start -p 3200   (in einem Terminal)
 *   node scripts/crawl.mjs http://localhost:3200
 *
 * Prüft jede erreichbare interne Seite auf: Status, genau eine H1, Title,
 * Description, Canonical (Produktivdomain!), Open Graph, JSON-LD (gültig),
 * noindex-Konsistenz, doppelte Titles/Descriptions, tote interne Links,
 * Sitemap-Abdeckung, robots.txt, Weiterleitungsschleifen.
 */
const BASE = (process.argv[2] ?? 'http://localhost:3200').replace(/\/$/, '');
const PROD = process.env.EXPECT_SITE_URL ?? 'https://ing-gutachten.de';
const NOINDEX_OK = new Set(['/impressum/', '/datenschutz/', '/404/']);

const problems = [];
const warn = [];
const pages = new Map(); // path -> info
const queue = ['/'];
const seen = new Set(['/']);

const bad = (path, msg) => problems.push(`${path}  ✖ ${msg}`);

async function get(path, redirect = 'manual') {
  let hops = 0;
  let url = BASE + path;
  for (;;) {
    const res = await fetch(url, { redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      if (++hops > 5) return { status: 'LOOP', body: '' };
      const loc = res.headers.get('location') ?? '';
      url = new URL(loc, url).toString();
      if (redirect === 'manual') return { status: res.status, location: loc, body: '' };
      continue;
    }
    return { status: res.status, body: await res.text(), headers: res.headers };
  }
}

const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const attr = (tag, name) => (tag.match(new RegExp(`${name}=("([^"]*)"|'([^']*)')`, 'i')) ?? [])[2] ?? (tag.match(new RegExp(`${name}=("([^"]*)"|'([^']*)')`, 'i')) ?? [])[3];

function analyse(path, html) {
  const h1s = [...html.matchAll(/<h1[\s>][\s\S]*?<\/h1>/gi)];
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) ?? [])[1];
  const metas = [...html.matchAll(/<meta\s[^>]*>/gi)].map((m) => m[0]);
  const meta = (key, by = 'name') => {
    const t = metas.find((m) => attr(m, by) === key);
    return t ? attr(t, 'content') : undefined;
  };
  const canonical = (html.match(/<link[^>]+rel="canonical"[^>]*>/i) ?? [])[0];
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const links = [...html.matchAll(/<a\s[^>]*href="([^"]+)"/gi)].map((m) => m[1]);
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/gi)].map((m) => m[1]));
  return {
    h1: h1s.length,
    h1text: h1s[0] ? strip(h1s[0][0]) : '',
    title: title ? title.replace(/&amp;/g, '&') : undefined,
    description: meta('description'),
    robots: meta('robots'),
    canonical: canonical ? attr(canonical, 'href') : undefined,
    og: { title: meta('og:title', 'property'), description: meta('og:description', 'property'), url: meta('og:url', 'property'), image: meta('og:image', 'property') },
    ld,
    links,
    ids,
    words: strip(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '')).split(' ').length,
  };
}

while (queue.length) {
  const path = queue.shift();
  const res = await get(path);
  if (res.status !== 200) {
    bad(path, `Status ${res.status}${res.location ? ` → ${res.location}` : ''}`);
    pages.set(path, { status: res.status });
    continue;
  }
  const a = analyse(path, res.body);
  pages.set(path, { status: 200, ...a });

  if (a.h1 !== 1) bad(path, `${a.h1} H1-Überschriften (erwartet: genau 1)`);
  if (!a.title) bad(path, 'Title fehlt');
  else if (a.title.length > 70) warn.push(`${path}  Title ${a.title.length} Zeichen (>70): ${a.title}`);
  if (!a.description) bad(path, 'Meta-Description fehlt');
  else if (a.description.length > 165) warn.push(`${path}  Description ${a.description.length} Zeichen (>165)`);
  if (!a.canonical) bad(path, 'Canonical fehlt');
  else if (a.canonical !== PROD + (path === '/' ? '/' : path)) bad(path, `Canonical ${a.canonical} ≠ ${PROD}${path}`);
  if (!a.og.title || !a.og.description || !a.og.url || !a.og.image) bad(path, 'Open-Graph unvollständig');
  else if (!a.og.url.startsWith(PROD)) bad(path, `og:url zeigt nicht auf ${PROD}`);
  if (a.og.image && !a.og.image.startsWith(PROD)) bad(path, `og:image nicht absolut auf ${PROD}`);
  if (/vercel\.app|localhost/.test(res.body.replace(/localhost:\d+\/_next/g, ''))) {
    if (/https?:\/\/[^"' ]*(vercel\.app)/.test(res.body)) bad(path, 'vercel.app-URL im HTML');
  }
  if (a.ld.length === 0) bad(path, 'Kein JSON-LD');
  for (const raw of a.ld) {
    try {
      const j = JSON.parse(raw);
      const text = JSON.stringify(j);
      if (/AggregateRating|"Review"/.test(text)) bad(path, 'AggregateRating/Review im Schema – nicht belegt');
      if (/priceRange/.test(text)) bad(path, 'priceRange im Schema');
      if (/"url":"http/.test(text) && !/"url":"https:\/\/ing-gutachten\.de/.test(text)) bad(path, 'Schema-URL nicht auf Produktivdomain');
    } catch {
      bad(path, 'JSON-LD nicht parsebar');
    }
  }
  const noindex = /noindex/.test(a.robots ?? '');
  if (noindex && !NOINDEX_OK.has(path)) bad(path, 'unerwartet noindex');
  if (!noindex && NOINDEX_OK.has(path) && path !== '/404/') bad(path, 'sollte noindex sein');

  for (const href of a.links) {
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    const [clean] = href.split('#')[0].split('?');
    if (!clean) continue;
    const norm = clean.endsWith('/') || clean.includes('.') ? clean : clean + '/';
    if (clean !== norm && !clean.includes('.')) warn.push(`${path}  Link ohne Slash: ${href}`);
    if (clean.startsWith('/_next') || clean.startsWith('/assets/')) continue;
    if (!seen.has(norm)) {
      seen.add(norm);
      queue.push(norm);
    }
  }
}

/* Anker-Ziele (#id) auf der Zielseite vorhanden? */
for (const [p, i] of pages) {
  if (i.status !== 200) continue;
  for (const href of i.links) {
    const m = href.match(/^([^#?]*)#(.+)$/);
    if (!m) continue;
    const target = m[1] === '' ? p : (m[1].endsWith('/') ? m[1] : m[1] + '/');
    const t = pages.get(target);
    if (t && t.status === 200 && !t.ids.has(m[2])) bad(p, `Anker ${href} → #${m[2]} fehlt auf ${target}`);
  }
}

/* Doppelte Titles/Descriptions */
for (const key of ['title', 'description']) {
  const map = new Map();
  for (const [p, i] of pages) if (i[key]) (map.get(i[key]) ?? map.set(i[key], []).get(i[key])).push(p);
  for (const [v, ps] of map) if (ps.length > 1) bad(ps.join(', '), `doppelte ${key}: ${v.slice(0, 70)}`);
}

/* Sitemap + robots */
const sm = await get('/sitemap.xml');
const smUrls = sm.status === 200 ? [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]) : [];
if (!smUrls.length) bad('/sitemap.xml', 'leer oder nicht erreichbar');
for (const u of smUrls) {
  if (!u.startsWith(PROD)) bad('/sitemap.xml', `URL nicht auf Produktivdomain: ${u}`);
  const p = u.replace(PROD, '');
  if (pages.has(p) && pages.get(p).status !== 200) bad('/sitemap.xml', `${p} nicht erreichbar`);
  if (!pages.has(p)) bad('/sitemap.xml', `${p} wurde nicht gecrawlt (verwaist?)`);
  if (NOINDEX_OK.has(p)) bad('/sitemap.xml', `${p} ist noindex, steht aber in der Sitemap`);
}
for (const [p, i] of pages) {
  if (i.status === 200 && !NOINDEX_OK.has(p) && !smUrls.includes(PROD + p)) bad(p, 'indexierbar, aber nicht in sitemap.xml');
}
const robots = await get('/robots.txt');
if (robots.status !== 200 || !robots.body.includes(`Sitemap: ${PROD}/sitemap.xml`)) bad('/robots.txt', 'Sitemap-Zeile fehlt oder falsch');
if (/Disallow:\s*\/\s*$/m.test(robots.body)) bad('/robots.txt', 'sperrt die gesamte Seite');

/* 404 */
const nf = await get('/gibt-es-nicht/');
if (nf.status !== 404) bad('/gibt-es-nicht/', `liefert ${nf.status} statt 404`);

/* Bericht */
const ok = [...pages.values()].filter((p) => p.status === 200).length;
console.log(`\nGecrawlt: ${pages.size} Seiten (${ok} mit 200), Sitemap-URLs: ${smUrls.length}`);
console.log('Seiten:');
for (const [p, i] of [...pages].sort()) {
  console.log(`  ${String(i.status).padEnd(4)} ${p.padEnd(34)} H1=${i.h1 ?? '-'} · ${i.words ?? '-'} Wörter · ${i.title ?? ''}`);
}
if (warn.length) console.log(`\nHinweise (${warn.length}):\n  ` + warn.join('\n  '));
if (problems.length) {
  console.log(`\nFEHLER (${problems.length}):\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log('\n✔ Keine Fehler.');
