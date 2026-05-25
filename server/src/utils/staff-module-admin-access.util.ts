import type { StaffModuleId } from './staff-visible-modules.util';
import {
  staffModuleGrantsWriteAccess,
  staffModuleIsReadOnlyByDesign,
} from './staff-module-capabilities.util';

type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type ModuleRouteRule = {
  moduleId: StaffModuleId;
  prefixes: string[];
  /** read = GET/HEAD uniquement */
  access: 'read' | 'write';
};

/** Préfixes /admin couverts par au moins un module STAFF. */
const MODULE_ROUTE_RULES: ModuleRouteRule[] = [
  // ——— Pédagogie & scolarité ———
  { moduleId: 'students_mgmt', prefixes: ['/students', '/school-tracks', '/subject-options'], access: 'write' },
  { moduleId: 'student_registry', prefixes: ['/students'], access: 'read' },
  { moduleId: 'classes_mgmt', prefixes: ['/classes', '/class-groups', '/school-tracks', '/subject-options'], access: 'write' },
  { moduleId: 'teachers_mgmt', prefixes: ['/teachers'], access: 'write' },
  { moduleId: 'educators_mgmt', prefixes: ['/educators', '/staff/personnel-registry', '/staff'], access: 'write' },
  { moduleId: 'staff_mgmt', prefixes: ['/staff-personnel', '/staff'], access: 'write' },
  { moduleId: 'parents_mgmt', prefixes: ['/parents'], access: 'write' },
  { moduleId: 'admissions', prefixes: ['/admissions'], access: 'write' },
  {
    moduleId: 'academic_mgmt',
    prefixes: [
      '/courses',
      '/school-calendar-events',
      '/school-gallery-items',
      '/school-curricula',
      '/school-tracks',
      '/subject-options',
    ],
    access: 'write',
  },
  {
    moduleId: 'grading_mgmt',
    prefixes: ['/grades', '/assignments', '/report-cards', '/academic-change-requests'],
    access: 'write',
  },
  { moduleId: 'schedule_mgmt', prefixes: ['/schedules', '/schedule-room-blocks'], access: 'write' },
  { moduleId: 'attendance_mgmt', prefixes: ['/absences', '/teachers/attendance'], access: 'write' },
  { moduleId: 'pointage_mgmt', prefixes: ['/students/nfc', '/nfc'], access: 'write' },
  { moduleId: 'discipline_mgmt', prefixes: ['/discipline'], access: 'write' },
  { moduleId: 'extracurricular_mgmt', prefixes: ['/extracurricular'], access: 'write' },
  { moduleId: 'orientation_mgmt', prefixes: ['/orientation'], access: 'write' },
  { moduleId: 'communication_mgmt', prefixes: ['/messages', '/announcements'], access: 'write' },
  { moduleId: 'library_mgmt', prefixes: ['/library'], access: 'write' },
  { moduleId: 'library', prefixes: ['/library'], access: 'write' },
  { moduleId: 'digital_library', prefixes: ['/library'], access: 'write' },
  { moduleId: 'material_mgmt', prefixes: ['/material'], access: 'write' },
  { moduleId: 'reports_mgmt', prefixes: ['/reports'], access: 'read' },
  { moduleId: 'analytics_mgmt', prefixes: ['/pedagogical', '/metrics'], access: 'read' },
  { moduleId: 'pedagogical_tracking', prefixes: ['/pedagogical'], access: 'read' },
  { moduleId: 'hr_mgmt', prefixes: ['/hr'], access: 'write' },
  { moduleId: 'class_councils', prefixes: ['/class-councils'], access: 'write' },
  { moduleId: 'validations', prefixes: ['/academic-change-requests', '/grades'], access: 'write' },
  // ——— Finances ———
  {
    moduleId: 'fees_mgmt',
    prefixes: [
      '/tuition-fees',
      '/tuition-fee-catalog',
      '/tuition-level-rates',
      '/tuition-class-rates',
      '/tuition-payment-schedule-templates',
    ],
    access: 'write',
  },
  {
    moduleId: 'tuition_fees_mgmt',
    prefixes: [
      '/tuition-fees',
      '/tuition-fee-catalog',
      '/tuition-level-rates',
      '/tuition-class-rates',
      '/tuition-payment-schedule-templates',
    ],
    access: 'write',
  },
  { moduleId: 'payments_mgmt', prefixes: ['/payments'], access: 'write' },
  {
    moduleId: 'accounting_mgmt',
    prefixes: ['/accounting', '/suppliers', '/school-expenses', '/petty-cash', '/budget-lines'],
    access: 'write',
  },
  { moduleId: 'treasury', prefixes: ['/payments', '/tuition-fees', '/students', '/classes'], access: 'read' },
  { moduleId: 'counter', prefixes: ['/payments', '/students', '/tuition-fees'], access: 'write' },
  { moduleId: 'administrative_mgmt', prefixes: ['/dashboard'], access: 'read' },
  { moduleId: 'notifications_mgmt', prefixes: ['/notifications'], access: 'write' },
];

