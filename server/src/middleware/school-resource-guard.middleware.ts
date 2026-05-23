import type { Response, NextFunction } from 'express';
import {
  assertStudentInSchool,
  isObjectId,
  SchoolAccessDeniedError,
} from '../utils/school-access-guard.util';
import type { SchoolContextRequest } from '../utils/school-context.util';

function respondSchoolAccessDenied(res: Response, error: unknown, next: NextFunction): void {
  if (error instanceof SchoolAccessDeniedError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  next(error);
}

/** Vérifie que :id ou :studentId désigne un élève de l’établissement actif (routes admin). */
export async function guardAdminStudentRoute(
  req: SchoolContextRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const studentId = req.params.id ?? req.params.studentId;
  if (!studentId || !isObjectId(studentId)) {
    next();
    return;
  }
  try {
    await assertStudentInSchool(studentId, req.schoolId);
    next();
  } catch (error) {
    respondSchoolAccessDenied(res, error, next);
  }
}
