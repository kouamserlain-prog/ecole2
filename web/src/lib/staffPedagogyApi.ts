import type { AxiosInstance } from 'axios';
import legacyApi from '@/services/api';
import api from '@/services/api/client';

const attached = new WeakSet<AxiosInstance>();

function isStaffPedagogyContext(): boolean {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/staff');
}

/**
 * GET /admin conservés tels quels depuis /staff (finance, périmètre établissement, pas de proxy pédagogie).
 * Tous les autres GET /admin/… sont réécrits vers /staff/pedagogy/… ; les mutations restent sur /admin.
 */
const STAFF_GET_STAYS_ON_ADMIN_PREFIXES = [
  '/admin/payments',
  '/admin/tuition-fees',
  '/admin/tuition-fee-catalog',
  '/admin/tuition-level-rates',
  '/admin/tuition-class-rates',
  '/admin/tuition-payment-schedule-templates',
  '/admin/suppliers',
  '/admin/school-expenses',
  '/admin/petty-cash',
  '/admin/petty-cash-movements',
  '/admin/petty-cash-balance',
  '/admin/budget-lines',
  '/admin/accounting',
  '/admin/students',
  '/admin/classes',
  '/admin/admissions',
  '/admin/staff-personnel',
  '/admin/discipline',
  '/admin/extracurricular',
  '/admin/orientation',
  '/admin/dashboard',
  '/admin/academic-change-requests',
  '/admin/metrics',
];

/** Extrait le chemin API (/admin/…) quel que soit le format axios (relatif, /api/…, URL absolue). */
export function normalizeAdminApiPath(url: string): string {
  const withoutQuery = (url.split('?')[0] ?? '').trim();
  if (!withoutQuery) return '/';

  try {
    if (/^https?:\/\//i.test(withoutQuery)) {
      const u = new URL(withoutQuery);
      const p = u.pathname.replace(/^\/api(?=\/|$)/, '') || '/';
      return p.startsWith('/') ? p : `/${p}`;
    }
  } catch {
    /* chemin relatif */
  }

  let path = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
  if (path.startsWith('/api/')) path = path.slice(4);
  else if (path === '/api') path = '/';
  return path;
}

function staffGetStaysOnAdmin(url: string): boolean {
  const path = normalizeAdminApiPath(url);
  return STAFF_GET_STAYS_ON_ADMIN_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/** Réécrit /admin/… → /staff/pedagogy/… pour les GET de consultation (pas finance ni établissements). */
export function rewriteAdminGetUrl(url: string): string {
  if (!url) return url;
  const path = normalizeAdminApiPath(url);
  if (!path.includes('/admin/')) return url;
  if (path.includes('/admin/schools')) {
    return url.replace(/\/admin\/schools/, '/staff/schools');
  }
  if (staffGetStaysOnAdmin(url)) return url;
  return url.replace(/\/admin\//, '/staff/pedagogy/');
}

function attachStaffPedagogyInterceptor(instance: AxiosInstance): void {
  if (attached.has(instance)) return;
  attached.add(instance);
  instance.interceptors.request.use((config) => {
    const method = (config.method || 'get').toLowerCase();
    const url = config.url ?? '';
    if (!isStaffPedagogyContext()) return config;
    if (method !== 'get' && method !== 'head') return config;
    const rewritten = rewriteAdminGetUrl(url);
    if (rewritten !== url) {
      config.url = rewritten;
    }
    return config;
  });
}

/**
 * Installe l’intercepteur GET sur les deux instances axios du projet
 * (client.ts ET services/api.ts legacy utilisé par adminApi).
 */
export function ensureStaffPedagogyApiInterceptor(): void {
  attachStaffPedagogyInterceptor(api);
  attachStaffPedagogyInterceptor(legacyApi);
}

/** @deprecated */
export function registerStaffPedagogyApiInterceptor(): void {
  ensureStaffPedagogyApiInterceptor();
}

/** @deprecated */
export function unregisterStaffPedagogyApiInterceptor(): void {
  /* no-op */
}
