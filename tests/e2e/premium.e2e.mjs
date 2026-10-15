/** BASE=http://localhost:3000 node tests/e2e/premium.e2e.mjs; read-only, synthetic browser interactions. */
import assert from 'node:assert/strict';
import { launch, newPage, sleep } from './cdp.mjs';
const BASE = process.env.BASE;
if (!BASE) throw new Error('BASE is required');
const { proc, port } = await launch(9525);
let checks = 0;
function check(value, label) { assert.ok(value, label); console.log('PASS', label); checks++; }
try {
  const pg = await newPage(port);
  const errors = [];
  pg.on(e => { if (e.method === 'Runtime.exceptionThrown') errors.push(e.params); });
  for (const [width, height, mobile] of [[1440, 1000, false], [390, 844, true], [320, 740, true]]) {
    await pg.viewport(width, height, mobile, 1);
    await pg.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await pg.goto(BASE + '/', 1800);
    check(await pg.evalJs('document.querySelectorAll("h1").length === 1'), `${width}: one H1`);
    check(await pg.evalJs('document.querySelectorAll("#leistungen li").length === 9'), `${width}: nine evidenced offerings`);
    check(await pg.evalJs('document.querySelectorAll("#fahrzeugklassen li").length === 9'), `${width}: nine vehicle classes`);
    check(await pg.evalJs('document.documentElement.scrollWidth <= innerWidth + 1'), `${width}: no horizontal overflow`);
    await pg.evalJs('document.querySelector("#einblicke").scrollIntoView()'); await sleep(300);
    const srcs = await pg.evalJs('Array.from(document.querySelectorAll("#einblicke video source")).map(x=>x.getAttribute("src"))');
    for (const src of srcs) { const r = await fetch(BASE + src, { method: 'HEAD' }); check(r.ok && /video\/mp4/.test(r.headers.get('content-type') ?? ''), `${width}: video source exists ${src}`); }
    const frame = await pg.evalJs('(()=>{const r=document.querySelector("#einblicke [aria-roledescription=Folie]").getBoundingClientRect();return {w:r.width,h:r.height}})()');
    check(Math.abs(frame.w / frame.h - 16 / 9) < 0.02, `${width}: stable 16:9 media frame`);
    for (let i=1;i<4;i++) {
      await pg.evalJs('document.querySelector("[aria-label=\\"Nächste Szene\\"]").click()'); await sleep(150);
      check(await pg.evalJs(`document.querySelectorAll('#einblicke [aria-pressed="true"]').length === 1 && document.querySelector('#einblicke [aria-roledescription="Folie"]').getAttribute('aria-label').startsWith('${i+1} von 4')`), `${width}: select scene ${i+1}`);
    }
    await pg.evalJs('document.querySelector("[aria-label=\\"Nächste Szene\\"]").click()'); await sleep(100);
    check(await pg.evalJs('document.querySelector("#einblicke [aria-roledescription=Folie]").getAttribute("aria-label").startsWith("1 von 4")'), `${width}: wrap to first scene`);
    await pg.evalJs('document.querySelector("[aria-label=\\"Nächste Szene\\"]").focus()');
    const enter = { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 };
    await pg.send('Input.dispatchKeyEvent', { type: 'keyDown', text: '\r', ...enter }); await pg.send('Input.dispatchKeyEvent', { type: 'keyUp', ...enter }); await sleep(150);
    check(await pg.evalJs('document.querySelector("#einblicke [aria-roledescription=Folie]").getAttribute("aria-label").startsWith("2 von 4")'), `${width}: keyboard selection`);
    check(await pg.evalJs('Array.from(document.querySelectorAll("#einblicke img")).every(x=>x.complete && x.naturalWidth>0)'), `${width}: poster loaded`);
    if (process.env.OUT) {
      await pg.evalJs('document.querySelector("#leistungen").scrollIntoView()'); await sleep(150); await pg.shot(`${process.env.OUT}/services-${width}.png`);
      await pg.evalJs('document.querySelector("#einblicke").scrollIntoView()'); await sleep(150); await pg.shot(`${process.env.OUT}/showcase-${width}.png`);
    }
  }
  const links = await pg.evalJs('Array.from(new Set(Array.from(document.querySelectorAll("#leistungen a, #fahrzeugklassen a")).map(a=>a.pathname)))');
  for (const path of links) {
    const response = await fetch(BASE + path);
    check(response.ok, `service destination ${path}`);
  }
  const studio = await fetch(BASE + '/studio/', { redirect: 'manual' });
  check([307,308].includes(studio.status) && studio.headers.get('location')?.includes('/admin/login'), 'studio redirects anonymous access to login');
  const calendar = await fetch(BASE + '/api/studio/kalender/?monat=2026-10');
  check(calendar.status === 401, 'calendar rejects anonymous access');
  check(errors.length === 0, 'no uncaught browser exceptions');
  console.log(`${checks} checks passed`);
} finally { proc.kill(); }
