import type { StaffCategory, SupportStaffKind } from '@prisma/client';
import prisma from './prisma';
import {
  getEligibleModulesForSupportKind,
  normalizeStaffModuleId,
  STAFF_MODULE_LABELS,
  type StaffModuleId,
} from './staff-visible-modules.util';

export const SUPPORT_STAFF_KINDS: SupportStaffKind[] = [
  'SECRETARY',
  'BURSAR',
  'ACCOUNTANT',
  'STUDIES_DIRECTOR',
  'NURSE',
  'LIBRARIAN',
  'IT',
  'MAINTENANCE',
  'OTHER',
];

export const DEFAULT_SUPPORT_KIND_LABELS: Record<SupportStaffKind, string> = {
  SECRETARY: 'Secrétaire',
  BURSAR: 'Économe',
  ACCOUNTANT: 'Comptabilité',
  STUDIES_DIRECTOR: 'Directeur(trice) des études',
  NURSE: 'Infirmier(e)',
  LIBRARIAN: 'Bibliothécaire',
  IT: 'Informatique',
  MAINTENANCE: 'Maintenance',
  OTHER: 'Personnel',
};

const KIND_SORT: Record<SupportStaffKind, number> = {
  STUDIES_DIRECTOR: 10,
  SECRETARY: 20,
  BURSAR: 30,
  ACCOUNTANT: 40,
  NURSE: 50,
  LIBRARIAN: 60,
  IT: 70,
  MAINTENANCE: 80,
  OTHER: 90,
};

export type SchoolStaffMetierDto = {
  id: string;
  schoolId: string;
  supportKind: SupportStaffKind;
  label: string;
  description: string | null;
  defaultModules: StaffModuleId[];
  isActive: boolean;
  sortOrder: number;
};

function modulesFromStored(
  staffCategory: StaffCategory,
  supportKind: SupportStaffKind | null | undefined,
  modules: string[],
): StaffModuleId[] {
  if (staffCategory !== 'SUPPORT') return ['overview'];
  const set = new Set<StaffModuleId>(['overview']);
  for (const raw of modules) {
    const id = normalizeStaffModuleId(raw);
    if (id && id !== 'overview') set.add(id);
  }
  if (set.size === 1 && modules.length === 0) {
    return getEligibleModulesForSupportKind(supportKind);
  }
  return [...set];
}

export function labelForSupportKind(
  supportKind: SupportStaffKind,
  customLabel?: string | null,
): string {
  const trimmed = customLabel?.trim();
  if (trimmed) return trimmed;
  return DEFAULT_SUPPORT_KIND_LABELS[supportKind] ?? supportKind;
}

/** Crée ou met à jour les métiers standard pour un établissement (à la création d’un collège). */
export async function seedSchoolStaffMetiers(schoolId: string): Promise<number> {
  let count = 0;
  for (const supportKind of SUPPORT_STAFF_KINDS) {
    const defaultModules = getEligibleModulesForSupportKind(supportKind);
    await prisma.schoolStaffMetier.upsert({
      where: { schoolId_supportKind: { schoolId, supportKind } },
      create: {
        schoolId,
        supportKind,
        label: DEFAULT_SUPPORT_KIND_LABELS[supportKind],
        defaultModules,
        isActive: true,
        sortOrder: KIND_SORT[supportKind],
      },
      update: {},
    });
    count += 1;
  }
  return count;
}

export async function seedAllSchoolsStaffMetiers(): Promise<void> {
  const schools = await prisma.school.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  for (const s of schools) {
    await seedSchoolStaffMetiers(s.id);
  }
}

