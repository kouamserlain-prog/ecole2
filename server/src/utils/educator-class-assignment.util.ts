import type { Prisma } from '@prisma/client';
import prisma from './prisma';

const objectIdHex = /^[a-f0-9]{24}$/i;

export function parseEducatorClassIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw
    .filter((id): id is string => typeof id === 'string' && objectIdHex.test(id.trim()))
    .map((id) => id.trim());
  return [...new Set(ids)];
}

export async function getAssignedClassIds(educatorId: string): Promise<string[]> {
  const rows = await prisma.educatorClassAssignment.findMany({
    where: { educatorId },
    select: { classId: true },
  });
  return rows.map((r) => r.classId);
}

export async function getAssignedClassIdsForUserId(userId: string): Promise<string[] | null> {
  const educator = await prisma.educator.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!educator) return null;
  return getAssignedClassIds(educator.id);
}

export async function syncEducatorClassAssignments(
  educatorId: string,
  classIds: string[],
): Promise<void> {
  const unique = [...new Set(classIds)];
  if (unique.length === 0) {
    await prisma.educatorClassAssignment.deleteMany({ where: { educatorId } });
    return;
  }

  const existingClasses = await prisma.class.findMany({
    where: { id: { in: unique } },
    select: { id: true },
  });
  const validIds = new Set(existingClasses.map((c) => c.id));
  const invalid = unique.filter((id) => !validIds.has(id));
  if (invalid.length > 0) {
    throw new Error(`Classes introuvables : ${invalid.join(', ')}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.educatorClassAssignment.deleteMany({ where: { educatorId } });
    if (unique.length > 0) {
      await tx.educatorClassAssignment.createMany({
        data: unique.map((classId) => ({ educatorId, classId })),
      });
    }
  });
}

export async function isStudentInEducatorScope(
  educatorUserId: string,
  studentId: string,
): Promise<boolean> {
  const classIds = await getAssignedClassIdsForUserId(educatorUserId);
  if (classIds === null || classIds.length === 0) return false;

  const student = await prisma.student.findFirst({
    where: { id: studentId, ...studentClassFilter(classIds) },
    select: { id: true },
  });
  return !!student;
}

export async function isClassInEducatorScope(
  educatorUserId: string,
  classId: string,
): Promise<boolean> {
  const classIds = await getAssignedClassIdsForUserId(educatorUserId);
  if (!classIds?.length) return false;
  return classIds.includes(classId);
}

export function studentClassFilter(classIds: string[]): Prisma.StudentWhereInput {
  if (classIds.length === 0) {
    return { id: { in: [] } };
  }
  return { classId: { in: classIds }, isActive: true };
}

export function classIdFilter(classIds: string[]): Prisma.ClassWhereInput {
  if (classIds.length === 0) {
    return { id: { in: [] } };
  }
  return { id: { in: classIds } };
}

export const educatorClassAssignmentInclude = {
  classAssignments: {
    include: {
      class: { select: { id: true, name: true, level: true, academicYear: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
} as const;
