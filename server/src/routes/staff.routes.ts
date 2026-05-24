import express from 'express';
import type { PaymentMethod } from '@prisma/client';
import prisma from '../utils/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware';
import { autoReceiptUrl } from '../utils/tuition-financial-automation.util';
import { syncTuitionFeePaidStatusForFeeId } from '../utils/tuition-fee-paid-sync.util';
import {
  assertStaffHasModule,
  getStaffMemberModuleContext,
  type StaffModuleId,
} from '../utils/staff-visible-modules.util';
import staffRolesRoutes from './staff-roles.routes';
import staffPedagogyRoutes from './staff-pedagogy.routes';
import staffHealthMessagingRoutes from './staff-health-messaging.routes';
import staffLibraryRoutes from './staff-library.routes';
import staffNotificationsRoutes from './staff-notifications.routes';
import { listSchoolsForUser } from '../utils/school-context.util';
import { attachSchoolContext } from '../middleware/school-context.middleware';
import { studentScopeWhere, type SchoolContextRequest } from '../utils/school-context.util';

const router = express.Router();

const COUNTER_METHODS = new Set<PaymentMethod>(['CASH', 'BANK_TRANSFER']);

function requireStaffModule(moduleId: StaffModuleId) {
  return async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    try {
      await assertStaffHasModule(req.user!.id, moduleId);
      next();
    } catch (e: unknown) {
      if (e instanceof Error) {
        if (e.message === 'MODULE_NOT_ALLOWED' || e.message === 'STAFF_PROFILE_NOT_FOUND') {
          return res.status(403).json({
            error: 'Ce module n’est pas activé pour votre compte personnel. Contactez l’administration.',
          });
        }
      }
      next(e);
    }
  };
}

router.use(authenticate);
router.use(authorize('STAFF'));

