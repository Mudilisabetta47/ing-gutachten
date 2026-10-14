/**
 * Erzeugt frische Zufallsschlüssel für die Umgebung (Ausgabe NUR auf dem Bildschirm – es wird nichts gespeichert).
 * In den Passwortmanager der Geschäftsführung und anschließend in die Umgebungsvariablen von Vercel eintragen.
 *   node scripts/generate-secrets.mjs
 */
import { randomBytes } from 'node:crypto';
const b64 = (n) => randomBytes(n).toString('base64url');
console.log('# Pro Umgebung (Staging und Produktion) EIGENE Werte verwenden – nie dieselben Schlüssel teilen.');
console.log('# Diese Zeilen nirgends einchecken, nicht in Tickets/Chats einfügen.\n');
console.log(`MFA_ENCRYPTION_KEY=${b64(32)}`);
console.log(`STORAGE_ENCRYPTION_KEY=${b64(32)}`);
console.log(`IP_HASH_SALT=${b64(24)}`);
console.log(`HEALTH_TOKEN=${b64(24)}`);
console.log(`BACKUP_ENCRYPTION_KEY=${b64(32)}`);
console.log('\n# Verlust von MFA_ENCRYPTION_KEY: 2FA muss für alle Konten zurückgesetzt werden.');
console.log('# Verlust von STORAGE_ENCRYPTION_KEY: Fotos/Dokumente sind NICHT wiederherstellbar → Schlüssel zusätzlich offline sichern (Tresor/zwei Personen).');
console.log('# Verlust von BACKUP_ENCRYPTION_KEY: verschlüsselte Sicherungen sind unlesbar.');
