import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';
import { getStaffMemberModuleContext } from '../utils/staff-visible-modules.util';
import {
  isStaffModuleAdminPath,
  staffModuleAdminPathAllowed,
} from '../utils/staff-module-admin-access.util';

/**
 * Autorise ADMIN / SUPER_ADMIN, ou STAFF dont un module visible couvre la route /admin demandée.
 */
export async function authorizeAdminOrStaffFinance(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'Non authentifié' });
    return;
  }

  const role = user.role;
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
    next();
    return;
  }

  if (role !== 'STAFF') {
    res.status(403).json({ error: 'Accès réservé à l’administration ou au personnel autorisé.' });
    return;
  }

  const path = req.path || '/';
  const method = req.method.toUpperCase();

  if (!isStaffModuleAdminPath(path, method)) {
    res.status(403).json({ error: 'Cette action est réservée aux administrateurs.' });
    return;
  }

  try {
    const ctx = await getStaffMemberModuleContext(user.id);
    if (!ctx) {
      res.status(403).json({ error: 'Profil personnel introuvable.' });
      return;
    }

    if (staffModuleAdminPathAllowed(ctx.visibleModules, path, method)) {
      next();
      return;
    }

    res.status(403).json({
      error: 'Ce module n’est pas activé pour votre compte. Contactez l’administration.',
    });
  } catch {
    res.status(500).json({ error: 'Erreur de vérification des droits.' });
  }
}
