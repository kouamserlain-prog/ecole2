import path from 'path';
import { getPublicUploadsUrlPrefix, getUploadsRootDir } from './uploads-path';

/** Convertit une URL publique d’upload en chemin local (null si hors uploads). */
export function localPathFromUploadUrl(fileUrl: string): string | null {
  if (!fileUrl || typeof fileUrl !== 'string') return null;

  const match = fileUrl.match(/\/(?:api\/)?uploads\/(.+)$/i);
  if (match) {
    const rel = match[1].replace(/^\/+/, '');
    if (!rel || rel.includes('..')) return null;
    return path.join(getUploadsRootDir(), rel);
  }

  const prefix = getPublicUploadsUrlPrefix();
  const marker = `${prefix}/`;
  const idx = fileUrl.indexOf(marker);
  if (idx === -1) return null;
  const rel = fileUrl.slice(idx + marker.length).replace(/^\/+/, '');
  if (!rel || rel.includes('..')) return null;
  return path.join(getUploadsRootDir(), rel);
}

export function isPathInsideUploadsRoot(absPath: string): boolean {
  const root = path.resolve(getUploadsRootDir());
  const resolved = path.resolve(absPath);
  return resolved === root || resolved.startsWith(`${root}${path.sep}`);
}
