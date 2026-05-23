import express from 'express';
import prisma from '../utils/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware';
import {
  assertStaffHasModule,
  type StaffModuleId,
} from '../utils/staff-visible-modules.util';
import libraryManagementRoutes from './shared/library-management.routes';
import digitalLibraryManagementRoutes from './shared/digital-library-management.routes';

const router = express.Router();

function requireStaffModule(moduleId: StaffModuleId) {
  return async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    try {
      await assertStaffHasModule(req.user!.id, moduleId);
      next();
    } catch (e: unknown) {
      if (e instanceof Error) {
        if (e.message === 'MODULE_NOT_ALLOWED' || e.message === 'STAFF_PROFILE_NOT_FOUND') {
          return res.status(403).json({
            error: 'Module non autorisé pour votre compte personnel',
            code: e.message,
          });
        }
      }
      next(e);
    }
  };
}

async function requireLibraryOrDigitalModule(
  req: AuthRequest,
  res: express.Response,
  next: express.NextFunction,
) {
  try {
    await assertStaffHasModule(req.user!.id, 'library');
    return next();
  } catch {
    try {
      await assertStaffHasModule(req.user!.id, 'digital_library');
      return next();
    } catch (e: unknown) {
      if (e instanceof Error) {
        if (e.message === 'MODULE_NOT_ALLOWED' || e.message === 'STAFF_PROFILE_NOT_FOUND') {
          return res.status(403).json({
            error: 'Module non autorisé pour votre compte personnel',
            code: e.message,
          });
        }
      }
      return next(e);
    }
  }
}

const staffOnly = [authenticate, authorize('STAFF')];
const libraryAccess = [...staffOnly, requireStaffModule('library')];
const digitalAccess = [...staffOnly, requireLibraryOrDigitalModule];

/** Ne pas bloquer /admissions, /pedagogy, etc. — ce routeur est monté à la racine /staff. */
router.use((req, res, next) => {
  if (!req.path.startsWith('/library')) {
    return next('router');
  }
  next();
});

router.get('/library/users', ...libraryAccess, async (req, res) => {
  try {
    const { isActive } = req.query;
    const users = await prisma.user.findMany({
      where: {
        ...(isActive !== undefined && { isActive: isActive === 'true' }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 500,
    });
    res.json(users);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.use(...libraryAccess, libraryManagementRoutes);
router.use(...digitalAccess, digitalLibraryManagementRoutes);

export default router;
