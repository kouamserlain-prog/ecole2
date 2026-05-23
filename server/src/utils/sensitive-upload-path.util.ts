/** Dossiers d’uploads ne devant jamais être servis sans contrôle d’accès. */
const SENSITIVE_UPLOAD_SEGMENTS = [
  '/identity-documents/',
  '/admission-documents/',
  '/teacher-admin-documents/',
] as const;

export function normalizeUploadRequestPath(urlPath: string): string {
  const decoded = decodeURIComponent(urlPath).replace(/\\/g, '/');
  const lower = decoded.toLowerCase();
  if (lower.includes('..')) return '';
  return decoded.startsWith('/') ? decoded : `/${decoded}`;
}

export function isSensitiveUploadPath(urlPath: string): boolean {
  const norm = normalizeUploadRequestPath(urlPath).toLowerCase();
  if (!norm || norm.includes('..')) return true;
  return SENSITIVE_UPLOAD_SEGMENTS.some((seg) => norm.includes(seg));
}

/** Extrait le chemin relatif `/uploads/...` depuis une URL stockée en base. */
export function uploadRelativePathFromStoredUrl(stored: string): string | null {
  if (!stored?.trim()) return null;
  try {
    if (stored.startsWith('http://') || stored.startsWith('https://')) {
      const u = new URL(stored);
      return normalizeUploadRequestPath(u.pathname);
    }
  } catch {
    /* chemin relatif */
  }
  const path = stored.startsWith('/') ? stored : `/${stored}`;
  const normalized = normalizeUploadRequestPath(path);
  if (!normalized.includes('/uploads/')) return null;
  return normalized;
}
