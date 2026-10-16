import { launch, newPage, sleep } from './cdp.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:4310';
const results = [];
const ok = (name, cond, extra = '') => { results.push([cond, name, extra]); console.log(`${cond ? 'OK  ' : 'FEHL'}  ${name}${extra ? ' — ' + extra : ''}`); };
const { proc, port } = await launch(9533, { w: 1440, h: 900 });
try {
  // ---- A: Desktop, Standard -------------------------------------------------------------
  let p = await newPage(port); await p.viewport(1440, 900);
  await p.goto(BASE + '/', 3500);
  let s = await p.evalJs(`(()=>{const h=document.getElementById('top');const v=h.querySelector('video');return JSON.stringify({video:!!v,playing:!!v&&!v.paused&&v.readyState>=3,btn:[...h.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')),label:h.textContent.includes('Illustrative KI-Filmszene'),einblickeVideos:document.getElementById('einblicke').querySelectorAll('video').length,einblickeTabs:document.getElementById('einblicke').querySelectorAll('button[aria-pressed]').length})})()`);
  s = JSON.parse(s);
  ok('Desktop: Hero-Video läuft', s.video && s.playing);
  ok('Desktop: Pause-Knopf + KI-Kennzeichnung sichtbar', s.btn.includes('Hintergrundvideo pausieren') && s.label);
  ok('Einblicke: kein Video mehr (doppelte Verwendung entfernt)', s.einblickeVideos === 0, `Videos=${s.einblickeVideos}, Szenen=${s.einblickeTabs}`);

  // ---- B: Bewegung reduzieren -----------------------------------------------------------
  p = await newPage(port); await p.viewport(1440, 900);
  await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await p.goto(BASE + '/', 3000);
  s = JSON.parse(await p.evalJs(`(()=>{const h=document.getElementById('top');const v=h.querySelector('video');const img=h.querySelector('img[src*="showcase-begutachtung"]');return JSON.stringify({reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,video:!!v,poster:!!img&&img.complete&&img.naturalWidth>0,posterVisible:!!img&&getComputedStyle(img).opacity==='1',btn:[...h.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')+'|'+b.innerText)})})()`));
  ok('Reduzierte Bewegung aktiv (Medienabfrage)', s.reduced);
  ok('Reduzierte Bewegung: kein Autoplay, Poster sichtbar', !s.video && s.poster && s.posterVisible, JSON.stringify(s.btn));
  ok('Reduzierte Bewegung: Abspielen-Knopf vorhanden', s.btn.some((b) => /abspielen/i.test(b)));
  await p.evalJs(`[...document.getElementById('top').querySelectorAll('button')].find(b=>/abspielen/i.test(b.getAttribute('aria-label')||'')).click()`);
  await sleep(3500);
  s = JSON.parse(await p.evalJs(`(()=>{const v=document.getElementById('top').querySelector('video');const t=v&&v.currentTime;return JSON.stringify({video:!!v,playing:!!v&&!v.paused,t,btn:[...document.getElementById('top').querySelectorAll('button')].map(b=>b.getAttribute('aria-label'))})})()`));
  await sleep(1200);
  const t2 = await p.evalJs(`document.getElementById('top').querySelector('video')?.currentTime`);
  ok('Reduzierte Bewegung: manuelles Abspielen startet das Video', s.video && s.playing && t2 > s.t, `t=${s.t?.toFixed?.(2)}→${t2?.toFixed?.(2)}`);
  ok('Danach zeigt der Knopf „pausieren“', s.btn.includes('Hintergrundvideo pausieren'));

  // ---- C: Autoplay blockiert (play() lehnt ab, wie Stromsparmodus/Browser-Richtlinie) -------
  p = await newPage(port); await p.viewport(1440, 900);
  await p.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__block=true;const o=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){if(window.__block)return Promise.reject(new DOMException('blocked','NotAllowedError'));return o.apply(this,arguments)};` });
  await p.goto(BASE + '/', 3500);
  s = JSON.parse(await p.evalJs(`(()=>{const h=document.getElementById('top');const v=h.querySelector('video');const img=h.querySelector('img[src*="showcase-begutachtung"]');return JSON.stringify({video:!!v,paused:!!v&&v.paused,poster:!!img&&img.complete&&img.naturalWidth>0,posterAttr:v&&v.getAttribute('poster'),btn:[...h.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')+'|'+b.innerText)})})()`));
  ok('Autoplay blockiert: Video angehalten, Poster bleibt sichtbar', s.video && s.paused && s.poster && !!s.posterAttr);
  ok('Autoplay blockiert: Knopf bietet „Abspielen“', s.btn.some((b) => /abspielen/i.test(b)), JSON.stringify(s.btn));
  await p.evalJs(`window.__block=false; [...document.getElementById('top').querySelectorAll('button')].find(b=>/abspielen/i.test(b.getAttribute('aria-label')||'')).click()`);
  await sleep(2500);
  s = JSON.parse(await p.evalJs(`(()=>{const v=document.getElementById('top').querySelector('video');return JSON.stringify({playing:!v.paused,t:v.currentTime})})()`));
  ok('Autoplay blockiert: Klick auf „Abspielen“ startet das Video', s.playing && s.t > 0, `t=${s.t.toFixed(2)}`);
} finally { proc.kill(); }
const failed = results.filter((r) => !r[0]).length;
console.log(failed ? `ERGEBNIS: ${failed} Prüfung(en) fehlgeschlagen` : 'ERGEBNIS: bestanden');
process.exit(failed ? 1 : 0);
