import { launch, newPage, sleep } from './cdp.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:4310';
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(`${c ? 'OK  ' : 'FEHL'}  ${n}${x ? ' — ' + x : ''}`); };
const { proc, port } = await launch(9588, { w: 1440, h: 900 });
const key = (p, k, code, extra = {}) => p.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: extra.vk, ...(k === 'Enter' ? { text: '\r' } : {}), ...extra }).then(() => p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: extra.vk }));
const tab = (p, shift = false) => key(p, 'Tab', 'Tab', { vk: 9, modifiers: shift ? 8 : 0 });
const active = (p) => p.evalJs(`(()=>{const e=document.activeElement;const cs=getComputedStyle(e);return JSON.stringify({tag:e.tagName,txt:(e.getAttribute('aria-label')||e.innerText||e.getAttribute('href')||'').trim().replace(/\\s+/g,' ').slice(0,40),href:e.getAttribute('href'),outline:cs.outlineStyle+' '+cs.outlineWidth,inView:(()=>{const r=e.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight})()})})()`).then(JSON.parse);
try {
  const p = await newPage(port); await p.viewport(1440, 900);
  await p.goto(BASE + '/', 2500);
  await p.evalJs(`document.body.focus()`);
  const seq = [];
  for (let i = 0; i < 12; i++) { await tab(p); await sleep(120); seq.push(await active(p)); }
  console.log('   Tab-Reihenfolge:', seq.map((s) => s.txt || s.tag).join(' › '));
  ok('Erster Tab-Stopp ist „Zum Inhalt springen“', /Inhalt springen/i.test(seq[0].txt));
  ok('Fokus ist sichtbar (Kontur) auf allen ersten Stopps', seq.every((s) => !/^none/.test(s.outline)), seq.filter((s) => /^none/.test(s.outline)).map((s) => s.txt).join(', '));
  // Dropdown per Tastatur
  const names = seq.map((s) => s.txt);
  ok('Hauptmenü „Schadensgutachten“ per Tab erreichbar', names.some((n) => /Schadensgutachten/.test(n)));
  await p.goto(BASE + '/', 1500); await p.evalJs(`document.body.focus()`);
  for (let i = 0; i < 3; i++) await tab(p);   // Inhalt springen, Logo, Schadensgutachten
  await sleep(500);
  const f = await active(p); const open1 = await p.evalJs(`document.querySelectorAll('nav[aria-label="Hauptnavigation"] ul a').length`);
  ok('Fokus liegt auf „Schadensgutachten“ und das Dropdown ist offen', /Schadensgutachten/.test(f.txt) && open1 >= 2, `${f.txt}, ${open1} Einträge`);
  await tab(p); await sleep(200); const a1 = await active(p);
  ok('Tab führt in das Dropdown (PKW-Gutachten)', /PKW-Gutachten/.test(a1.txt), a1.txt);
  await tab(p); await sleep(200); const a2 = await active(p);
  ok('Tab führt zum zweiten Eintrag (Unfallgutachten)', /Unfallgutachten/.test(a2.txt), a2.txt);
  await key(p, 'Escape', 'Escape', { vk: 27 }); await sleep(500);
  const open2 = await p.evalJs(`document.querySelectorAll('nav[aria-label="Hauptnavigation"] ul a').length`);
  ok('Escape schließt das Dropdown', open2 === 0, `${open2} Einträge offen`);
  // Hero-Video-Knopf per Tastatur bedienbar
  const hasBtn = await p.evalJs(`!!document.querySelector('#top button[aria-label*="Hintergrundvideo"]')`);
  await p.evalJs(`document.querySelector('#top button[aria-label*="Hintergrundvideo"]').focus()`);
  await key(p, 'Enter', 'Enter', { vk: 13 }); await sleep(600);
  const lab = await p.evalJs(`document.querySelector('#top button[aria-label*="Hintergrundvideo"]').getAttribute('aria-label')`);
  ok('Hero-Video: Knopf per Enter bedienbar (pausiert)', hasBtn && /abspielen/.test(lab), lab);
  // Mobile-Menü per Tastatur
  const m = await newPage(port); await m.viewport(390, 844, true, 2); await m.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await m.goto(BASE + '/', 2000);
  await m.evalJs(`document.querySelector('button[aria-controls="fullscreen-menu"]').focus()`);
  await key(m, 'Enter', 'Enter', { vk: 13 }); await sleep(1200);
  const menu = await m.evalJs(`!!document.getElementById('fullscreen-menu')&&document.body.classList.contains('is-locked')`);
  ok('Mobiles Menü öffnet per Tastatur, Scroll gesperrt', menu);
  await key(m, 'Escape', 'Escape', { vk: 27 }); await sleep(1000);
  ok('Escape schließt das mobile Menü', !(await m.evalJs(`!!document.getElementById('fullscreen-menu')`)));
} finally { proc.kill(); }
console.log(res.every(Boolean) ? 'ERGEBNIS: bestanden' : `ERGEBNIS: ${res.filter((r) => !r).length} fehlgeschlagen`);
