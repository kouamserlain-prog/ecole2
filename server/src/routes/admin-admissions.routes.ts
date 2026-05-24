import express from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma';
import { optionalPasswordPolicyValidator, PASSWORD_POLICY_HINT } from '../utils/password.util';
import type { SchoolContextRequest } from '../utils/school-context.util';
import { admissionScopeWhere } from '../utils/school-context.util';
import { enrollStudentFromAdmission } from '../utils/admission-enroll.util';
import type { AuthRequest } from '../middleware/auth.middleware';

const router = express.Router();


async function admissionsWithEnrolledStudents<A extends { enrolledStudentId: string | null }>(
  rows: A[],
  mode: 'list' | 'detail' | 'patch'
): Promise<(A & { enrolledStudent: unknown })[]> {
  const ids = [...new Set(rows.map((r) => r.enrolledStudentId).filter(Boolean))] as string[];
  if (ids.length === 0) {
    return rows.map((r) => ({ ...r, enrolledStudent: null }));
  }
  const include =
    mode === 'list'
      ? {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
          class: { select: { id: true, name: true, level: true } },
        }
      : mode === 'detail'
        ? {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
            class: true,
          }
        : {
            user: { select: { email: true, firstName: true, lastName: true } },
          };
  const students = await prisma.student.findMany({
    where: { id: { in: ids } },
    include,
  });
  const map = new Map(students.map((s) => [s.id, s]));
  return rows.map((r) => ({
    ...r,
    enrolledStudent: r.enrolledStudentId ? map.get(r.enrolledStudentId) ?? null : null,
  }));
}

router.get('/admissions', async (req: SchoolContextRequest, res) => {
  try {
    const { status, academicYear } = req.query;
    const schoolId = req.schoolId!;
    const admissions = await prisma.admission.findMany({
      where: {
        ...admissionScopeWhere(schoolId, req.school?.isDefault),
        ...(status && typeof status === 'string' ? { status: status as any } : {}),
        ...(academicYear && typeof academicYear === 'string'
          ? { academicYear: academicYear }
          : {}),
      },
      include: {
        proposedClass: {
          select: { id: true, name: true, level: true, academicYear: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const enriched = await admissionsWithEnrolledStudents(admissions, 'list');
    res.json(enriched);
  } catch (error: any) {
    console.error('GET /admissions:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.get('/admissions/stats', async (req: SchoolContextRequest, res) => {
  try {
    const admissionWhere = admissionScopeWhere(req.schoolId!, req.school?.isDefault);
    const [pending, underReview, accepted, total] = await Promise.all([
      prisma.admission.count({ where: { ...admissionWhere, status: 'PENDING' } }),
      prisma.admission.count({ where: { ...admissionWhere, status: 'UNDER_REVIEW' } }),
      prisma.admission.count({ where: { ...admissionWhere, status: 'ACCEPTED' } }),
      prisma.admission.count({ where: admissionWhere }),
    ]);
    res.json({ pending, underReview, accepted, total });
  } catch (error: any) {
    console.error('GET /admissions/stats:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.get('/admissions/:id', async (req, res) => {
  try {
    const admission = await prisma.admission.findUnique({
      where: { id: req.params.id },
      include: {
        proposedClass: true,
      },
    });
    if (!admission) {
      return res.status(404).json({ error: 'Dossier introuvable' });
    }
    const [enriched] = await admissionsWithEnrolledStudents([admission], 'detail');
    res.json(enriched);
  } catch (error: any) {
    console.error('GET /admissions/:id:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.patch(
  '/admissions/:id',
  [
    body('status')
      .optional()
      .isIn(['PENDING', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'WAITLIST', 'ENROLLED'])
      .withMessage('Statut invalide'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const existing = await prisma.admission.findUnique({
        where: { id: req.params.id },
      });
      if (!existing) {
        return res.status(404).json({ error: 'Dossier introuvable' });
      }
      if (existing.status === 'ENROLLED' && req.body.status && req.body.status !== 'ENROLLED') {
        return res.status(400).json({ error: 'Impossible de modifier le statut d\'un dossier déjà inscrit' });
      }

      const { status, adminNotes, proposedClassId } = req.body;
      const adminId = (req as any).user?.id;

      if (status === 'ENROLLED' && !existing.enrolledStudentId) {
        return res.status(400).json({
          error:
            'Le statut « Inscrit » est attribué automatiquement après création du compte élève (action Inscrire).',
        });
      }

      const data: any = {
        ...(status !== undefined && { status }),
        ...(adminNotes !== undefined && { adminNotes: adminNotes === '' ? null : String(adminNotes) }),
        ...(proposedClassId !== undefined && {
          proposedClassId: proposedClassId === '' || proposedClassId === null ? null : proposedClassId,
        }),
        ...(status !== undefined &&
          status !== existing.status && {
            reviewedAt: new Date(),
            reviewedById: adminId,
          }),
      };

      const updated = await prisma.admission.update({
        where: { id: req.params.id },
        data,
        include: {
          proposedClass: { select: { id: true, name: true, level: true } },
        },
      });

      const [enriched] = await admissionsWithEnrolledStudents([updated], 'patch');

      try {
        await prisma.securityEvent.create({
          data: {
            userId: adminId,
            type: 'admission_updated',
            description: `Dossier ${existing.reference}: ${status ?? existing.status}`,
            ipAddress: req.ip || req.socket.remoteAddress,
            userAgent: req.get('user-agent'),
            severity: 'info',
          },
        });
      } catch (_) {
        /* ignore */
      }

      res.json(enriched);
    } catch (error: any) {
      console.error('PATCH /admissions/:id:', error);
      res.status(500).json({ error: error.message || 'Erreur serveur' });
    }
  }
);

router.post(
  '/admissions/:id/enroll',
  [
    body('password')
      .optional({ values: 'falsy' })
      .trim()
      .custom(optionalPasswordPolicyValidator)
      .withMessage(PASSWORD_POLICY_HINT),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const result = await enrollStudentFromAdmission(
        req.params.id,
        req.user!.id,
        req.body,
        req,
      );
      res.status(201).json(result);
    } catch (error: unknown) {
      const err = error as Error & { statusCode?: number };
      console.error('POST /admissions/:id/enroll:', error);
      const code = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
      res.status(code).json({ error: err.message || 'Erreur serveur' });
    }
  }
);



export default router;
