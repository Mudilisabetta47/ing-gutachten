import 'server-only';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { STORAGE_KEY_RE, StorageError, type StorageDriver } from './types';

/** Dateisystem-Speicher für Entwicklung und Tests. Verweigert Pfade außerhalb des Wurzelverzeichnisses. */
export function localDriver(root = process.env.STORAGE_LOCAL_DIR || path.join(process.cwd(), '.data', 'private')): StorageDriver {
  const base = path.resolve(root);
  const resolve = (key: string) => {
    if (!STORAGE_KEY_RE.test(key) || key.includes('..') || key.includes('//')) throw new StorageError('Ungültiger Speicherschlüssel.');
    const full = path.resolve(base, key);
    if (!full.startsWith(base + path.sep)) throw new StorageError('Ungültiger Speicherpfad.');
    return full;
  };
  return {
    id: 'local',
    async put(key, bytes) {
      const file = resolve(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, bytes, { flag: 'wx' }); // nie überschreiben
    },
    async get(key) {
      try {
        return new Uint8Array(await readFile(resolve(key)));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw e;
      }
    },
    async delete(key) {
      await rm(resolve(key), { force: true });
    },
    async exists(key) {
      try {
        await stat(resolve(key));
        return true;
      } catch {
        return false;
      }
    },
    async signedUrl() {
      return null;
    },
  };
}
