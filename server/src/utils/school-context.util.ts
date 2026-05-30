import type { Role } from '@prisma/client';
import type { Request } from 'express';
import prisma from './prisma';
import { ensureDefaultSchool, SchoolPrismaNotReadyError } from './ensure-default-school.util';

export { SchoolPrismaNotReadyError };
import type { AuthRequest } from '../middleware/auth.middleware';
import {
  getSchoolDelegate,
  getSchoolMemberDelegate,
  isSchoolPrismaReady,
} from './school-prisma.util';

export type SchoolSummary = {
  id: string;
  name: string;
  slug: string;
  shortName?: string | null;
  isDefault: boolean;
};

export type SchoolContextRequest = AuthRequest & {
  schoolId?: string;
  school?: SchoolSummary;
};

export function readSchoolIdFromRequest(req: Request): string | undefined {
  const header = req.get('X-School-Id')?.trim();
  if (header) return header;
  const q = req.query.schoolId;
  if (typeof q === 'string' && q.trim()) return q.trim();
  return undefined;
}

export function readSchoolSlugFromRequest(req: Request): string | undefined {
  const q = req.query.school ?? req.query.college ?? req.query.etablissement;
  if (typeof q === 'string' && q.trim()) return q.trim().toLowerCase();
  return undefined;
}

export async function resolveSchoolBySlug(slug: string): Promise<SchoolSummary | null> {
  const schools = getSchoolDelegate();
  if (!schools) return null;
  return (await schools.findFirst({
    where: { slug: slug.toLowerCase(), isActive: true },
    select: { id: true, name: true, slug: true, isDefault: true },
  })) as SchoolSummary | null;
}

export async function listSchoolsForUser(userId: string, role: Role): Promise<SchoolSummary[]> {
  const schools = getSchoolDelegate();
  const members = getSchoolMemberDelegate();
  if (!schools || !members) {
    throw new SchoolPrismaNotReadyError();
  }

  if (role === 'SUPER_ADMIN') {
    return (await schools.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, shortName: true, isDefault: true },
    })) as SchoolSummary[];
  }

  const memberships = (await members.findMany({
    where: { userId, school: { isActive: true } },
    include: {
      school: {
        select: { id: true, name: true, slug: true, shortName: true, isDefault: true },
      },
    },
    orderBy: [{ isDefault: 'desc' }, { school: { name: 'asc' } }],
  })) as { school: SchoolSummary }[];

  if (memberships.length > 0) {
    return memberships.map((m) => m.school);
  }

  const defaultId = await ensureDefaultSchool();
  const school = (await schools.findUnique({
    where: { id: defaultId },
    select: { id: true, name: true, slug: true, shortName: true, isDefault: true },
  })) as SchoolSummary | null;
  return school ? [school] : [];
}

export async function userCanAccessSchool(
  userId: string,
  role: Role,
  schoolId: string
): Promise<boolean> {
  if (role === 'SUPER_ADMIN') return true;
  const schools = getSchoolDelegate();
  const members = getSchoolMemberDelegate();
  if (!schools || !members) return false;

  const member = await members.findUnique({
    where: { schoolId_userId: { schoolId, userId } },
  });
  if (member) return true;

  const school = (await schools.findUnique({
    where: { id: schoolId },
    select: { isActive: true },
  })) as { isActive: boolean } | null;
  if (!school?.isActive) return false;

  if (role === 'ADMIN') {
    await members.create({
      data: { schoolId, userId, isDefault: false },
    });
    return true;
  }

  return false;
}

export async function resolveActiveSchoolForRequest(
  req: SchoolContextRequest
): Promise<{ schoolId: string; school: SchoolSummary } | null> {
  if (!isSchoolPrismaReady()) {
    throw new SchoolPrismaNotReadyError();
  }

  await ensureDefaultSchool();

  const schools = getSchoolDelegate()!;
  const members = getSchoolMemberDelegate()!;

  let schoolId = readSchoolIdFromRequest(req);
  const explicitSchoolId = schoolId;
  const slug = readSchoolSlugFromRequest(req);

  if (!schoolId && slug) {
    const bySlug = await resolveSchoolBySlug(slug);
    schoolId = bySlug?.id;
  }

  const user = req.user;
  if (!user) {
    if (!schoolId) {
      const def = (await schools.findFirst({
        where: { isDefault: true, isActive: true },
        select: { id: true, name: true, slug: true, isDefault: true },
      })) as SchoolSummary | null;
      if (!def) return null;
      return { schoolId: def.id, school: def };
    }
    const school = (await schools.findFirst({
      where: { id: schoolId, isActive: true },
      select: { id: true, name: true, slug: true, isDefault: true },
    })) as SchoolSummary | null;
    if (!school) return null;
    return { schoolId: school.id, school };
  }

  const accessible = await listSchoolsForUser(user.id, user.role as Role);
  if (accessible.length === 0) return null;

  if (schoolId) {
    const allowed = accessible.some((s) => s.id === schoolId);
    const canAccess =
      allowed || (await userCanAccessSchool(user.id, user.role as Role, schoolId));
    if (canAccess) {
      const school = (await schools.findFirst({
        where: { id: schoolId, isActive: true },
        select: { id: true, name: true, slug: true, shortName: true, isDefault: true },
      })) as SchoolSummary | null;
      if (school) return { schoolId: school.id, school };
    }
    if (explicitSchoolId) {
      return null;
    }
  }

  const preferred = (await members.findFirst({
    where: { userId: user.id, isDefault: true, school: { isActive: true } },
    include: {
      school: { select: { id: true, name: true, slug: true, shortName: true, isDefault: true } },
    },
  })) as { school: SchoolSummary } | null;
  if (preferred) {
    return { schoolId: preferred.school.id, school: preferred.school };
  }
  const def = accessible.find((s) => s.isDefault) ?? accessible[0];
  return { schoolId: def.id, school: def };
}

/** MongoDB : champ absent ≠ null — inclure les deux pour les données legacy. */
function schoolIdMatchesActive(schoolId: string, includeLegacyOrphans: boolean) {
  if (!includeLegacyOrphans) {
    return { schoolId };
  }
  return {
    OR: [{ schoolId }, { schoolId: null }],
  };
}

/** Filtre élèves pour l’établissement actif */
export function studentScopeWhere(schoolId: string, isDefaultSchool = false) {
  const schoolMatch = schoolIdMatchesActive(schoolId, isDefaultSchool);
  const classMatch = schoolIdMatchesActive(schoolId, isDefaultSchool);
  return {
    OR: [schoolMatch, { class: classMatch }],
  };
}

export function classScopeWhere(schoolId: string, isDefaultSchool = false) {
  return schoolIdMatchesActive(schoolId, isDefaultSchool);
}

/**
 * Filtre pré-inscriptions pour l’établissement actif.
 * Les dossiers sans schoolId (anciennes données) sont rattachés à l’établissement par défaut uniquement.
 */
export function admissionScopeWhere(schoolId: string, isDefaultSchool = false) {
  return schoolIdMatchesActive(schoolId, isDefaultSchool);
}

/** Filtre compta (fournisseurs, dépenses, caisse, budget) par établissement. */
export function accountingScopeWhere(schoolId: string, isDefaultSchool = false) {
  return schoolIdMatchesActive(schoolId, isDefaultSchool);
}

export async function brandingIdForSchool(schoolId: string): Promise<string> {
  const row = await prisma.appBranding.findFirst({
    where: { OR: [{ schoolId }, { id: schoolId }] },
    select: { id: true },
  });
  return row?.id ?? schoolId;
}

