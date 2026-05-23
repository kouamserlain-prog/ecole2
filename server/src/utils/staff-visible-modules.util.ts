import type { StaffCategory, SupportStaffKind } from '@prisma/client';
import prisma from './prisma';

/** Identifiants des modules de l’espace personnel STAFF. */
export const STAFF_MODULE_IDS = [
  'overview',
  'counter',
  'admissions',
  'appointments',
  'student_registry',
  'treasury',
  'validations',
  'academic_overview',
  'class_councils',
  'health_log',
  'library',
  'digital_library',
  'it_requests',
  'maintenance_requests',
  'students_mgmt',
  'academic_mgmt',
  'grading_mgmt',
  'classes_mgmt',
  'teachers_mgmt',
  'educators_mgmt',
  'staff_mgmt',
  'parents_mgmt',
  'pedagogical_tracking',
  'discipline_mgmt',
  'extracurricular_mgmt',
  'orientation_mgmt',
  'communication_mgmt',
  'library_mgmt',
  'material_mgmt',
  'reports_mgmt',
  'analytics_mgmt',
  'schedule_mgmt',
  'pointage_mgmt',
  'attendance_mgmt',
  'hr_mgmt',
  'notifications_mgmt',
  'fees_mgmt',
  'tuition_fees_mgmt',
  'payments_mgmt',
  'accounting_mgmt',
  'administrative_mgmt',
] as const;

export type StaffModuleId = (typeof STAFF_MODULE_IDS)[number];

const MODULE_SET = new Set<string>(STAFF_MODULE_IDS);

export const STAFF_MODULE_LABELS: Record<StaffModuleId, string> = {
  overview: 'Vue d’ensemble',
  counter: 'Guichet scolarité',
  admissions: 'Inscriptions & admissions',
  appointments: 'Rendez-vous parents',
  student_registry: 'Registre élèves',
  treasury: 'Trésorerie & frais',
  validations: 'Validations notes & moyennes',
  academic_overview: 'Pilotage pédagogique',
  class_councils: 'Conseils de classe',
  health_log: 'Infirmerie — consultations',
  library: 'Bibliothèque — prêts',
  digital_library: 'Bibliothèque numérique',
  it_requests: 'Support informatique',
  maintenance_requests: 'Maintenance & travaux',
  students_mgmt: 'Élèves',
  academic_mgmt: 'Gestion académique',
  grading_mgmt: 'Notation & évaluation',
  classes_mgmt: 'Classes',
  teachers_mgmt: 'Enseignants',
  educators_mgmt: 'Éducateurs',
  staff_mgmt: 'Personnel administratif',
  parents_mgmt: 'Parents & tuteurs',
  pedagogical_tracking: 'Suivi pédagogique',
  discipline_mgmt: 'Discipline & règlement',
  extracurricular_mgmt: 'Activités parascolaires',
  orientation_mgmt: 'Orientation',
  communication_mgmt: 'Communication',
  library_mgmt: 'Bibliothèque',
  material_mgmt: 'Gestion matérielle',
  reports_mgmt: 'Rapports & statistiques',
  analytics_mgmt: 'Analytique avancée',
  schedule_mgmt: 'Emploi du temps',
  pointage_mgmt: 'Pointage des élèves',
  attendance_mgmt: 'Gestion des présences',
  hr_mgmt: 'Ressources humaines',
  notifications_mgmt: 'Notifications',
  fees_mgmt: 'Gestion des frais',
  tuition_fees_mgmt: 'Frais de scolarité',
  payments_mgmt: 'Paiements',
  accounting_mgmt: 'Comptabilité',
  administrative_mgmt: 'Gestion administrative',
};

