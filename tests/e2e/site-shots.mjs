/** Screenshots der öffentlichen Website (Desktop + Smartphone) zur Sichtprüfung: BASE=… OUT=… node tests/e2e/site-shots.mjs */
import { launch, newPage, sleep } from './cdp.mjs';
const BASE = process.env.BASE; if (!BASE) throw new Error('BASE setzen');
const OUT = process.env.OUT || '/tmp/ing-site';
const pages = (process.env.PAGES || '/,/kfz-gutachter-hannover/,/leistungen/,/unfallgutachten/,/kontakt/,/einsatzgebiet/,/kfz-gutachter/laatzen/,/faq/').split(',');
const { proc, port } = await launch(9521);
try {
  const pg = await newPage(port);
  for (const [name, w, h, mobile, dpr] of [['d', 1440, 900, false, 1], ['m', 390, 844, true, 2]]) {
    await pg.viewport(w, h, mobile, dpr);
    for (const p of pages) {
      await pg.goto(BASE + p, 2500);
      // einmal durchscrollen, damit Einblend-Animationen auslösen
      const total = await pg.evalJs('document.documentElement.scrollHeight');
      for (let y = 0; y < total; y += h * 0.8) { await pg.evalJs(`window.scrollTo(0,${y})`); await sleep(120); }
      await pg.evalJs('window.scrollTo(0,0)'); await sleep(500);
      const slug = (p.replace(/\//g, '_') || '_') ;
      await pg.shot(`${OUT}/${name}${slug}top.png`);
      console.log(name, p, 'Höhe', total, 'Überlauf-X:', await pg.evalJs('document.documentElement.scrollWidth>innerWidth+1'));
    }
  }
} finally { proc.kill(); }
