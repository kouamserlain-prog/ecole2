import express from 'express';
import { body, validationResult } from 'express-validator';
import type { AdmissionStatus, ParentTeacherAppointmentStatus } from '@prisma/client';
import prisma from '../utils/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware';
import {
  assertStaffHasModule,
  getStaffMemberModuleContext,
  type StaffModuleId,
} from '../utils/staff-visible-modules.util';
import {
  listPendingCashPayments,
  rejectCashPayment,
  validateCashPayment,
} from '../utils/cash-payment-validation.util';
import { enrollStudentFromAdmission } from '../utils/admission-enroll.util';
import { admissionScopeWhere } from '../utils/school-context.util';
import { ensureDefaultSchool } from '../utils/ensure-default-school.util';
import { optionalPasswordPolicyValidator, PASSWORD_POLICY_HINT } from '../utils/password.util';

const router = express.Router();

router.use(authenticate);
router.use(authorize('STAFF'));

const CASH_VALIDATION_MODULES: StaffModuleId[] = [
  'treasury',
  'payments_mgmt',
  'fees_mgmt',
  'counter',
];

function requireStaffAnyModule(moduleIds: StaffModuleId[]) {
  return async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    try {
      const ctx = await getStaffMemberModuleContext(req.user!.id);
      if (!ctx) {
        return res.status(403).json({ error: 'Profil personnel introuvable.' });
      }
      if (!moduleIds.some((m) => ctx.visibleModules.includes(m))) {
        return res.status(403).json({
          error:
            'Le module Paiements / Trésorerie n’est pas activé pour votre compte. Contactez l’administration.',
        });
      }
      next();
    } catch (e: unknown) {
      next(e);
    }
  };
}

function requireStaffModule(moduleId: StaffModuleId) {
  return async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    try {
      await assertStaffHasModule(req.user!.id, moduleId);
      next();
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'STAFF_PROFILE_NOT_FOUND') {
        return res.status(403).json({
          error: 'Profil personnel introuvable. Contactez l’administration pour rattacher votre compte.',
          code: 'STAFF_PROFILE_NOT_FOUND',
        });
      }
      if (e instanceof Error && e.message === 'MODULE_NOT_ALLOWED') {
        return res.status(403).json({
          error:
            'Le module « Inscriptions & admissions » n’est pas activé pour votre compte. Reconnectez-vous ou demandez l’accès à l’administration.',
          code: 'MODULE_NOT_ALLOWED',
        });
      }
      next(e);
    }
  };
}

const SECRETARY_ADMISSION_STATUSES = new Set<AdmissionStatus>([
  'PENDING',
  'UNDER_REVIEW',
  'ACCEPTED',
  'REJECTED',
  'WAITLIST',
]);

async function staffAdmissionScope(): Promise<ReturnType<typeof admissionScopeWhere>> {
  const defaultId = await ensureDefaultSchool();
  return admissionScopeWhere(defaultId, true);
}

// ——— Secrétariat : admissions ———

