import { launch, newPage, sleep } from './cdp.mjs';
import { start, received } from './mock-api.mjs';
const BASE = 'http://127.0.0.1:4312';
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(`${c ? 'OK  ' : 'FEHL'}  ${n}${x ? ' — ' + x : ''}`); };
const srv = await start(4311);
const { proc, port } = await launch(9622, { w: 1200, h: 1000 });
try {
  const p = await newPage(port); await p.viewport(1200, 1000);
  const reqs = []; p.on((d) => { if (d.method === 'Network.requestWillBeSent' && d.params.request.url.includes(':4311')) reqs.push({ method: d.params.request.method, url: d.params.request.url }); });
  await p.goto(BASE + '/kontakt/', 2500);
  const ev = (e) => p.evalJs(e);
  await ev(`document.getElementById('anfrage').scrollIntoView()`); await sleep(600);
  // Schritt 1: ohne Auswahl „Weiter“ -> Fehler
  await ev(`[...document.querySelectorAll('#anfrage button')].find(b=>/Weiter/.test(b.innerText))?.click()`); await sleep(500);
  ok('Schritt 1: ohne Auswahl erscheint ein Fehlerhinweis', /Bitte eine Option wählen/.test(await ev(`document.getElementById('anfrage').innerText`)));
  await ev(`document.querySelector('input[name=anlass][value="Unfall"]').click()`); await sleep(900);
  await ev(`document.querySelector('input[name=fahrzeug][value="PKW"]').click()`); await sleep(900);
  // Schritt 3: Fotos (3 synthetische, 6,4 MB je Foto -> müssen verkleinert werden)
  const { root } = await p.send('DOM.getDocument'); const { nodeId } = await p.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#photos' });
  ok('Foto-Schritt zeigt den Hinweis zum Versand ohne Endpunkt NICHT (Endpunkt gesetzt)', !/nicht automatisch mitgesendet/.test(await ev(`document.getElementById('anfrage').innerText`)));
  await p.send('DOM.setFileInputFiles', { nodeId, files: [(process.env.SYNTH_PHOTO || '/tmp/synth-photo.jpg'), (process.env.SYNTH_PHOTO || '/tmp/synth-photo.jpg')] }); await sleep(800);
  ok('Fahrzeugschein-Feld ist ausgeblendet', !(await ev(`!!document.getElementById('fahrzeugschein')`)));
  await ev(`[...document.querySelectorAll('#anfrage button')].find(b=>/Weiter/.test(b.innerText))?.click()`); await sleep(900);
  // Schritt 4: Absenden mit ungültiger E-Mail -> Fehler, nichts gesendet
  const setv = (id, v) => ev(`(()=>{const e=document.getElementById('${id}');const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(v)});e.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`);
  await setv('name', 'Test Person'); await setv('telefon', '0511 123456'); await setv('email', 'kein-email'); await setv('standort', 'Hannover'); await setv('nachricht', 'Synthetischer Test – keine echten Daten');
  await ev(`document.querySelector('#anfrage input[type=checkbox]').click()`); await sleep(300);
  await ev(`[...document.querySelectorAll('#anfrage button')].find(b=>/Anfrage senden/.test(b.innerText))?.click()`); await sleep(800);
  ok('Ungültige E-Mail wird im Browser abgewiesen, nichts gesendet', /gültige E-Mail/.test(await ev(`document.getElementById('anfrage').innerText`)) && reqs.length === 0);
  await setv('email', 'test@example.invalid'); await sleep(7000 - 0); // Mindest-Ausfüllzeit (2,5 s) sicher überschritten
  await ev(`[...document.querySelectorAll('#anfrage button')].find(b=>/Anfrage senden/.test(b.innerText))?.click()`); await sleep(2500);
  ok('Anfrage wird per POST an den Endpunkt gesendet', reqs.some((r) => r.method === 'POST'), JSON.stringify(reqs.map((r) => r.method)));
  const r = received[0];
  ok('Server nimmt die Anfrage an (Felder, Dateien, Größen gültig)', !!r, r ? JSON.stringify({ fields: Object.keys(r.fields).join(','), files: r.files }) : 'nicht angekommen');
  if (r) {
    ok('Feldnamen entsprechen dem API-Vertrag (foto, website, t …)', ['anlass', 'fahrzeug', 'name', 'telefon', 'email', 'standort', 'nachricht', 'datenschutz', 'website', 't', 'foto'].every((k) => r.fieldNames.includes(k)), r.fieldNames.join(','));
    ok('Fotos wurden vor dem Senden auf ≤ 1,6 MB verkleinert (Original 6,4 MB)', r.files.length === 2 && r.files.every((f) => f.size <= 1_600_000 && f.mime === 'image/jpeg'), r.files.map((f) => `${(f.size / 1024).toFixed(0)} KiB`).join(', '));
  }
  ok('Erfolgsmeldung im Formular', /Anfrage ist raus/.test(await ev(`document.getElementById('anfrage').innerText`)));
} finally { proc.kill(); srv.close(); }
console.log(res.every(Boolean) ? 'ERGEBNIS: bestanden' : `ERGEBNIS: ${res.filter((r) => !r).length} fehlgeschlagen`);
process.exit(0);
