/** Grobe Leistungsmessung der öffentlichen Seiten im Browser (Produktionsbuild): LCP, CLS, Übertragungsmenge, Skriptgröße. */
import { launch, newPage, sleep } from './cdp.mjs';
const BASE = process.env.BASE; if (!BASE) throw new Error('BASE setzen');
const pages = (process.env.PAGES || '/,/kfz-gutachter-hannover/,/unfallgutachten/,/kontakt/').split(',');
const { proc, port } = await launch(9561);
try {
  const pg = await newPage(port);
  await pg.send('Network.setCacheDisabled', { cacheDisabled: true }); // jede Messung wie ein Erstbesuch
  for (const [label, w, h, mobile] of [['Desktop', 1440, 900, false], ['Smartphone', 390, 844, true]]) {
    await pg.viewport(w, h, mobile, mobile ? 2 : 1);
    if (mobile) await pg.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    else await pg.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await pg.send('Emulation.setCPUThrottlingRate', { rate: mobile ? 4 : 1 });
    for (const p of pages) {
      let bytes = 0, js = 0, img = 0;
      const sizes = new Map();
      pg.on((d) => {
        if (d.method === 'Network.responseReceived') sizes.set(d.params.requestId, d.params.type);
        if (d.method === 'Network.loadingFinished') { const t = sizes.get(d.params.requestId); bytes += d.params.encodedDataLength; if (t === 'Script') js += d.params.encodedDataLength; if (t === 'Image') img += d.params.encodedDataLength; }
      });
      await pg.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__lcp=0;window.__cls=0;new PerformanceObserver(l=>{for(const e of l.getEntries()) window.__lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries()) if(!e.hadRecentInput) window.__cls+=e.value}).observe({type:'layout-shift',buffered:true});` });
      await pg.goto(BASE + p, 6000);
      const m = await pg.evalJs('({lcp:Math.round(window.__lcp), cls:Math.round(window.__cls*1000)/1000, load:Math.round(performance.timing.loadEventEnd-performance.timing.navigationStart)})');
      console.log(`${label.padEnd(10)} ${p.padEnd(26)} LCP ${String(m.lcp).padStart(5)} ms · CLS ${m.cls} · geladen ${m.load} ms · ${(bytes / 1024).toFixed(0)} kB gesamt (Skripte ${(js / 1024).toFixed(0)} kB, Bilder ${(img / 1024).toFixed(0)} kB)`);
    }
  }
} finally { proc.kill(); }
