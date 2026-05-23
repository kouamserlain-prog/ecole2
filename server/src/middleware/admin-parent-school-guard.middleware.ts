import type { Response, NextFunction } from 'express';
import {
  assertParentInSchool,
  isObjectId,
  SchoolAccessDeniedError,
} from '../utils/school-access-guard.util';
import type { SchoolContextRequest } from '../utils/school-context.util';

/** Vérifie que le parent ciblé appartient à l’établissement actif (:id ou :parentId). */
export async function guardAdminParentRoute(
  req: SchoolContextRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parentId = req.params.id ?? req.params.parentId;
  if (!parentId || !isObjectId(parentId)) {
    res.status(400).json({ error: 'Identifiant parent invalide' });
    return;
  }
  try {
    await assertParentInSchool(parentId, req.schoolId);
    next();
  } catch (e) {
    if (e instanceof SchoolAccessDeniedError) {
      res.status(e.status).json({ error: e.message });
      return;
    }
    next(e);
  }
}