const ALL_PREFIXES = [...new Set(MODULE_ROUTE_RULES.flatMap((r) => r.prefixes))];

/**
 * Métiers / modules qui consultent le barème scolarité (inscription, admissions, frais)
 * sans avoir obligatoirement fees_mgmt.
 */
export const STAFF_TUITION_RATES_READ_MODULE_IDS: StaffModuleId[] = [
  'admissions',
  'appointments',
  'students_mgmt',
  'student_registry',
  'classes_mgmt',
  'class_councils',
  'fees_mgmt',
  'tuition_fees_mgmt',
  'payments_mgmt',
  'treasury',
  'counter',
  'administrative_mgmt',
  'validations',
  'academic_overview',
  'pedagogical_tracking',
];

function isTuitionRatesAdminPath(path: string): boolean {
  return (
    path === '/tuition-level-rates' ||
    path.startsWith('/tuition-level-rates/') ||
    path === '/tuition-class-rates' ||
    path.startsWith('/tuition-class-rates/')
  );
}

export function staffTuitionRatesReadAllowed(visibleModules: StaffModuleId[]): boolean {
  return hasAnyModule(visibleModules, STAFF_TUITION_RATES_READ_MODULE_IDS);
}

function normalizePath(path: string): string {
  const raw = path.split('?')[0] || '/';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function normalizeMethod(method: string): HttpMethod {
  return method.toUpperCase() as HttpMethod;
}

function pathMatchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function pathMatchesAny(path: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathMatchesPrefix(path, p));
}

function hasAnyModule(modules: StaffModuleId[], ids: StaffModuleId[]): boolean {
  return ids.some((id) => modules.includes(id));
}

function methodAllowedForAccess(
  method: HttpMethod,
  access: 'read' | 'write',
  allowDelete: boolean,
): boolean {
  if (method === 'GET' || method === 'HEAD') return true;
  if (access === 'read') return false;
  if (method === 'DELETE') return allowDelete;
  return method === 'POST' || method === 'PUT' || method === 'PATCH';
}

/** Actions /admin toujours réservées aux administrateurs. */
export function isStaffAdminForbidden(
  path: string,
  method: string,
  visibleModules: StaffModuleId[] = [],
): boolean {
  const p = normalizePath(path);
  const m = normalizeMethod(method);

  if (p.startsWith('/schools')) return true;

  if (p.startsWith('/workspaces')) {
    if (p === '/workspaces/my-context' || p === '/workspaces/module-catalog') return false;
    return true;
  }

  if (p.startsWith('/app-branding')) return true;

  if (p.startsWith('/users')) {
    if (m === 'GET' || m === 'HEAD') return false;
    return true;
  }

  return false;
}

/** Sous-chemin disponibilités enseignant pour l’emploi du temps. */
function isTeacherScheduleAvailabilityPath(path: string): boolean {
  return /\/teachers\/[^/]+\/schedule-availability/.test(path);
}

/** Au moins une règle de module pourrait couvrir ce chemin (hors interdictions). */
export function isStaffModuleAdminPath(path: string, method: string): boolean {
  const p = normalizePath(path);
  const m = normalizeMethod(method);
  if (isStaffAdminForbidden(p, m)) return false;
  if (!pathMatchesAny(p, ALL_PREFIXES)) return false;
  return MODULE_ROUTE_RULES.some((rule) => {
    const allowDelete = rule.access === 'write' && !staffModuleIsReadOnlyByDesign(rule.moduleId);
    return pathMatchesAny(p, rule.prefixes) && methodAllowedForAccess(m, rule.access, allowDelete);
  });
}

function ruleMatchesPath(rule: ModuleRouteRule, path: string): boolean {
  return pathMatchesAny(path, rule.prefixes);
}

/** GET /users pour sélection destinataires (communication). */
function staffUsersListAllowed(visibleModules: StaffModuleId[], path: string, method: HttpMethod): boolean {
  if (path !== '/users' && !path.startsWith('/users/')) return false;
  if (method !== 'GET' && method !== 'HEAD') return false;
  return hasAnyModule(visibleModules, ['communication_mgmt', 'hr_mgmt', 'staff_mgmt']);
}

function admissionsSpecialCase(
  visibleModules: StaffModuleId[],
  path: string,
  method: HttpMethod,
): boolean {
  if (!path.startsWith('/admissions')) return false;
  const canAdmit = visibleModules.includes('admissions') || visibleModules.includes('students_mgmt');
  if (method === 'GET' || method === 'HEAD') return canAdmit;
  if (path.endsWith('/enroll') && method === 'POST') return canAdmit;
  return staffModuleGrantsWriteAccess('admissions', visibleModules);
}