export async function listSchoolStaffMetiers(schoolId: string): Promise<SchoolStaffMetierDto[]> {
  const rows = await prisma.schoolStaffMetier.findMany({
    where: { schoolId },
    orderBy: [{ sortOrder: 'asc' }, { supportKind: 'asc' }],
  });
  if (rows.length === 0) {
    await seedSchoolStaffMetiers(schoolId);
    return listSchoolStaffMetiers(schoolId);
  }
  return rows.map((row) => ({
    id: row.id,
    schoolId: row.schoolId,
    supportKind: row.supportKind,
    label: labelForSupportKind(row.supportKind, row.label),
    description: row.description,
    defaultModules: modulesFromStored('SUPPORT', row.supportKind, row.defaultModules),
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  }));
}

export async function getSchoolMetierDefaults(
  schoolId: string,
  supportKind: SupportStaffKind,
): Promise<StaffModuleId[] | null> {
  const row = await prisma.schoolStaffMetier.findUnique({
    where: { schoolId_supportKind: { schoolId, supportKind } },
  });
  if (!row || !row.isActive) return null;
  return modulesFromStored('SUPPORT', supportKind, row.defaultModules);
}

export async function assertSupportKindActiveForSchool(
  schoolId: string,
  supportKind: SupportStaffKind,
): Promise<void> {
  const row = await prisma.schoolStaffMetier.findUnique({
    where: { schoolId_supportKind: { schoolId, supportKind } },
    select: { isActive: true },
  });
  if (!row?.isActive) {
    throw new Error('METIER_INACTIVE_FOR_SCHOOL');
  }
}

export async function getEligibleModulesForStaffMemberAtSchool(
  staffCategory: StaffCategory,
  supportKind: SupportStaffKind | null | undefined,
  schoolId?: string | null,
): Promise<StaffModuleId[]> {
  if (staffCategory !== 'SUPPORT') return ['overview'];
  const kind = supportKind ?? 'SECRETARY';
  if (schoolId) {
    const fromSchool = await getSchoolMetierDefaults(schoolId, kind);
    if (fromSchool) return fromSchool;
  }
  return getEligibleModulesForSupportKind(kind);
}

export async function resolveVisibleStaffModulesAtSchool(
  staffCategory: StaffCategory,
  supportKind: SupportStaffKind | null | undefined,
  stored: string[] | null | undefined,
  schoolId?: string | null,
): Promise<StaffModuleId[]> {
  if (staffCategory !== 'SUPPORT') return ['overview'];
  const eligible = await getEligibleModulesForStaffMemberAtSchool(
    staffCategory,
    supportKind,
    schoolId,
  );
  if (!stored || stored.length === 0) {
    return eligible;
  }
  let picked = stored
    .map((id) => normalizeStaffModuleId(id))
    .filter((id): id is StaffModuleId => id !== null);
  if (!picked.includes('overview')) {
    picked.unshift('overview');
  }
  return [...new Set<StaffModuleId>(picked)];
}

export async function sanitizeVisibleStaffModulesForSchool(
  staffCategory: StaffCategory,
  supportKind: SupportStaffKind | null | undefined,
  requested: unknown,
  schoolId: string,
): Promise<StaffModuleId[]> {
  if (staffCategory !== 'SUPPORT') return ['overview'];
  if (!supportKind) {
    throw new Error('SUPPORT_KIND_REQUIRED');
  }
  await assertSupportKindActiveForSchool(schoolId, supportKind);
  if (!Array.isArray(requested) || requested.length === 0) {
    return ['overview'];
  }
  // Plafond = modules possibles pour ce métier (plateforme), pas seulement le sous-ensemble
  // « recommandé » configuré pour l’établissement — aligné avec l’UI « vous pouvez en ajouter d’autres ».
  const allowed = new Set(getEligibleModulesForSupportKind(supportKind ?? 'OTHER'));
  const withOverview = new Set<StaffModuleId>(['overview']);
  for (const raw of requested) {
    const id = normalizeStaffModuleId(raw);
    if (id && id !== 'overview' && allowed.has(id)) withOverview.add(id);
  }
  return [...withOverview];
}

export { STAFF_MODULE_LABELS };
