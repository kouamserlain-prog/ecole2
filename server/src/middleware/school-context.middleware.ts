import { Response, NextFunction } from 'express';
import {
  resolveActiveSchoolForRequest,
  SchoolPrismaNotReadyError,
  type SchoolContextRequest,
} from '../utils/school-context.util';
import { SCHOOL_PRISMA_HINT } from '../utils/school-prisma.util';

/**
 * Résout l’établissement actif (header X-School-Id ou établissement par défaut de l’utilisateur).
 * Les routes publiques peuvent l’utiliser sans authentification (query ?school=slug).
 */
export async function attachSchoolContext(
  req: SchoolContextRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const ctx = await resolveActiveSchoolForRequest(req);
    if (!ctx) {
      return res.status(400).json({
        error:
          'Établissement introuvable ou accès refusé. Sélectionnez un collège dans le menu ou précisez ?school=slug.',
      });
    }
    req.schoolId = ctx.schoolId;
    req.school = ctx.school;
    next();
  } catch (error: unknown) {
    if (error instanceof SchoolPrismaNotReadyError) {
      console.error('[school] Client Prisma à régénérer —', SCHOOL_PRISMA_HINT);
      return res.status(503).json({ error: SCHOOL_PRISMA_HINT });
    }
    console.error('attachSchoolContext:', error);
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(500).json({ error: message });
  }
}

/** Contexte optionnel : ne bloque pas si aucun établissement (stats globales super-admin). */
export async function attachSchoolContextOptional(
  req: SchoolContextRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const ctx = await resolveActiveSchoolForRequest(req);
    if (ctx) {
      req.schoolId = ctx.schoolId;
      req.school = ctx.school;
    }
    next();
  } catch (error: unknown) {
    console.error('attachSchoolContextOptional:', error);
    next();
  }
}