function teacherScheduleAvailabilityCase(
  visibleModules: StaffModuleId[],
  path: string,
  method: HttpMethod,
): boolean {
  if (!isTeacherScheduleAvailabilityPath(path)) return false;
  if (method === 'GET' || method === 'HEAD') {
    return hasAnyModule(visibleModules, [
      'schedule_mgmt',
      'teachers_mgmt',
      'attendance_mgmt',
      'hr_mgmt',
      'administrative_mgmt',
    ]);
  }
  return (
    staffModuleGrantsWriteAccess('schedule_mgmt', visibleModules) ||
    staffModuleGrantsWriteAccess('teachers_mgmt', visibleModules)
  );
}

function counterPaymentCase(visibleModules: StaffModuleId[], path: string, method: HttpMethod): boolean {
  if (!visibleModules.includes('counter')) return false;
  if (path === '/payments/pending-cash' || path.startsWith('/payments/pending-cash')) {
    return method === 'GET' || method === 'HEAD' || method === 'POST' || method === 'PUT' || method === 'PATCH';
  }
  if (path.startsWith('/payments/') && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    return true;
  }
  if ((path === '/students' || path.startsWith('/students/')) && (method === 'GET' || method === 'HEAD')) {
    return true;
  }
  return false;
}

/**
 * Autorise un appel /admin pour un STAFF si un module visible de son espace couvre le chemin et la méthode.
 */
export function staffModuleAdminPathAllowed(
  visibleModules: StaffModuleId[],
  path: string,
  method: string,
): boolean {
  const p = normalizePath(path);
  const m = normalizeMethod(method);

  if (isStaffAdminForbidden(p, m, visibleModules)) return false;

  if (m === 'DELETE' && (p === '/students' || p.startsWith('/students/'))) {
    return staffModuleGrantsWriteAccess('students_mgmt', visibleModules);
  }

  if (staffUsersListAllowed(visibleModules, p, m)) return true;
  if (teacherScheduleAvailabilityCase(visibleModules, p, m)) return true;
  if (admissionsSpecialCase(visibleModules, p, m)) return true;
  if (counterPaymentCase(visibleModules, p, m)) return true;

  for (const rule of MODULE_ROUTE_RULES) {
    if (!visibleModules.includes(rule.moduleId)) continue;
    if (!ruleMatchesPath(rule, p)) continue;
    const allowDelete =
      rule.access === 'write' && staffModuleGrantsWriteAccess(rule.moduleId, visibleModules);
    if (methodAllowedForAccess(m, rule.access, allowDelete)) return true;
  }

  // Lecture croisée pour modules financiers / admin
  if (m === 'GET' || m === 'HEAD') {
    if (p === '/students' || p.startsWith('/students/')) {
      return hasAnyModule(visibleModules, [
        'treasury',
        'counter',
        'fees_mgmt',
        'tuition_fees_mgmt',
        'payments_mgmt',
        'parents_mgmt',
        'administrative_mgmt',
        'attendance_mgmt',
        'students_mgmt',
        'student_registry',
        'admissions',
      ]);
    }
    if (p === '/classes' || p.startsWith('/classes/')) {
      return hasAnyModule(visibleModules, [
        'treasury',
        'counter',
        'administrative_mgmt',
        'attendance_mgmt',
        'classes_mgmt',
        'student_registry',
        'students_mgmt',
        'schedule_mgmt',
      ]);
    }
    if (p === '/teachers' || p.startsWith('/teachers/')) {
      return hasAnyModule(visibleModules, [
        'administrative_mgmt',
        'attendance_mgmt',
        'hr_mgmt',
        'teachers_mgmt',
        'schedule_mgmt',
      ]);
    }
    if (p === '/courses' || p.startsWith('/courses/')) {
      return hasAnyModule(visibleModules, ['academic_mgmt', 'schedule_mgmt', 'grading_mgmt']);
    }
    if (p.startsWith('/material')) {
      return hasAnyModule(visibleModules, ['material_mgmt', 'schedule_mgmt']);
    }
    if (p === '/schedules' || p.startsWith('/schedules/') || p.startsWith('/schedule-room-blocks')) {
      return visibleModules.includes('schedule_mgmt');
    }
    if (p.startsWith('/staff-personnel')) {
      return hasAnyModule(visibleModules, ['administrative_mgmt', 'hr_mgmt', 'staff_mgmt']);
    }
    if (isTuitionRatesAdminPath(p)) {
      return staffTuitionRatesReadAllowed(visibleModules);
    }
  }

  return false;
}

export function staffModuleGrantsWriteUi(
  moduleId: StaffModuleId,
  visibleModules: StaffModuleId[],
): boolean {
  return staffModuleGrantsWriteAccess(moduleId, visibleModules);
}

/** Préfixes /admin utilisés directement depuis /staff (écriture, pas proxy pédagogie GET). */
export function getStaffDirectAdminPrefixes(): string[] {
  return [
    ...new Set(
      MODULE_ROUTE_RULES.filter((r) => r.access === 'write').flatMap((r) => r.prefixes),
    ),
  ].map((p) => `/admin${p}`);
}
