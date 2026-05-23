import type { AxiosInstance } from 'axios';
import legacyApi from '@/services/api';
import api from '@/services/api/client';

const attached = new WeakSet<AxiosInstance>();

function isStaffPedagogyContext(): boolean {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/staff');
}

/**
 * Chemins /admin laissés intacts pour le personnel (économe, comptable…).
 * Aligné sur server/src/utils/staff-finance-access.util.ts (middleware authorizeAdminOrStaffFinance).
 */
const STAFF_DIRECT_ADMIN_PREFIXES = [
  '/admin/payments',
  '/admin/tuition-fees',
  '/admin/tuition-fee-catalog',
  '/admin/tuition-payment-schedule-templates',
  '/admin/suppliers',
  '/admin/school-expenses',
  '/admin/petty-cash',
  '/admin/budget-lines',
  '/admin/accounting',
];

function isStaffFinanceAdminUrl(url: string): boolean {
  const path = url.split('?')[0] ?? '';
  return STAFF_DIRECT_ADMIN_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/** Réécrit /admin/… → /staff/pedagogy/… sauf finance & établissements (chemins relatifs ou URL absolues). */
export function rewriteAdminGetUrl(url: string): string {
  if (!url || !url.includes('/admin/')) return url;
  if (url.includes('/admin/schools')) return url.replace('/admin/schools', '/staff/schools');
  if (isStaffFinanceAdminUrl(url)) return url;
  return url.replace('/admin/', '/staff/pedagogy/');
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
