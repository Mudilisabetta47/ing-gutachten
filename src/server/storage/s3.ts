import 'server-only';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { STORAGE_KEY_RE, StorageError, type StorageDriver } from './types';

export type S3Config = { endpoint?: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string };

/** S3-kompatibler privater Bucket (R2/S3/MinIO). Bucket darf NICHT öffentlich sein. */
export function s3Driver(cfg: S3Config): StorageDriver {
  const client = new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint || undefined,
    forcePathStyle: Boolean(cfg.endpoint), // R2/MinIO
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  });
  const check = (key: string) => {
    if (!STORAGE_KEY_RE.test(key) || key.includes('..') || key.includes('//')) throw new StorageError('Ungültiger Speicherschlüssel.');
    return key;
  };
  return {
    id: 's3',
    async put(key, bytes, mimeType) {
      await client.send(new PutObjectCommand({ Bucket: cfg.bucket, Key: check(key), Body: bytes, ContentType: mimeType, ServerSideEncryption: undefined }));
    },
    async get(key) {
      try {
        const res = await client.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: check(key) }));
        return res.Body ? await res.Body.transformToByteArray() : null;
      } catch (e) {
        if ((e as { name?: string }).name === 'NoSuchKey') return null;
        throw e;
      }
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: check(key) }));
    },
    async exists(key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: check(key) }));
        return true;
      } catch {
        return false;
      }
    },
    async signedUrl(key, { expiresInSeconds, fileName, mimeType }) {
      const cmd = new GetObjectCommand({
        Bucket: cfg.bucket,
        Key: check(key),
        ResponseContentType: mimeType,
        // Dateiname nur für den Download-Dialog, wird nicht gespeichert
        ResponseContentDisposition: fileName ? `inline; filename="${fileName.replace(/[^\w.\- ]/g, '_')}"` : undefined,
      });
      return getSignedUrl(client, cmd, { expiresIn: Math.min(Math.max(expiresInSeconds, 30), 300) });
    },
  };
}
