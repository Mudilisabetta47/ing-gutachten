import { readFileSync } from 'node:fs';
import { launch, newPage } from './cdp.mjs';
const BASE = process.env.BASE;
if (!BASE) throw new Error('BASE setzen, z. B. BASE=http://localhost:3101');
const PW = readFileSync(new URL('../../scripts/seed-demo.ts', import.meta.url), 'utf8').match(/DEMO_PASSWORD = '([^']+)'/)[1];
const OUT = process.env.OUT || '/tmp/ing-shots';
const { proc, port } = await launch(9511);
try {
  const pg = await newPage(port);
  await pg.viewport(1500, 900);
  await pg.goto(BASE + '/admin/login/', 1500);
  await pg.evalJs(`(()=>{const f=document.querySelector('form'); f.email.value='inhaber@demo.ing.test'; f.password.value=${JSON.stringify(PW)}; f.requestSubmit();})()`);
  await pg.sleep(3500);
  await pg.shot(`${OUT}/01-desktop.png`);
  console.log(await pg.evalJs('location.pathname'));
} finally { proc.kill(); }
