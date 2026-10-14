/**
 * Vorabprüfung der Betriebsumgebung (Staging/Produktion) – reine Funktion über die Umgebungsvariablen.
 * Gibt nie Werte aus, nur Befunde. `scripts/preflight.ts` ruft sie auf und setzt den Exit-Code.
 */
export type Finding = { level: 'ok' | 'warn' | 'error'; msg: string };
export type Target = 'staging' | 'production';
type Env = Record<string, string | undefined>;

const WEAK = /^(.)\1+$|changeme|passwort|password|example|beispiel|test|secret|geheim|xxxx|1234|demo/i;
const isWeakSecret = (v: string) => v.length < 32 || WEAK.test(v);
const dbTarget = (url: string) => { try { const u = new URL(url.replace(/^postgres(ql)?:/, 'http:')); return `${u.hostname}:${u.port || '5432'}${u.pathname}`; } catch { return ''; } };

export function evaluatePreflight(env: Env, target: Target, other?: Env): Finding[] {
  const f: Finding[] = [];
  const ok = (m: string) => f.push({ level: 'ok', msg: m });
  const warn = (m: string) => f.push({ level: 'warn', msg: m });
  const err = (m: string) => f.push({ level: 'error', msg: m });
  const need = (cond: boolean, good: string, bad: string, level: 'error' | 'warn' = 'error') => (cond ? ok(good) : level === 'error' ? err(bad) : warn(bad));

  need((env.ING_ENV ?? '').toLowerCase() === target, `ING_ENV=${target}`, `ING_ENV muss „${target}“ sein (ist: ${env.ING_ENV ? 'anderer Wert' : 'nicht gesetzt'}). Ohne das gelten die strengen Regeln (Demo-Sperre, Pflicht-Verschlüsselung) nicht sicher.`);

  // Datenbank
  const db = env.DATABASE_URL ?? '';
  if (!db) err('DATABASE_URL fehlt');
  else {
    const host = dbTarget(db).split(':')[0];
    need(!['localhost', '127.0.0.1', '::1', ''].includes(host), 'Datenbank liegt nicht lokal', 'DATABASE_URL zeigt auf eine lokale Datenbank');
    need(/sslmode=(require|verify-full|verify-ca)/i.test(db), 'Datenbankverbindung verlangt TLS (sslmode)', 'DATABASE_URL ohne sslmode=require – unverschlüsselte Verbindung möglich');
    need(!/^postgres(ql)?:\/\/[^:]+:(password|postgres|admin|123)/i.test(db), 'Datenbankpasswort nicht trivial', 'Datenbankpasswort wirkt trivial');
  }
  need(env.ALLOW_REMOTE_DB !== 'yes', 'ALLOW_REMOTE_DB nicht gesetzt', 'ALLOW_REMOTE_DB=yes ist gesetzt (nur für lokale Wartung gedacht) – entfernen');
  need(env.ALLOW_PRODUCTION_BOOTSTRAP !== 'yes', 'ALLOW_PRODUCTION_BOOTSTRAP nicht (mehr) gesetzt', 'ALLOW_PRODUCTION_BOOTSTRAP=yes ist noch gesetzt – nach der Einrichtung des Inhabers entfernen', 'warn');

  // Speicher
  need((env.STORAGE_DRIVER ?? '').toLowerCase() === 's3', 'Dateispeicher: S3-kompatibel', 'STORAGE_DRIVER muss „s3“ sein (lokal ist auf Vercel/Echtbetrieb verboten)');
  const s3 = ['S3_BUCKET_PRIVATE', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'].every((k) => Boolean(env[k]));
  need(s3, 'S3-Zugang vollständig', 'S3_BUCKET_PRIVATE / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY unvollständig');
  need(!env.STORAGE_LOCAL_DIR, 'kein lokales Speicherverzeichnis gesetzt', 'STORAGE_LOCAL_DIR ist gesetzt – in Staging/Produktion entfernen', 'warn');
  if (env.S3_BUCKET_PRIVATE && env.S3_BUCKET_PUBLIC) need(env.S3_BUCKET_PRIVATE !== env.S3_BUCKET_PUBLIC, 'privater und öffentlicher Bucket sind getrennt', 'S3_BUCKET_PRIVATE und S3_BUCKET_PUBLIC sind identisch – private Unterlagen dürfen nie in einen öffentlichen Bucket');
  const enc = env.STORAGE_ENCRYPTION_KEY ?? '';
  need(enc.length >= 32 && !isWeakSecret(enc), 'STORAGE_ENCRYPTION_KEY gesetzt und stark', 'STORAGE_ENCRYPTION_KEY fehlt, ist zu kurz (<32) oder wirkt schwach – ohne ihn wird in dieser Umgebung nichts gespeichert');
  const mfa = env.MFA_ENCRYPTION_KEY ?? '';
  need(mfa.length >= 32 && !isWeakSecret(mfa), 'MFA_ENCRYPTION_KEY gesetzt und stark', 'MFA_ENCRYPTION_KEY fehlt, ist zu kurz (<32) oder wirkt schwach – Zwei-Faktor-Anmeldung wäre gesperrt');
  if (enc && mfa) need(enc !== mfa, 'Speicher- und 2FA-Schlüssel sind verschieden', 'STORAGE_ENCRYPTION_KEY und MFA_ENCRYPTION_KEY sind identisch – getrennte Schlüssel verwenden');
  need((env.IP_HASH_SALT ?? '').length >= 16, 'IP_HASH_SALT gesetzt', 'IP_HASH_SALT fehlt oder ist kürzer als 16 Zeichen (sonst wird keine Missbrauchserkennung gespeichert)', 'warn');
  need((env.BACKUP_ENCRYPTION_KEY ?? '').length >= 32, 'BACKUP_ENCRYPTION_KEY gesetzt', 'BACKUP_ENCRYPTION_KEY fehlt – Sicherungen würden unverschlüsselt abgelegt', 'warn');

  // Website / Adresse
  const site = env.SITE_URL ?? env.NEXT_PUBLIC_SITE_URL ?? '';
  need(/^https:\/\//.test(site), 'SITE_URL ist https', 'SITE_URL fehlt oder ist nicht https');
  if (target === 'production') need(!/vercel\.app|localhost/.test(site), 'SITE_URL ist die Produktivdomain', 'SITE_URL zeigt auf vercel.app/localhost – Canonicals wären falsch');

  // Mail
  const kind = (env.MAIL_PROVIDER ?? 'brevo').toLowerCase();
  need(kind === 'brevo' || kind === 'resend', `Mail-Anbieter: ${kind}`, `MAIL_PROVIDER „${kind}“ ist in ${target} nicht erlaubt (nur brevo oder resend)`);
  need(Boolean(kind === 'brevo' ? env.BREVO_API_KEY : env.RESEND_API_KEY), 'API-Schlüssel des Mail-Anbieters gesetzt', 'API-Schlüssel des Mail-Anbieters fehlt');
  need(Boolean(env.MAIL_FROM && env.MAIL_TO), 'MAIL_FROM und MAIL_TO gesetzt', 'MAIL_FROM/MAIL_TO fehlen');
  need(env.ALLOW_PREVIEW_DRY_RUN !== 'true' || target === 'staging', 'Dry-Run ist nicht freigeschaltet', 'ALLOW_PREVIEW_DRY_RUN=true in Produktion – entfernen');
  const allow = (env.MAIL_ALLOWED_RECIPIENTS ?? '').trim();
  if (target === 'staging') {
    need(allow.length > 0, 'Staging: Empfänger-Positivliste gesetzt', 'Staging braucht MAIL_ALLOWED_RECIPIENTS (nur freigegebene Testadressen)');
    if (allow && env.MAIL_TO) need(allow.toLowerCase().split(',').map((x) => x.trim()).some((a) => (a.startsWith('@') ? env.MAIL_TO!.toLowerCase().endsWith(a) : env.MAIL_TO!.toLowerCase() === a)), 'MAIL_TO ist freigegeben', 'MAIL_TO steht nicht in MAIL_ALLOWED_RECIPIENTS');
  } else if (allow) warn('MAIL_ALLOWED_RECIPIENTS ist in Produktion gesetzt – echte Kunden-Mails würden blockiert; nur beabsichtigt, wenn noch im Testbetrieb');

  // Überwachung
  need(/^https:\/\//.test(env.ALERT_WEBHOOK_URL ?? ''), 'Alarm-Webhook (https) gesetzt', 'ALERT_WEBHOOK_URL fehlt – Fehler lösen keinen Alarm aus (nur Log)', 'warn');
  need((env.HEALTH_TOKEN ?? '').length >= 16, 'HEALTH_TOKEN gesetzt (Detail-Gesundheitsprüfung möglich)', 'HEALTH_TOKEN fehlt (<16 Zeichen) – Überwachung sieht nur „ok/degraded“', 'warn');

  // Anmeldung
  const maxTry = Number(env.LOGIN_MAX_ATTEMPTS ?? 5);
  need(maxTry >= 1 && maxTry <= 10, `Login-Sperre nach ${maxTry} Fehlversuchen`, `LOGIN_MAX_ATTEMPTS=${env.LOGIN_MAX_ATTEMPTS} ist zu großzügig (höchstens 10)`);
  need(Number(env.SESSION_HOURS ?? 12) <= 24 && Number(env.SESSION_MAX_DAYS ?? 7) <= 14, 'Sitzungsdauer im vernünftigen Rahmen', 'SESSION_HOURS (>24) oder SESSION_MAX_DAYS (>14) zu lang', 'warn');

  // Geheimnisse dürfen nie im Browser landen
  const leaky = Object.keys(env).filter((k) => /^NEXT_PUBLIC_/.test(k) && /(KEY|SECRET|TOKEN|PASSWORD|SALT)/i.test(k));
  need(leaky.length === 0, 'Keine Geheimnisse in NEXT_PUBLIC_*-Variablen', `Geheimnis-artige Variablen mit NEXT_PUBLIC_ (landen im Browser!): ${leaky.join(', ')}`);

  // Vergleich mit der anderen Umgebung: nichts teilen
  if (other) {
    const same: string[] = [];
    if (dbTarget(env.DATABASE_URL ?? '') && dbTarget(env.DATABASE_URL ?? '') === dbTarget(other.DATABASE_URL ?? '')) same.push('Datenbank');
    for (const k of ['S3_BUCKET_PRIVATE', 'STORAGE_ENCRYPTION_KEY', 'MFA_ENCRYPTION_KEY', 'IP_HASH_SALT', 'HEALTH_TOKEN', 'BACKUP_ENCRYPTION_KEY', 'S3_ACCESS_KEY_ID']) if (env[k] && env[k] === other[k]) same.push(k);
    need(same.length === 0, 'Staging und Produktion teilen nichts (Datenbank, Bucket, Schlüssel getrennt)', `Mit der anderen Umgebung identisch: ${same.join(', ')} – getrennt halten`);
  }
  return f;
}
