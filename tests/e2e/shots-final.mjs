/** Abschluss-Screenshots (Desktop + Smartphone) für den Bericht: BASE=… OUT=… node tests/e2e/shots-final.mjs */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { launch, newPage, sleep } from './cdp.mjs';
const BASE = process.env.BASE; if (!BASE) throw new Error('BASE setzen');
const OUT = process.env.OUT || '/tmp/ing-final';
const PW = readFileSync(new URL('../../scripts/seed-demo.ts', import.meta.url), 'utf8').match(/DEMO_PASSWORD = '([^']+)'/)[1];
const PSQL = process.env.PSQL || '/Applications/Postgres.app/Contents/Versions/latest/bin/psql';
const sql = (q) => execSync(`${PSQL} -h localhost -U ${process.env.USER} -d ${process.env.E2E_DB || 'ing_os_dev'} -At -c "${q.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
sql('delete from user_preferences'); sql('delete from login_attempts');
const nr = sql('select case_number from cases order by created_at limit 1');
const { proc, port } = await launch(9581);
try {
  const pg = await newPage(port);
  const login = async (email) => { await pg.send('Network.clearBrowserCookies'); await pg.goto(BASE + '/admin/login/', 1200); await pg.evalJs(`(()=>{const f=document.querySelector('form'); f.email.value=${JSON.stringify(email)}; f.password.value=${JSON.stringify(PW)}; f.requestSubmit();})()`); await sleep(3500); };
  const wait = async (fn, ms = 12000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch { /* weiter */ } await sleep(200); } return false; };
  const open = async (q, app) => { await pg.key('KeyK', 'k', { ctrl: true }); await wait(() => pg.rect('.st-start input')); await pg.type(q); await wait(() => pg.evalJs(`document.querySelectorAll('.st-start-row').length>0`)); await sleep(500); await pg.key('Enter', 'Enter'); await wait(() => pg.evalJs(`!!document.querySelector('[data-app="${app}"]')`)); await sleep(1200); };
  const title = (id) => pg.evalJs(`(()=>{const el=document.querySelector('[data-win="${id}"] .st-title'); const r=el.getBoundingClientRect(); for(let x=r.left+60;x<r.right-200;x+=12){const t=document.elementFromPoint(x,r.top+r.height/2); if(t&&el.contains(t)&&!t.closest('button')) return {x,y:r.top+r.height/2}} return null})()`);

  // Desktop 1: Schadenakte links, Kalkulation rechts (angedockt), Bewertung dahinter
  await pg.viewport(1600, 960);
  await login('inhaber@demo.ing.test');
  await open('Bewertung', 'bewertung');
  await open('Kalkul', 'kalkulation');
  await open(nr, 'faelle');
  const id = async (app) => pg.evalJs(`document.querySelector('[data-app="${app}"]').dataset.win`);
  await pg.drag(await title(await id('faelle')), { x: 2, y: 500 }); await sleep(500);
  await pg.drag(await title(await id('kalkulation')), { x: 1598, y: 500 }); await sleep(600);
  await pg.shot(`${OUT}/studio-desktop-dunkel.png`);
  // Startmenü
  await pg.key('KeyK', 'k', { ctrl: true }); await sleep(600);
  await pg.shot(`${OUT}/studio-startmenue.png`);
  await pg.key('Escape', 'Escape');
  // Hell
  await pg.evalJs(`document.querySelector('.st-iconbtn[aria-label="Hell schalten"]')?.click()`); await sleep(1800);
  await pg.shot(`${OUT}/studio-desktop-hell.png`);

  // Smartphone: Startseite + Schadenaufnahme
  await pg.viewport(390, 844, true, 2);
  await pg.goto(BASE + '/', 3500);
  await pg.evalJs(`document.querySelector('[aria-label="Cookie-Hinweis"] button')?.click()`); await sleep(500);
  await pg.shot(`${OUT}/website-mobil-hero.png`);
  await pg.goto(BASE + '/admin/', 3000);
  await pg.shot(`${OUT}/mobil-dashboard.png`);
  // Website Desktop
  await pg.viewport(1440, 900, false, 1);
  await pg.send('Network.clearBrowserCookies');
  await pg.goto(BASE + '/', 3500);
  await pg.evalJs(`document.querySelector('[aria-label="Cookie-Hinweis"] button')?.click()`);
  await pg.evalJs('window.scrollTo(0, 900*3)'); await sleep(1200);
  await pg.shot(`${OUT}/website-film-mitte.png`);
  await pg.goto(BASE + '/kfz-gutachter-hannover/', 3000);
  await pg.shot(`${OUT}/website-unterseite.png`);
} finally { proc.kill(); sql('delete from user_preferences'); }
console.log('Screenshots in', OUT);