/** Modules éligibles selon le métier (supportKind). */
export function getEligibleModulesForSupportKind(
  supportKind: SupportStaffKind | null | undefined,
): StaffModuleId[] {
  if (!supportKind) return ['overview'];
  switch (supportKind) {
    case 'SECRETARY':
      return [
        'overview',
        'counter',
        'admissions',
        'appointments',
        'student_registry',
        'students_mgmt',
        'classes_mgmt',
        'parents_mgmt',
        'class_councils',
        'communication_mgmt',
        'extracurricular_mgmt',
      ];
    case 'BURSAR':
      return [
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
    case 'ACCOUNTANT':
      return [
        'overview',
        'counter',
        'admissions',
        'treasury',
        'notifications_mgmt',
        'reports_mgmt',
        'fees_mgmt',
        'tuition_fees_mgmt',
        'payments_mgmt',
        'accounting_mgmt',
        'administrative_mgmt',
        'communication_mgmt',
      ];
    case 'STUDIES_DIRECTOR':
      return [
        'overview',
        'admissions',
        'appointments',
        'student_registry',
        'validations',
        'grading_mgmt',
        'academic_overview',
        'class_councils',
        'parents_mgmt',
        'pedagogical_tracking',
        'discipline_mgmt',
        'extracurricular_mgmt',
        'orientation_mgmt',
        'communication_mgmt',
        'hr_mgmt',
      ];
    case 'NURSE':
      return ['overview', 'health_log'];
    case 'LIBRARIAN':
      return ['overview', 'library', 'digital_library'];
    case 'IT':
      return ['overview', 'it_requests'];
    case 'MAINTENANCE':
      return ['overview', 'maintenance_requests'];
    default:
      return ['overview'];
  }
}

export function getEligibleModulesForStaffMember(
  staffCategory: StaffCategory,
  supportKind: SupportStaffKind | null | undefined,
): StaffModuleId[] {
  if (staffCategory === 'SUPPORT') {
    return getEligibleModulesForSupportKind(supportKind);
  }
  return ['overview'];
}

export function sanitizeVisibleStaffModules(
  staffCategory: StaffCategory,
  supportKind: SupportStaffKind | null | undefined,
  requested: unknown,
): StaffModuleId[] {
  if (staffCategory !== 'SUPPORT') {
    return ['overview'];
  }
  if (!Array.isArray(requested) || requested.length === 0) {
    return getEligibleModulesForStaffMember(staffCategory, supportKind);
  }
  const picked = requested
    .map((v) => String(v).trim())
    .filter((id): id is StaffModuleId => MODULE_SET.has(id) && id !== 'overview');
  const withOverview = new Set<StaffModuleId>(['overview', ...picked]);
  return [...withOverview];
}

export function resolveVisibleStaffModules(
  staffCategory: StaffCategory,
  supportKind: SupportStaffKind | null | undefined,
  stored: string[] | null | undefined,
): StaffModuleId[] {
  if (staffCategory !== 'SUPPORT') {
    return ['overview'];
  }
  const eligible = getEligibleModulesForStaffMember(staffCategory, supportKind);
  if (!stored || stored.length === 0) {
    return eligible;
  }
  let picked = stored.filter((id): id is StaffModuleId => MODULE_SET.has(id));
  if (!picked.includes('overview')) {
    picked.unshift('overview');
  }

  return [...new Set<StaffModuleId>([...eligible, ...picked])];
}

/** Met à jour visibleStaffModules en base si le catalogue éligible a évolué. */
export async function syncStaffVisibleModulesIfStale(staff: {
  id: string;
  staffCategory: StaffCategory;
  supportKind: SupportStaffKind | null;
  visibleStaffModules: string[];
}): Promise<StaffModuleId[] | null> {
  const resolved = resolveVisibleStaffModules(
    staff.staffCategory,
    staff.supportKind,
    staff.visibleStaffModules,
  );
  const stored = staff.visibleStaffModules ?? [];
  const same =
    resolved.length === stored.length && resolved.every((id) => stored.includes(id));
  if (same) return null;
  await prisma.staffMember.update({
    where: { id: staff.id },
    data: { visibleStaffModules: resolved },
  });
  return resolved;
}

export async function getStaffMemberModuleContext(userId: string) {
  const staff = await prisma.staffMember.findUnique({
    where: { userId },
    select: {
      id: true,
      staffCategory: true,
      supportKind: true,
      visibleStaffModules: true,
    },
  });
  if (!staff) return null;
  const visibleModules = resolveVisibleStaffModules(
    staff.staffCategory,
    staff.supportKind,
    staff.visibleStaffModules,
  );
  return { staff, visibleModules };
}

export async function assertStaffHasModule(userId: string, moduleId: StaffModuleId): Promise<void> {
  const ctx = await getStaffMemberModuleContext(userId);
  if (!ctx) {
    const err = new Error('STAFF_PROFILE_NOT_FOUND');
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
  if (!ctx.visibleModules.includes(moduleId)) {
    const err = new Error('MODULE_NOT_ALLOWED');
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}
