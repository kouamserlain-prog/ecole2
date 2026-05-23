import type { StaffModuleId } from './staff-visible-modules.util';

/** Modules financiers / admin accessibles à l’économe via les routes /admin (STAFF). */
export const BURSAR_STAFF_MODULES: StaffModuleId[] = [
  'overview',
  'counter',
  'admissions',
  'treasury',
  'notifications_mgmt',
  'reports_mgmt',
  'extracurricular_mgmt',
  'attendance_mgmt',
  'parents_mgmt',
  'hr_mgmt',
  'fees_mgmt',
  'tuition_fees_mgmt',
  'payments_mgmt',
  'accounting_mgmt',
  'administrative_mgmt',
  'communication_mgmt',
  'material_mgmt',
];

const FINANCE_WRITE_PREFIXES = [
  '/tuition-fees',
  '/payments',
  '/tuition-fee-catalog',
  '/tuition-payment-schedule-templates',
  '/suppliers',
  '/school-expenses',
  '/petty-cash',
  '/budget-lines',
  '/accounting/',
];

const READ_SUPPORT_PREFIXES = [
  '/reports/',
  '/extracurricular/',
  '/notifications',
  '/messages',
  '/announcements',
  '/dashboard',
  '/teachers/attendance',
  '/material/',
  '/hr/',
  '/admissions',
];

function pathMatches(path: string, prefixes: string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(p));
}

/** Chemins /admin autorisés pour un compte STAFF (économe). */
export function isStaffFinanceAdminPath(path: string, method: string): boolean {
  const p = path.split('?')[0] || '/';
  if (pathMatches(p, FINANCE_WRITE_PREFIXES)) return true;
  if (pathMatches(p, READ_SUPPORT_PREFIXES)) return true;

  if (method === 'GET' || method === 'HEAD') {
    if (p === '/students' || p.startsWith('/students/')) return true;
    if (p === '/classes' || p.startsWith('/classes/')) return true;
    if (p === '/teachers' || p.startsWith('/teachers/')) return true;
    if (p === '/staff-personnel' || p.startsWith('/staff-personnel')) return true;
    if (p.startsWith('/parents')) return true;
    if (p.startsWith('/hr/') || p === '/hr') return true;
  }

  return false;
}

function hasAny(modules: StaffModuleId[], ids: StaffModuleId[]): boolean {
  return ids.some((id) => modules.includes(id));
}

/** Vérifie que le module STAFF actif autorise l’appel API admin ciblé. */
export function staffFinancePathAllowed(
  visibleModules: StaffModuleId[],
  path: string,
  method: string,
): boolean {
  const p = path.split('?')[0] || '/';

  if (p.startsWith('/notifications')) {
    return hasAny(visibleModules, ['notifications_mgmt', 'communication_mgmt']);
  }
  if (p.startsWith('/messages') || p.startsWith('/announcements')) {
    return visibleModules.includes('communication_mgmt');
  }
  if (p.startsWith('/reports/')) {
    return visibleModules.includes('reports_mgmt');
  }
  if (p.startsWith('/extracurricular/')) {
    return visibleModules.includes('extracurricular_mgmt');
  }
  if (p.includes('attendance') || p.startsWith('/teachers/attendance')) {
    return visibleModules.includes('attendance_mgmt');
  }
  if (p.startsWith('/parents')) {
    return visibleModules.includes('parents_mgmt');
  }
  if (p.startsWith('/hr')) {
    return visibleModules.includes('hr_mgmt');
  }
  if (p === '/dashboard' || p.startsWith('/dashboard/')) {
    return visibleModules.includes('administrative_mgmt');
  }
  if (p === '/students' || p.startsWith('/students/')) {
    return hasAny(visibleModules, ['administrative_mgmt', 'parents_mgmt', 'fees_mgmt', 'treasury']);
  }
  if (p === '/classes' || p.startsWith('/classes/')) {
    return hasAny(visibleModules, ['administrative_mgmt', 'attendance_mgmt']);
  }
  if (p === '/teachers' || p.startsWith('/teachers/')) {
    return hasAny(visibleModules, ['administrative_mgmt', 'attendance_mgmt', 'hr_mgmt']);
  }
  if (p.startsWith('/material')) {
    return visibleModules.includes('material_mgmt');
  }
  if (p.startsWith('/admissions')) {
    return visibleModules.includes('admissions');
  }

  const financeOps: StaffModuleId[] = [
    'fees_mgmt',
    'tuition_fees_mgmt',
    'payments_mgmt',
    'accounting_mgmt',
    'treasury',
    'counter',
    'admissions',
  ];

  if (p === '/payments/pending-cash' || p.startsWith('/payments/')) {
    return hasAny(visibleModules, [...financeOps, 'treasury', 'counter']);
  }

  if (pathMatches(p, FINANCE_WRITE_PREFIXES)) {
    return hasAny(visibleModules, financeOps);
  }

  if ((method === 'GET' || method === 'HEAD') && isStaffFinanceAdminPath(p, method)) {
    return hasAny(visibleModules, [...financeOps, 'administrative_mgmt']);
  }

  return false;
}
