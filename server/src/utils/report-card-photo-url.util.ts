import { isVercelBlobUrl } from './blob-storage.util';
import { resolveStoredFileAccessUrl } from './upload-access-token.util';

/**
 * URL photo utilisable par le front (PDF bulletin) : chemin relatif `/uploads/...`,
 * jeton pour pièces d'identité, ou URL Blob publique.
 */
export function reportCardClientPhotoUrl(stored: string | null | undefined): string | null {
  if (!stored?.trim()) return null;
  const value = stored.trim();
  if (value.startsWith('data:') || value.startsWith('blob:')) return value;
  if (isVercelBlobUrl(value)) return value;

  let pathname = value;
  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      pathname = new URL(value).pathname;
    } catch {
      return resolveStoredFileAccessUrl(value);
    }
  }

  if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  pathname = pathname.replace(/^\/api\/uploads/i, '/uploads');

  if (pathname.includes('/identity-documents/')) {
    return resolveStoredFileAccessUrl(pathname);
  }
  if (pathname.includes('/uploads/')) {
    return pathname;
  }

  return resolveStoredFileAccessUrl(value);
}
