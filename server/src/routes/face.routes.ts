import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize, type AuthRequest } from '../middleware/auth.middleware';
import { verifyDeviceApiKey } from '../middleware/device-api-key.middleware';
import { deviceBiometricLimiter } from '../middleware/rate-limit.middleware';
import {
  clearFaceDescriptor,
  countFaceEnrollments,
  findBestFaceMatch,
  parseFaceDescriptor,
  saveFaceDescriptor,
  type FacePersonType,
} from '../utils/face-recognition.util';
import { executeFacePunch } from '../utils/face-punch.util';

const router = express.Router();

function hasDeviceApiKeyAttempt(req: express.Request): boolean {
  const header = req.headers['x-nfc-api-key'];
  const bodyKey = req.body?.apiKey;
  return (
    (typeof header === 'string' && header.length > 0) ||
    (typeof bodyKey === 'string' && bodyKey.length > 0)
  );
}

function requireAdminOrDevice(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  if (hasDeviceApiKeyAttempt(req)) return verifyDeviceApiKey(req, res, next);
  return authenticate(req as AuthRequest, res, () =>
    authorize('ADMIN', 'SUPER_ADMIN')(req as AuthRequest, res, next),
  );
}

/** Statistiques d’enrôlement (admin). */
router.get('/stats', authenticate, authorize('ADMIN', 'SUPER_ADMIN'), async (_req, res) => {
  try {
    const counts = await countFaceEnrollments();
    res.json({
      ...counts,
      matchThreshold: parseFloat(process.env.FACE_MATCH_THRESHOLD || '0.55'),
    });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur serveur' });
  }
});

/** Enregistrer / mettre à jour le visage d’une personne. */
router.post(
  '/enroll',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  [
    body('personType').isIn(['STUDENT', 'TEACHER', 'STAFF']),
    body('personId').notEmpty(),
    body('descriptor').isArray({ min: 128, max: 128 }),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const personType = req.body.personType as FacePersonType;
      const personId = String(req.body.personId);
      const descriptor = parseFaceDescriptor(req.body.descriptor);

      await saveFaceDescriptor(personType, personId, descriptor);
      res.json({
        ok: true,
        personType,
        personId,
        enrolledAt: new Date().toISOString(),
      });
    } catch (e: unknown) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 500).json({ error: err.message || 'Erreur serveur' });
    }
  },
);

/** Supprimer l’enrôlement facial. */
router.delete(
  '/enroll/:personType/:personId',
  authenticate,
  authorize('ADMIN', 'SUPER_ADMIN'),
  async (req, res) => {
    try {
      const personType = req.params.personType as FacePersonType;
      if (!['STUDENT', 'TEACHER', 'STAFF'].includes(personType)) {
        return res.status(400).json({ error: 'personType invalide' });
      }
      await clearFaceDescriptor(personType, req.params.personId);
      res.json({ ok: true });
    } catch (e: unknown) {
      res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur serveur' });
    }
  },
);

/** Identifier un visage sans pointer (admin / debug). */
router.post(
  '/match',
  deviceBiometricLimiter,
  requireAdminOrDevice,
  [body('descriptor').isArray({ min: 128, max: 128 }), body('personType').optional().isIn(['STUDENT', 'TEACHER', 'STAFF'])],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const descriptor = parseFaceDescriptor(req.body.descriptor);
      const match = await findBestFaceMatch(descriptor, {
        personType: req.body.personType as FacePersonType | undefined,
      });
      if (!match) {
        return res.status(404).json({
          success: false,
          error: 'Aucun visage correspondant dans la base.',
        });
      }
      res.json({ success: true, match });
    } catch (e: unknown) {
      const err = e as Error & { status?: number };
      res.status(err.status ?? 500).json({ error: err.message || 'Erreur serveur' });
    }
  },
);

/** Pointage par reconnaissance faciale (terminal ou interface admin). */
router.post(
  '/punch',
  deviceBiometricLimiter,
  requireAdminOrDevice,
  [
    body('descriptor').isArray({ min: 128, max: 128 }),
    body('courseId').optional().isString(),
    body('date').optional().isISO8601(),
    body('personType').optional().isIn(['STUDENT', 'TEACHER', 'STAFF']),
    body('notifyParentsOnSave').optional().isBoolean(),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const descriptor = parseFaceDescriptor(req.body.descriptor);
      const match = await findBestFaceMatch(descriptor, {
        personType: req.body.personType as FacePersonType | undefined,
      });

      if (!match) {
        return res.status(404).json({
          success: false,
          error: 'Visage non reconnu. Enregistrez le profil ou réessayez.',
        });
      }

      const result = await executeFacePunch({
        match,
        courseId: req.body.courseId,
        at: req.body.date ? new Date(req.body.date) : new Date(),
        notifyParents: req.body.notifyParentsOnSave !== false,
        recordedByUserId: req.user?.id,
      });

      res.status(200).json(result);
    } catch (e: unknown) {
      const err = e as Error & { status?: number; statusCode?: number };
      const code = err.status ?? err.statusCode ?? 500;
      res.status(code).json({
        success: false,
        error: err.message || 'Pointage impossible',
      });
    }
  },
);

export default router;
