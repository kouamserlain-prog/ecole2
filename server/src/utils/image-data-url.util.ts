import fs from 'fs/promises';
import path from 'path';
import { APP_BRANDING_ID, getAppBrandingDelegate } from './app-branding-prisma.util';
import { isVercelBlobUrl } from './blob-storage.util';
import { brandingIdForSchool } from './school-context.util';
import { localPathFromUploadUrl } from './upload-file-path.util';

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

function mimeFromBuffer(buf: Buffer, ext?: string): string {
  if (ext && MIME_BY_EXT[ext]) return MIME_BY_EXT[ext];
  if (buf.length >= 2 && buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (
    buf.length >= 12 &&
    buf.slice(0, 4).toString() === 'RIFF' &&
    buf.slice(8, 12).toString() === 'WEBP'
  ) {
    return 'image/webp';
  }
  return 'application/octet-stream';
}

async function readLocalUpload(stored: string): Promise<{ buffer: Buffer; ext: string } | null> {
  const localPath =
    localPathFromUploadUrl(stored) ??
    (stored.startsWith('/')
      ? localPathFromUploadUrl(`http://localhost${stored}`)
      : null);
  if (!localPath) return null;
  const buffer = await fs.readFile(localPath);
  return { buffer, ext: path.extname(localPath).toLowerCase() };
}

/**
 * Charge une image stockée (Blob, URL HTTP, `/uploads/...`) en data URL pour le PDF côté client.
 */
export async function fetchStoredImageAsDataUrl(
  stored: string | null | undefined,
): Promise<string | null> {
  if (!stored?.trim()) return null;
  const value = stored.trim();
  if (value.startsWith('data:')) return value;

  try {
    let buffer: Buffer | null = null;
    let ext = '';

    const local = await readLocalUpload(value);
    if (local) {
      buffer = local.buffer;
      ext = local.ext;
    } else if (value.startsWith('http://') || value.startsWith('https://') || isVercelBlobUrl(value)) {
      const res = await fetch(value);
      if (!res.ok) return null;
      buffer = Buffer.from(await res.arrayBuffer());
      try {
        ext = path.extname(new URL(value).pathname).toLowerCase();
      } catch {
        ext = '';
      }
      const contentType = res.headers.get('content-type')?.split(';')[0]?.trim();
      if (contentType?.startsWith('image/') && buffer.length > 0) {
        return `data:${contentType};base64,${buffer.toString('base64')}`;
      }
    }

    if (!buffer || buffer.length === 0) return null;
    const mime = mimeFromBuffer(buffer, ext);
    if (!mime.startsWith('image/')) return null;
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

/** Logo navigation / connexion en data URL (fetch serveur, sans CORS navigateur). */
export async function fetchBrandingLogoDataUrl(schoolId?: string | null): Promise<string | null> {
  const delegate = getAppBrandingDelegate();
  if (!delegate) return null;
  const brandingId = schoolId ? await brandingIdForSchool(schoolId) : APP_BRANDING_ID;
  const row = await delegate.findUnique({ where: { id: brandingId } });
  const logoUrl = row?.loginLogoUrl?.trim() || row?.navigationLogoUrl?.trim() || null;
  return fetchStoredImageAsDataUrl(logoUrl);
}
