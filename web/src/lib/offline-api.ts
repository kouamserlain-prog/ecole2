import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import axios from 'axios';
import {
  apiCacheKey,
  loadApiCacheEntry,
  saveApiCacheEntry,
} from './offline-storage';
import {
  buildQueuedResponse,
  enqueueFromConfig,
  isMutableMethod,
  shouldQueueMutation,
} from './offline-sync-queue';

export { apiCacheKey };

/** Réponses GET mises en cache pour relecture hors ligne (pathname après résolution URL complète). */
const CACHEABLE_PATH_REGEX: RegExp[] = [
  /^\/api\/auth\/me$/,
  /^\/api\/public\/app-branding/,
  /^\/api\/public\/schools$/,
  /^\/api\/student\//,
  /^\/api\/parent\//,
  /^\/api\/teacher\//,
  /^\/api\/educator\//,
  /^\/api\/admin\/schools$/,
  /^\/api\/admin\/schools\/manage$/,
  /^\/api\/admin\/workspaces\/my-context$/,
  /^\/api\/staff\/schools$/,
];

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function isNetworkError(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return (
    e?.code === 'ERR_NETWORK' ||
    e?.code === 'ECONNREFUSED' ||
    e?.message === 'Network Error'
  );
}

export function pathnameFromConfig(config: InternalAxiosRequestConfig): string {
  try {
    const uri = axios.getUri(config);
    const u = new URL(uri, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    return `${u.pathname}${u.search}`;
  } catch {
    const base = config.baseURL || '';
    const p = config.url || '';
    return `${base}${p}`.replace(/^https?:\/\/[^/]+/i, '');
  }
}

export function shouldCacheGet(pathnameWithSearch: string): boolean {
  return CACHEABLE_PATH_REGEX.some((re) => re.test(pathnameWithSearch));
}

/** Supprime les réponses GET mises en cache (ex. après modification de l’emploi du temps). */
export async function clearOfflineApiCachePaths(pathnames: string[]): Promise<void> {
  const { clearApiCacheEntry } = await import('./offline-storage');
  await Promise.all(
    pathnames.map((path) => clearApiCacheEntry(apiCacheKey('GET', path))),
  );
}

export async function loadCachedGetPayload(pathnameWithSearch: string): Promise<unknown | null> {
  if (!shouldCacheGet(pathnameWithSearch)) return null;
  const row = await loadApiCacheEntry<unknown>(apiCacheKey('GET', pathnameWithSearch));
  return row?.payload ?? null;
}

export async function persistSuccessfulGet(
  config: InternalAxiosRequestConfig,
  data: unknown,
): Promise<void> {
  const method = (config.method || 'get').toUpperCase();
  if (method !== 'GET') return;
  const path = pathnameFromConfig(config);
  if (!shouldCacheGet(path)) return;
  const key = apiCacheKey('GET', path);
  await saveApiCacheEntry(key, data);
}

/** Sert immédiatement le cache quand le navigateur est hors ligne (évite les timeouts réseau). */
export async function offlineGetAdapterIfAvailable(
  config: InternalAxiosRequestConfig,
): Promise<AxiosAdapter | null> {
  if (!isOffline()) return null;
  const method = (config.method || 'get').toUpperCase();
  if (method !== 'GET') return null;
  const path = pathnameFromConfig(config);
  const payload = await loadCachedGetPayload(path);
  if (payload === null) return null;

  return async (cfg) => ({
    data: payload,
    status: 200,
    statusText: 'OK (cache hors ligne)',
    headers: {},
    config: cfg,
  });
}

/** Met en file d’attente les mutations hors ligne et renvoie une réponse locale immédiate. */
export async function offlineMutationAdapterIfAvailable(
  config: InternalAxiosRequestConfig,
): Promise<AxiosAdapter | null> {
  if (!isOffline()) return null;
  if (!isMutableMethod(config.method) || !shouldQueueMutation(config)) return null;

  return async (cfg) => {
    const item = await enqueueFromConfig(cfg);
    return {
      data: buildQueuedResponse(item),
      status: 202,
      statusText: 'Accepted (file hors ligne)',
      headers: {},
      config: cfg,
    };
  };
}

export async function tryQueueMutationOnNetworkError(
  config: InternalAxiosRequestConfig,
  err: unknown,
): Promise<{ data: Record<string, unknown>; status: number } | null> {
  if (!isMutableMethod(config.method) || !shouldQueueMutation(config)) return null;
  if (!isNetworkError(err)) return null;
  if ((config as InternalAxiosRequestConfig & { __offlineQueueAttempted?: boolean }).__offlineQueueAttempted) {
    return null;
  }
  (config as InternalAxiosRequestConfig & { __offlineQueueAttempted?: boolean }).__offlineQueueAttempted = true;
  const item = await enqueueFromConfig(config);
  return {
    data: buildQueuedResponse(item),
    status: 202,
  };
}

export async function tryServeGetFromOfflineCache(
  config: InternalAxiosRequestConfig,
  err: unknown,
): Promise<unknown | null> {
  const method = (config.method || 'get').toUpperCase();
  if (method !== 'GET') return null;
  const path = pathnameFromConfig(config);
  if (!shouldCacheGet(path)) return null;
  if (!isNetworkError(err) && !isOffline()) return null;
  return loadCachedGetPayload(path);
}
