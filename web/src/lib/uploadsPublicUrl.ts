/**
 * Origine HTTP(S) du serveur qui expose `GET /uploads/...` (Express, même hôte que l’API en général).
 *
 * En production, si `NEXT_PUBLIC_API_URL` est **relatif** (`/api`), les images ne peuvent pas être
 * résolues vers le bon hôte sans l’une des options suivantes :
 * - **Même domaine** (reverse proxy) : `NEXT_PUBLIC_API_URL=/api`, pas de `NEXT_PUBLIC_UPLOADS_ORIGIN`
 *   — le navigateur charge `https://votre-domaine/uploads/...` (nginx route vers Express).
 * - **API sur un autre hôte** : `NEXT_PUBLIC_UPLOADS_ORIGIN` (ex. `https://api.votredomaine.com`) ;
 * - ou **`NEXT_PUBLIC_API_URL`** en URL absolue (ex. `https://api.votredomaine.com/api`) ;
 * - ou un **rewrite** Next (`next.config`) vers l’API si le front ne reçoit pas directement `/uploads`
 *   (désactivable avec `NEXT_PUBLIC_DISABLE_UPLOADS_REWRITE=1` si même hôte que l’API).
 * - **Vercel experimentalServices** (Express uniquement sous `/api`) : URLs publiques `/api/uploads/...`
 *   côté serveur ; `NEXT_PUBLIC_EXPRESS_UPLOADS_VIA_API_PREFIX=1` réécrit les anciennes URLs `/uploads/...`.
 */

function trimSlash(s: string): string {
  return s.replace(/\/+$/, '').trim();
}

/** Anciennes entrées BDD `/uploads/...` sur déploiement Vercel + Express sous `/api`. */
function normalizeUploadedAssetPathForClient(relativePath: string): string {
  if (
    relativePath.startsWith('/uploads/') &&
    process.env.NEXT_PUBLIC_EXPRESS_UPLOADS_VIA_API_PREFIX === '1'
  ) {
    return `/api${relativePath}`;
  }
  /** Dev local : Express sert `/uploads` ; normalise les URLs enregistrées en `/api/uploads`. */
  if (
    relativePath.startsWith('/api/uploads/') &&
    process.env.NEXT_PUBLIC_EXPRESS_UPLOADS_VIA_API_PREFIX !== '1'
  ) {
    return relativePath.replace(/^\/api/, '');
  }
  return relativePath;
}

/** Origine des uploads en SSR (layout, métadonnées) — sans `window`. */
export function getServerOriginForUploads(): string {
  const uploadsOrigin = trimSlash(process.env.NEXT_PUBLIC_UPLOADS_ORIGIN || '');
  if (uploadsOrigin.startsWith('http://') || uploadsOrigin.startsWith('https://')) {
    return uploadsOrigin;
  }

  const api = trimSlash(process.env.NEXT_PUBLIC_API_URL || '');
  if (api.startsWith('http://') || api.startsWith('https://')) {
    const withoutApi = api.replace(/\/api\/?$/i, '');
    const base = trimSlash(withoutApi);
    return base.length > 0 ? base : trimSlash(api);
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}`;
  }

  return 'http://localhost:5000';
}

export function resolveUploadPublicUrlForServer(relativePath: string | null | undefined): string | null {
  if (!relativePath) return null;
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }
  const origin = getServerOriginForUploads();
  const path = normalizeUploadedAssetPathForClient(
    relativePath.startsWith('/') ? relativePath : `/${relativePath}`,
  );
  return `${origin}${path}`;
}

export function getApiOriginForUploads(): string {
  const uploadsOrigin = trimSlash(process.env.NEXT_PUBLIC_UPLOADS_ORIGIN || '');
  if (uploadsOrigin.startsWith('http://') || uploadsOrigin.startsWith('https://')) {
    return uploadsOrigin;
  }

  const api = trimSlash(process.env.NEXT_PUBLIC_API_URL || '');
  if (api.startsWith('http://') || api.startsWith('https://')) {
    const withoutApi = api.replace(/\/api\/?$/i, '');
    const base = trimSlash(withoutApi);
    return base.length > 0 ? base : trimSlash(api);
  }

  if (typeof window !== 'undefined') {
    const base =
      api ||
      (process.env.VERCEL ? `${window.location.origin}/api` : 'http://localhost:5000/api');
    if (base.startsWith('/')) {
      // Même origine que le front : les fichiers passent par le rewrite `/uploads` → backend (next.config).
      return trimSlash(window.location.origin);
    }
    if (base.startsWith('http://') || base.startsWith('https://')) {
      return trimSlash(base.replace(/\/api\/?$/i, '')) || trimSlash(window.location.origin);
    }
    return trimSlash(window.location.origin);
  }

  // SSR / build : pas de `window` — exiger une URL absolue API ou NEXT_PUBLIC_UPLOADS_ORIGIN en prod.
  return 'http://localhost:5000';
}

export function resolveUploadPublicUrl(relativePath: string | null | undefined): string | null {
  if (!relativePath) return null;
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }
  const origin = getApiOriginForUploads();
  const path = normalizeUploadedAssetPathForClient(
    relativePath.startsWith('/') ? relativePath : `/${relativePath}`,
  );
  return `${origin}${path}`;
}

/**
 * URL pour charger une image côté navigateur (PDF, canvas).
 * Réécrit l'hôte des URLs `/uploads/...` vers l'origine courante (proxy Next en dev).
 */
export function resolveUploadFetchUrl(storedUrl: string | null | undefined): string | null {
  if (!storedUrl) return null;
  if (storedUrl.startsWith('data:') || storedUrl.startsWith('blob:')) {
    return storedUrl;
  }

  let pathname = '';
  let search = '';

  if (storedUrl.startsWith('http://') || storedUrl.startsWith('https://')) {
    try {
      const u = new URL(storedUrl);
      pathname = u.pathname;
      search = u.search;
    } catch {
      return storedUrl;
    }
  } else {
    pathname = storedUrl.startsWith('/') ? storedUrl : `/${storedUrl}`;
  }

  if (!pathname.includes('/uploads/')) {
    return storedUrl.startsWith('http') ? storedUrl : resolveUploadPublicUrl(storedUrl);
  }

  const path = normalizeUploadedAssetPathForClient(pathname);
  return `${getApiOriginForUploads()}${path}${search}`;
}
