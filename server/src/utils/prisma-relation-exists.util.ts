import type { Prisma } from '@prisma/client';

/**
 * Filtres pour exclure les enregistrements orphelins (cours / enseignant / élève supprimé
 * sans cascade). Sans cela, Prisma lève « Field course is required … got null ».
 */
export const gradeWhereRelationsExist: Pick<
  Prisma.GradeWhereInput,
  'course' | 'teacher' | 'student'
> = {
  course: { is: {} },
  teacher: { is: {} },
  student: { is: {} },
};

export const absenceWhereRelationsExist: Pick<
  Prisma.AbsenceWhereInput,
  'course' | 'teacher' | 'student'
> = {
  course: { is: {} },
  teacher: { is: {} },
  student: { is: {} },
};

export const assignmentWhereRelationsExist: Pick<
  Prisma.AssignmentWhereInput,
  'course' | 'teacher'
> = {
  course: { is: {} },
  teacher: { is: {} },
};
