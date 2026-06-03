import type { InternalAxiosRequestConfig } from 'axios';
import axios from 'axios';
import {
  apiCacheKey,
  loadApiCacheEntry,
  saveApiCacheEntry,
} from './offline-storage';

export { apiCacheKey };

/** Réponses GET mises en cache pour relecture hors ligne (pathname après résolution URL complète). */
const CACHEABLE_PATH_REGEX: RegExp[] = [
  /^\/api\/auth\/me$/,
  /^\/api\/student\/profile$/,
  /^\/api\/student\/grades$/,
  /^\/api\/student\/schedule$/,
  /^\/api\/student\/announcements$/,
  /^\/api\/student\/portal-feed$/,
  /^\/api\/parent\/portal-feed$/,
  /^\/api\/student\/notifications$/,
  /^\/api\/parent\/children$/,
  /^\/api\/parent\/appointments$/,
  /^\/api\/teacher\/profile$/,
  /^\/api\/teacher\/schedule$/,
  /^\/api\/teacher\/appointments$/,
  /^\/api\/educator\/profile$/,
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

function pathnameFromConfig(config: InternalAxiosRequestConfig): string {
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

export async function persistSuccessfulGet(
  config: InternalAxiosRequestConfig,
  data: unknown
): Promise<void> {
  const method = (config.method || 'get').toUpperCase();
  if (method !== 'GET') return;
  const path = pathnameFromConfig(config);
  if (!shouldCacheGet(path)) return;
  const key = apiCacheKey('GET', path);
  await saveApiCacheEntry(key, data);
}

export async function tryServeGetFromOfflineCache(
  config: InternalAxiosRequestConfig,
  err: unknown
): Promise<unknown | null> {
  if (!isNetworkError(err)) return null;
  const method = (config.method || 'get').toUpperCase();
  if (method !== 'GET') return null;
  const path = pathnameFromConfig(config);
  if (!shouldCacheGet(path)) return null;
  const key = apiCacheKey('GET', path);
  const row = await loadApiCacheEntry<unknown>(key);
  return row?.payload ?? null;
}
