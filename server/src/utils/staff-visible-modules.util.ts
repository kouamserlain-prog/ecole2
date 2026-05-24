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

/** Correspondance ids module ADMIN → ids module STAFF (évite perte à l’enregistrement). */
const STAFF_MODULE_ALIASES: Record<string, StaffModuleId> = {
  accounting: 'accounting_mgmt',
  fees: 'fees_mgmt',
  'tuition-fees': 'tuition_fees_mgmt',
  payments: 'payments_mgmt',
  administrative: 'administrative_mgmt',
  hr: 'hr_mgmt',
  library: 'library_mgmt',
  material: 'material_mgmt',
  reports: 'reports_mgmt',
  analytics: 'analytics_mgmt',
  schedule: 'schedule_mgmt',
  pointage: 'pointage_mgmt',
  attendance: 'attendance_mgmt',
  communication: 'communication_mgmt',
  students: 'students_mgmt',
  classes: 'classes_mgmt',
  teachers: 'teachers_mgmt',
  educators: 'educators_mgmt',
  'staff-personnel': 'staff_mgmt',
  'parent-guardians': 'parents_mgmt',
  pedagogical: 'pedagogical_tracking',
  discipline: 'discipline_mgmt',
  extracurricular: 'extracurricular_mgmt',
  orientation: 'orientation_mgmt',
  grading: 'grading_mgmt',
  academic: 'academic_mgmt',
  management: 'academic_mgmt',
  notifications: 'notifications_mgmt',
};

export function normalizeStaffModuleId(raw: unknown): StaffModuleId | null {
  const id = String(raw ?? '').trim();
  if (!id) return null;
  if (MODULE_SET.has(id)) return id as StaffModuleId;
  return STAFF_MODULE_ALIASES[id] ?? null;
}

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
  educators_mgmt: 'Personnel — éducateurs',
  staff_mgmt: 'Personnel',
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
        'notifications_mgmt',
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
        'notifications_mgmt',
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
      return ['overview', 'notifications_mgmt', 'health_log', 'communication_mgmt'];
    case 'LIBRARIAN':
      return ['overview', 'notifications_mgmt', 'library', 'digital_library', 'communication_mgmt'];
    case 'IT':
      return ['overview', 'notifications_mgmt', 'it_requests', 'communication_mgmt'];
    case 'MAINTENANCE':
      return ['overview', 'notifications_mgmt', 'maintenance_requests', 'communication_mgmt'];
    case 'OTHER':
      return [
        'overview',
        'notifications_mgmt',
        'counter',
        'admissions',
        'appointments',
        'student_registry',
        'communication_mgmt',
      ];
    default:
      return ['overview'];
  }
}

export function getEligibleModulesForStaffMember(
  staffCategory: StaffCategory,
  supportKind: SupportStaffKind | null | undefined,
): StaffModuleId[] {
  if (staffCategory === 'SUPPORT') {
    // Comptes legacy sans métier : droits secrétariat par défaut (dont admissions)
    return getEligibleModulesForSupportKind(supportKind ?? 'SECRETARY');
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
  const withOverview = new Set<StaffModuleId>(['overview']);
  for (const raw of requested) {
    const id = normalizeStaffModuleId(raw);
    if (id && id !== 'overview') withOverview.add(id);
  }
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
  let picked = stored
    .map((id) => normalizeStaffModuleId(id))
    .filter((id): id is StaffModuleId => id !== null);
  if (!picked.includes('overview')) {
    picked.unshift('overview');
  }

  // Modules recommandés du métier toujours présents + modules ajoutés par l’admin.
  return [...new Set<StaffModuleId>([...eligible, ...picked])];
}

/**
 * Première connexion uniquement : enregistre les modules par défaut du métier si la liste est vide.
 * Ne réécrit pas une personnalisation déjà enregistrée.
 */
export async function syncStaffVisibleModulesIfStale(staff: {
  id: string;
  staffCategory: StaffCategory;
  supportKind: SupportStaffKind | null;
  visibleStaffModules: string[];
  schoolId?: string | null;
}): Promise<StaffModuleId[] | null> {
  const stored = staff.visibleStaffModules ?? [];
  if (stored.length > 0) return null;

  const { getEligibleModulesForStaffMemberAtSchool } = await import('./school-staff-metiers.util');
  const defaults = staff.schoolId
    ? await getEligibleModulesForStaffMemberAtSchool(
        staff.staffCategory,
        staff.supportKind,
        staff.schoolId,
      )
    : getEligibleModulesForStaffMember(staff.staffCategory, staff.supportKind);
  await prisma.staffMember.update({
    where: { id: staff.id },
    data: { visibleStaffModules: defaults },
  });
  return defaults;
}

export async function getStaffMemberModuleContext(userId: string) {
  const staff = await prisma.staffMember.findUnique({
    where: { userId },
    select: {
      id: true,
      staffCategory: true,
      supportKind: true,
      visibleStaffModules: true,
      schoolId: true,
    },
  });
  if (!staff) return null;

  const { resolveVisibleStaffModulesAtSchool, labelForSupportKind } = await import(
    './school-staff-metiers.util'
  );

  const visibleModules = staff.schoolId
    ? await resolveVisibleStaffModulesAtSchool(
        staff.staffCategory,
        staff.supportKind,
        staff.visibleStaffModules,
        staff.schoolId,
      )
    : resolveVisibleStaffModules(
        staff.staffCategory,
        staff.supportKind,
        staff.visibleStaffModules,
      );

  let metierLabel: string | null = null;
  if (staff.schoolId && staff.supportKind) {
    const row = await prisma.schoolStaffMetier.findUnique({
      where: {
        schoolId_supportKind: { schoolId: staff.schoolId, supportKind: staff.supportKind },
      },
      select: { label: true },
    });
    metierLabel = labelForSupportKind(staff.supportKind, row?.label);
  }

  return { staff, visibleModules, metierLabel };
}

export async function assertStaffHasModule(userId: string, moduleId: StaffModuleId): Promise<void> {
  const staff = await prisma.staffMember.findUnique({
    where: { userId },
    select: {
      id: true,
      staffCategory: true,
      supportKind: true,
      visibleStaffModules: true,
      schoolId: true,
    },
  });
  if (!staff) {
    const err = new Error('STAFF_PROFILE_NOT_FOUND');
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
  await syncStaffVisibleModulesIfStale(staff);
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
