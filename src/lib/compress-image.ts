/**
 * Verkleinert ein Foto im Browser (längste Kante ≤ 1600 px, JPEG), damit acht
 * Fotos sicher unter das 4,5-MB-Limit von Vercel Functions passen. iPhones
 * liefern bei accept="image/jpeg,image/png,image/webp" bereits JPEG statt HEIC.
 */
export async function compressImage(file: File, index: number, targetBytes = 420_000): Promise<File> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error('unsupported');

  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('unsupported');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  let quality = 0.84;
  let blob: Blob | null = null;
  for (let i = 0; i < 5; i++) {
    blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob || blob.size <= targetBytes) break;
    quality -= 0.08;
  }
  if (!blob) throw new Error('unsupported');
  return new File([blob], `foto-${index}.jpg`, { type: 'image/jpeg' });
}
