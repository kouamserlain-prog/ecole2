import express from 'express';
import { body, validationResult } from 'express-validator';
import type { Role } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.middleware';
import prisma from '../utils/prisma';
import { hashPassword, assertPasswordPolicy, PASSWORD_POLICY_HINT } from '../utils/password.util';
import { getAppBrandingDelegate, APP_BRANDING_ID } from '../utils/app-branding-prisma.util';
import { runMongoBackup } from '../utils/mongodb-backup.util';
import { getMetricsSummary } from '../utils/performance-metrics.util';

const router = express.Router();

const PLATFORM_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'TEACHER',
  'STUDENT',
  'PARENT',
  'EDUCATOR',
  'STAFF',
] as const;

type PlatformRole = (typeof PLATFORM_ROLES)[number];

router.use(authenticate);
router.use(authorize('SUPER_ADMIN'));

router.get('/overview', async (_req, res) => {
  try {
    const [
      usersTotal,
      usersActive,
      students,
      teachers,
      parents,
      admins,
      superAdmins,
      classes,
      courses,
      tuitionOpen,
      recentUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.student.count(),
      prisma.teacher.count(),
      prisma.parent.count(),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.user.count({ where: { role: 'SUPER_ADMIN' as Role } }),
      prisma.class.count(),
      prisma.course.count(),
      prisma.tuitionFee.count({ where: { isPaid: false } }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      }),
    ]);

    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: { _all: true },
    });

    let branding: Record<string, unknown> | null = null;
    const appBranding = getAppBrandingDelegate();
    if (appBranding) {
      branding = await appBranding.findUnique({ where: { id: APP_BRANDING_ID } });
    }

    let metrics: ReturnType<typeof getMetricsSummary> | null = null;
    try {
      metrics = getMetricsSummary();
    } catch {
      metrics = null;
    }

    res.json({
      counts: {
        usersTotal,
        usersActive,
        students,
        teachers,
        parents,
        admins,
        superAdmins,
        classes,
        courses,
        tuitionOpen,
      },
      usersByRole: usersByRole.map((r) => ({ role: r.role, count: r._count._all })),
      recentUsers,
      branding,
      metrics,
    });
  } catch (error: unknown) {
    console.error('GET /super-admin/overview:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Erreur serveur',
    });
  }
});

router.get('/users', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const role = typeof req.query.role === 'string' ? req.query.role.trim() : '';
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 200);

    const users = await prisma.user.findMany({
      where: {
        ...(role && (PLATFORM_ROLES as readonly string[]).includes(role)
          ? { role: role as Role }
          : {}),
        ...(q
          ? {
              OR: [
                { email: { contains: q, mode: 'insensitive' } },
                { firstName: { contains: q, mode: 'insensitive' } },
                { lastName: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ users });
  } catch (error: unknown) {
    console.error('GET /super-admin/users:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Erreur serveur',
    });
  }
});

router.post(
  '/users',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').custom(assertPasswordPolicy).withMessage(PASSWORD_POLICY_HINT),
    body('firstName').trim().notEmpty(),
    body('lastName').trim().notEmpty(),
    body('role').isIn([...PLATFORM_ROLES]),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, firstName, lastName, role, phone } = req.body as {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        role: Role;
        phone?: string;
      };

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({ error: 'Un compte existe déjà avec cet e-mail.' });
      }

      const user = await prisma.user.create({
        data: {
          email,
          password: await hashPassword(password),
          firstName,
          lastName,
          role: role as Role,
          phone: phone?.trim() || null,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      res.status(201).json({ user });
    } catch (error: unknown) {
      console.error('POST /super-admin/users:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Erreur serveur',
      });
    }
  },
);

router.patch(
  '/users/:id',
  [
    body('role').optional().isIn(PLATFORM_ROLES),
    body('isActive').optional().isBoolean(),
    body('firstName').optional().trim().notEmpty(),
    body('lastName').optional().trim().notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { role, isActive, firstName, lastName } = req.body as {
        role?: Role;
        isActive?: boolean;
        firstName?: string;
        lastName?: string;
      };

      if (id === req.user!.id && role && role !== 'SUPER_ADMIN') {
        return res.status(400).json({ error: 'Vous ne pouvez pas retirer votre propre rôle super admin.' });
      }
      if (id === req.user!.id && isActive === false) {
        return res.status(400).json({ error: 'Vous ne pouvez pas désactiver votre propre compte.' });
      }

      const user = await prisma.user.update({
        where: { id },
        data: {
          ...(role !== undefined ? { role } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
          ...(firstName !== undefined ? { firstName } : {}),
          ...(lastName !== undefined ? { lastName } : {}),
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          updatedAt: true,
        },
      });

      res.json({ user });
    } catch (error: unknown) {
      console.error('PATCH /super-admin/users/:id:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Erreur serveur',
      });
    }
  },
);

router.post('/backup', async (_req, res) => {
  try {
    const result = await runMongoBackup();
    res.json(result);
  } catch (error: unknown) {
    console.error('POST /super-admin/backup:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Échec de la sauvegarde',
    });
  }
});

export default router;
