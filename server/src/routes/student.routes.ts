import express from 'express';
import type { Prisma } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma';
import { academicYearFromDate } from '../utils/academicYear.util';
import { deleteStoredUploadUrl } from '../utils/upload-persist.util';
import { resolveStoredFileAccessUrl } from '../utils/upload-access-token.util';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware';
import {
  decryptStudentRecord,
  encryptStudentSensitiveWritePayload,
} from '../utils/student-sensitive-crypto.util';
import {
  diffStudentSelfProfile,
  recordAuditLog,
  studentSelfProfileSnapshotForAudit,
} from '../utils/audit-log.util';
import {
  buildPortalOfferingWhere,
  registerStudentForExtracurricular,
} from '../utils/extracurricular.util';
import { notifyStaffOfPendingCashPayment } from '../utils/payment-cash-notify.util';
import { notifyParentCashPaymentSubmitted } from '../utils/parent-notify.util';
import {
  getAcademicYearsWithTuitionBlockForParent,
  parentTuitionBlockFromYears,
} from '../utils/parent-academic-result-access.util';
import { findSchedulesWithRelations } from '../utils/safe-schedule-query.util';

const router = express.Router();

router.use(authenticate);
router.use(authorize('STUDENT'));

router.use(async (req: AuthRequest, res, next) => {
  try {
    const student = await prisma.student.findUnique({
      where: { userId: req.user!.id },
      select: { enrollmentStatus: true },
    });
    if (!student) {
      return res.status(403).json({ error: 'Profil élève introuvable' });
    }
    if (student.enrollmentStatus === 'SUSPENDED') {
      return res.status(403).json({
        error:
          'Votre inscription est suspendue. Contactez l’administration pour plus d’informations.',
        code: 'ENROLLMENT_SUSPENDED',
      });
    }
    next();
  } catch (err) {
    next(err);
  }
});

