import axios, { AxiosHeaders } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import {
  persistSuccessfulGet,
  tryServeGetFromOfflineCache,
} from '@/lib/offline-api';

/**
 * Base URL sans slash final.
 * - Navigateur sur Vercel : même origine `/api` (ou NEXT_PUBLIC_API_URL).
 * - SSR / Node : URL absolue (VERCEL_URL + préfixe, ou localhost:5000 en dev).
 */
const API_URL = (() => {
  const n = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '');
  if (n?.startsWith('http')) return n;
  if (typeof window !== 'undefined') {
    return n || (process.env.VERCEL ? '/api' : 'http://localhost:5000/api');
  }
  if (process.env.VERCEL_URL) {
    const path = n?.startsWith('/') ? n : '/api';
    return `https://${process.env.VERCEL_URL}${path}`;
  }
  if (n?.startsWith('/')) {
    return `http://localhost:5000${n}`;
  }
  return n || 'http://localhost:5000/api';
})();

const PUBLIC_AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password'];

function isPublicAuthRequest(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split('?')[0];
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return PUBLIC_AUTH_PATHS.some((p) => normalized === p || normalized.endsWith(p));
}

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur : multipart (FormData) ne doit pas garder Content-Type: application/json
api.interceptors.request.use((config) => {
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    const h = config.headers;
    if (h instanceof AxiosHeaders) {
      h.delete('Content-Type');
    } else if (h && typeof h === 'object') {
      delete (h as Record<string, unknown>)['Content-Type'];
      delete (h as Record<string, unknown>)['content-type'];
    }
  }
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token && !isPublicAuthRequest(config.url)) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (typeof window !== 'undefined') {
    const schoolId = localStorage.getItem('activeSchoolId');
    if (schoolId) {
      if (config.headers instanceof AxiosHeaders) {
        config.headers.set('X-School-Id', schoolId);
      } else {
        config.headers = config.headers ?? {};
        (config.headers as Record<string, string>)['X-School-Id'] = schoolId;
      }
    }
  }
  return config;
});

// Réponses : mise en cache des GET essentiels pour le mode hors ligne
api.interceptors.response.use(
  async (response) => {
    if (typeof window !== 'undefined') {
      await persistSuccessfulGet(response.config as InternalAxiosRequestConfig, response.data);
    }
    return response;
  },
  async (error) => {
    const config = error.config as InternalAxiosRequestConfig | undefined;

    if (config && typeof window !== 'undefined') {
      const cached = await tryServeGetFromOfflineCache(config, error);
      if (cached !== null) {
        return {
          data: cached,
          status: 200,
          statusText: 'OK (cache hors ligne)',
          headers: {} as never,
          config,
        };
      }
    }

    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
      console.warn('Serveur backend non disponible ou hors ligne.');
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const requestUrl = error.config?.url as string | undefined;
      if (!isPublicAuthRequest(requestUrl)) {
        try {
          localStorage.removeItem('token');
        } catch {
          /* ignore */
        }
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

/** Santé backend : `GET {base}/health` (base URL inclut déjà `/api`). */
export function getApiHealthUrl(): string {
  return `${API_URL.replace(/\/+$/, '')}/health`;
}

export { API_URL };
export default api;
