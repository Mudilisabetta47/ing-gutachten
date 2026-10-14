/**
 * Vorabprüfung vor Staging/Produktion (gibt keine Werte aus, nur Befunde; Exit-Code 1 bei Fehlern):
 *   node --env-file=.env.staging.local --import tsx scripts/preflight.ts staging [--compare .env.production.local]
 *   npm run preflight -- production --env-file=<Datei> [--compare <Datei der anderen Umgebung>]
 * Die Dateien holen Sie mit `vercel env pull` o. Ä. – sie dürfen NICHT eingecheckt werden (.gitignore: .env*.local).
 */
import { readFileSync } from 'node:fs';
import { evaluatePreflight, type Target } from '../src/lib/preflight';

const parse = (file: string) => Object.fromEntries(readFileSync(file, 'utf8').split('\n').map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter((m): m is RegExpMatchArray => Boolean(m)).map((m) => [m[1], m[2].replace(/^['"]|['"]$/g, '')]));
const arg = (n: string) => { const i = process.argv.findIndex((a) => a === `--${n}` || a.startsWith(`--${n}=`)); if (i < 0) return undefined; return process.argv[i].includes('=') ? process.argv[i].split('=')[1] : process.argv[i + 1]; };

const target = process.argv[2] as Target;
if (target !== 'staging' && target !== 'production') { console.error('Aufruf: npm run preflight -- <staging|production> [--env-file=<Datei>] [--compare=<Datei>]'); process.exit(2); }
const envFile = arg('env-file');
const env = envFile ? parse(envFile) : (process.env as Record<string, string | undefined>);
const cmp = arg('compare');
const findings = evaluatePreflight(env, target, cmp ? parse(cmp) : undefined);
const icon = { ok: '✔', warn: '⚠', error: '✖' } as const;
for (const x of findings) console.log(`${icon[x.level]} ${x.msg}`);
const errors = findings.filter((x) => x.level === 'error').length, warns = findings.filter((x) => x.level === 'warn').length;
console.log(`\n${target}: ${errors} Fehler, ${warns} Warnungen, ${findings.filter((x) => x.level === 'ok').length} in Ordnung.`);
console.log('Zusätzlich gegen die echte Datenbank: DATABASE_URL=… npm run db:check');
process.exit(errors ? 1 : 0);
