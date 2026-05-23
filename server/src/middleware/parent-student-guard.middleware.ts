import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';
import {
  assertParentOwnsStudent,
  getParentIdForUser,
} from '../utils/parent-teacher-appointment.util';
import { isObjectId } from '../utils/school-access-guard.util';

export type ParentAuthRequest = AuthRequest & { parentId?: string };

/** Vérifie que le parent connecté est bien lié à l’élève :studentId. */
export async function guardParentOwnsStudentParam(
  req: ParentAuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { studentId } = req.params;
  if (!studentId || !isObjectId(studentId)) {
    res.status(400).json({ error: 'Identifiant élève invalide' });
    return;
  }
  const parentId = await getParentIdForUser(req.user!.id);
  if (!parentId) {
    res.status(404).json({ error: 'Parent non trouvé' });
    return;
  }
  try {
    await assertParentOwnsStudent(parentId, studentId);
    req.parentId = parentId;
    next();
  } catch {
    res.status(403).json({ error: 'Accès refusé — cet élève n’est pas associé à votre compte.' });
  }
}
