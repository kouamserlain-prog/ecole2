import type { InternalAxiosRequestConfig } from 'axios';
import axios from 'axios';
import {
  deleteSyncBlobs,
  loadSyncBlob,
  loadSyncQueueItems,
  saveSyncBlob,
  saveSyncQueueItems,
  type SyncQueueItem,
} from './offline-storage';
import {
  buildFormDataFromParts,
  collectBlobKeys,
  extractFormDataParts,
  normalizeQueueBody,
  type SyncQueueBody,
} from './offline-formdata';

export const SKIP_OFFLINE_QUEUE_HEADER = 'X-Skip-Offline-Queue';
export const OFFLINE_QUEUED_FLAG = '__offlineQueued';
export const SYNC_QUEUE_CHANGED_EVENT = 'offline-sync-changed';
export const SYNC_QUEUE_QUEUED_EVENT = 'offline-sync-queued';

const MUTABLE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const MAX_QUEUE_SIZE = 200;
const MAX_RETRIES = 5;
const MAX_SYNC_FILE_BYTES = 15 * 1024 * 1024;

const EXCLUDED_PATH_REGEX: RegExp[] = [
  /^\/api\/auth\//,
  /^\/auth\//,
  /\/health$/,
  /\/backup/,
  /\/restore/,
];

let queueLock: Promise<void> = Promise.resolve();
let flushing = false;

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
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

function withQueueLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queueLock.then(fn);
  queueLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function emitSyncChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SYNC_QUEUE_CHANGED_EVENT));
}

function emitQueued(item: SyncQueueItem): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SYNC_QUEUE_QUEUED_EVENT, { detail: item }));
}

