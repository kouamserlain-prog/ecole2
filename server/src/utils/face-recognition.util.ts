import type { Prisma } from '@prisma/client';
import prisma from './prisma';

export type FacePersonType = 'STUDENT' | 'TEACHER' | 'STAFF';

export type FaceMatchResult = {
  personType: FacePersonType;
  personId: string;
  displayName: string;
  distance: number;
  employeeOrStudentCode?: string | null;
};

const DESCRIPTOR_LENGTH = 128;

export function parseFaceDescriptor(raw: unknown): number[] {
  if (!Array.isArray(raw) || raw.length !== DESCRIPTOR_LENGTH) {
    throw Object.assign(new Error(`Le descripteur facial doit contenir ${DESCRIPTOR_LENGTH} valeurs.`), {
      status: 400,
    });
  }
  const descriptor = raw.map((v) => Number(v));
  if (descriptor.some((n) => !Number.isFinite(n))) {
    throw Object.assign(new Error('Descripteur facial invalide.'), { status: 400 });
  }
  return descriptor;
}

export function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - b[i]!;
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function matchThreshold(): number {
  const n = parseFloat(process.env.FACE_MATCH_THRESHOLD || '0.55');
  return Number.isFinite(n) ? Math.max(0.3, Math.min(0.9, n)) : 0.55;
}

function descriptorFromJson(value: Prisma.JsonValue | null): number[] | null {
  if (!value || !Array.isArray(value) || value.length !== DESCRIPTOR_LENGTH) return null;
  const arr = value.map((v) => Number(v));
  if (arr.some((n) => !Number.isFinite(n))) return null;
  return arr;
}

type EnrolledRow = {
  personType: FacePersonType;
  personId: string;
  displayName: string;
  employeeOrStudentCode?: string | null;
  descriptor: number[];
};

async function loadEnrolledRows(filter?: FacePersonType): Promise<EnrolledRow[]> {
  const rows: EnrolledRow[] = [];

  if (!filter || filter === 'STUDENT') {
    const students = await prisma.student.findMany({
      where: { faceEnrolledAt: { not: null }, isActive: true },
      select: {
        id: true,
        studentId: true,
        faceDescriptor: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });
    for (const s of students) {
      const descriptor = descriptorFromJson(s.faceDescriptor);
      if (!descriptor) continue;
      rows.push({
        personType: 'STUDENT',
        personId: s.id,
        displayName: `${s.user.firstName} ${s.user.lastName}`.trim(),
        employeeOrStudentCode: s.studentId,
        descriptor,
      });
    }
  }

  if (!filter || filter === 'TEACHER') {
    const teachers = await prisma.teacher.findMany({
      where: { faceEnrolledAt: { not: null } },
      select: {
        id: true,
        employeeId: true,
        faceDescriptor: true,
        user: { select: { firstName: true, lastName: true, isActive: true } },
      },
    });
    for (const t of teachers) {
      if (!t.user.isActive) continue;
      const descriptor = descriptorFromJson(t.faceDescriptor);
      if (!descriptor) continue;
      rows.push({
        personType: 'TEACHER',
        personId: t.id,
        displayName: `${t.user.firstName} ${t.user.lastName}`.trim(),
        employeeOrStudentCode: t.employeeId,
        descriptor,
      });
    }
  }

  if (!filter || filter === 'STAFF') {
    const staff = await prisma.staffMember.findMany({
      where: { faceEnrolledAt: { not: null } },
      select: {
        id: true,
        employeeId: true,
        faceDescriptor: true,
        user: { select: { firstName: true, lastName: true, isActive: true } },
      },
    });
    for (const s of staff) {
      if (!s.user.isActive) continue;
      const descriptor = descriptorFromJson(s.faceDescriptor);
      if (!descriptor) continue;
      rows.push({
        personType: 'STAFF',
        personId: s.id,
        displayName: `${s.user.firstName} ${s.user.lastName}`.trim(),
        employeeOrStudentCode: s.employeeId,
        descriptor,
      });
    }
  }

  return rows;
}

/** Retourne la meilleure correspondance sous le seuil, ou null. */
export async function findBestFaceMatch(
  probe: number[],
  options?: { personType?: FacePersonType },
): Promise<FaceMatchResult | null> {
  const enrolled = await loadEnrolledRows(options?.personType);
  if (enrolled.length === 0) return null;

  const threshold = matchThreshold();
  let best: FaceMatchResult | null = null;

  for (const row of enrolled) {
    const distance = euclideanDistance(probe, row.descriptor);
    if (distance > threshold) continue;
    if (!best || distance < best.distance) {
      best = {
        personType: row.personType,
        personId: row.personId,
        displayName: row.displayName,
        distance,
        employeeOrStudentCode: row.employeeOrStudentCode ?? null,
      };
    }
  }

  return best;
}

export async function countFaceEnrollments(): Promise<{
  students: number;
  teachers: number;
  staff: number;
  total: number;
}> {
  const [students, teachers, staff] = await Promise.all([
    prisma.student.count({ where: { faceEnrolledAt: { not: null } } }),
    prisma.teacher.count({ where: { faceEnrolledAt: { not: null } } }),
    prisma.staffMember.count({ where: { faceEnrolledAt: { not: null } } }),
  ]);
  return { students, teachers, staff, total: students + teachers + staff };
}

export async function saveFaceDescriptor(
  personType: FacePersonType,
  personId: string,
  descriptor: number[],
): Promise<void> {
  const data = {
    faceDescriptor: descriptor as unknown as Prisma.InputJsonValue,
    faceEnrolledAt: new Date(),
  };

  if (personType === 'STUDENT') {
    await prisma.student.update({ where: { id: personId }, data });
    return;
  }
  if (personType === 'TEACHER') {
    await prisma.teacher.update({ where: { id: personId }, data });
    return;
  }
  await prisma.staffMember.update({ where: { id: personId }, data });
}

export async function clearFaceDescriptor(
  personType: FacePersonType,
  personId: string,
): Promise<void> {
  const data = { faceDescriptor: null, faceEnrolledAt: null };
  if (personType === 'STUDENT') {
    await prisma.student.update({ where: { id: personId }, data });
    return;
  }
  if (personType === 'TEACHER') {
    await prisma.teacher.update({ where: { id: personId }, data });
    return;
  }
  await prisma.staffMember.update({ where: { id: personId }, data });
}