router.get('/admissions/stats', requireStaffModule('admissions'), async (_req, res) => {
  try {
    const scope = await staffAdmissionScope();
    const [pending, underReview, accepted, total] = await Promise.all([
      prisma.admission.count({ where: { ...scope, status: 'PENDING' } }),
      prisma.admission.count({ where: { ...scope, status: 'UNDER_REVIEW' } }),
      prisma.admission.count({ where: { ...scope, status: 'ACCEPTED' } }),
      prisma.admission.count({ where: scope }),
    ]);
    res.json({ pending, underReview, accepted, total });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/admissions/classes', requireStaffModule('admissions'), async (_req, res) => {
  try {
    const classes = await prisma.class.findMany({
      select: { id: true, name: true, level: true, academicYear: true },
      orderBy: [{ academicYear: 'desc' }, { name: 'asc' }],
    });
    res.json(classes);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/admissions', requireStaffModule('admissions'), async (req, res) => {
  try {
    const { status, academicYear, q } = req.query;
    const scope = await staffAdmissionScope();
    const admissions = await prisma.admission.findMany({
      where: {
        ...scope,
        ...(status && typeof status === 'string' ? { status: status as AdmissionStatus } : {}),
        ...(academicYear && typeof academicYear === 'string' ? { academicYear } : {}),
        ...(q && typeof q === 'string' && q.trim()
          ? {
              OR: [
                { firstName: { contains: q.trim() } },
                { lastName: { contains: q.trim() } },
                { email: { contains: q.trim() } },
                { reference: { contains: q.trim() } },
              ],
            }
          : {}),
      },
      include: {
        proposedClass: { select: { id: true, name: true, level: true, academicYear: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 150,
    });
    res.json(admissions);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.patch(
  '/admissions/:id',
  requireStaffModule('admissions'),
  body('status').optional().isString(),
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const existing = await prisma.admission.findUnique({ where: { id: req.params.id } });
      if (!existing) return res.status(404).json({ error: 'Dossier introuvable' });
      if (existing.status === 'ENROLLED') {
        return res.status(400).json({ error: 'Dossier déjà inscrit — modification limitée' });
      }

      const { status, adminNotes, proposedClassId } = req.body ?? {};
      if (status && !SECRETARY_ADMISSION_STATUSES.has(status as AdmissionStatus)) {
        return res.status(400).json({ error: 'Statut non autorisé au secrétariat' });
      }

      const updated = await prisma.admission.update({
        where: { id: req.params.id },
        data: {
          ...(status !== undefined && { status: status as AdmissionStatus }),
          ...(adminNotes !== undefined && { adminNotes: adminNotes === '' ? null : String(adminNotes) }),
          ...(proposedClassId !== undefined && {
            proposedClassId: proposedClassId === '' || proposedClassId === null ? null : proposedClassId,
          }),
          ...(status !== undefined &&
            status !== existing.status && {
              reviewedAt: new Date(),
              reviewedById: req.user!.id,
            }),
        },
        include: { proposedClass: { select: { id: true, name: true, level: true } } },
      });
      res.json(updated);
    } catch (error: unknown) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
    }
  },
);

router.post(
  '/admissions/:id/enroll',
  requireStaffModule('admissions'),
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
      console.error('POST /staff/admissions/:id/enroll:', error);
      const code = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500;
      res.status(code).json({ error: err.message || 'Erreur serveur' });
    }
  },
);

// ——— Secrétariat : rendez-vous parents ———

router.get('/appointments/stats', requireStaffModule('appointments'), async (_req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const [pending, today, confirmed] = await Promise.all([
      prisma.parentTeacherAppointment.count({ where: { status: 'PENDING' } }),
      prisma.parentTeacherAppointment.count({
        where: { scheduledStart: { gte: startOfDay, lte: endOfDay }, status: { not: 'CANCELLED' } },
      }),
      prisma.parentTeacherAppointment.count({ where: { status: 'CONFIRMED' } }),
    ]);
    res.json({ pending, today, confirmed });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/appointments', requireStaffModule('appointments'), async (req, res) => {
  try {
    const { status, from, to, q } = req.query;
    const rows = await prisma.parentTeacherAppointment.findMany({
      where: {
        ...(status && typeof status === 'string'
          ? { status: status as ParentTeacherAppointmentStatus }
          : {}),
        ...(from && typeof from === 'string' ? { scheduledStart: { gte: new Date(from) } } : {}),
        ...(to && typeof to === 'string' ? { scheduledStart: { lte: new Date(to) } } : {}),
      },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            class: { select: { name: true } },
          },
        },
        parent: { include: { user: { select: { firstName: true, lastName: true, phone: true, email: true } } } },
        teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { scheduledStart: 'asc' },
      take: 120,
    });

    let filtered = rows;
    if (q && typeof q === 'string' && q.trim()) {
      const needle = q.trim().toLowerCase();
      filtered = rows.filter((r) => {
        const student = `${r.student.user.firstName} ${r.student.user.lastName}`.toLowerCase();
        const parent = `${r.parent.user.firstName} ${r.parent.user.lastName}`.toLowerCase();
        const teacher = `${r.teacher.user.firstName} ${r.teacher.user.lastName}`.toLowerCase();
        return student.includes(needle) || parent.includes(needle) || teacher.includes(needle);
      });
    }
    res.json(filtered);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

// ——— Secrétariat : registre élèves ———

router.get('/registry/students', requireStaffModule('student_registry'), async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json([]);

    const students = await prisma.student.findMany({
      where: {
        isActive: true,
        OR: [
          { studentId: { contains: q } },
          { user: { firstName: { contains: q } } },
          { user: { lastName: { contains: q } } },
          { user: { email: { contains: q } } },
        ],
      },
      take: 40,
      orderBy: { user: { lastName: 'asc' } },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
        class: { select: { name: true, level: true, academicYear: true } },
        parents: {
          include: {
            parent: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
          },
        },
        _count: { select: { identityDocuments: true } },
      },
    });
    res.json(students);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/registry/students/:id', requireStaffModule('student_registry'), async (req, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, isActive: true },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
        class: { select: { name: true, level: true, academicYear: true } },
        parents: {
          include: {
            parent: { include: { user: { select: { firstName: true, lastName: true, phone: true, email: true } } } },
          },
        },
        identityDocuments: { orderBy: { createdAt: 'desc' }, take: 20 },
        schoolHistory: { orderBy: { academicYear: 'desc' }, take: 10 },
      },
    });
    if (!student) return res.status(404).json({ error: 'Élève introuvable' });
    res.json(student);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

// ——— Économe / comptabilité : trésorerie ———

router.get('/treasury/summary', requireStaffModule('treasury'), async (_req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [fees, paymentsToday, paymentsMonth, overdueCount] = await Promise.all([
      prisma.tuitionFee.findMany({
        select: {
          id: true,
          amount: true,
          isPaid: true,
          dueDate: true,
          studentId: true,
          payments: { where: { status: 'COMPLETED' }, select: { amount: true } },
        },
      }),
      prisma.payment.aggregate({
        where: { status: 'COMPLETED', paidAt: { gte: startOfDay } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { status: 'COMPLETED', paidAt: { gte: startOfMonth } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.tuitionFee.count({
        where: { isPaid: false, dueDate: { lt: now } },
      }),
    ]);

    let totalOutstanding = 0;
    let unpaidLines = 0;
    for (const fee of fees) {
      const paid = fee.payments.reduce((s, p) => s + p.amount, 0);
      const remaining = Math.max(0, fee.amount - paid);
      if (remaining > 0) {
        totalOutstanding += remaining;
        unpaidLines += 1;
      }
    }

    res.json({
      totalOutstanding: Math.round(totalOutstanding),
      unpaidLines,
      overdueCount,
      collectedToday: Math.round(paymentsToday._sum.amount ?? 0),
      paymentsTodayCount: paymentsToday._count,
      collectedMonth: Math.round(paymentsMonth._sum.amount ?? 0),
      paymentsMonthCount: paymentsMonth._count,
    });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/treasury/overdue', requireStaffModule('treasury'), async (_req, res) => {
  try {
    const now = new Date();
    const fees = await prisma.tuitionFee.findMany({
      where: { isPaid: false, dueDate: { lt: now } },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            class: { select: { name: true } },
          },
        },
        payments: { where: { status: 'COMPLETED' } },
      },
      orderBy: { dueDate: 'asc' },
      take: 80,
    });

    res.json(
      fees.map((f) => {
        const paid = f.payments.reduce((s, p) => s + p.amount, 0);
        const remaining = Math.max(0, f.amount - paid);
        return { ...f, totalPaid: paid, remainingAmount: remaining };
      }),
    );
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/treasury/recent-payments', requireStaffModule('treasury'), async (_req, res) => {
  try {
    const rows = await prisma.payment.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { paidAt: 'desc' },
      take: 50,
      include: {
        student: { include: { user: { select: { firstName: true, lastName: true } } } },
        tuitionFee: { select: { period: true, academicYear: true } },
      },
    });
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/treasury/pending-cash', requireStaffAnyModule(CASH_VALIDATION_MODULES), async (_req, res) => {
  try {
    const rows = await listPendingCashPayments();
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.post(
  '/treasury/pending-cash/:id/validate',
  requireStaffAnyModule(CASH_VALIDATION_MODULES),
  async (req: AuthRequest, res) => {
  try {
    const staff = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, firstName: true, lastName: true, role: true },
    });
    if (!staff) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const name = [staff.firstName, staff.lastName].filter(Boolean).join(' ').trim() || 'Économe';
    const payment = await validateCashPayment(prisma, req.params.id, {
      id: staff.id,
      role: staff.role,
      name,
    });
    res.json({ payment, message: 'Paiement espèces validé et pris en compte' });
  } catch (error: unknown) {
    const err = error as Error & { status?: number };
    if (err.status && err.status !== 500) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
});

router.post(
  '/treasury/pending-cash/:id/reject',
  requireStaffAnyModule(CASH_VALIDATION_MODULES),
  async (req: AuthRequest, res) => {
  try {
    const staff = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { firstName: true, lastName: true },
    });
    const name = [staff?.firstName, staff?.lastName].filter(Boolean).join(' ').trim() || 'Économe';
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    const payment = await rejectCashPayment(prisma, req.params.id, { name }, reason);
    res.json({ payment, message: 'Déclaration espèces refusée' });
  } catch (error: unknown) {
    const err = error as Error & { status?: number };
    if (err.status && err.status !== 500) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
});

// ——— Directeur des études : pilotage ———

router.get('/academic/overview', requireStaffModule('academic_overview'), async (_req, res) => {
  try {
    const [classCount, studentCount, pendingValidations, gradeAgg, classes] = await Promise.all([
      prisma.class.count(),
      prisma.student.count({ where: { isActive: true } }),
      prisma.academicChangeRequest.count({ where: { status: 'PENDING_STUDIES_DIRECTOR' } }),
      prisma.grade.aggregate({ _avg: { score: true }, _count: true }),
      prisma.class.findMany({
        select: {
          id: true,
          name: true,
          level: true,
          academicYear: true,
          _count: { select: { students: true, courses: true } },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    res.json({
      classCount,
      studentCount,
      pendingValidations,
      gradesCount: gradeAgg._count,
      averageScore: gradeAgg._avg.score != null ? Math.round(gradeAgg._avg.score * 100) / 100 : null,
      classes,
    });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/academic/class-averages', requireStaffModule('academic_overview'), async (req, res) => {
  try {
    const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;
    const grades = await prisma.grade.findMany({
      where: classId ? { student: { classId } } : {},
      select: { score: true, maxScore: true, student: { select: { classId: true } } },
    });

    const byClass = new Map<string, { sum: number; count: number }>();
    for (const g of grades) {
      const cid = g.student.classId;
      if (!cid) continue;
      const normalized = g.maxScore > 0 ? (g.score / g.maxScore) * 20 : g.score;
      const cur = byClass.get(cid) ?? { sum: 0, count: 0 };
      cur.sum += normalized;
      cur.count += 1;
      byClass.set(cid, cur);
    }

    const classIds = [...byClass.keys()];
    const classRows =
      classIds.length > 0
        ? await prisma.class.findMany({
            where: { id: { in: classIds } },
            select: { id: true, name: true, level: true },
          })
        : [];

    const nameById = new Map(classRows.map((c) => [c.id, c]));
    res.json(
      classIds.map((id) => {
        const agg = byClass.get(id)!;
        return {
          classId: id,
          class: nameById.get(id) ?? null,
          averageOn20: agg.count > 0 ? Math.round((agg.sum / agg.count) * 100) / 100 : null,
          gradeCount: agg.count,
        };
      }),
    );
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

// ——— Directeur des études : conseils de classe ———

router.get('/class-councils', requireStaffModule('class_councils'), async (req, res) => {
  try {
    const { classId, period, academicYear } = req.query;
    const rows = await prisma.classCouncilSession.findMany({
      where: {
        ...(classId && typeof classId === 'string' ? { classId } : {}),
        ...(period && typeof period === 'string' ? { period } : {}),
        ...(academicYear && typeof academicYear === 'string' ? { academicYear } : {}),
      },
      include: { class: { select: { id: true, name: true, level: true } } },
      orderBy: { meetingDate: 'desc' },
      take: 100,
    });
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/class-councils/classes', requireStaffModule('class_councils'), async (_req, res) => {
  try {
    const classes = await prisma.class.findMany({
      select: { id: true, name: true, level: true, academicYear: true },
      orderBy: { name: 'asc' },
    });
    res.json(classes);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.post('/class-councils', requireStaffModule('class_councils'), async (req: AuthRequest, res) => {
  try {
    const { classId, period, academicYear, title, meetingDate, summary, decisions, recommendations } =
      req.body ?? {};
    if (!classId || !period || !academicYear || !meetingDate) {
      return res.status(400).json({ error: 'classId, period, academicYear et meetingDate sont requis' });
    }
    const created = await prisma.classCouncilSession.create({
      data: {
        classId,
        period,
        academicYear,
        title: title?.trim() || null,
        meetingDate: new Date(meetingDate),
        summary: summary?.trim() || null,
        decisions: decisions?.trim() || null,
        recommendations: recommendations?.trim() || null,
        createdById: req.user!.id,
      },
      include: { class: { select: { id: true, name: true, level: true } } },
    });
    res.status(201).json(created);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.patch('/class-councils/:id', requireStaffModule('class_councils'), async (req, res) => {
  try {
    const { title, meetingDate, summary, decisions, recommendations } = req.body ?? {};
    const updated = await prisma.classCouncilSession.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title: title?.trim() || null }),
        ...(meetingDate !== undefined && { meetingDate: new Date(meetingDate) }),
        ...(summary !== undefined && { summary: summary?.trim() || null }),
        ...(decisions !== undefined && { decisions: decisions?.trim() || null }),
        ...(recommendations !== undefined && { recommendations: recommendations?.trim() || null }),
      },
      include: { class: { select: { id: true, name: true, level: true } } },
    });
    res.json(updated);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

export default router;
