import type { Prisma } from '@prisma/client';
import prisma from './prisma';
import { studentScopeWhere, classScopeWhere } from './school-context.util';

export class SchoolAccessDeniedError extends Error {
  status = 403;
  constructor(message = 'Accès refusé pour cet établissement.') {
    super(message);
    this.name = 'SchoolAccessDeniedError';
  }
}

const OBJECT_ID = /^[a-f\d]{24}$/i;

export function isObjectId(value: string): boolean {
  return OBJECT_ID.test(value);
}

export async function studentBelongsToSchool(studentId: string, schoolId: string): Promise<boolean> {
  if (!isObjectId(studentId)) return false;
  const row = await prisma.student.findFirst({
    where: { id: studentId, ...studentScopeWhere(schoolId) },
    select: { id: true },
  });
  return !!row;
}

export async function assertStudentInSchool(studentId: string, schoolId: string | undefined): Promise<void> {
  if (!schoolId) throw new SchoolAccessDeniedError('Établissement actif requis (en-tête X-School-Id).');
  if (!(await studentBelongsToSchool(studentId, schoolId))) {
    throw new SchoolAccessDeniedError('Élève introuvable dans cet établissement.');
  }
}

export async function assertClassInSchool(classId: string, schoolId: string | undefined): Promise<void> {
  if (!schoolId) throw new SchoolAccessDeniedError('Établissement actif requis (en-tête X-School-Id).');
  if (!isObjectId(classId)) throw new SchoolAccessDeniedError('Classe invalide.');
  const row = await prisma.class.findFirst({
    where: { id: classId, ...classScopeWhere(schoolId) },
    select: { id: true },
  });
  if (!row) throw new SchoolAccessDeniedError('Classe introuvable dans cet établissement.');
}

export async function assertTuitionFeeInSchool(feeId: string, schoolId: string | undefined): Promise<void> {
  if (!schoolId) throw new SchoolAccessDeniedError('Établissement actif requis (en-tête X-School-Id).');
  const row = await prisma.tuitionFee.findFirst({
    where: { id: feeId, student: studentScopeWhere(schoolId) },
    select: { id: true },
  });
  if (!row) throw new SchoolAccessDeniedError('Frais introuvable dans cet établissement.');
}

export async function assertPaymentInSchool(paymentId: string, schoolId: string | undefined): Promise<void> {
  if (!schoolId) throw new SchoolAccessDeniedError('Établissement actif requis (en-tête X-School-Id).');
  const row = await prisma.payment.findFirst({
    where: { id: paymentId, student: studentScopeWhere(schoolId) },
    select: { id: true },
  });
  if (!row) throw new SchoolAccessDeniedError('Paiement introuvable dans cet établissement.');
}

/** Filtre Prisma : élève rattaché à l’établissement actif. */
export function scopedStudentWhere(schoolId: string): Prisma.StudentWhereInput {
  return studentScopeWhere(schoolId);
}

/** Filtre Prisma : frais de scolarité des élèves de l’établissement. */
export function scopedTuitionFeeWhere(schoolId: string): Prisma.TuitionFeeWhereInput {
  return { student: studentScopeWhere(schoolId) };
}

/** Filtre Prisma : paiements des élèves de l’établissement. */
export function scopedPaymentWhere(schoolId: string): Prisma.PaymentWhereInput {
  return { student: studentScopeWhere(schoolId) };
}

/** Filtre Prisma : parents ayant au moins un enfant dans l’établissement. */
export function scopedParentWhere(schoolId: string): Prisma.ParentWhereInput {
  return {
    students: {
      some: {
        student: studentScopeWhere(schoolId),
      },
    },
  };
}

export async function assertParentInSchool(parentId: string, schoolId: string | undefined): Promise<void> {
  if (!schoolId) throw new SchoolAccessDeniedError('Établissement actif requis (en-tête X-School-Id).');
  if (!isObjectId(parentId)) throw new SchoolAccessDeniedError('Parent invalide.');
  const row = await prisma.parent.findFirst({
    where: { id: parentId, ...scopedParentWhere(schoolId) },
    select: { id: true },
  });
  if (!row) throw new SchoolAccessDeniedError('Parent introuvable dans cet établissement.');
}

export function mergeWhereWithSchoolScope<T extends Record<string, unknown>>(
  base: T,
  schoolScope: Record<string, unknown>,
): T & Record<string, unknown> {
  const keys = Object.keys(base);
  if (keys.length === 0) return { ...schoolScope } as T & Record<string, unknown>;
  return { AND: [base, schoolScope] } as unknown as T & Record<string, unknown>;
}
