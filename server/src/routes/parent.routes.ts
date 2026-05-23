import express from 'express';
import type { Prisma } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma';
import { findSchedulesWithRelations } from '../utils/safe-schedule-query.util';
import { autoReceiptUrl } from '../utils/tuition-financial-automation.util';
import { syncTuitionFeePaidStatusForFeeId } from '../utils/tuition-fee-paid-sync.util';
import {
  decryptParentTeacherAppointmentRow,
  decryptStudentRecord,
} from '../utils/student-sensitive-crypto.util';
import { notifyUsersImportant } from '../utils/notify-important.util';
import { notifyStaffOfPendingCashPayment } from '../utils/payment-cash-notify.util';
import { notifyParentCashPaymentSubmitted } from '../utils/parent-notify.util';
import {
  addMinutes,
  appointmentInclude,
  assertParentOwnsStudent,
  assertAppointmentFitsTeacherAvailability,
  getParentIdForUser,
  hasTeacherSlotConflict,
  isTeacherAllowedForStudent,
} from '../utils/parent-teacher-appointment.util';
import {
  buildPortalOfferingWhere,
  registerStudentForExtracurricular,
} from '../utils/extracurricular.util';
import {
  getAcademicYearsWithTuitionBlockForParent,
  parentTuitionBlockFromYears,
} from '../utils/parent-academic-result-access.util';
import {
  absenceWhereRelationsExist,
  gradeWhereRelationsExist,
} from '../utils/prisma-relation-exists.util';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware';
import { guardParentOwnsStudentParam } from '../middleware/parent-student-guard.middleware';

const router = express.Router();

router.use(authenticate);
router.use(authorize('PARENT'));
router.use('/children/:studentId', guardParentOwnsStudentParam);

