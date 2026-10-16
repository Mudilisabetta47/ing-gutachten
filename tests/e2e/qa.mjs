import { launch, newPage, sleep } from './cdp.mjs';
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const BASE = process.env.BASE || 'http://127.0.0.1:4310';
const OUT = process.env.OUT_DIR || new URL('../../out', import.meta.url).pathname;
const axeSrc = readFileSync(process.env.AXE_JS || new URL('../../node_modules/axe-core/axe.min.js', import.meta.url).pathname, 'utf8');
// Seitenliste aus dem Build
const pages = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = path.join(d, f); if (statSync(p).isDirectory()) { if (f === '_next' || f === 'assets') continue; walk(p); } else if (f === 'index.html') pages.push('/' + path.relative(OUT, d).replace(/\\/g, '/') + (path.relative(OUT, d) ? '/' : '')); } })(OUT);
pages.sort();
const viewports = [['Smartphone klein 360', 360, 740, true], ['Smartphone groß 430', 430, 932, true], ['Tablet 768', 768, 1024, true], ['Desktop 1440', 1440, 900, false]];
const { proc, port } = await launch(9544, { w: 1440, h: 900 });
const report = { pages: pages.length, perViewport: {}, perPage: {}, axe: {} };
const issues = [];
const add = (kind, page, vp, detail) => issues.push({ kind, page, vp, detail });
try {
  for (const [vpName, w, h, mobile] of viewports) {
    const p = await newPage(port);
    await p.viewport(w, h, mobile, mobile ? 2 : 1);
    if (mobile) await p.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    const errs = [];
    p.on((d) => {
      if (d.method === 'Runtime.exceptionThrown') errs.push('exception: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).slice(0, 160));
      if (d.method === 'Runtime.consoleAPICalled' && ['error'].includes(d.params.type)) errs.push('console.error: ' + d.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 160));
      if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') errs.push('log: ' + d.params.entry.text.slice(0, 120) + ' ' + (d.params.entry.url || ''));
      if (d.method === 'Network.responseReceived' && d.params.response.status >= 400) errs.push(`HTTP ${d.params.response.status} ${d.params.response.url.replace(BASE, '')}`);
    });
    await p.send('Log.enable');
    let counted = 0;
    for (const pg of pages) {
      errs.length = 0;
      await p.goto(BASE + pg, 1500);
      // langsames Durchscrollen, damit Lazy-Elemente und Animationen laufen
      await p.evalJs(`(async()=>{const H=document.documentElement.scrollHeight;for(let y=0;y<H;y+=Math.max(400,innerHeight*.8)){scrollTo(0,y);await new Promise(r=>setTimeout(r,60))}scrollTo(0,0);return 1})()`);
      await sleep(400);
      const r = JSON.parse(await p.evalJs(`JSON.stringify((function(){
        var de=document.documentElement; var W=innerWidth; var o={};
        o.overflowX = de.scrollWidth>W+1; o.scrollW=de.scrollWidth;
        o.h1=document.querySelectorAll('h1').length;
        o.title=document.title; var md=document.querySelector('meta[name=description]'); o.desc=md?md.content:''; 
        var can=document.querySelector('link[rel=canonical]'); o.canonical=can?can.href:''; var rb=document.querySelector('meta[name=robots]'); o.robots=rb?rb.content:'';
        o.lang=de.lang; o.imgsBroken=[].filter.call(document.images,function(i){return i.complete&&i.naturalWidth===0&&i.loading!=='lazy'}).map(function(i){return i.getAttribute('src')});
        o.noAlt=[].filter.call(document.images,function(i){return !i.hasAttribute('alt')}).length;
        var small=[]; document.querySelectorAll('a,button,input,select,textarea,summary').forEach(function(e){var r=e.getBoundingClientRect(); var cs=getComputedStyle(e); if(r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.opacity!=='0'&&!e.closest('[aria-hidden=true]')&&e.offsetParent!==null&&(r.height<${mobile ? 40 : 24}||r.width<${mobile ? 40 : 24}) && !(e.tagName==='A'&&e.closest('p,li,address,dd,small,span.tlink')&&r.height>=16&&e.closest('p,address'))&&!e.classList.contains('sr-only')){small.push((e.getAttribute('aria-label')||e.innerText||e.getAttribute('href')||e.tagName).trim().slice(0,30)+' '+Math.round(r.width)+'x'+Math.round(r.height))}}); o.small=small.slice(0,8);o.smallCount=small.length;
        var clip=[]; document.querySelectorAll('h1,h2,h3,p,li,a,button,span,dd,dt,b').forEach(function(e){var cs=getComputedStyle(e); if(cs.display!=='inline'&&(cs.overflow==='hidden'||cs.textOverflow==='ellipsis')&&e.scrollWidth>e.clientWidth+2&&e.clientWidth>0&&!e.closest('svg')&&!e.classList.contains('sr-only')&&!e.closest('.sr-only,.sr-only-focusable'))clip.push((e.innerText||'').trim().slice(0,30))}); o.clipped=clip.slice(0,5);
        var bad=[]; document.querySelectorAll('body *').forEach(function(e){var r=e.getBoundingClientRect(); if(r.right>W+2&&r.width>0&&getComputedStyle(e).position!=='fixed'&&!e.closest('svg,[aria-hidden=true],.no-scrollbar,[class*=overflow-x-auto]')){var inScroll=false;var a=e.parentElement;while(a){var ov=getComputedStyle(a).overflowX;if(ov==='hidden'||ov==='auto'||ov==='scroll'||ov==='clip'){inScroll=true;break}a=a.parentElement}if(!inScroll)bad.push(e.tagName+'.'+String(e.className).slice(0,30))}}); o.escaping=bad.slice(0,4);
        return o})())`));
      counted++;
      if (r.overflowX) add('horizontales Scrollen', pg, vpName, `scrollWidth ${r.scrollW}`);
      if (r.escaping.length) add('Element ragt über den Rand', pg, vpName, r.escaping.join(', '));
      if (r.clipped.length) add('abgeschnittener Text', pg, vpName, r.clipped.join(' | '));
      if (r.imgsBroken.length) add('defektes Bild', pg, vpName, r.imgsBroken.join(', '));
      if (r.smallCount && mobile) add('kleine Tippfläche (<40 px)', pg, vpName, r.small.join('; ') + ` (${r.smallCount})`);
      if (errs.length) add('Konsole/Netzwerk', pg, vpName, [...new Set(errs)].slice(0, 4).join(' | '));
      if (vpName.startsWith('Desktop')) {
        report.perPage[pg] = { h1: r.h1, title: r.title, titleLen: r.title.length, descLen: r.desc.length, canonical: r.canonical.replace(BASE, ''), robots: r.robots, lang: r.lang, noAlt: r.noAlt };
        if (r.h1 !== 1) add('h1-Anzahl', pg, vpName, String(r.h1));
        if (!r.desc) add('Meta-Beschreibung fehlt', pg, vpName, '');
        if (r.desc.length > 175) add('Meta-Beschreibung lang (>175)', pg, vpName, String(r.desc.length));
        if (r.title.length > 70) add('Titel lang (>70)', pg, vpName, String(r.title.length));
        if (!r.canonical) add('Canonical fehlt', pg, vpName, '');
        if (r.lang !== 'de') add('lang ≠ de', pg, vpName, r.lang);
        if (r.noAlt) add('Bild ohne alt', pg, vpName, String(r.noAlt));
      }
      // Barrierefreiheit (axe) nur Desktop und Smartphone groß
      if (vpName.startsWith('Desktop') || vpName.includes('430')) {
        await p.evalJs(axeSrc);
        const ax = JSON.parse(await p.evalJs(`axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']},resultTypes:['violations']}).then(r=>JSON.stringify(r.violations.map(v=>({id:v.id,impact:v.impact,n:v.nodes.length,help:v.help,ex:v.nodes[0]&&v.nodes[0].target.join(' ').slice(0,80)}))))`));
        for (const v of ax) { (report.axe[v.id] ??= { impact: v.impact, help: v.help, pages: [] }).pages.push(`${pg} (${v.n}) ${v.ex}`); }
      }
    }
    report.perViewport[vpName] = counted;
    p.close();
  }
} finally { proc.kill(); }
report.issues = issues;
writeFileSync(process.env.QA_REPORT || '/tmp/ing-qa-report.json', JSON.stringify(report, null, 1));
const by = {}; for (const i of issues) (by[i.kind] ??= []).push(i);
console.log('Seiten:', pages.length, '| Viewports:', Object.keys(report.perViewport).join(', '));
for (const [k, v] of Object.entries(by)) { console.log(`\n== ${k}: ${v.length}`); v.slice(0, 8).forEach((i) => console.log(`   ${i.vp} ${i.page} — ${i.detail}`)); }
console.log('\n== axe-Verstöße (Regel → Seiten):'); for (const [id, v] of Object.entries(report.axe)) console.log(`   ${id} [${v.impact}] ${v.help} — ${v.pages.length} Fundstellen, z. B. ${v.pages[0]}`);