export function labelFromMutation(path: string, method: string): string {
  const verbs: Record<string, string> = {
    POST: 'Création',
    PUT: 'Mise à jour',
    PATCH: 'Modification',
    DELETE: 'Suppression',
  };
  const verb = verbs[method.toUpperCase()] || method;
  const clean = path.split('?')[0] ?? path;
  if (/\/upload\//i.test(clean)) {
    const segment = clean.split('/').filter(Boolean).pop() ?? 'fichier';
    return `Envoi fichier — ${segment.replace(/-/g, ' ')}`;
  }
  const segments = clean.split('/').filter(Boolean);
  const last = segments[segments.length - 1] ?? 'données';
  const resource = /^[a-f0-9-]{20,}$/i.test(last)
    ? (segments[segments.length - 2] ?? 'élément')
    : last;
  return `${verb} — ${resource.replace(/-/g, ' ')}`;
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeQueuePath(path: string): string {
  const withoutHost = path.replace(/^https?:\/\/[^/]+/i, '');
  if (withoutHost.startsWith('/api/')) return withoutHost.slice(4);
  if (withoutHost === '/api') return '/';
  return withoutHost.startsWith('/') ? withoutHost : `/${withoutHost}`;
}

export function isMutableMethod(method?: string): boolean {
  return MUTABLE_METHODS.has((method || 'GET').toUpperCase());
}

export function shouldQueueMutation(config: InternalAxiosRequestConfig): boolean {
  const method = (config.method || 'GET').toUpperCase();
  if (!isMutableMethod(method)) return false;

  const headers = config.headers;
  const skip =
    (headers &&
      (typeof headers.get === 'function'
        ? headers.get(SKIP_OFFLINE_QUEUE_HEADER)
        : (headers as Record<string, string>)[SKIP_OFFLINE_QUEUE_HEADER])) ||
    (config as InternalAxiosRequestConfig & { __skipOfflineQueue?: boolean }).__skipOfflineQueue;
  if (skip) return false;

  const path = normalizeQueuePath(pathnameFromConfig(config));
  return !EXCLUDED_PATH_REGEX.some((re) => re.test(path));
}

function snapshotHeaders(config: InternalAxiosRequestConfig): Record<string, string> {
  const out: Record<string, string> = {};
  const h = config.headers;
  if (!h) return out;

  const pick = (key: string) => {
    let v: unknown;
    if (typeof (h as { get?: (k: string) => unknown }).get === 'function') {
      v = (h as { get: (k: string) => unknown }).get(key);
    } else {
      v = (h as Record<string, unknown>)[key];
    }
    if (typeof v === 'string' && v.trim()) out[key] = v;
  };

  pick('Authorization');
  pick('X-School-Id');
  if (!(config.data instanceof FormData)) {
    pick('Content-Type');
  }
  return out;
}

async function serializeRequestBody(
  data: unknown,
  queueItemId: string,
): Promise<SyncQueueBody | undefined> {
  if (data === undefined || data === null) return undefined;
  if (!(typeof FormData !== 'undefined' && data instanceof FormData)) {
    return { kind: 'json', data };
  }

  const { fields, files } = extractFormDataParts(data, queueItemId);
  const savedKeys: string[] = [];
  try {
    for (const entry of files) {
      if (entry.meta.size > MAX_SYNC_FILE_BYTES) {
        throw new Error(
          `Fichier trop volumineux (${entry.meta.fileName}, max ${Math.round(MAX_SYNC_FILE_BYTES / (1024 * 1024))} Mo).`,
        );
      }
      await saveSyncBlob(entry.meta.blobKey, entry.blob);
      savedKeys.push(entry.meta.blobKey);
    }
  } catch (error) {
    await deleteSyncBlobs(savedKeys);
    throw error;
  }

  return {
    kind: 'multipart',
    fields,
    files: files.map((entry) => entry.meta),
  };
}

async function deserializeRequestBody(body: SyncQueueBody | undefined): Promise<unknown> {
  const normalized = normalizeQueueBody(body);
  if (!normalized) return undefined;
  if (normalized.kind === 'json') return normalized.data;

  return buildFormDataFromParts(normalized.fields, normalized.files, loadSyncBlob);
}

async function deleteItemBlobs(item: SyncQueueItem): Promise<void> {
  const keys = collectBlobKeys(normalizeQueueBody(item.body));
  if (keys.length > 0) {
    await deleteSyncBlobs(keys);
  }
}

export function buildQueuedResponse(item: SyncQueueItem): Record<string, unknown> {
  const isUpload = item.body?.kind === 'multipart';
  return {
    [OFFLINE_QUEUED_FLAG]: true,
    queueId: item.id,
    label: item.label,
    message: isUpload
      ? 'Fichier enregistré localement. Envoi automatique à la reconnexion.'
      : 'Modification enregistrée localement. Synchronisation automatique à la reconnexion.',
  };
}

export function isOfflineQueuedPayload(data: unknown): data is Record<string, unknown> {
  return Boolean(data && typeof data === 'object' && OFFLINE_QUEUED_FLAG in data);
}

export async function getSyncQueueStatus(): Promise<{
  pending: number;
  failed: number;
  syncing: boolean;
  items: SyncQueueItem[];
}> {
  const items = await loadSyncQueueItems();
  return {
    pending: items.filter((i) => i.status === 'pending').length,
    failed: items.filter((i) => i.status === 'failed').length,
    syncing: flushing,
    items,
  };
}

export async function enqueueFromConfig(
  config: InternalAxiosRequestConfig,
): Promise<SyncQueueItem> {
  return withQueueLock(async () => {
    const items = await loadSyncQueueItems();
    if (items.length >= MAX_QUEUE_SIZE) {
      throw new Error('File de synchronisation pleine. Reconnectez-vous pour vider la file.');
    }

    const method = (config.method || 'POST').toUpperCase() as SyncQueueItem['method'];
    const path = normalizeQueuePath(pathnameFromConfig(config));
    const id = randomId();
    const body = await serializeRequestBody(config.data, id);
    const item: SyncQueueItem = {
      id,
      method,
      path,
      body,
      headers: snapshotHeaders(config),
      label: labelFromMutation(path, method),
      createdAt: Date.now(),
      status: 'pending',
      retries: 0,
    };

    items.push(item);
    await saveSyncQueueItems(items);
    emitQueued(item);
    emitSyncChanged();
    return item;
  });
}

function isPermanentHttpError(status?: number): boolean {
  if (!status) return false;
  return status === 400 || status === 401 || status === 403 || status === 404 || status === 409 || status === 422;
}

async function executeQueueItem(
  item: SyncQueueItem,
  baseURL: string,
): Promise<void> {
  const data = await deserializeRequestBody(item.body);
  const headers: Record<string, string> = {
    ...item.headers,
    [SKIP_OFFLINE_QUEUE_HEADER]: '1',
  };
  const isMultipart = item.body?.kind === 'multipart';
  if (isMultipart) {
    delete headers['Content-Type'];
    delete headers['content-type'];
  } else if (!headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/json';
  }

  await axios({
    baseURL,
    method: item.method,
    url: normalizeQueuePath(item.path),
    data,
    headers,
  });
}

export async function flushSyncQueue(baseURL: string): Promise<{
  synced: number;
  failed: number;
  remaining: number;
}> {
  if (typeof window === 'undefined') {
    return { synced: 0, failed: 0, remaining: 0 };
  }
  if (flushing || isOffline()) {
    const status = await getSyncQueueStatus();
    return { synced: 0, failed: status.failed, remaining: status.pending };
  }

  flushing = true;
  emitSyncChanged();

  let synced = 0;
  let failed = 0;

  try {
    await withQueueLock(async () => {
      let items = await loadSyncQueueItems();
      const pending = items.filter((i) => i.status === 'pending');

      for (const item of pending) {
        item.status = 'syncing';
        await saveSyncQueueItems(items);
        emitSyncChanged();

        try {
          await executeQueueItem(item, baseURL);
          await deleteItemBlobs(item);
          items = items.filter((i) => i.id !== item.id);
          await saveSyncQueueItems(items);
          synced += 1;
        } catch (err) {
          const status = axios.isAxiosError(err) ? err.response?.status : undefined;
          const message =
            (axios.isAxiosError(err) && (err.response?.data as { error?: string })?.error) ||
            (err instanceof Error ? err.message : 'Erreur de synchronisation');

          item.retries += 1;
          if (isPermanentHttpError(status) || item.retries >= MAX_RETRIES) {
            item.status = 'failed';
            item.error = message;
            failed += 1;
          } else {
            item.status = 'pending';
          }
          const idx = items.findIndex((i) => i.id === item.id);
          if (idx >= 0) items[idx] = item;
          await saveSyncQueueItems(items);

          if (!isPermanentHttpError(status) && item.retries < MAX_RETRIES) {
            break;
          }
        }
      }
    });
  } finally {
    flushing = false;
    emitSyncChanged();
  }

  const status = await getSyncQueueStatus();
  return { synced, failed, remaining: status.pending };
}

export async function retryFailedSyncItems(baseURL: string): Promise<void> {
  await withQueueLock(async () => {
    const items = await loadSyncQueueItems();
    let changed = false;
    for (const item of items) {
      if (item.status === 'failed') {
        item.status = 'pending';
        item.error = undefined;
        item.retries = 0;
        changed = true;
      }
    }
    if (changed) {
      await saveSyncQueueItems(items);
      emitSyncChanged();
    }
  });
  await flushSyncQueue(baseURL);
}

export async function removeSyncQueueItem(id: string): Promise<void> {
  await withQueueLock(async () => {
    const items = await loadSyncQueueItems();
    const removed = items.filter((i) => i.id === id);
    const next = items.filter((i) => i.id !== id);
    if (next.length !== items.length) {
      await Promise.all(removed.map((item) => deleteItemBlobs(item)));
      await saveSyncQueueItems(next);
      emitSyncChanged();
    }
  });
}

export async function clearFailedSyncItems(): Promise<void> {
  await withQueueLock(async () => {
    const items = await loadSyncQueueItems();
    const failed = items.filter((i) => i.status === 'failed');
    const next = items.filter((i) => i.status !== 'failed');
    if (next.length !== items.length) {
      await Promise.all(failed.map((item) => deleteItemBlobs(item)));
      await saveSyncQueueItems(next);
      emitSyncChanged();
    }
  });
}
