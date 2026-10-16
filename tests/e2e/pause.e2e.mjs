import { launch, newPage, sleep } from './cdp.mjs';
const { proc, port } = await launch(9611, { w: 1440, h: 900 });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(`${c ? 'OK  ' : 'FEHL'}  ${n}${x ? ' — ' + x : ''}`); };
try {
  const p = await newPage(port); await p.viewport(1440, 900);
  await p.goto((process.env.BASE || 'http://127.0.0.1:4310') + '/', 6000);
  const st = async () => JSON.parse(await p.evalJs(`JSON.stringify((()=>{const v=document.querySelector('#top video');return {paused:v.paused,t:v.currentTime}})())`));
  let s = await st(); ok('Video läuft im sichtbaren Hero', !s.paused);
  await p.evalJs(`scrollTo(0, document.body.scrollHeight*0.5)`); await sleep(1200); s = await st(); ok('Video pausiert, sobald der Hero nicht mehr sichtbar ist', s.paused);
  await p.evalJs(`scrollTo(0,0)`); await sleep(1500); s = await st(); ok('Video läuft weiter, wenn der Hero wieder sichtbar ist', !s.paused);
  await p.evalJs(`Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); document.dispatchEvent(new Event('visibilitychange'))`); await sleep(600); s = await st(); ok('Video pausiert, wenn der Tab nicht sichtbar ist', s.paused);
  await p.evalJs(`Object.defineProperty(document,'hidden',{configurable:true,get:()=>false}); document.dispatchEvent(new Event('visibilitychange'))`); await sleep(900); s = await st(); ok('Video läuft nach Rückkehr in den Tab weiter', !s.paused);
  const attrs = JSON.parse(await p.evalJs(`JSON.stringify((()=>{const v=document.querySelector('#top video');return {muted:v.muted,playsInline:v.playsInline,loop:v.loop,tabindex:v.getAttribute('tabindex'),ariaHidden:v.closest('[aria-hidden]')?.getAttribute('aria-hidden'),btnLabel:document.querySelector('#top button[aria-label*=Hintergrundvideo]').getAttribute('aria-label')}})())`));
  ok('Stumm, playsInline, Schleife; dekorativ (aria-hidden) mit beschriftetem Bedienknopf', attrs.muted && attrs.playsInline && attrs.loop && attrs.ariaHidden === 'true' && /Hintergrundvideo/.test(attrs.btnLabel), JSON.stringify(attrs));
} finally { proc.kill(); }
console.log(res.every(Boolean) ? 'ERGEBNIS: bestanden' : 'ERGEBNIS: fehlgeschlagen');
