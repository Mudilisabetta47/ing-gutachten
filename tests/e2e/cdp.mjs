/**
 * Kleiner Browser-Treiber für die End-to-End-Prüfungen (Chrome über das DevTools-Protokoll, keine Zusatzpakete).
 * Echte Maus- und Tastaturereignisse – kein Aufruf von Funktionen der Seite, damit Ziehen, Andocken und Fokus wirklich geprüft werden.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch(port = 9500, size = { w: 1500, h: 950 }) {
  const dir = mkdtempSync(path.join(tmpdir(), 'ing-chrome-'));
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars', '--mute-audio', `--window-size=${size.w},${size.h}`, 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) return { proc, port }; } catch { /* noch nicht bereit */ }
    await sleep(150);
  }
  proc.kill();
  throw new Error('Chrome startet nicht');
}

export async function newPage(port) {
  const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { const { res, rej } = pending.get(d.id); pending.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); }
    else listeners.forEach((l) => l(d));
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
    return r.result.value;
  };
  const mods = (m = {}) => (m.alt ? 1 : 0) | (m.ctrl ? 2 : 0) | (m.meta ? 4 : 0) | (m.shift ? 8 : 0);
  const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, ...extra });
  const api = {
    send, evalJs, sleep,
    on: (fn) => listeners.push(fn),
    async goto(url, wait = 1200) { await send('Page.navigate', { url }); await sleep(wait); },
    async viewport(w, h, mobile = false, dpr = 1) { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile }); },
    async shot(file) { const r = await send('Page.captureScreenshot', { format: 'png' }); mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, Buffer.from(r.data, 'base64')); return file; },
    async move(x, y) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); },
    async click(x, y, o = {}) { await api.move(x, y); await mouse('mousePressed', x, y, { clickCount: o.count ?? 1, modifiers: mods(o), button: o.button ?? 'left' }); await mouse('mouseReleased', x, y, { clickCount: o.count ?? 1, modifiers: mods(o), button: o.button ?? 'left' }); },
    dblclick: (x, y) => api.click(x, y, { count: 2 }),
    rightClick: (x, y) => api.click(x, y, { button: 'right' }),
    async drag(from, to, steps = 12) {
      await api.move(from.x, from.y);
      await mouse('mousePressed', from.x, from.y);
      for (let i = 1; i <= steps; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps, button: 'left', buttons: 1 }); await sleep(12); }
      await mouse('mouseReleased', to.x, to.y);
    },
    async key(code, key, m = {}) {
      const base = { code, key, windowsVirtualKeyCode: ({ ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Tab: 9, Escape: 27, Enter: 13 })[code] ?? key.toUpperCase().charCodeAt(0), modifiers: mods(m) };
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
    },
    async type(text) { for (const ch of text) { await send('Input.dispatchKeyEvent', { type: 'char', text: ch }); } },
    async rect(sel) { return evalJs(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2}})()`); },
    close: () => { try { ws.close(); } catch { /* egal */ } },
  };
  return api;
}
