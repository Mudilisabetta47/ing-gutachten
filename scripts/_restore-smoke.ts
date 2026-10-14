/** Stichproben nach einer Wiederherstellung (von backup-drill.mjs aufgerufen): Anmeldung, Foto, Gutachten-PDF – über die echten Anwendungs-Dienste. */
import { db } from '../src/server/db';
import { getStorage } from '../src/server/storage';
import { verifyPassword } from '../src/server/auth/password';
import { KNOWN_DEMO_PASSWORD } from '../src/lib/env';

async function main() {
  const out: string[] = [];
  const user = await db.user.findFirst({ where: { isActive: true, email: { endsWith: '@demo.ing.test' } } });
  if (!user) throw new Error('kein aktives Konto');
  out.push(`Anmeldung: Passwortprüfung ${(await verifyPassword(user.passwordHash, KNOWN_DEMO_PASSWORD)) ? 'ok' : 'FEHLER'}`);
  const storage = getStorage();
  if (!storage) throw new Error('Speicher nicht konfiguriert');
  const photo = await db.media.findFirst({ where: { mimeType: { in: ['image/jpeg', 'image/png'] } } });
  if (photo) { const b = await storage.get(photo.storageKey); out.push(`Foto: ${b && b.length === photo.sizeBytes ? 'ok' : 'FEHLER'} (${b?.length ?? 0} Bytes entschlüsselt)`); }
  const pdf = await db.media.findFirst({ where: { mimeType: 'application/pdf' } });
  if (pdf) { const b = await storage.get(pdf.storageKey); out.push(`PDF: ${b && Buffer.from(b.subarray(0, 5)).toString() === '%PDF-' ? 'ok' : 'FEHLER'} (${b?.length ?? 0} Bytes)`); }
  else out.push('PDF: (keines in den Übungsdaten)');
  const cases = await db.case.count();
  out.push(`Fälle: ${cases}`);
  console.log(out.join('\n'));
  if (out.some((l) => l.includes('FEHLER'))) process.exit(1);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); }).finally(() => db.$disconnect?.());
