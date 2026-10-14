/**
 * ING Studio – Browser-Prüfung mit echten Maus- und Tastaturereignissen gegen den laufenden Server und die echte Datenbank.
 *   BASE=http://localhost:3101 node tests/e2e/studio.e2e.mjs
 * Voraussetzung: lokale Demo-Daten (npm run seed:demo -- fixtures). Szenario D der Aufgabenstellung: Login → Startmenü → Schadenakte →
 * Kalkulation → Bewertung → Minimieren → Wiederherstellen → Speichern.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { launch, newPage, sleep } from './cdp.mjs';

const BASE = process.env.BASE;
if (!BASE) throw new Error('BASE setzen, z. B. BASE=http://localhost:3101');
if (/:3100\b/.test(BASE) && !process.env.ALLOW_3100) throw new Error('Port 3100 gehört evtl. einem anderen Projekt – bitte den ING-Server angeben.');
const PW = readFileSync(new URL('../../scripts/seed-demo.ts', import.meta.url), 'utf8').match(/DEMO_PASSWORD = '([^']+)'/)[1];
const PSQL = process.env.PSQL || '/Applications/Postgres.app/Contents/Versions/latest/bin/psql';
const DB = process.env.E2E_DB || 'ing_os_dev';
const sql = (q) => execSync(`${PSQL} -h localhost -U ${process.env.USER} -d ${DB} -At -c "${q.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
const OUT = process.env.OUT || '/tmp/ing-shots';
const res = [];
const check = (name, ok, extra = '') => { res.push(Boolean(ok)); console.log(`${ok ? '✔' : '✖'} ${name}${extra ? ' — ' + extra : ''}`); };

sql('delete from login_attempts');
sql('delete from user_preferences');
const caseNr = sql('select case_number from cases order by created_at limit 1');

const { proc, port } = await launch(9512);
try {
  const pg = await newPage(port);
  await pg.viewport(1500, 900);
  const login = async (email) => {
    await pg.send('Network.clearBrowserCookies');
    await pg.goto(BASE + '/admin/login/', 1200);
    await pg.evalJs(`(()=>{const f=document.querySelector('form'); f.email.value=${JSON.stringify(email)}; f.password.value=${JSON.stringify(PW)}; f.requestSubmit();})()`);
    await pg.sleep(3500);
  };
  const waitFor = async (fn, ms = 12000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch { /* weiter */ } await sleep(200); } return false; };
  const wins = async () => { await sleep(330); return pg.evalJs(`[...document.querySelectorAll('.st-win')].map(w=>{const r=w.getBoundingClientRect(); return {id:w.dataset.win, app:w.dataset.app, title:w.querySelector('.st-title-text')?.textContent, focus:w.classList.contains('is-focus'), min:w.classList.contains('is-min'), max:w.classList.contains('is-max'), snap:w.classList.contains('is-snap'), z:Number(w.style.zIndex), x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height)}})`); };
  const frameText = (id) => pg.evalJs(`document.querySelector('[data-win="${id}"] iframe')?.contentDocument?.body?.innerText ?? ''`);
  const byApp = async (app) => (await wins()).find((w) => w.app === app);
  /** Ein Punkt des Elements, der wirklich sichtbar (nicht von anderen Fenstern verdeckt) ist – so klickt auch ein Mensch. */
  const visiblePoint = (sel, insetLeft = 60, insetRight = 200) => pg.evalJs(`(()=>{const el=document.querySelector(${JSON.stringify(sel)}); if(!el) return null; const r=el.getBoundingClientRect(); for(let x=r.left+${insetLeft}; x<r.right-${insetRight}; x+=12){ for(let y=r.top+3; y<r.bottom-2; y+=6){ const t=document.elementFromPoint(x,y); if(t && el.contains(t) && !t.closest('button')) return {x,y}; } } return null})()`);
  const titleOf = (id) => visiblePoint(`[data-win="${id}"] .st-title`);
  const taskBtn = (label) => pg.evalJs(`(()=>{const b=[...document.querySelectorAll('.st-task')].find(x=>x.getAttribute('aria-label').includes(${JSON.stringify(label)})); if(!b) return null; const r=b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  const APPLABEL = { kalkulation: 'Kalkulation', faelle: 'Fälle', bewertung: 'Bewertung', settings: 'Einstellungen' };
  /** Fenster nach vorn holen wie ein Mensch: Titelleiste anklicken – ist sie verdeckt, über die Taskleiste. */
  const raise = async (app) => {
    const w = await byApp(app); const p = await titleOf(w.id);
    if (p) await pg.click(p.x, p.y); else { const t = await taskBtn(APPLABEL[app]); await pg.click(t.x, t.y); }
    await sleep(200);
  };
  const freePoint = () => pg.evalJs(`(()=>{for(let x=1450;x>600;x-=40){ for(let y=30;y<780;y+=40){ const t=document.elementFromPoint(x,y); if(t && (t.classList.contains('st-root')||t.classList.contains('st-layer')||t.classList.contains('st-wall')||t.classList.contains('st-wall-art')||t.classList.contains('st-wall-grain')||t.closest('.st-wall'))) return {x,y}; } } return null})()`);
  const openViaStart = async (query, expectApp) => {
    await pg.key('KeyK', 'k', { ctrl: true });
    await waitFor(() => pg.rect('.st-start input'));
    await pg.type(query);
    await waitFor(() => pg.evalJs(`document.querySelectorAll('.st-start-row').length>0`));
    await pg.sleep(500);
    await pg.key('Enter', 'Enter');
    return waitFor(async () => (await wins()).some((w) => w.app === expectApp));
  };

  /* ---------- Anmeldung → Desktop ---------- */
  await login('inhaber@demo.ing.test');
  check('Login führt in den Desktop (/studio/)', (await pg.evalJs('location.pathname')) === '/studio/');
  check('Desktop: Verknüpfungen, Taskleiste, Startknopf, Uhr', await pg.evalJs(`document.querySelectorAll('.st-dicon').length>=15 && !!document.querySelector('.st-taskbar .st-start-btn') && /\\d\\d:\\d\\d/.test(document.querySelector('.st-clock')?.innerText||'')`));
  check('Willkommenstext bei leerem Desktop', await pg.evalJs(`/Willkommen/.test(document.querySelector('.st-hello')?.innerText||'')`));
  await pg.shot(`${OUT}/10-desktop-leer.png`);

  /* ---------- Startmenü + App-Suche ---------- */
  await pg.key('KeyK', 'k', { ctrl: true });
  check('Strg+K öffnet das Startmenü mit fokussiertem Suchfeld', await waitFor(() => pg.evalJs(`document.activeElement?.closest('.st-start-search')!==null && !!document.querySelector('.st-start')`)));
  check('Startmenü: angeheftete Apps und Gruppen', await pg.evalJs(`document.querySelectorAll('.st-start-app').length>=5 && /fachanwendungen/i.test(document.querySelector('.st-start').innerText)`));
  await pg.shot(`${OUT}/11-startmenue.png`);
  await pg.key('Escape', 'Escape');
  check('Esc schließt das Startmenü', await waitFor(() => pg.evalJs(`!document.querySelector('.st-start')`)));

  check('App „ING Kalkulation“ per Suche geöffnet', await openViaStart('Kalkul', 'kalkulation'));
  const calc = await byApp('kalkulation');
  check('Fenster ist fokussiert, nicht minimiert', calc?.focus && !calc.min);
  check('Eingebettete Seite lädt die echte Kalkulationsliste (ohne Seitenleiste)', await waitFor(async () => /Schadenkalkulation/.test(await frameText(calc.id))) && await pg.evalJs(`(()=>{const d=document.querySelector('[data-win="${calc.id}"] iframe').contentDocument; return d.documentElement.classList.contains('is-embedded') && getComputedStyle(d.querySelector('.adm-sidebar')).display==='none'})()`));

  /* ---------- Schadenakte (Fall) als zweites Fenster ---------- */
  check('Fall per Datensuche in eigenem Fenster geöffnet', await openViaStart(caseNr, 'faelle'));
  const caseWin = await byApp('faelle');
  check('Fenstertitel folgt der Seite (Fallnummer)', await waitFor(async () => (await byApp('faelle'))?.title?.includes(caseNr)));
  check('Schadenakte zeigt Kundendaten und Reiter', await waitFor(async () => { const t = await frameText(caseWin.id); return t.includes(caseNr) && /Kalkulation/.test(t) && /Fixture/.test(t); }));

  /* ---------- Bewertung als drittes Fenster (Desktop-Symbol, Doppelklick) ---------- */
  const icon = await pg.evalJs(`(()=>{const b=[...document.querySelectorAll('.st-dicon')].find(x=>/Bewertung/.test(x.innerText)); const r=b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await pg.dblclick(icon.x, icon.y);
  check('Doppelklick auf Desktop-Symbol öffnet „ING Bewertung“', await waitFor(async () => (await wins()).some((w) => w.app === 'bewertung')));
  let ws = await wins();
  check('Drei Fenster gleichzeitig, jeweils eigene Ebene', ws.length === 3 && new Set(ws.map((w) => w.z)).size === 3, JSON.stringify(ws.map((w) => [w.app, w.z])));
  check('Taskleiste zeigt alle laufenden Apps', await pg.evalJs(`document.querySelectorAll('.st-task.is-run').length===3`));
  await pg.shot(`${OUT}/12-drei-fenster.png`);

  /* ---------- Fokus per Klick ---------- */
  await raise('kalkulation');
  ws = await wins();
  check('Klick auf die Titelleiste bringt das Fenster nach vorn', ws.find((w) => w.app === 'kalkulation')?.focus && ws.find((w) => w.app === 'kalkulation').z === Math.max(...ws.map((w) => w.z)));

  /* ---------- Verschieben & Andocken ---------- */
  const before = await byApp('kalkulation');
  const p0 = await titleOf(before.id);
  await pg.drag(p0, { x: p0.x + 140, y: p0.y + 100 });
  const moved = await byApp('kalkulation');
  check('Fenster lässt sich an der Titelleiste verschieben', moved.x - before.x > 100 && moved.y - before.y > 60, `${before.x},${before.y} → ${moved.x},${moved.y}`);
  await pg.drag(await titleOf(moved.id), { x: 2, y: 400 });
  let snap = await byApp('kalkulation');
  check('Ziehen an den linken Rand dockt links an (halbe Breite, volle Höhe)', snap.snap && snap.x === 0 && Math.abs(snap.w - 750) <= 2 && snap.h === 836, JSON.stringify(snap));
  await raise('faelle');
  await pg.drag(await titleOf((await byApp('faelle')).id), { x: 1498, y: 400 });
  const snapR = await byApp('faelle');
  check('Ziehen an den rechten Rand dockt rechts an', snapR.snap && Math.abs(snapR.x - 750) <= 2 && Math.abs(snapR.w - 750) <= 2, JSON.stringify(snapR));
  snap = await byApp('kalkulation');
  check('Angedockte Fenster liegen lückenlos nebeneinander', Math.abs(snap.x + snap.w - snapR.x) <= 1);
  await pg.shot(`${OUT}/13-angedockt.png`);
  await raise('bewertung');
  await pg.drag(await titleOf((await byApp('bewertung')).id), { x: 750, y: 2 });
  const maxW = await byApp('bewertung');
  check('Ziehen an die Oberkante maximiert', maxW.max && maxW.w === 1500 && maxW.h === 836, JSON.stringify(maxW));
  await pg.shot(`${OUT}/17-maximiert.png`);

  /* ---------- Tastatur ---------- */
  await pg.key('ArrowDown', 'ArrowDown', { ctrl: true, alt: true });
  let bwNow = await byApp('bewertung');
  check('Strg+Alt+↓ stellt das maximierte Fenster wieder her', !bwNow.max && !bwNow.min && bwNow.w < 1500);
  await pg.key('ArrowDown', 'ArrowDown', { ctrl: true, alt: true });
  bwNow = await byApp('bewertung');
  check('Strg+Alt+↓ minimiert das Fenster', bwNow.min);
  const tb = await pg.evalJs(`(()=>{const b=[...document.querySelectorAll('.st-task')].find(x=>/Bewertung/.test(x.getAttribute('aria-label'))); const r=b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await pg.click(tb.x, tb.y);
  bwNow = await byApp('bewertung');
  check('Klick in der Taskleiste stellt das Fenster wieder her und fokussiert es', !bwNow.min && bwNow.focus);
  await pg.key('ArrowLeft', 'ArrowLeft', { ctrl: true, alt: true });
  bwNow = await byApp('bewertung');
  check('Strg+Alt+← dockt das aktive Fenster links an', bwNow.snap && bwNow.x === 0);
  await pg.key('KeyW', 'w', { ctrl: true, alt: true });
  check('Strg+Alt+W schließt das aktive Fenster', await waitFor(async () => !(await byApp('bewertung'))));

  /* ---------- Kein Datenverlust beim Minimieren ---------- */
  await raise('kalkulation');
  const calcNow = await byApp('kalkulation');
  const typed = 'ING-ENTWURF-123';
  await pg.evalJs(`(()=>{const d=document.querySelector('[data-win="${calcNow.id}"] iframe').contentDocument; const i=d.querySelector('input[name=q]'); i.value=${JSON.stringify(typed)}; return !!i})()`);
  await pg.key('ArrowDown', 'ArrowDown', { ctrl: true, alt: true }); // angedocktes Fenster → wiederherstellen
  await sleep(350);
  { const mb = await pg.rect(`[data-win="${calcNow.id}"] .st-wbtns button`); await pg.click(mb.cx, mb.cy); }
  check('Fenster minimiert (Inhalt bleibt eingehängt)', await waitFor(async () => (await byApp('kalkulation'))?.min));
  const tb2 = await pg.evalJs(`(()=>{const b=[...document.querySelectorAll('.st-task')].find(x=>/Kalkulation/.test(x.getAttribute('aria-label'))); const r=b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await pg.click(tb2.x, tb2.y);
  await pg.sleep(400);
  const kept = await pg.evalJs(`document.querySelector('[data-win="${calcNow.id}"] iframe').contentDocument.querySelector('input[name=q]')?.value`);
  check('Ungespeicherte Eingabe ist nach Minimieren/Wiederherstellen noch da', kept === typed, String(kept));

  /* ---------- Größe ändern ---------- */
  await raise('kalkulation');
  const rz = await byApp('kalkulation');
  const bigger = await (async () => {
    const r = await pg.rect(`[data-win="${rz.id}"] .st-rz-se`);
    const hit = await pg.evalJs(`(()=>{const e=document.elementFromPoint(${r.cx},${r.cy}); return e ? e.className + ' in ' + (e.closest('.st-win')?.dataset.app ?? '?') : 'none'})()`);
    if (!/st-rz-se/.test(hit)) console.log('  (Ecke verdeckt:', hit, JSON.stringify(r), JSON.stringify(rz), ')');
    await pg.drag({ x: r.cx, y: r.cy }, { x: r.cx + 120, y: r.cy + 80 });
    return byApp('kalkulation');
  })();
  check('Größenänderung an der Ecke funktioniert (und löst das Andocken)', bigger.w >= rz.w && bigger.h >= rz.h && !bigger.snap, `${rz.w}x${rz.h} → ${bigger.w}x${bigger.h}`);

  /* ---------- Kontextmenü ---------- */
  { const fp = await freePoint(); await pg.rightClick(fp?.x ?? 1450, fp?.y ?? 30); }
  check('Rechtsklick auf den Desktop öffnet das Kontextmenü', await waitFor(() => pg.evalJs(`!!document.querySelector('.st-ctx') && /Alle Fenster schließen/.test(document.querySelector('.st-ctx').innerText)`)));
  await pg.key('Escape', 'Escape');
  check('Esc schließt das Kontextmenü', await waitFor(() => pg.evalJs(`!document.querySelector('.st-ctx')`)));
  const tk = await pg.evalJs(`(()=>{const b=document.querySelector('.st-task.is-run'); const r=b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await pg.rightClick(tk.x, tk.y);
  check('Rechtsklick auf Taskleisten-Symbol: Menü mit „Neues Fenster“', await waitFor(() => pg.evalJs(`/Neues Fenster/.test(document.querySelector('.st-ctx')?.innerText||'')`)));
  await pg.key('Escape', 'Escape');

  /* ---------- Strg-Klick auf Link → neues Fenster ---------- */
  await raise('faelle');
  const caseNow = await byApp('faelle');
  const link = await pg.evalJs(`(()=>{const f=document.querySelector('[data-win="${caseNow.id}"] iframe'); const a=[...f.contentDocument.querySelectorAll('.adm-main a[href^="/admin/kunden/"]')].find(x=>x.getBoundingClientRect().width>0); if(!a) return null; const fr=f.getBoundingClientRect(); const r=a.getBoundingClientRect(); return {x:fr.x+r.x+r.width/2, y:fr.y+r.y+r.height/2}})()`);
  if (link) {
    const n0 = (await wins()).length;
    await pg.click(link.x, link.y, { meta: true });
    check('⌘/Strg-Klick auf einen Link in der Schadenakte öffnet ein neues Fenster', await waitFor(async () => (await wins()).length === n0 + 1));
  } else check('Strg-Klick auf Link (Kunden-Link in der Akte gefunden)', false, 'kein Kunden-Link sichtbar');

  /* ---------- Benachrichtigungen ---------- */
  const bell = await pg.rect('.st-bellbtn');
  await pg.click(bell.cx, bell.cy);
  check('Benachrichtigungszentrale zeigt offene Hinweise aus echten Zählern', await waitFor(() => pg.evalJs(`/offene hinweise/i.test(document.querySelector('.st-notif')?.innerText||'') && document.querySelectorAll('.st-notif li').length>0`)));
  await pg.shot(`${OUT}/14-benachrichtigungen.png`);
  await pg.key('Escape', 'Escape');

  /* ---------- Einstellungen: Darstellung ---------- */
  await pg.key('KeyK', 'k', { ctrl: true });
  await waitFor(() => pg.rect('.st-start-foot .st-iconbtn'));
  const sb = await pg.rect('.st-start-foot .st-iconbtn');
  await pg.click(sb.cx, sb.cy);
  check('Einstellungen öffnen als eigenes Fenster', await waitFor(async () => (await wins()).some((w) => w.app === 'settings')));
  await pg.evalJs(`[...document.querySelectorAll('.st-seg button')].find(b=>b.textContent==='Hell').click()`);
  const themeOk = await waitFor(() => pg.evalJs(`document.querySelector('.st-root').dataset.theme==='light' && document.cookie.includes('ing_theme=light') && [...document.querySelectorAll('iframe')].every(f=>f.contentDocument?.querySelector('.adm-root')?.dataset.theme==='light')`));
  check('Hellmodus: Desktop, Cookie und eingebettete Fenster wechseln', themeOk, themeOk ? '' : await pg.evalJs(`JSON.stringify([document.querySelector('.st-root').dataset.theme, document.cookie, [...document.querySelectorAll('iframe')].map(f=>f.contentDocument?.querySelector('.adm-root')?.dataset.theme ?? 'none')])`));
  await pg.shot(`${OUT}/15-hell.png`);
  await pg.evalJs(`[...document.querySelectorAll('.st-seg button')].find(b=>b.textContent==='Dunkel').click()`);
  await pg.evalJs(`[...document.querySelectorAll('.st-wall-pick')].find(b=>/Nachtfahrt/.test(b.textContent)).click()`);
  check('Hintergrund wechselbar', await waitFor(() => pg.evalJs(`document.querySelector('.st-wall').dataset.wall==='night-drive'`)));

  /* ---------- Speichern im Benutzerkonto + Wiederherstellung ---------- */
  await pg.sleep(2500);
  const saved = sql(`select jsonb_array_length(value->'windows')||'|'||(value->'settings'->>'wallpaper') from user_preferences where key='studio'`);
  check('Layout und Einstellungen sind im Benutzerkonto gespeichert (Datenbank)', /^\d+\|night-drive$/.test(saved) && Number(saved.split('|')[0]) >= 4, saved);
  const beforeReload = (await wins()).map((w) => `${w.app}:${w.min}`).sort().join(',');
  await pg.goto(BASE + '/studio/', 3500);
  const afterReload = (await wins()).map((w) => `${w.app}:${w.min}`).sort().join(',');
  check('Nach Neuladen sind alle Fenster samt Zustand wieder da', beforeReload === afterReload && afterReload.length > 0, `${beforeReload} | ${afterReload}`);
  check('Hintergrund bleibt gespeichert', await pg.evalJs(`document.querySelector('.st-wall').dataset.wall==='night-drive'`));
  const restored = await byApp('faelle');
  check('Fenster zeigt nach Neuladen wieder dieselbe Seite (Fall)', await waitFor(async () => (await frameText(restored.id)).includes(caseNr)));
  await pg.shot(`${OUT}/16-wiederhergestellt.png`);

  /* ---------- Gutachter: nur erlaubte Apps ---------- */
  sql(`delete from user_preferences`);
  await login('gutachter@demo.ing.test');
  const exApps = await pg.evalJs(`[...document.querySelectorAll('.st-dicon')].map(b=>b.innerText.trim())`);
  check('Gutachter sieht keine Finanzen-, Benutzer- oder Verwaltungs-App', exApps.length > 3 && !exApps.some((t) => /Finanzen|Benutzer|Verwaltung/.test(t)), exApps.join(', '));
  check('Gutachter sieht seine Fachanwendungen', exApps.some((t) => /Fälle/.test(t)) && exApps.some((t) => /Kalkulation/.test(t)));
  const bad = await pg.evalJs(`fetch('/api/studio/prefs/',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({windows:[{appId:'finanzen',url:'/admin/rechnungen/',title:'x',x:1,y:1,w:500,h:400},{appId:'faelle',url:'https://evil.example/',title:'y',x:1,y:1,w:500,h:400}],pinned:['finanzen','faelle'],settings:{theme:'light'}})}).then(r=>r.json())`);
  check('Server filtert unerlaubte Apps und fremde Adressen aus gespeicherten Fenstern', bad.ok && bad.prefs.windows.length === 0 && !bad.prefs.pinned.includes('finanzen') && bad.prefs.pinned.includes('faelle'), JSON.stringify(bad.prefs?.windows) + JSON.stringify(bad.prefs?.pinned));
  const other = await pg.evalJs(`fetch('/api/studio/prefs/').then(r=>r.json())`);
  check('Gutachter sieht nur eigene Einstellungen (Theme light aus seinem Konto)', other.prefs.settings.theme === 'light');
  check('Anderes Konto (Inhaber) bleibt unberührt', sql(`select count(*) from user_preferences where user_id=(select id from users where email='inhaber@demo.ing.test')`) === '0');
  sql(`delete from user_preferences`);

  /* ---------- Ohne Anmeldung ---------- */
  await pg.send('Network.clearBrowserCookies');
  await pg.goto(BASE + '/studio/', 1500);
  check('Ohne Anmeldung: /studio/ führt zum Login', (await pg.evalJs('location.pathname')).startsWith('/admin/login'));
  const anon = await pg.evalJs(`Promise.all(['/api/studio/state/','/api/studio/prefs/'].map(u=>fetch(u).then(r=>r.status)))`);
  check('Ohne Anmeldung: Studio-Schnittstellen liefern 401', anon.every((s) => s === 401), anon.join(','));

  /* ---------- Smartphone: eigene Touch-Oberfläche statt Mini-Desktop ---------- */
  await login('inhaber@demo.ing.test');
  await pg.viewport(390, 844, true, 2);
  await pg.goto(BASE + '/studio/', 2500);
  check('Smartphone: /studio/ leitet auf die Touch-Oberfläche (/admin/) um', (await pg.evalJs('location.pathname')) === '/admin/');
} finally {
  proc.kill();
}
console.log(`\n${res.filter(Boolean).length}/${res.length} bestanden`);
process.exit(res.every(Boolean) ? 0 : 1);