router.get('/notifications', async (req: AuthRequest, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(notifications);
  } catch (error: unknown) {
    console.error('GET /parent/notifications:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.put('/notifications/read-all', async (req: AuthRequest, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, read: false },
      data: { read: true, readAt: new Date() },
    });
    res.json({ ok: true });
  } catch (error: unknown) {
    console.error('PUT /parent/notifications/read-all:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.put('/notifications/:id/read', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.notification.findFirst({
      where: { id, userId: req.user!.id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Notification non trouvée' });
    }
    const notification = await prisma.notification.update({
      where: { id },
      data: { read: true, readAt: new Date() },
    });
    res.json(notification);
  } catch (error: unknown) {
    console.error('PUT /parent/notifications/:id/read:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.delete('/notifications/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.notification.findFirst({
      where: { id, userId: req.user!.id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Notification non trouvée' });
    }
    await prisma.notification.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error: unknown) {
    console.error('DELETE /parent/notifications/:id:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

// --- Annonces, calendrier et fil portail (circulaires, actualités, événements, galerie) ---

router.get('/announcements', async (req: AuthRequest, res) => {
  try {
    const parentId = await getParentIdForUser(req.user!.id);
    if (!parentId) {
      return res.status(404).json({ error: 'Parent non trouvé' });
    }
    const links = await prisma.studentParent.findMany({
      where: { parentId },
      include: { student: { select: { classId: true } } },
    });
    const classIds = links.map((l) => l.student.classId).filter(Boolean) as string[];
    const { fetchAnnouncementsForPortal } = await import('../utils/portal-feed.util');
    const rows = await fetchAnnouncementsForPortal('PARENT', classIds);
    res.json(rows);
  } catch (error: unknown) {
    console.error('GET /parent/announcements:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/school-calendar-events', async (req: AuthRequest, res) => {
  try {
    const academicYear =
      typeof req.query.academicYear === 'string' ? req.query.academicYear : undefined;
    const { fetchSchoolCalendarForPortal } = await import('../utils/portal-feed.util');
    const events = await fetchSchoolCalendarForPortal(academicYear);
    res.json(events);
  } catch (error: unknown) {
    console.error('GET /parent/school-calendar-events:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/portal-feed', async (req: AuthRequest, res) => {
  try {
    const parentId = await getParentIdForUser(req.user!.id);
    if (!parentId) {
      return res.status(404).json({ error: 'Parent non trouvé' });
    }
    const links = await prisma.studentParent.findMany({
      where: { parentId },
      include: { student: { select: { classId: true } } },
    });
    const classIds = links.map((l) => l.student.classId).filter(Boolean) as string[];
    const academicYear =
      typeof req.query.academicYear === 'string' ? req.query.academicYear : undefined;
    const { buildPortalFeed } = await import('../utils/portal-feed.util');
    const feed = await buildPortalFeed({ role: 'PARENT', classIds, academicYear });
    res.json(feed);
  } catch (error: unknown) {
    console.error('GET /parent/portal-feed:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

// --- Rendez-vous parents-enseignants ---

router.get('/appointments', async (req: AuthRequest, res) => {
  try {
    const parentId = await getParentIdForUser(req.user!.id);
    if (!parentId) {
      return res.status(404).json({ error: 'Parent non trouvé' });
    }
    const rows = await prisma.parentTeacherAppointment.findMany({
      where: { parentId },
      orderBy: { scheduledStart: 'desc' },
      include: appointmentInclude,
    });
    res.json(rows.map(decryptParentTeacherAppointmentRow));
  } catch (error: unknown) {
    console.error('GET /parent/appointments:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/appointment-teachers/:studentId', async (req: AuthRequest, res) => {
  try {
    const parentId = await getParentIdForUser(req.user!.id);
    if (!parentId) {
      return res.status(404).json({ error: 'Parent non trouvé' });
    }
    const { studentId } = req.params;
    await assertParentOwnsStudent(parentId, studentId);

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        class: {
          include: {
            teacher: {
              include: {
                user: {
                  select: { firstName: true, lastName: true, email: true },
                },
              },
            },
            courses: {
              include: {
                teacher: {
                  include: {
                    user: {
                      select: { firstName: true, lastName: true, email: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!student?.class) {
      return res.json([]);
    }

    const out: {
      teacherId: string;
      label: string;
      firstName: string;
      lastName: string;
      email: string | null;
    }[] = [];
    const seen = new Set<string>();

    if (student.class.teacher) {
      const t = student.class.teacher;
      seen.add(t.id);
      out.push({
        teacherId: t.id,
        label: 'Professeur principal',
        firstName: t.user.firstName,
        lastName: t.user.lastName,
        email: t.user.email,
      });
    }
    for (const c of student.class.courses) {
      if (seen.has(c.teacherId)) continue;
      seen.add(c.teacherId);
      out.push({
        teacherId: c.teacherId,
        label: `Enseignant · ${c.name}`,
        firstName: c.teacher.user.firstName,
        lastName: c.teacher.user.lastName,
        email: c.teacher.user.email,
      });
    }

    const ids = [...new Set(out.map((o) => o.teacherId))];
    const allSlots =
      ids.length > 0
        ? await prisma.teacherScheduleAvailabilitySlot.findMany({
            where: { teacherId: { in: ids } },
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
          })
        : [];
    const byTeacher = new Map<string, typeof allSlots>();
    for (const s of allSlots) {
      if (!byTeacher.has(s.teacherId)) byTeacher.set(s.teacherId, []);
      byTeacher.get(s.teacherId)!.push(s);
    }
    const withSlots = out.map((o) => ({
      ...o,
      availabilitySlots: byTeacher.get(o.teacherId) ?? [],
    }));

    res.json(withSlots);
  } catch (error: unknown) {
    console.error('GET /parent/appointment-teachers/:studentId:', error);
    const msg = error instanceof Error ? error.message : 'Erreur serveur';
    const status = msg.includes('associé') ? 403 : 500;
    res.status(status).json({ error: msg });
  }
});

router.post('/appointments', async (req: AuthRequest, res) => {
  try {
    const parentId = await getParentIdForUser(req.user!.id);
    if (!parentId) {
      return res.status(404).json({ error: 'Parent non trouvé' });
    }

    const {
      studentId,
      teacherId,
      scheduledStart: scheduledRaw,
      durationMinutes: durRaw,
      topic,
      notesParent,
    } = req.body as {
      studentId?: string;
      teacherId?: string;
      scheduledStart?: string;
      durationMinutes?: number;
      topic?: string;
      notesParent?: string;
    };

    if (!studentId || !teacherId || !scheduledRaw) {
      return res.status(400).json({
        error: 'studentId, teacherId et scheduledStart sont requis.',
      });
    }

    const durationMinutes = Math.min(120, Math.max(15, Number(durRaw) || 30));
    const scheduledStart = new Date(scheduledRaw);
    if (Number.isNaN(scheduledStart.getTime())) {
      return res.status(400).json({ error: 'Date ou heure invalide.' });
    }

    const minLead = 30 * 60 * 1000;
    if (scheduledStart.getTime() < Date.now() + minLead) {
      return res.status(400).json({
        error: 'Le rendez-vous doit être fixé au moins 30 minutes à l’avance.',
      });
    }

    await assertParentOwnsStudent(parentId, studentId);

    const allowed = await isTeacherAllowedForStudent(teacherId, studentId);
    if (!allowed) {
      return res.status(403).json({
        error: 'Ce professeur ne peut pas recevoir de rendez-vous pour cet élève.',
      });
    }

    try {
      await assertAppointmentFitsTeacherAvailability(teacherId, scheduledStart, durationMinutes);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Créneau non autorisé.';
      return res.status(400).json({ error: msg });
    }

    const end = addMinutes(scheduledStart, durationMinutes);
    const conflict = await hasTeacherSlotConflict(teacherId, scheduledStart, end);
    if (conflict) {
      return res.status(409).json({
        error: 'Ce créneau chevauche un autre rendez-vous confirmé ou en attente.',
      });
    }

    const autoConfirm =
      process.env.APPOINTMENTS_AUTO_CONFIRM?.trim() === '1' ||
      process.env.APPOINTMENTS_AUTO_CONFIRM?.trim()?.toLowerCase() === 'true';

    const created = await prisma.parentTeacherAppointment.create({
      data: {
        parentId,
        teacherId,
        studentId,
        scheduledStart,
        durationMinutes,
        topic: topic?.trim() || null,
        notesParent: notesParent?.trim() || null,
        status: autoConfirm ? 'CONFIRMED' : 'PENDING',
      },
      include: appointmentInclude,
    });

    const teacherUser = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { userId: true },
    });
    const parentUser = await prisma.parent.findUnique({
      where: { id: parentId },
      select: { userId: true },
    });

    if (teacherUser?.userId) {
      const stName = [created.student.user.firstName, created.student.user.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      const when = scheduledStart.toLocaleString('fr-FR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      if (autoConfirm && parentUser?.userId) {
        await notifyUsersImportant([parentUser.userId], {
          type: 'appointment',
          title: 'Rendez-vous confirmé',
          content: `Entretien parents-enseignants (${stName || 'élève'}) le ${when} — confirmation automatique.`,
          link: '/parent?tab=appointments',
          email: undefined,
        });
        await notifyUsersImportant([teacherUser.userId], {
          type: 'appointment',
          title: 'Rendez-vous confirmé',
          content: `Entretien avec un parent (${stName || 'élève'}) le ${when} — confirmation automatique.`,
          link: '/teacher?tab=appointments',
          email: undefined,
        });
      } else {
        await notifyUsersImportant([teacherUser.userId], {
          type: 'appointment',
          title: 'Demande de rendez-vous parent',
          content: `Un parent souhaite un entretien concernant ${stName || 'un élève'}, le ${when}.`,
          link: '/teacher?tab=appointments',
        });
      }
    }

    res.status(201).json(decryptParentTeacherAppointmentRow(created));
  } catch (error: unknown) {
    console.error('POST /parent/appointments:', error);
    const msg = error instanceof Error ? error.message : 'Erreur serveur';
    const status = msg.includes('associé') ? 403 : 500;
    res.status(status).json({ error: msg });
  }
});

router.put('/appointments/:id/cancel', async (req: AuthRequest, res) => {
  try {
    const parentId = await getParentIdForUser(req.user!.id);
    if (!parentId) {
      return res.status(404).json({ error: 'Parent non trouvé' });
    }
    const { id } = req.params;

    const existing = await prisma.parentTeacherAppointment.findFirst({
      where: { id, parentId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Rendez-vous introuvable.' });
    }
    if (existing.status !== 'PENDING' && existing.status !== 'CONFIRMED') {
      return res.status(400).json({ error: 'Ce rendez-vous ne peut plus être annulé.' });
    }

    const updated = await prisma.parentTeacherAppointment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledBy: 'PARENT',
      },
      include: appointmentInclude,
    });

    const teacherUser = await prisma.teacher.findUnique({
      where: { id: updated.teacherId },
      select: { userId: true },
    });
    if (teacherUser?.userId) {
      await notifyUsersImportant([teacherUser.userId], {
        type: 'appointment',
        title: 'Rendez-vous annulé',
        content: 'Le parent a annulé un rendez-vous.',
        link: '/teacher?tab=appointments',
      });
    }

    res.json(decryptParentTeacherAppointmentRow(updated));
  } catch (error: unknown) {
    console.error('PUT /parent/appointments/:id/cancel:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.put('/appointments/:id/reschedule', async (req: AuthRequest, res) => {
  try {
    const parentId = await getParentIdForUser(req.user!.id);
    if (!parentId) {
      return res.status(404).json({ error: 'Parent non trouvé' });
    }
    const { id } = req.params;
    const { scheduledStart: scheduledRaw, durationMinutes: durRaw } = req.body as {
      scheduledStart?: string;
      durationMinutes?: number;
    };

    if (!scheduledRaw) {
      return res.status(400).json({ error: 'scheduledStart est requis.' });
    }

    const existing = await prisma.parentTeacherAppointment.findFirst({
      where: { id, parentId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Rendez-vous introuvable.' });
    }
    if (existing.status !== 'PENDING' && existing.status !== 'CONFIRMED') {
      return res.status(400).json({ error: 'Ce rendez-vous ne peut plus être reprogrammé.' });
    }

    const durationMinutes = Math.min(120, Math.max(15, Number(durRaw) || existing.durationMinutes));
    const scheduledStart = new Date(scheduledRaw);
    if (Number.isNaN(scheduledStart.getTime())) {
      return res.status(400).json({ error: 'Date ou heure invalide.' });
    }

    const minLead = 30 * 60 * 1000;
    if (scheduledStart.getTime() < Date.now() + minLead) {
      return res.status(400).json({
        error: 'Le rendez-vous doit être fixé au moins 30 minutes à l’avance.',
      });
    }

    await assertParentOwnsStudent(parentId, existing.studentId);

    try {
      await assertAppointmentFitsTeacherAvailability(
        existing.teacherId,
        scheduledStart,
        durationMinutes
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Créneau non autorisé.';
      return res.status(400).json({ error: msg });
    }

    const end = addMinutes(scheduledStart, durationMinutes);
    const conflict = await hasTeacherSlotConflict(
      existing.teacherId,
      scheduledStart,
      end,
      existing.id
    );
    if (conflict) {
      return res.status(409).json({
        error: 'Ce créneau chevauche un autre rendez-vous confirmé ou en attente.',
      });
    }

    const updated = await prisma.parentTeacherAppointment.update({
      where: { id },
      data: {
        scheduledStart,
        durationMinutes,
        status: 'PENDING',
        declineReason: null,
        reminder24hSentAt: null,
        reminder1hSentAt: null,
      },
      include: appointmentInclude,
    });

    const teacherUser = await prisma.teacher.findUnique({
      where: { id: updated.teacherId },
      select: { userId: true },
    });
    if (teacherUser?.userId) {
      const when = scheduledStart.toLocaleString('fr-FR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      await notifyUsersImportant([teacherUser.userId], {
        type: 'appointment',
        title: 'Rendez-vous reprogrammé',
        content: `Un parent a proposé un nouveau créneau : ${when}. Merci de confirmer ou décliner.`,
        link: '/teacher?tab=appointments',
      });
    }

    res.json(decryptParentTeacherAppointmentRow(updated));
  } catch (error: unknown) {
    console.error('PUT /parent/appointments/:id/reschedule:', error);
    const msg = error instanceof Error ? error.message : 'Erreur serveur';
    const status = msg.includes('associé') ? 403 : 500;
    res.status(status).json({ error: msg });
  }
});

async function findOrCreateParentProfile(userId: string) {
  let parent = await prisma.parent.findFirst({ where: { userId } });
  if (parent) return parent;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || user.role !== 'PARENT') {
    return null;
  }

  return prisma.parent.create({ data: { userId } });
}

const parentChildrenInclude = {
  students: {
    include: {
      student: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
          class: {
            include: {
              teacher: {
                include: {
                  user: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

// Obtenir les enfants du parent
router.get('/children', async (req: AuthRequest, res) => {
  try {
    const profile = await findOrCreateParentProfile(req.user!.id);
    if (!profile) {
      return res.status(404).json({ error: 'Parent non trouvé' });
    }

    const parent = await prisma.parent.findUnique({
      where: { id: profile.id },
      include: parentChildrenInclude,
    });

    if (!parent) {
      return res.status(404).json({ error: 'Parent non trouvé' });
    }

    const children = parent.students.map((sp) => ({
      ...decryptStudentRecord(sp.student as Record<string, unknown>),
      relation: sp.relation,
    }));

    res.json(children);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/dashboard/kpis', async (req: AuthRequest, res) => {
  try {
    const parent = await prisma.parent.findFirst({
      where: { userId: req.user!.id },
      select: {
        id: true,
        students: { select: { studentId: true, student: { select: { id: true, user: { select: { firstName: true, lastName: true } } } } } },
      },
    });
    if (!parent) {
      return res.status(404).json({ error: 'Parent non trouvé' });
    }
    const studentIds = parent.students.map((s) => s.student.id);
    if (studentIds.length === 0) {
      return res.json({
        generatedAt: new Date().toISOString(),
        cards: {
          childrenCount: 0,
          tuitionUnpaidAmount: 0,
          tuitionUnpaidCount: 0,
          pendingAppointments: 0,
          unreadNotifications: 0,
        },
        charts: { averageByChild: [] },
      });
    }

    const since = new Date();
    since.setDate(since.getDate() - 120);

    const blockedByStudent = new Map<string, Set<string>>();
    await Promise.all(
      studentIds.map(async (id) => {
        blockedByStudent.set(id, await getAcademicYearsWithTuitionBlockForParent(prisma, id));
      }),
    );

    const [tuitionUnpaid, pendingAppointments, unreadNotifications, grades] = await Promise.all([
      prisma.tuitionFee.aggregate({
        where: { studentId: { in: studentIds }, isPaid: false },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.parentTeacherAppointment.count({
        where: { parentId: parent.id, status: 'PENDING' },
      }),
      prisma.notification.count({
        where: { userId: req.user!.id, read: false },
      }),
      prisma.grade.findMany({
        where: {
          studentId: { in: studentIds },
          date: { gte: since },
          ...gradeWhereRelationsExist,
        },
        select: {
          studentId: true,
          score: true,
          maxScore: true,
          coefficient: true,
          course: { select: { class: { select: { academicYear: true } } } },
        },
      }),
    ]);

    const aggC = tuitionUnpaid._count;
    const unpaidCount = typeof aggC === 'number' ? aggC : (aggC as { _all?: number })?._all ?? 0;

    const perChild = new Map<string, { name: string; sum: number; coef: number }>();
    for (const sp of parent.students) {
      const id = sp.student.id;
      const name = `${sp.student.user.firstName} ${sp.student.user.lastName}`.trim();
      perChild.set(id, { name, sum: 0, coef: 0 });
    }
    for (const g of grades) {
      const row = perChild.get(g.studentId);
      if (!row) continue;
      const ay = (g.course?.class?.academicYear ?? '').trim();
      if (ay && blockedByStudent.get(g.studentId)?.has(ay)) continue;
      const max = g.maxScore > 0 ? g.maxScore : 20;
      const n20 = (g.score / max) * 20;
      row.sum += n20 * g.coefficient;
      row.coef += g.coefficient;
    }
    const averageByChild = [...perChild.entries()].map(([studentId, v]) => ({
      studentId,
      name: v.name,
      average20: v.coef > 0 ? Math.round((v.sum / v.coef) * 100) / 100 : null,
    }));

    res.json({
      generatedAt: new Date().toISOString(),
      cards: {
        childrenCount: studentIds.length,
        tuitionUnpaidAmount: Math.round((tuitionUnpaid._sum.amount ?? 0) * 100) / 100,
        tuitionUnpaidCount: unpaidCount,
        pendingAppointments: pendingAppointments,
        unreadNotifications: unreadNotifications,
      },
      charts: { averageByChild },
    });
  } catch (e: unknown) {
    console.error('GET /parent/dashboard/kpis:', e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur serveur' });
  }
});

// Obtenir les notes d'un enfant
router.get('/children/:studentId/grades', async (req: AuthRequest, res) => {
  try {
    const { studentId } = req.params;

    // Vérifier que l'élève est bien un enfant du parent
    const parent = await prisma.parent.findFirst({
      where: {
        userId: req.user!.id,
      },
      include: {
        students: {
          where: {
            studentId,
          },
        },
      },
    });

    if (!parent || parent.students.length === 0) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const blockedAcademicYears = await getAcademicYearsWithTuitionBlockForParent(prisma, studentId);
    const tuitionBlock = parentTuitionBlockFromYears(blockedAcademicYears);

    const gradesRaw = await prisma.grade.findMany({
      where: {
        studentId,
        ...gradeWhereRelationsExist,
      },
      include: {
        course: {
          include: {
            class: true,
          },
        },
        teacher: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    const grades = gradesRaw.filter((grade) => {
      const ay = (grade.course?.class?.academicYear ?? '').trim();
      if (!ay) return true;
      return !blockedAcademicYears.has(ay);
    });

    // Calculer les moyennes par cours
    const courseAverages: Record<string, { total: number; count: number; average: number }> = {};

    grades.forEach((grade) => {
      const courseId = grade.courseId;
      if (!courseAverages[courseId]) {
        courseAverages[courseId] = { total: 0, count: 0, average: 0 };
      }
      courseAverages[courseId].total += (grade.score / grade.maxScore) * 20 * grade.coefficient;
      courseAverages[courseId].count += grade.coefficient;
    });

    Object.keys(courseAverages).forEach((courseId) => {
      const course = courseAverages[courseId];
      course.average = course.count > 0 ? course.total / course.count : 0;
    });

    res.json({
      grades,
      courseAverages,
      tuitionBlock,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir les absences d'un enfant
router.get('/children/:studentId/absences', async (req: AuthRequest, res) => {
  try {
    const { studentId } = req.params;

    // Vérifier que l'élève est bien un enfant du parent
    const parent = await prisma.parent.findFirst({
      where: {
        userId: req.user!.id,
      },
      include: {
        students: {
          where: {
            studentId,
          },
        },
      },
    });

    if (!parent || parent.students.length === 0) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const absences = await prisma.absence.findMany({
      where: {
        studentId,
        ...absenceWhereRelationsExist,
      },
      include: {
        course: true,
        teacher: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    res.json(absences);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir l'emploi du temps d'un enfant
router.get('/children/:studentId/schedule', async (req: AuthRequest, res) => {
  try {
    const { studentId } = req.params;

    // Vérifier que l'élève est bien un enfant du parent
    const parent = await prisma.parent.findFirst({
      where: {
        userId: req.user!.id,
      },
      include: {
        students: {
          where: {
            studentId,
          },
        },
      },
    });

    if (!parent || parent.students.length === 0) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        class: true,
      },
    });

    if (!student || !student.classId) {
      return res.status(404).json({ error: 'Classe non trouvée' });
    }

    const schedule = await findSchedulesWithRelations({ classId: student.classId });

    res.json(schedule);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir les devoirs d'un enfant
router.get('/children/:studentId/assignments', async (req: AuthRequest, res) => {
  try {
    const { studentId } = req.params;

    // Vérifier que l'élève est bien un enfant du parent
    const parent = await prisma.parent.findFirst({
      where: {
        userId: req.user!.id,
      },
      include: {
        students: {
          where: {
            studentId,
          },
        },
      },
    });

    if (!parent || parent.students.length === 0) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const assignments = await prisma.studentAssignment.findMany({
      where: {
        studentId,
      },
      include: {
        assignment: {
          include: {
            course: {
              include: {
                class: true,
              },
            },
            teacher: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        assignment: {
          dueDate: 'desc',
        },
      },
    });

    res.json(assignments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== GESTION DES PAIEMENTS ==========

// Obtenir les frais de scolarité d'un enfant
router.get('/children/:studentId/tuition-fees', async (req: AuthRequest, res) => {
  try {
    const { studentId } = req.params;

    // Vérifier que l'élève est bien un enfant du parent
    const parent = await prisma.parent.findFirst({
      where: {
        userId: req.user!.id,
      },
      include: {
        students: {
          where: {
            studentId,
          },
        },
      },
    });

    if (!parent || parent.students.length === 0) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const tuitionFees = await prisma.tuitionFee.findMany({
      where: {
        studentId,
      },
      include: {
        payments: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
    });

    // Calculer le montant payé et restant pour chaque frais
    const feesWithPaymentInfo = tuitionFees.map((fee) => {
      const completedPayments = fee.payments.filter((p: any) => p.status === 'COMPLETED');
      const totalPaid = completedPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
      const remainingAmount = fee.amount - totalPaid;
      
      return {
        ...fee,
        totalPaid,
        remainingAmount: Math.max(0, remainingAmount),
        paymentProgress: fee.amount > 0 ? (totalPaid / fee.amount) * 100 : 0,
      };
    });

    res.json(feesWithPaymentInfo);
  } catch (error: any) {
    console.error('Erreur lors de la récupération des frais de scolarité:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Créer un paiement pour un enfant
router.post('/children/:studentId/payments', async (req: AuthRequest, res) => {
  try {
    const { studentId } = req.params;
    const { tuitionFeeId, paymentMethod, amount, phoneNumber, operator, transactionCode } = req.body;

    if (!tuitionFeeId || !paymentMethod || !amount) {
      return res.status(400).json({ error: 'tuitionFeeId, paymentMethod et amount sont requis' });
    }

    // Validation spécifique pour Mobile Money
    if (paymentMethod === 'MOBILE_MONEY') {
      if (!phoneNumber) {
        return res.status(400).json({ error: 'Le numéro de téléphone est requis pour Mobile Money' });
      }
      // Valider le format du numéro (ex: +237 6XX XXX XXX ou 6XX XXX XXX)
      const phoneRegex = /^(\+237\s?)?[67]\d{8}$/;
      const cleanPhone = phoneNumber.replace(/\s/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        return res.status(400).json({ error: 'Format de numéro de téléphone invalide. Utilisez le format: +237 6XX XXX XXX ou 6XX XXX XXX' });
      }
    }

    // Vérifier que l'élève est bien un enfant du parent
    const parent = await prisma.parent.findFirst({
      where: {
        userId: req.user!.id,
      },
      include: {
        students: {
          where: {
            studentId,
          },
        },
      },
    });

    if (!parent || parent.students.length === 0) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    // Vérifier que le frais appartient à l'élève
    const tuitionFee = await prisma.tuitionFee.findFirst({
      where: {
        id: tuitionFeeId,
        studentId,
      },
    });

    if (!tuitionFee) {
      return res.status(404).json({ error: 'Frais de scolarité non trouvé' });
    }

    // Calculer le montant total payé pour ce frais
    const completedPayments = await prisma.payment.findMany({
      where: {
        tuitionFeeId,
        status: 'COMPLETED',
      },
    });
    const totalPaid = completedPayments.reduce((sum, p) => sum + p.amount, 0);
    const remainingAmount = tuitionFee.amount - totalPaid;

    if (remainingAmount <= 0) {
      return res.status(400).json({ error: 'Ce frais a déjà été entièrement payé' });
    }

    // Valider que le montant du paiement ne dépasse pas le montant restant
    const paymentAmount = parseFloat(amount);
    if (paymentAmount <= 0) {
      return res.status(400).json({ error: 'Le montant doit être supérieur à 0' });
    }
    if (paymentAmount > remainingAmount) {
      return res.status(400).json({ 
        error: `Le montant ne peut pas dépasser le montant restant (${remainingAmount.toFixed(0)} FCFA)` 
      });
    }

    // Générer une référence de paiement unique
    const paymentReference = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Préparer les notes pour Mobile Money
    let paymentNotes = '';
    if (paymentMethod === 'MOBILE_MONEY') {
      paymentNotes = `Mobile Money - Téléphone: ${phoneNumber}${operator ? `, Opérateur: ${operator}` : ''}${transactionCode ? `, Code: ${transactionCode}` : ''}`;
    } else if (paymentMethod === 'CASH') {
      paymentNotes =
        "Espèces — déclaration en ligne en attente de validation par l'économe après dépôt à l'administration";
    }

    // Créer le paiement
    const payment = await prisma.payment.create({
      data: {
        tuitionFeeId,
        studentId,
        payerId: req.user!.id,
        payerRole: 'PARENT',
        amount: paymentAmount,
        paymentMethod,
        status: 'PENDING',
        paymentReference,
        notes: paymentNotes || undefined,
      },
      include: {
        tuitionFee: true,
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (paymentMethod === 'CASH') {
      await notifyStaffOfPendingCashPayment({
        paymentId: payment.id,
        amount: payment.amount,
        paymentReference: payment.paymentReference,
        studentFirstName: payment.student.user.firstName,
        studentLastName: payment.student.user.lastName,
        period: payment.tuitionFee.period,
        academicYear: payment.tuitionFee.academicYear,
        payerRole: 'PARENT',
      }).catch((err) => console.error('notifyStaffOfPendingCashPayment:', err));
      void notifyParentCashPaymentSubmitted(payment.id).catch((err) =>
        console.error('notifyParentCashPaymentSubmitted:', err),
      );
    }

    res.status(201).json({
      payment,
      paymentUrl: `/payment/process/${payment.id}`,
      message: 'Paiement initié avec succès',
    });
  } catch (error: any) {
    console.error('Erreur lors de la création du paiement:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Confirmer un paiement
router.post('/children/:studentId/payments/:id/confirm', async (req: AuthRequest, res) => {
  try {
    const { studentId, id } = req.params;
    const { transactionId } = req.body;

    // Vérifier que l'élève est bien un enfant du parent
    const parent = await prisma.parent.findFirst({
      where: {
        userId: req.user!.id,
      },
      include: {
        students: {
          where: {
            studentId,
          },
        },
      },
    });

    if (!parent || parent.students.length === 0) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const payment = await prisma.payment.findFirst({
      where: {
        id,
        studentId,
        payerId: req.user!.id,
      },
      include: {
        tuitionFee: true,
      },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Paiement non trouvé ou non autorisé' });
    }

    if (payment.status !== 'PENDING') {
      return res.status(400).json({ error: 'Ce paiement ne peut plus être modifié' });
    }

    if (payment.paymentMethod === 'CASH') {
      return res.status(403).json({
        error:
          "Les paiements en espèces doivent être validés par l'économe après dépôt du montant à l'administration.",
      });
    }

    // Mettre à jour le paiement comme complété + reçu automatique (référence PDF côté client)
    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        transactionId: transactionId || `TXN-${Date.now()}`,
        paidAt: new Date(),
        receiptUrl: autoReceiptUrl(payment.paymentReference || id),
      },
    });

    // Mettre à jour le solde du frais (isPaid / paidAt)
    await syncTuitionFeePaidStatusForFeeId(prisma, payment.tuitionFeeId);

    res.json({
      payment: updatedPayment,
      message: 'Paiement confirmé avec succès',
    });
  } catch (error: any) {
    console.error('Erreur lors de la confirmation du paiement:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Obtenir l'historique des paiements pour un enfant
router.get('/children/:studentId/payments', async (req: AuthRequest, res) => {
  try {
    const { studentId } = req.params;

    // Vérifier que l'élève est bien un enfant du parent
    const parent = await prisma.parent.findFirst({
      where: {
        userId: req.user!.id,
      },
      include: {
        students: {
          where: {
            studentId,
          },
        },
      },
    });

    if (!parent || parent.students.length === 0) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const payments = await prisma.payment.findMany({
      where: {
        studentId,
        payerId: req.user!.id,
      },
      include: {
        tuitionFee: {
          include: {
            student: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    phone: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(payments);
  } catch (error: any) {
    console.error('Erreur lors de la récupération des paiements:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ========== BULLETINS ==========

// Obtenir les bulletins d'un enfant
router.get('/children/:studentId/report-cards', async (req: AuthRequest, res) => {
  try {
    const { studentId } = req.params;

    // Vérifier que l'élève est bien un enfant du parent
    const parent = await prisma.parent.findFirst({
      where: {
        userId: req.user!.id,
      },
      include: {
        students: {
          where: {
            studentId,
          },
        },
      },
    });

    if (!parent || parent.students.length === 0) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const blockedAcademicYears = await getAcademicYearsWithTuitionBlockForParent(prisma, studentId);
    const tuitionBlock = parentTuitionBlockFromYears(blockedAcademicYears);

    const reportCardsRaw = await prisma.reportCard.findMany({
      where: {
        studentId,
        published: true,
      },
      orderBy: [
        { academicYear: 'desc' },
        { period: 'asc' },
      ],
    });

    const reportCards = reportCardsRaw.filter((rc) => {
      const ay = (rc.academicYear ?? '').trim();
      if (!ay) return true;
      return !blockedAcademicYears.has(ay);
    });

    res.json({ reportCards, tuitionBlock });
  } catch (error: any) {
    console.error('Erreur lors de la récupération des bulletins:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ========== CONDUITE ==========

// Obtenir les évaluations de conduite d'un enfant
router.get('/children/:studentId/conduct', async (req: AuthRequest, res) => {
  try {
    const { studentId } = req.params;
    const { period, academicYear } = req.query;

    // Vérifier que l'élève est bien un enfant du parent
    const parent = await prisma.parent.findFirst({
      where: {
        userId: req.user!.id,
      },
      include: {
        students: {
          where: {
            studentId,
          },
        },
      },
    });

    if (!parent || parent.students.length === 0) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const conducts = await prisma.conduct.findMany({
      where: {
        studentId,
        ...(period && { period: period as string }),
        ...(academicYear && { academicYear: academicYear as string }),
      },
      include: {
        evaluatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: [
        { academicYear: 'desc' },
        { period: 'asc' },
      ],
    });

    res.json(conducts);
  } catch (error: any) {
    console.error('Erreur lors de la récupération de la conduite:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.get('/discipline/rulebook', async (req: AuthRequest, res) => {
  try {
    const row = await prisma.schoolDisciplinaryRulebook.findFirst({
      where: { isPublished: true },
      orderBy: [{ effectiveFrom: 'desc' }, { sortOrder: 'asc' }],
      select: {
        id: true,
        title: true,
        content: true,
        academicYear: true,
        effectiveFrom: true,
        updatedAt: true,
      },
    });
    res.json(row);
  } catch (error: unknown) {
    console.error('GET /parent/discipline/rulebook:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/children/:studentId/discipline-records', async (req: AuthRequest, res) => {
  try {
    const { studentId } = req.params;
    const { academicYear } = req.query;

    const parent = await prisma.parent.findFirst({
      where: { userId: req.user!.id },
      include: {
        students: { where: { studentId } },
      },
    });

    if (!parent || parent.students.length === 0) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const records = await prisma.studentDisciplinaryRecord.findMany({
      where: {
        studentId,
        ...(typeof academicYear === 'string' && academicYear ? { academicYear } : {}),
      },
      orderBy: { incidentDate: 'desc' },
      select: {
        id: true,
        category: true,
        title: true,
        description: true,
        incidentDate: true,
        academicYear: true,
        exclusionStartDate: true,
        exclusionEndDate: true,
        councilSessionDate: true,
        councilDecisionSummary: true,
        behaviorContractGoals: true,
        behaviorContractReviewAt: true,
        behaviorContractStatus: true,
        recordedBy: { select: { firstName: true, lastName: true, role: true } },
      },
    });

    res.json(records);
  } catch (error: unknown) {
    console.error('GET /parent/children/:studentId/discipline-records:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/children/:studentId/extracurricular-offerings', async (req: AuthRequest, res) => {
  try {
    const { studentId } = req.params;
    const parentId = await getParentIdForUser(req.user!.id);
    if (!parentId) return res.status(404).json({ error: 'Parent non trouvé' });
    await assertParentOwnsStudent(parentId, studentId);
    const academicYear =
      typeof req.query.academicYear === 'string' ? req.query.academicYear : undefined;
    const where = await buildPortalOfferingWhere(studentId, academicYear);
    if (!where) return res.json([]);

    const rows = await prisma.extracurricularOffering.findMany({
      where,
      orderBy: [{ kind: 'asc' }, { startAt: 'asc' }, { title: 'asc' }],
      select: {
        id: true,
        kind: true,
        category: true,
        title: true,
        description: true,
        academicYear: true,
        supervisorName: true,
        meetSchedule: true,
        startAt: true,
        endAt: true,
        location: true,
        registrationDeadline: true,
        maxParticipants: true,
        class: { select: { name: true, level: true } },
        _count: { select: { registrations: true } },
      },
    });
    res.json(rows);
  } catch (error: unknown) {
    console.error('GET /parent/children/:studentId/extracurricular-offerings:', error);
    const msg = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(msg.includes('associé') ? 403 : 500).json({ error: msg });
  }
});

router.get('/children/:studentId/extracurricular-registrations', async (req: AuthRequest, res) => {
  try {
    const { studentId } = req.params;
    const parentId = await getParentIdForUser(req.user!.id);
    if (!parentId) return res.status(404).json({ error: 'Parent non trouvé' });
    await assertParentOwnsStudent(parentId, studentId);
    const academicYear =
      typeof req.query.academicYear === 'string' ? req.query.academicYear : undefined;
    const rows = await prisma.extracurricularRegistration.findMany({
      where: {
        studentId,
        ...(academicYear?.trim() ? { offering: { academicYear: academicYear.trim() } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        offering: {
          select: {
            id: true,
            title: true,
            kind: true,
            category: true,
            startAt: true,
            endAt: true,
            location: true,
            academicYear: true,
          },
        },
      },
    });
    res.json(rows);
  } catch (error: unknown) {
    console.error('GET /parent/children/:studentId/extracurricular-registrations:', error);
    const msg = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(msg.includes('associé') ? 403 : 500).json({ error: msg });
  }
});

router.post('/children/:studentId/extracurricular-registrations', async (req: AuthRequest, res) => {
  try {
    const { studentId } = req.params;
    const { offeringId } = req.body as { offeringId?: string };
    if (!offeringId) return res.status(400).json({ error: 'offeringId est requis.' });
    const parentId = await getParentIdForUser(req.user!.id);
    if (!parentId) return res.status(404).json({ error: 'Parent non trouvé' });
    await assertParentOwnsStudent(parentId, studentId);
    const { registration, status } = await registerStudentForExtracurricular(studentId, offeringId);
    res.status(201).json({ ...(registration as object), _placement: status });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      return res.status(409).json({ error: 'Inscription déjà enregistrée.' });
    }
    const msg = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('POST /parent/children/:studentId/extracurricular-registrations:', error);
    const st = msg.includes('associé') ? 403 : 400;
    res.status(st).json({ error: msg });
  }
});

router.delete('/children/:studentId/extracurricular-registrations/:regId', async (req: AuthRequest, res) => {
  try {
    const { studentId, regId } = req.params;
    const parentId = await getParentIdForUser(req.user!.id);
    if (!parentId) return res.status(404).json({ error: 'Parent non trouvé' });
    await assertParentOwnsStudent(parentId, studentId);
    const reg = await prisma.extracurricularRegistration.findFirst({
      where: { id: regId, studentId },
    });
    if (!reg) return res.status(404).json({ error: 'Inscription introuvable.' });
    await prisma.extracurricularRegistration.delete({ where: { id: regId } });
    res.json({ ok: true });
  } catch (error: unknown) {
    console.error('DELETE /parent/children/.../extracurricular-registrations:', error);
    const msg = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(msg.includes('associé') ? 403 : 500).json({ error: msg });
  }
});

// ---------- Orientation (portail parent) ----------
router.get('/orientation/catalog', async (req: AuthRequest, res) => {
  try {
    const academicYear = typeof req.query.academicYear === 'string' ? req.query.academicYear.trim() : '';
    const testWhere: Prisma.OrientationAptitudeTestWhereInput = {
      isPublished: true,
      ...(academicYear
        ? { OR: [{ academicYear: null }, { academicYear: academicYear }] }
        : {}),
    };
    const adviceWhere: Prisma.OrientationAdviceWhereInput = {
      isPublished: true,
      OR: [{ audience: 'ALL' }, { audience: 'PARENT' }],
    };
    const [filieres, partnerships, aptitudeTests, advice] = await Promise.all([
      prisma.orientationFiliere.findMany({
        where: { isPublished: true },
        orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      }),
      prisma.orientationPartnership.findMany({
        where: { isPublished: true },
        orderBy: [{ sortOrder: 'asc' }, { organizationName: 'asc' }],
      }),
      prisma.orientationAptitudeTest.findMany({
        where: testWhere,
        orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      }),
      prisma.orientationAdvice.findMany({
        where: adviceWhere,
        orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      }),
    ]);
    res.json({ filieres, partnerships, aptitudeTests, advice });
  } catch (error: unknown) {
    console.error('GET /parent/orientation/catalog:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/children/:studentId/orientation/follow-ups', async (req: AuthRequest, res) => {
  try {
    const { studentId } = req.params;
    const parentId = await getParentIdForUser(req.user!.id);
    if (!parentId) return res.status(404).json({ error: 'Parent non trouvé' });
    await assertParentOwnsStudent(parentId, studentId);
    const academicYear =
      typeof req.query.academicYear === 'string' ? req.query.academicYear.trim() : undefined;
    const rows = await prisma.studentOrientationFollowUp.findMany({
      where: {
        studentId,
        ...(academicYear ? { academicYear } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        counselor: { select: { id: true, firstName: true, lastName: true, email: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    res.json(rows);
  } catch (error: unknown) {
    console.error('GET /parent/children/.../orientation/follow-ups:', error);
    const msg = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(msg.includes('associé') ? 403 : 500).json({ error: msg });
  }
});

router.get('/children/:studentId/orientation/placements', async (req: AuthRequest, res) => {
  try {
    const { studentId } = req.params;
    const parentId = await getParentIdForUser(req.user!.id);
    if (!parentId) return res.status(404).json({ error: 'Parent non trouvé' });
    await assertParentOwnsStudent(parentId, studentId);
    const rows = await prisma.studentOrientationPlacement.findMany({
      where: { studentId },
      orderBy: { startDate: 'desc' },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.json(rows);
  } catch (error: unknown) {
    console.error('GET /parent/children/.../orientation/placements:', error);
    const msg = error instanceof Error ? error.message : 'Erreur serveur';
    res.status(msg.includes('associé') ? 403 : 500).json({ error: msg });
  }
});

// ========== COMMUNICATION (messages avec l’école) ==========

router.get('/messages', async (req: AuthRequest, res) => {
  try {
    const { unread } = req.query;

    const receivedWhere: { receiverId: string; read?: boolean } = {
      receiverId: req.user!.id,
    };
    if (unread === 'true') {
      receivedWhere.read = false;
    }

    const [received, sent] = await Promise.all([
      prisma.message.findMany({
        where: receivedWhere,
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.message.findMany({
        where: { senderId: req.user!.id },
        include: {
          receiver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    res.json({ received, sent });
  } catch (error: any) {
    console.error('GET /parent/messages:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.get('/messages/contacts', async (req: AuthRequest, res) => {
  try {
    const [admins, staffUsers, educators, courses] = await Promise.all([
      prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isActive: true },
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
        orderBy: { lastName: 'asc' },
        take: 40,
      }),
      prisma.user.findMany({
        where: { role: 'STAFF', isActive: true },
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
        orderBy: { lastName: 'asc' },
        take: 120,
      }),
      prisma.user.findMany({
        where: { role: 'EDUCATOR', isActive: true },
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
        orderBy: { lastName: 'asc' },
        take: 80,
      }),
      prisma.course.findMany({
        where: {
          class: {
            students: {
              some: {
                parents: { some: { parent: { userId: req.user!.id } } },
              },
            },
          },
        },
        select: {
          class: { select: { name: true, level: true } },
          teacher: {
            select: {
              user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
            },
          },
        },
      }),
    ]);

    const teacherMap = new Map<string, { id: string; firstName: string; lastName: string; email: string; role: string; label: string }>();
    for (const c of courses) {
      const u = c.teacher.user;
      if (!teacherMap.has(u.id)) {
        teacherMap.set(u.id, {
          ...u,
          label: `${c.class.name} (${c.class.level})`,
        });
      }
    }

    res.json({ admins, staff: staffUsers, educators, teachers: [...teacherMap.values()] });
  } catch (error: any) {
    console.error('GET /parent/messages/contacts:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.post('/messages', async (req: AuthRequest, res) => {
  try {
    const {
      subject,
      content,
      category,
      studentId,
      receiverId,
      threadKey: bodyThreadKey,
      attachmentUrls,
    } = req.body as {
      subject?: string;
      content?: string;
      category?: string;
      studentId?: string;
      receiverId?: string;
      threadKey?: string;
      attachmentUrls?: string[];
    };

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Le contenu du message est requis' });
    }

    let body = content.trim();
    if (studentId && typeof studentId === 'string') {
      const parent = await prisma.parent.findFirst({
        where: {
          userId: req.user!.id,
          students: { some: { studentId } },
        },
      });
      if (!parent) {
        return res.status(403).json({ error: 'Cet élève n’est pas associé à votre compte' });
      }
      const st = await prisma.student.findUnique({
        where: { id: studentId },
        include: { user: { select: { firstName: true, lastName: true } } },
      });
      if (st?.user) {
        body += `\n\n---\nConcernant l’élève : ${st.user.firstName} ${st.user.lastName}`;
      }
    }

    const validCategories = [
      'GENERAL',
      'ACADEMIC',
      'ABSENCE',
      'PAYMENT',
      'CONDUCT',
      'URGENT',
      'ANNOUNCEMENT',
    ] as const;
    const cat =
      category && validCategories.includes(category as (typeof validCategories)[number])
        ? (category as (typeof validCategories)[number])
        : 'GENERAL';

    let targetReceiverId =
      receiverId && typeof receiverId === 'string' && receiverId.trim() ? receiverId.trim() : '';

    if (!targetReceiverId) {
      const admin = await prisma.user.findFirst({
        where: { role: 'ADMIN', isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (!admin) {
        return res.status(503).json({
          error: 'Aucun administrateur n’est disponible pour recevoir le message pour le moment.',
        });
      }
      targetReceiverId = admin.id;
    } else {
      const recv = await prisma.user.findUnique({
        where: { id: targetReceiverId },
        select: { id: true, role: true, isActive: true },
      });
      if (!recv || !recv.isActive) {
        return res.status(404).json({ error: 'Destinataire introuvable' });
      }
      if (recv.role === 'ADMIN' || recv.role === 'SUPER_ADMIN') {
        /* ok */
      } else if (recv.role === 'TEACHER') {
        const { parentLinkedToTeacherUser } = await import('../utils/internal-messaging.util');
        const ok = await parentLinkedToTeacherUser(req.user!.id, recv.id);
        if (!ok) {
          return res.status(403).json({
            error: 'Vous ne pouvez écrire qu’aux enseignants de vos enfants ou à l’administration.',
          });
        }
      } else {
        const { isPlatformMessagingRole } = await import('../utils/internal-messaging.util');
        if (!isPlatformMessagingRole(recv.role)) {
          return res.status(400).json({
            error: 'Destinataire non autorisé. Choisissez un contact de l’établissement ou laissez vide pour l’administration.',
          });
        }
      }
    }

    const { createInternalPlatformMessage, makeDmThreadKey } = await import(
      '../utils/internal-messaging.util'
    );
    const tk =
      bodyThreadKey && String(bodyThreadKey).trim().length > 0
        ? String(bodyThreadKey).trim()
        : makeDmThreadKey(req.user!.id, targetReceiverId);

    const message = await createInternalPlatformMessage({
      senderId: req.user!.id,
      receiverId: targetReceiverId,
      subject: subject && String(subject).trim() ? String(subject).trim() : null,
      content: body,
      category: cat,
      threadKey: tk,
      attachmentUrls,
    });

    res.status(201).json(message);
  } catch (error: any) {
    console.error('POST /parent/messages:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.get('/messages/threads', async (req: AuthRequest, res) => {
  try {
    const uid = req.user!.id;
    const rows = await prisma.message.findMany({
      where: {
        OR: [{ senderId: uid }, { receiverId: uid }],
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, role: true } },
        receiver: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const { effectiveThreadKey } = await import('../utils/internal-messaging.util');

    type ThreadAgg = {
      threadKey: string;
      lastAt: Date;
      lastPreview: string;
      peerId: string;
      peerName: string;
      peerRole: string;
      unread: number;
    };

    const map = new Map<string, ThreadAgg>();
    for (const m of rows) {
      const key = effectiveThreadKey(m);
      const peer = m.senderId === uid ? m.receiver : m.sender;
      const peerName = `${peer.firstName} ${peer.lastName}`.trim();
      const existing = map.get(key);
      const unreadInc = m.receiverId === uid && !m.read ? 1 : 0;
      if (!existing) {
        map.set(key, {
          threadKey: key,
          lastAt: m.createdAt,
          lastPreview: m.content.slice(0, 160),
          peerId: peer.id,
          peerName,
          peerRole: peer.role,
          unread: unreadInc,
        });
      } else {
        existing.unread += unreadInc;
      }
    }

    res.json({ threads: [...map.values()].sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime()) });
  } catch (error: any) {
    console.error('GET /parent/messages/threads:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.get('/messages/thread', async (req: AuthRequest, res) => {
  try {
    const threadKey = typeof req.query.threadKey === 'string' ? req.query.threadKey.trim() : '';
    if (!threadKey) {
      return res.status(400).json({ error: 'threadKey requis' });
    }
    const uid = req.user!.id;

    let list = await prisma.message.findMany({
      where: {
        threadKey,
        OR: [{ senderId: uid }, { receiverId: uid }],
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, role: true, avatar: true } },
        receiver: { select: { id: true, firstName: true, lastName: true, role: true, avatar: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 300,
    });

    if (list.length === 0 && threadKey.startsWith('dm_')) {
      const rest = threadKey.slice(3);
      const parts = rest.split('__');
      if (parts.length === 2 && parts[0] && parts[1]) {
        const [a, b] = parts[0] < parts[1] ? [parts[0], parts[1]] : [parts[1], parts[0]];
        if (a === uid || b === uid) {
          list = await prisma.message.findMany({
            where: {
              threadKey: null,
              OR: [
                { senderId: a, receiverId: b },
                { senderId: b, receiverId: a },
              ],
            },
            include: {
              sender: { select: { id: true, firstName: true, lastName: true, role: true, avatar: true } },
              receiver: { select: { id: true, firstName: true, lastName: true, role: true, avatar: true } },
            },
            orderBy: { createdAt: 'asc' },
            take: 300,
          });
        }
      }
    }

    res.json({ threadKey, messages: list });
  } catch (error: any) {
    console.error('GET /parent/messages/thread:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.put('/messages/:id/read', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.message.findFirst({
      where: {
        id: req.params.id,
        receiverId: req.user!.id,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Message introuvable' });
    }

    const message = await prisma.message.update({
      where: { id: existing.id },
      data: { read: true, readAt: new Date() },
    });

    res.json(message);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Profil familial : coordonnées, portail, consentements, récupérations, historique ---

router.get('/my-profile', async (req: AuthRequest, res) => {
  try {
    const parentId = await getParentIdForUser(req.user!.id);
    if (!parentId) {
      return res.status(404).json({ error: 'Parent non trouvé' });
    }
    const parent = await prisma.parent.findUnique({
      where: { id: parentId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatar: true,
          },
        },
        contacts: { orderBy: { sortOrder: 'asc' } },
        consents: { orderBy: { updatedAt: 'desc' }, take: 80 },
        interactionLogs: { orderBy: { createdAt: 'desc' }, take: 80 },
        students: {
          include: {
            student: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true } },
                class: { select: { id: true, name: true, level: true } },
                pickupAuthorizations: {
                  orderBy: { createdAt: 'desc' },
                  take: 30,
                },
              },
            },
          },
        },
      },
    });
    res.json(parent);
  } catch (error: unknown) {
    console.error('GET /parent/my-profile:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.put('/my-profile', async (req: AuthRequest, res) => {
  try {
    const parentId = await getParentIdForUser(req.user!.id);
    if (!parentId) {
      return res.status(404).json({ error: 'Parent non trouvé' });
    }
    const {
      profession,
      preferredLocale,
      notifyEmail,
      notifySms,
      portalShowFees,
      portalShowGrades,
      portalShowAttendance,
    } = req.body as Record<string, unknown>;

    const updated = await prisma.parent.update({
      where: { id: parentId },
      data: {
        ...(profession !== undefined && { profession: profession ? String(profession) : null }),
        ...(preferredLocale !== undefined && {
          preferredLocale: preferredLocale ? String(preferredLocale).slice(0, 16) : null,
        }),
        ...(notifyEmail !== undefined && { notifyEmail: Boolean(notifyEmail) }),
        ...(notifySms !== undefined && { notifySms: Boolean(notifySms) }),
        ...(portalShowFees !== undefined && { portalShowFees: Boolean(portalShowFees) }),
        ...(portalShowGrades !== undefined && { portalShowGrades: Boolean(portalShowGrades) }),
        ...(portalShowAttendance !== undefined && {
          portalShowAttendance: Boolean(portalShowAttendance),
        }),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatar: true,
          },
        },
        contacts: { orderBy: { sortOrder: 'asc' } },
        consents: { take: 80 },
      },
    });
    res.json(updated);
  } catch (error: unknown) {
    console.error('PUT /parent/my-profile:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.post(
  '/my-contacts',
  [body('label').trim().notEmpty(), body('phone').optional().trim(), body('email').optional().trim()],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const parentId = await getParentIdForUser(req.user!.id);
      if (!parentId) {
        return res.status(404).json({ error: 'Parent non trouvé' });
      }
      const { label, phone, email, sortOrder } = req.body as Record<string, unknown>;
      const row = await prisma.parentContact.create({
        data: {
          parentId,
          label: String(label).trim(),
          phone: phone ? String(phone).trim() : null,
          email: email ? String(email).trim() : null,
          sortOrder: sortOrder != null ? Number(sortOrder) : 0,
        },
      });
      res.status(201).json(row);
    } catch (error: unknown) {
      console.error('POST /parent/my-contacts:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
    }
  }
);

router.delete('/my-contacts/:contactId', async (req: AuthRequest, res) => {
  try {
    const parentId = await getParentIdForUser(req.user!.id);
    if (!parentId) {
      return res.status(404).json({ error: 'Parent non trouvé' });
    }
    const row = await prisma.parentContact.findFirst({
      where: { id: req.params.contactId, parentId },
    });
    if (!row) {
      return res.status(404).json({ error: 'Contact introuvable' });
    }
    await prisma.parentContact.delete({ where: { id: row.id } });
    res.json({ message: 'Supprimé' });
  } catch (error: unknown) {
    console.error('DELETE /parent/my-contacts/:id:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.post('/my-consents/upsert', async (req: AuthRequest, res) => {
  try {
    const parentId = await getParentIdForUser(req.user!.id);
    if (!parentId) {
      return res.status(404).json({ error: 'Parent non trouvé' });
    }
    const { studentId, consentType, granted, policyVersion, notes } = req.body as Record<string, unknown>;
    const allowed = [
      'IMAGE_PUBLICATION',
      'SCHOOL_TRIP',
      'MEDICAL_EMERGENCY',
      'DATA_PROCESSING',
      'COMMUNICATION_CHANNELS',
      'AUTHORIZED_PICKUP_POLICY',
    ];
    if (!consentType || !allowed.includes(String(consentType))) {
      return res.status(400).json({ error: 'consentType invalide' });
    }
    if (studentId) {
      await assertParentOwnsStudent(parentId, String(studentId));
    }

    const existing = await prisma.parentConsent.findFirst({
      where: {
        parentId,
        consentType: String(consentType) as any,
        ...(studentId ? { studentId: String(studentId) } : { studentId: null }),
      },
    });

    if (existing) {
      const u = await prisma.parentConsent.update({
        where: { id: existing.id },
        data: {
          granted: Boolean(granted),
          policyVersion: policyVersion != null ? String(policyVersion).slice(0, 64) : null,
          notes: notes != null ? String(notes).slice(0, 2000) : null,
        },
      });
      return res.json(u);
    }

    const c = await prisma.parentConsent.create({
      data: {
        parentId,
        studentId: studentId ? String(studentId) : null,
        consentType: String(consentType) as any,
        granted: Boolean(granted),
        policyVersion: policyVersion != null ? String(policyVersion).slice(0, 64) : null,
        notes: notes != null ? String(notes).slice(0, 2000) : null,
      },
    });
    res.status(201).json(c);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erreur serveur';
    const status = msg.includes('associé') ? 403 : 500;
    console.error('POST /parent/my-consents/upsert:', error);
    res.status(status).json({ error: msg });
  }
});

router.post(
  '/children/:studentId/pickup-authorizations',
  [body('authorizedName').trim().notEmpty()],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const parentId = await getParentIdForUser(req.user!.id);
      if (!parentId) {
        return res.status(404).json({ error: 'Parent non trouvé' });
      }
      const { studentId } = req.params;
      await assertParentOwnsStudent(parentId, studentId);
      const { authorizedName, relationship, phone, identityNote, validFrom, validUntil } = req.body as Record<
        string,
        unknown
      >;
      const row = await prisma.studentPickupAuthorization.create({
        data: {
          studentId,
          declaredByParentId: parentId,
          authorizedName: String(authorizedName).trim(),
          relationship: relationship ? String(relationship).slice(0, 120) : null,
          phone: phone ? String(phone).trim() : null,
          identityNote: identityNote ? String(identityNote).slice(0, 500) : null,
          validFrom: validFrom ? new Date(String(validFrom)) : new Date(),
          validUntil: validUntil ? new Date(String(validUntil)) : null,
        },
      });
      res.status(201).json(row);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erreur serveur';
      const status = msg.includes('associé') ? 403 : 500;
      console.error('POST /parent/children/.../pickup-authorizations:', error);
      res.status(status).json({ error: msg });
    }
  }
);

router.delete('/children/:studentId/pickup-authorizations/:pickupId', async (req: AuthRequest, res) => {
  try {
    const parentId = await getParentIdForUser(req.user!.id);
    if (!parentId) {
      return res.status(404).json({ error: 'Parent non trouvé' });
    }
    const { studentId, pickupId } = req.params;
    await assertParentOwnsStudent(parentId, studentId);
    const row = await prisma.studentPickupAuthorization.findFirst({
      where: { id: pickupId, studentId },
    });
    if (!row) {
      return res.status(404).json({ error: 'Autorisation introuvable' });
    }
    await prisma.studentPickupAuthorization.delete({ where: { id: row.id } });
    res.json({ message: 'Supprimé' });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erreur serveur';
    const status = msg.includes('associé') ? 403 : 500;
    res.status(status).json({ error: msg });
  }
});

export default router;