router.get('/notifications', async (req: AuthRequest, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(notifications);
  } catch (error: unknown) {
    console.error('GET /student/notifications:', error);
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
    console.error('PUT /student/notifications/read-all:', error);
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
    console.error('PUT /student/notifications/:id/read:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

const profileInclude = {
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
  parents: {
    include: {
      parent: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      },
    },
  },
} as const;

// Obtenir le profil de l'élève
router.get('/profile', async (req: AuthRequest, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: {
        userId: req.user!.id,
      },
      include: profileInclude,
    });

    if (!student) {
      return res.status(404).json({ error: 'Profil élève non trouvé' });
    }

    res.json(decryptStudentRecord(student as Record<string, unknown>));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mettre à jour les données élève (coordonnées, urgence, infos médicales — pas le dossier administratif)
router.put(
  '/profile',
  [
    body('address').optional().isString().isLength({ max: 500 }).withMessage('Adresse trop longue'),
    body('emergencyContact').optional().isString().isLength({ max: 200 }).withMessage('Contact urgence trop long'),
    body('emergencyPhone').optional().isString().isLength({ max: 40 }).withMessage('Téléphone invalide'),
    body('medicalInfo').optional().isString().isLength({ max: 2000 }).withMessage('Texte trop long'),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const student = await prisma.student.findFirst({
        where: { userId: req.user!.id },
      });

      if (!student) {
        return res.status(404).json({ error: 'Profil élève non trouvé' });
      }

      const { address, emergencyContact, emergencyPhone, medicalInfo } = req.body;

      const data: {
        address?: string | null;
        emergencyContact?: string | null;
        emergencyPhone?: string | null;
        medicalInfo?: string | null;
      } = {};

      if (address !== undefined) {
        data.address = address === null || String(address).trim() === '' ? null : String(address).trim();
      }
      if (emergencyContact !== undefined) {
        data.emergencyContact =
          emergencyContact === null || String(emergencyContact).trim() === ''
            ? null
            : String(emergencyContact).trim();
      }
      if (emergencyPhone !== undefined) {
        data.emergencyPhone =
          emergencyPhone === null || String(emergencyPhone).trim() === ''
            ? null
            : String(emergencyPhone).trim();
      }
      if (medicalInfo !== undefined) {
        data.medicalInfo =
          medicalInfo === null || String(medicalInfo).trim() === '' ? null : String(medicalInfo).trim();
      }

      if (Object.keys(data).length === 0) {
        const current = await prisma.student.findFirst({
          where: { id: student.id },
          include: profileInclude,
        });
        if (!current) {
          return res.status(404).json({ error: 'Profil élève non trouvé' });
        }
        return res.json(decryptStudentRecord(current as Record<string, unknown>));
      }

      const encryptedData = encryptStudentSensitiveWritePayload(data);

      const beforeProfile = studentSelfProfileSnapshotForAudit(student);

      const updated = await prisma.student.update({
        where: { id: student.id },
        data: encryptedData,
        include: profileInclude,
      });

      const profileChanges = diffStudentSelfProfile(
        beforeProfile,
        studentSelfProfileSnapshotForAudit(updated)
      );
      if (profileChanges) {
        await recordAuditLog({
          req,
          actor: req.user!,
          action: 'UPDATE',
          entityType: 'Student',
          entityId: student.id,
          summary: `Profil élève (coordonnées / urgence / santé) modifié par l’élève (${req.user!.email})`,
          changes: profileChanges,
        });
      }

      res.json(decryptStudentRecord(updated as Record<string, unknown>));
    } catch (error: any) {
      console.error('PUT /student/profile:', error);
      res.status(500).json({ error: error.message || 'Erreur serveur' });
    }
  }
);

// Obtenir les notes
router.get('/grades', async (req: AuthRequest, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: {
        userId: req.user!.id,
      },
    });

    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    const gradesRaw = await prisma.grade.findMany({
      where: {
        studentId: student.id,
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

    const blockedAcademicYears = await getAcademicYearsWithTuitionBlockForParent(prisma, student.id);
    const tuitionBlock = parentTuitionBlockFromYears(blockedAcademicYears);
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

// Obtenir l'emploi du temps
router.get('/schedule', async (req: AuthRequest, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: {
        userId: req.user!.id,
      },
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

// Obtenir les absences
router.get('/absences', async (req: AuthRequest, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: {
        userId: req.user!.id,
      },
    });

    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    const absences = await prisma.absence.findMany({
      where: {
        studentId: student.id,
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

// Justifier une absence avec un document
router.put('/absences/:id/justify', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { documentUrl, reason } = req.body;

    if (!documentUrl) {
      return res.status(400).json({ error: 'URL du document justificatif requise' });
    }

    const student = await prisma.student.findFirst({
      where: {
        userId: req.user!.id,
      },
    });

    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    // Vérifier que l'absence appartient à l'élève
    const absence = await prisma.absence.findFirst({
      where: {
        id,
        studentId: student.id,
      },
    });

    if (!absence) {
      return res.status(404).json({ error: 'Absence non trouvée ou non autorisée' });
    }

    // Récupérer les documents justificatifs existants
    const existingDocuments = absence.justificationDocuments || [];
    
    // Mettre à jour l'absence avec le justificatif
    const updatedAbsence = await prisma.absence.update({
      where: { id },
      data: {
        justificationDocuments: [...existingDocuments, documentUrl],
        ...(reason && { reason }),
        justificationSubmittedAt: new Date(),
        // L'absence est marquée comme justifiée seulement si un admin/enseignant l'approuve
        // Ici, on laisse excused à false par défaut, l'admin/enseignant pourra l'approuver
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
    });

    res.json(updatedAbsence);
  } catch (error: any) {
    console.error('Erreur lors de la justification de l\'absence:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Obtenir les devoirs
router.get('/assignments', async (req: AuthRequest, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: {
        userId: req.user!.id,
      },
    });

    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    const assignments = await prisma.studentAssignment.findMany({
      where: {
        studentId: student.id,
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

// Soumettre un devoir
router.post('/assignments/:assignmentId/submit', async (req: AuthRequest, res) => {
  try {
    const { assignmentId } = req.params;
    const { fileUrl } = req.body;

    const student = await prisma.student.findFirst({
      where: {
        userId: req.user!.id,
      },
    });

    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    const studentAssignment = await prisma.studentAssignment.findUnique({
      where: {
        studentId_assignmentId: {
          studentId: student.id,
          assignmentId,
        },
      },
    });

    if (!studentAssignment) {
      return res.status(404).json({ error: 'Devoir non trouvé' });
    }

    const updated = await prisma.studentAssignment.update({
      where: {
        id: studentAssignment.id,
      },
      data: {
        submitted: true,
        submittedAt: new Date(),
        fileUrl,
      },
      include: {
        assignment: {
          include: {
            course: true,
          },
        },
      },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir les messages (reçus + envoyés vers l'école)
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
        orderBy: {
          createdAt: 'desc',
        },
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
    res.status(500).json({ error: error.message });
  }
});

// Envoyer un message (administration ou contact de l'établissement)
router.post('/messages', async (req: AuthRequest, res) => {
  try {
    const { subject, content, category, receiverId } = req.body as {
      subject?: string;
      content?: string;
      category?: string;
      receiverId?: string;
    };
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Le contenu du message est requis' });
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

    const { makeDmThreadKey, createInternalPlatformMessage, isPlatformMessagingRole } =
      await import('../utils/internal-messaging.util');

    let targetReceiverId =
      receiverId && typeof receiverId === 'string' && receiverId.trim() ? receiverId.trim() : '';

    if (!targetReceiverId) {
      const admin = await prisma.user.findFirst({
        where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isActive: true },
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
      if (!isPlatformMessagingRole(recv.role)) {
        return res.status(400).json({ error: 'Destinataire non autorisé.' });
      }
    }

    const attachmentUrls = Array.isArray(req.body.attachmentUrls)
      ? (req.body.attachmentUrls as unknown[])
          .filter((u) => typeof u === 'string' && String(u).trim())
          .map((u) => String(u).trim())
      : [];

    const dmKey = makeDmThreadKey(req.user!.id, targetReceiverId);

    const message = await createInternalPlatformMessage({
      senderId: req.user!.id,
      receiverId: targetReceiverId,
      subject: subject && String(subject).trim() ? String(subject).trim() : null,
      content: content.trim(),
      category: cat,
      threadKey: dmKey,
      attachmentUrls,
    });

    res.status(201).json(message);
  } catch (error: unknown) {
    console.error('POST /student/messages:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

// Marquer un message comme lu
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

// Obtenir les annonces
router.get('/announcements', async (req: AuthRequest, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: {
        userId: req.user!.id,
      },
      select: { classId: true },
    });
    const { fetchAnnouncementsForPortal } = await import('../utils/portal-feed.util');
    const classIds = student?.classId ? [student.classId] : [];
    const announcements = await fetchAnnouncementsForPortal('STUDENT', classIds);
    res.json(announcements);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/school-calendar-events', async (req: AuthRequest, res) => {
  try {
    const academicYear =
      typeof req.query.academicYear === 'string' ? req.query.academicYear : undefined;
    const { fetchSchoolCalendarForPortal } = await import('../utils/portal-feed.util');
    const events = await fetchSchoolCalendarForPortal(academicYear);
    res.json(events);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/portal-feed', async (req: AuthRequest, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: { userId: req.user!.id },
      select: { classId: true },
    });
    const classIds = student?.classId ? [student.classId] : [];
    const academicYear =
      typeof req.query.academicYear === 'string' ? req.query.academicYear : undefined;
    const { buildPortalFeed } = await import('../utils/portal-feed.util');
    const feed = await buildPortalFeed({ role: 'STUDENT', classIds, academicYear });
    res.json(feed);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir les bulletins de l'élève
router.get('/report-cards', async (req: AuthRequest, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: {
        userId: req.user!.id,
      },
    });

    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    const { period, academicYear } = req.query;

    const blockedAcademicYears = await getAcademicYearsWithTuitionBlockForParent(prisma, student.id);
    const tuitionBlock = parentTuitionBlockFromYears(blockedAcademicYears);

    const reportCardsRaw = await prisma.reportCard.findMany({
      where: {
        studentId: student.id,
        published: true,
        ...(period && { period: period as string }),
        ...(academicYear && { academicYear: academicYear as string }),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const reportCards = reportCardsRaw.filter((rc) => {
      const ay = (rc.academicYear ?? '').trim();
      if (!ay) return true;
      return !blockedAcademicYears.has(ay);
    });

    res.json({ reportCards, tuitionBlock });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir la conduite de l'élève
router.get('/conduct', async (req: AuthRequest, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: {
        userId: req.user!.id,
      },
    });

    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    const { period, academicYear } = req.query;

    const conducts = await prisma.conduct.findMany({
      where: {
        studentId: student.id,
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(conducts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
    console.error('GET /student/discipline/rulebook:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/discipline/records', async (req: AuthRequest, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: { userId: req.user!.id },
    });
    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }
    const { academicYear } = req.query;
    const records = await prisma.studentDisciplinaryRecord.findMany({
      where: {
        studentId: student.id,
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
    console.error('GET /student/discipline/records:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/extracurricular/offerings', async (req: AuthRequest, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!student) return res.status(404).json({ error: 'Élève non trouvé' });
    const academicYear =
      typeof req.query.academicYear === 'string' ? req.query.academicYear : undefined;
    const where = await buildPortalOfferingWhere(student.id, academicYear);
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
    console.error('GET /student/extracurricular/offerings:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/extracurricular/registrations', async (req: AuthRequest, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!student) return res.status(404).json({ error: 'Élève non trouvé' });
    const academicYear =
      typeof req.query.academicYear === 'string' ? req.query.academicYear : undefined;
    const rows = await prisma.extracurricularRegistration.findMany({
      where: {
        studentId: student.id,
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
    console.error('GET /student/extracurricular/registrations:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.post('/extracurricular/registrations', async (req: AuthRequest, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!student) return res.status(404).json({ error: 'Élève non trouvé' });
    const { offeringId } = req.body as { offeringId?: string };
    if (!offeringId) return res.status(400).json({ error: 'offeringId est requis.' });
    const { registration, status } = await registerStudentForExtracurricular(student.id, offeringId);
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
    console.error('POST /student/extracurricular/registrations:', error);
    res.status(400).json({ error: msg });
  }
});

router.delete('/extracurricular/registrations/:id', async (req: AuthRequest, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!student) return res.status(404).json({ error: 'Élève non trouvé' });
    const reg = await prisma.extracurricularRegistration.findFirst({
      where: { id: req.params.id, studentId: student.id },
    });
    if (!reg) return res.status(404).json({ error: 'Inscription introuvable.' });
    await prisma.extracurricularRegistration.delete({ where: { id: reg.id } });
    res.json({ ok: true });
  } catch (error: unknown) {
    console.error('DELETE /student/extracurricular/registrations/:id:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

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
      OR: [{ audience: 'ALL' }, { audience: 'STUDENT' }],
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
    console.error('GET /student/orientation/catalog:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/orientation/follow-ups', async (req: AuthRequest, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!student) return res.status(404).json({ error: 'Élève non trouvé' });
    const academicYear =
      typeof req.query.academicYear === 'string' ? req.query.academicYear.trim() : undefined;
    const rows = await prisma.studentOrientationFollowUp.findMany({
      where: {
        studentId: student.id,
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
    console.error('GET /student/orientation/follow-ups:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/orientation/placements', async (req: AuthRequest, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: { userId: req.user!.id },
      select: { id: true },
    });
    if (!student) return res.status(404).json({ error: 'Élève non trouvé' });
    const rows = await prisma.studentOrientationPlacement.findMany({
      where: { studentId: student.id },
      orderBy: { startDate: 'desc' },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    res.json(rows);
  } catch (error: unknown) {
    console.error('GET /student/orientation/placements:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

// Historique scolaire agrégé (par année : bulletins, conduite, synthèse notes, absences)
router.get('/academic-history', async (req: AuthRequest, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: { userId: req.user!.id },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            level: true,
            academicYear: true,
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    const blockedAcademicYears = await getAcademicYearsWithTuitionBlockForParent(prisma, student.id);
    const tuitionBlock = parentTuitionBlockFromYears(blockedAcademicYears);

    const [reportCards, conducts, gradesList, absences] = await Promise.all([
      prisma.reportCard.findMany({
        where: { studentId: student.id },
        orderBy: [{ academicYear: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.conduct.findMany({
        where: { studentId: student.id },
        include: {
          evaluatedBy: {
            select: {
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
        orderBy: [{ academicYear: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.grade.findMany({
        where: { studentId: student.id },
        include: {
          course: {
            select: {
              name: true,
              code: true,
              class: {
                select: {
                  academicYear: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.absence.findMany({
        where: { studentId: student.id },
        select: {
          date: true,
          status: true,
          excused: true,
        },
      }),
    ]);

    type GradeRow = (typeof gradesList)[number];
    const gradesByYear: Record<string, GradeRow[]> = {};

    gradesList.forEach((g) => {
      const classYear = g.course?.class?.academicYear;
      const year = classYear || academicYearFromDate(new Date(g.date));
      if (blockedAcademicYears.has(year.trim())) return;
      if (!gradesByYear[year]) gradesByYear[year] = [];
      gradesByYear[year].push(g);
    });

    const absenceCountByYear: Record<string, number> = {};
    absences.forEach((a) => {
      const y = academicYearFromDate(new Date(a.date));
      absenceCountByYear[y] = (absenceCountByYear[y] || 0) + 1;
    });

    const gradeSummaryByYear: Record<
      string,
      { evaluationCount: number; weightedAverage20: number | null }
    > = {};

    Object.entries(gradesByYear).forEach(([year, list]) => {
      let total = 0;
      let coef = 0;
      list.forEach((g) => {
        const note20 = (g.score / g.maxScore) * 20;
        total += note20 * g.coefficient;
        coef += g.coefficient;
      });
      gradeSummaryByYear[year] = {
        evaluationCount: list.length,
        weightedAverage20: coef > 0 ? Math.round((total / coef) * 100) / 100 : null,
      };
    });

    const yearSet = new Set<string>();
    reportCards.forEach((r) => {
      if (!blockedAcademicYears.has((r.academicYear ?? '').trim())) yearSet.add(r.academicYear);
    });
    conducts.forEach((c) => yearSet.add(c.academicYear));
    Object.keys(gradesByYear).forEach((y) => yearSet.add(y));
    Object.keys(absenceCountByYear).forEach((y) => yearSet.add(y));
    if (student.class?.academicYear) {
      yearSet.add(student.class.academicYear);
    }
    const enrollmentYear = academicYearFromDate(new Date(student.enrollmentDate));
    yearSet.add(enrollmentYear);

    const yearsSorted = Array.from(yearSet).sort((a, b) => {
      const sa = parseInt(a.split('-')[0], 10);
      const sb = parseInt(b.split('-')[0], 10);
      return sb - sa;
    });

    const byYear = yearsSorted
      .filter((academicYear) => !blockedAcademicYears.has(academicYear.trim()))
      .map((academicYear) => ({
      academicYear,
      reportCards: reportCards.filter((r) => r.academicYear === academicYear),
      conducts: conducts.filter((c) => c.academicYear === academicYear),
      gradesSummary: gradeSummaryByYear[academicYear] ?? {
        evaluationCount: 0,
        weightedAverage20: null,
      },
      absenceCount: absenceCountByYear[academicYear] ?? 0,
    }));

    const visibleReportCards = reportCards.filter(
      (r) => !blockedAcademicYears.has((r.academicYear ?? '').trim()),
    );
    const visibleGrades = gradesList.filter((g) => {
      const classYear = g.course?.class?.academicYear;
      const year = (classYear || academicYearFromDate(new Date(g.date))).trim();
      return !blockedAcademicYears.has(year);
    });

    res.json({
      enrollmentDate: student.enrollmentDate,
      currentClass: student.class,
      byYear,
      tuitionBlock,
      totals: {
        reportCards: visibleReportCards.length,
        conducts: conducts.length,
        grades: visibleGrades.length,
        absences: absences.length,
      },
    });
  } catch (error: any) {
    console.error('GET /student/academic-history:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Documents d'identité (consultation et suppression par l'élève)
router.get('/identity-documents', async (req: AuthRequest, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: { userId: req.user!.id },
    });
    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    const documents = await prisma.identityDocument.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: {
          select: { firstName: true, lastName: true, role: true },
        },
      },
    });

    res.json(
      documents.map((doc) => ({
        ...doc,
        fileUrl: resolveStoredFileAccessUrl(doc.fileUrl),
      })),
    );
  } catch (error: any) {
    console.error('GET /student/identity-documents:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.delete('/identity-documents/:id', async (req: AuthRequest, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: { userId: req.user!.id },
    });
    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    const doc = await prisma.identityDocument.findFirst({
      where: { id: req.params.id, studentId: student.id },
    });
    if (!doc) {
      return res.status(404).json({ error: 'Document introuvable' });
    }

    await prisma.identityDocument.delete({ where: { id: doc.id } });
    await deleteStoredUploadUrl(doc.fileUrl);

    res.json({ message: 'Document supprimé' });
  } catch (error: any) {
    console.error('DELETE /student/identity-documents:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// ========== GESTION DES PAIEMENTS ==========

// Obtenir les frais de scolarité de l'élève
router.get('/tuition-fees', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const student = await prisma.student.findFirst({
      where: {
        userId: req.user.id,
      },
    });

    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    const tuitionFees = await prisma.tuitionFee.findMany({
      where: {
        studentId: student.id,
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

    res.json(feesWithPaymentInfo || []);
  } catch (error: any) {
    console.error('Erreur lors de la récupération des frais de scolarité:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Créer un paiement (initier le processus de paiement)
router.post('/payments', async (req: AuthRequest, res) => {
  try {
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

    const student = await prisma.student.findFirst({
      where: {
        userId: req.user!.id,
      },
    });

    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    // Vérifier que le frais appartient à l'élève
    const tuitionFee = await prisma.tuitionFee.findFirst({
      where: {
        id: tuitionFeeId,
        studentId: student.id,
      },
    });

    if (!tuitionFee) {
      return res.status(404).json({ error: 'Frais de scolarité non trouvé ou non autorisé' });
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
        studentId: student.id,
        payerId: req.user!.id,
        payerRole: 'STUDENT',
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
        payerRole: 'STUDENT',
      }).catch((err) => console.error('notifyStaffOfPendingCashPayment:', err));
      void notifyParentCashPaymentSubmitted(payment.id).catch((err) =>
        console.error('notifyParentCashPaymentSubmitted:', err),
      );
    }

    // Ici, vous pouvez intégrer avec un processeur de paiement réel (Stripe, PayPal, etc.)
    // Pour l'instant, on simule un paiement réussi après 2 secondes
    // En production, vous devriez utiliser un webhook ou une confirmation asynchrone

    res.status(201).json({
      payment,
      paymentUrl: `/payment/process/${payment.id}`, // URL pour traiter le paiement
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

// La confirmation des paiements en ligne doit venir d'un webhook prestataire signé, jamais du portail élève.
router.post('/payments/:id/confirm', async (req: AuthRequest, res) => {
  return res.status(409).json({
    error:
      'Confirmation désactivée : le paiement sera validé par l’administration ou par un webhook de paiement sécurisé.',
  });
});

// Obtenir l'historique des paiements
router.get('/payments', async (req: AuthRequest, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const student = await prisma.student.findFirst({
      where: {
        userId: req.user.id,
      },
    });

    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    const payments = await prisma.payment.findMany({
      where: {
        studentId: student.id,
        payerId: req.user.id,
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

    res.json(payments || []);
  } catch (error: any) {
    console.error('Erreur lors de la récupération des paiements:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;