router.get('/schools', async (req: AuthRequest, res) => {
  try {
    const schools = await listSchoolsForUser(req.user!.id, 'STAFF');
    res.json(schools);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

/** Mémorise l’établissement actif pour le personnel (en-tête X-School-Id côté client). */
router.put('/schools/active', async (req: AuthRequest, res) => {
  try {
    const { schoolId } = req.body ?? {};
    if (!schoolId || typeof schoolId !== 'string') {
      return res.status(400).json({ error: 'schoolId requis' });
    }
    const userId = req.user!.id;
    const schools = await listSchoolsForUser(userId, 'STAFF');
    if (!schools.some((s) => s.id === schoolId)) {
      return res.status(403).json({ error: 'Accès refusé à cet établissement' });
    }

    await prisma.schoolMember.updateMany({
      where: { userId },
      data: { isDefault: false },
    });

    await prisma.schoolMember.upsert({
      where: { schoolId_userId: { schoolId, userId } },
      create: { schoolId, userId, isDefault: true },
      update: { isDefault: true },
    });

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, name: true, slug: true, isDefault: true },
    });

    res.json({ schoolId, school });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/workspace', async (req: AuthRequest, res) => {
  try {
    const ctx = await getStaffMemberModuleContext(req.user!.id);
    if (!ctx) {
      return res.status(404).json({ error: 'Profil personnel introuvable' });
    }
    res.json({
      visibleModules: ctx.visibleModules,
      supportKind: ctx.staff.supportKind,
      staffCategory: ctx.staff.staffCategory,
      schoolId: ctx.staff.schoolId,
      metierLabel: ctx.metierLabel ?? null,
    });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.use('/counter-tuition', requireStaffModule('counter'));
router.use('/counter-tuition', (req, res, next) =>
  attachSchoolContext(req as SchoolContextRequest, res, next)
);

function counterStudentScope(req: SchoolContextRequest) {
  return {
    isActive: true,
    ...studentScopeWhere(req.schoolId!, req.school?.isDefault ?? false),
  };
}

/** Recherche d'élèves (nom, prénom ou numéro élève). */
router.get('/counter-tuition/students', async (req: SchoolContextRequest, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
      return res.json([]);
    }

    const students = await prisma.student.findMany({
      where: {
        ...counterStudentScope(req),
        OR: [
          { studentId: { contains: q } },
          { user: { firstName: { contains: q } } },
          { user: { lastName: { contains: q } } },
        ],
      },
      take: 30,
      orderBy: { user: { lastName: 'asc' } },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        class: { select: { name: true, level: true, academicYear: true } },
      },
    });

    res.json(students);
  } catch (error: unknown) {
    console.error('GET /staff/counter-tuition/students:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

/** Frais de scolarité d'un élève (toutes lignes) avec soldes — pour encaissement guichet. */
router.get('/counter-tuition/students/:studentId/tuition-fees', async (req: SchoolContextRequest, res) => {
  try {
    const { studentId } = req.params;

    const student = await prisma.student.findFirst({
      where: { id: studentId, ...counterStudentScope(req) },
      select: { id: true },
    });
    if (!student) {
      return res.status(404).json({ error: 'Élève introuvable ou inactif' });
    }

    const tuitionFees = await prisma.tuitionFee.findMany({
      where: { studentId },
      include: {
        payments: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const feesWithPaymentInfo = tuitionFees.map((fee) => {
      const completedPayments = fee.payments.filter((p) => p.status === 'COMPLETED');
      const totalPaid = completedPayments.reduce((sum, p) => sum + p.amount, 0);
      const remainingAmount = fee.amount - totalPaid;
      return {
        ...fee,
        totalPaid,
        remainingAmount: Math.max(0, remainingAmount),
        paymentProgress: fee.amount > 0 ? (totalPaid / fee.amount) * 100 : 0,
      };
    });

    res.json(feesWithPaymentInfo);
  } catch (error: unknown) {
    console.error('GET /staff/counter-tuition/students/:studentId/tuition-fees:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

/**
 * Enregistre un paiement présentiel (espèces ou virement encaissé au guichet), marqué COMPLETED immédiatement.
 */
router.post('/counter-tuition/students/:studentId/payments', async (req: SchoolContextRequest, res) => {
  try {
    const { studentId } = req.params;
    const { tuitionFeeId, amount, paymentMethod, notes } = req.body ?? {};

    if (!tuitionFeeId || amount == null || !paymentMethod) {
      return res.status(400).json({ error: 'tuitionFeeId, amount et paymentMethod sont requis' });
    }

    const method = String(paymentMethod).toUpperCase() as PaymentMethod;
    if (!COUNTER_METHODS.has(method)) {
      return res.status(400).json({ error: 'Modes autorisés au guichet : CASH, BANK_TRANSFER' });
    }

    const student = await prisma.student.findFirst({
      where: { id: studentId, ...counterStudentScope(req) },
      select: { id: true },
    });
    if (!student) {
      return res.status(404).json({ error: 'Élève introuvable ou inactif' });
    }

    const tuitionFee = await prisma.tuitionFee.findFirst({
      where: { id: tuitionFeeId, studentId },
    });
    if (!tuitionFee) {
      return res.status(404).json({ error: 'Ligne de frais introuvable pour cet élève' });
    }

    const completedPayments = await prisma.payment.findMany({
      where: { tuitionFeeId, status: 'COMPLETED' },
    });
    const totalPaid = completedPayments.reduce((sum, p) => sum + p.amount, 0);
    const remainingAmount = tuitionFee.amount - totalPaid;
    if (remainingAmount <= 0) {
      return res.status(400).json({ error: 'Cette ligne est déjà entièrement réglée' });
    }

    const paymentAmount = Number(amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Montant invalide' });
    }
    if (paymentAmount > remainingAmount + 0.0001) {
      return res.status(400).json({
        error: `Le montant ne peut pas dépasser le reste dû (${Math.round(remainingAmount)} FCFA)`,
      });
    }

    const staffUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { firstName: true, lastName: true },
    });
    const staffName = [staffUser?.firstName, staffUser?.lastName].filter(Boolean).join(' ').trim() || 'Personnel';

    const extraNote =
      typeof notes === 'string' && notes.trim() ? ` — ${notes.trim()}` : '';
    const paymentNotes = `Encaissement présentiel (guichet) par ${staffName}${extraNote}`;

    const paymentReference = `GUI-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

    const payment = await prisma.payment.create({
      data: {
        tuitionFeeId,
        studentId,
        payerId: req.user!.id,
        payerRole: 'STAFF',
        amount: paymentAmount,
        paymentMethod: method,
        status: 'COMPLETED',
        paymentReference,
        transactionId: `GUICHET-${Date.now()}`,
        paidAt: new Date(),
        receiptUrl: autoReceiptUrl(paymentReference),
        notes: paymentNotes,
      },
      include: {
        tuitionFee: true,
        student: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    await syncTuitionFeePaidStatusForFeeId(prisma, tuitionFeeId);

    res.status(201).json({
      payment,
      message: 'Paiement enregistré',
    });
  } catch (error: unknown) {
    console.error('POST /staff/counter-tuition/students/:studentId/payments:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

/** Recherche élèves (modules infirmerie, etc.). */
router.get('/students/search', requireStaffModule('health_log'), async (req: AuthRequest, res) => {
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
        ],
      },
      take: 30,
      orderBy: { user: { lastName: 'asc' } },
      include: {
        user: { select: { firstName: true, lastName: true } },
        class: { select: { name: true } },
      },
    });
    res.json(students);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

/** Journal infirmerie */
router.get('/module-records', async (req: AuthRequest, res) => {
  try {
    const moduleKey = String(req.query.moduleKey || '').trim();
    const allowedKeys = new Set(['health_log', 'it_requests', 'maintenance_requests']);
    if (!allowedKeys.has(moduleKey)) {
      return res.status(400).json({ error: 'moduleKey invalide' });
    }
    await assertStaffHasModule(req.user!.id, moduleKey as StaffModuleId);
    const ctx = await getStaffMemberModuleContext(req.user!.id);
    if (!ctx) return res.status(403).json({ error: 'Profil introuvable' });

    const rows = await prisma.staffModuleRecord.findMany({
      where: { staffMemberId: ctx.staff.id, moduleKey },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        student: {
          include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } },
        },
      },
    });
    res.json(rows);
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'MODULE_NOT_ALLOWED' || error.message === 'STAFF_PROFILE_NOT_FOUND')) {
      return res.status(403).json({ error: 'Module non autorisé' });
    }
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.post('/module-records', async (req: AuthRequest, res) => {
  try {
    const { moduleKey, title, payload, studentId, status } = req.body ?? {};
    const allowedKeys = new Set(['health_log', 'it_requests', 'maintenance_requests']);
    const key = String(moduleKey || '').trim();
    if (!allowedKeys.has(key) || !title || !String(title).trim()) {
      return res.status(400).json({ error: 'moduleKey et title sont requis' });
    }
    await assertStaffHasModule(req.user!.id, key as StaffModuleId);
    const ctx = await getStaffMemberModuleContext(req.user!.id);
    if (!ctx) return res.status(403).json({ error: 'Profil introuvable' });

    const created = await prisma.staffModuleRecord.create({
      data: {
        staffMemberId: ctx.staff.id,
        moduleKey: key,
        title: String(title).trim().slice(0, 200),
        status: typeof status === 'string' && status.trim() ? status.trim().slice(0, 32) : 'OPEN',
        payload: payload ?? undefined,
        studentId: studentId || null,
      },
      include: {
        student: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });
    res.status(201).json(created);
  } catch (error: unknown) {
    if (error instanceof Error && (error.message === 'MODULE_NOT_ALLOWED' || error.message === 'STAFF_PROFILE_NOT_FOUND')) {
      return res.status(403).json({ error: 'Module non autorisé' });
    }
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.patch('/module-records/:id', async (req: AuthRequest, res) => {
  try {
    const ctx = await getStaffMemberModuleContext(req.user!.id);
    if (!ctx) return res.status(403).json({ error: 'Profil introuvable' });

    const existing = await prisma.staffModuleRecord.findFirst({
      where: { id: req.params.id, staffMemberId: ctx.staff.id },
    });
    if (!existing) return res.status(404).json({ error: 'Enregistrement introuvable' });
    await assertStaffHasModule(req.user!.id, existing.moduleKey as StaffModuleId);

    const { status, title, payload } = req.body ?? {};
    const updated = await prisma.staffModuleRecord.update({
      where: { id: existing.id },
      data: {
        ...(status !== undefined && { status: String(status).trim().slice(0, 32) }),
        ...(title !== undefined && { title: String(title).trim().slice(0, 200) }),
        ...(payload !== undefined && { payload }),
      },
    });
    res.json(updated);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.use('/', staffNotificationsRoutes);
router.use('/', staffRolesRoutes);

router.use('/health-messaging', staffHealthMessagingRoutes);

router.use('/pedagogy', staffPedagogyRoutes);

router.use(staffLibraryRoutes);

export default router;
