/**
 * Sicherung prüfen, ohne etwas zurückzuspielen:  npm run backup:verify -- <Sicherungsordner>
 * Manifest-Siegel (HMAC), Prüfsummen von Datenbank-Dump und jeder Datei, Vollständigkeit; mit BACKUP_ENCRYPTION_KEY wird auch der Dump entschlüsselt.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { backupKey, listFiles, macOk, sha256File, type Manifest } from './_backup-lib';

export async function verifyBackup(dir: string): Promise<{ ok: boolean; problems: string[]; manifest: Manifest }> {
  const problems: string[] = [];
  const json = await readFile(path.join(dir, 'manifest.json'), 'utf8');
  const manifest = JSON.parse(json) as Manifest;
  const master = backupKey();
  if (manifest.db.encrypted) {
    if (!master) problems.push('Sicherung ist verschlüsselt, BACKUP_ENCRYPTION_KEY fehlt.');
    else {
      const mac = await readFile(path.join(dir, 'manifest.hmac'), 'utf8').catch(() => '');
      if (!mac || !macOk(json, mac, master)) problems.push('Manifest-Siegel ungültig (falscher Schlüssel oder Manifest verändert).');
    }
  }
  if ((await sha256File(path.join(dir, manifest.db.file)).catch(() => '')) !== manifest.db.sha256) problems.push('Prüfsumme des Datenbank-Dumps stimmt nicht.');
  const present = new Set(await listFiles(path.join(dir, 'objects')));
  for (const [k, m] of Object.entries(manifest.objects.files)) {
    if (!present.has(k)) problems.push(`Datei fehlt in der Sicherung: ${k}`);
    else if ((await sha256File(path.join(dir, 'objects', k))) !== m.sha256) problems.push(`Prüfsumme falsch: ${k}`);
  }
  for (const k of present) if (!(k in manifest.objects.files)) problems.push(`Unerwartete Datei in der Sicherung: ${k}`);
  if (manifest.objects.missing.length) problems.push(`Schon beim Sichern fehlten ${manifest.objects.missing.length} Dateien im Speicher.`);
  return { ok: problems.length === 0, problems, manifest };
}

if (process.argv[1]?.endsWith('backup-verify.ts')) {
  const dir = process.argv[2];
  if (!dir) { console.error('Aufruf: npm run backup:verify -- <Sicherungsordner>'); process.exit(2); }
  verifyBackup(path.resolve(dir)).then((r) => {
    console.log(`${r.ok ? '✔ Sicherung in Ordnung' : '✖ Sicherung fehlerhaft'} — erstellt ${r.manifest.createdAt}, Datenbank ${r.manifest.source.database}, ${r.manifest.objects.count} Dateien`);
    for (const p of r.problems) console.log('  -', p);
    process.exit(r.ok ? 0 : 1);
  }).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
}
