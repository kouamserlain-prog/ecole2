import express from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware';
import { decryptStudentRecord } from '../utils/student-sensitive-crypto.util';

const router = express.Router();

router.use(authenticate);
router.use(authorize('EDUCATOR'));

// Helper pour obtenir le educatorId depuis userId
const getEducatorId = async (userId: string) => {
  const educator = await prisma.educator.findUnique({
    where: { userId },
    select: { id: true },
  });
  return educator?.id;
};

router.get('/notifications', async (req: AuthRequest, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(notifications);
  } catch (error: unknown) {
    console.error('GET /educator/notifications:', error);
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
    console.error('PUT /educator/notifications/read-all:', error);
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
    console.error('PUT /educator/notifications/:id/read:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

// ========== PROFIL ÉDUCATEUR ==========

// Obtenir le profil de l'éducateur
router.get('/profile', async (req: AuthRequest, res) => {
  try {
    const educator = await prisma.educator.findUnique({
      where: { userId: req.user!.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatar: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
    });

    if (!educator) {
      return res.status(404).json({ error: 'Profil éducateur non trouvé' });
    }

    res.json(educator);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mettre à jour le profil de l'éducateur
router.put(
  '/profile',
  [
    body('phone').optional().isString(),
    body('avatar').optional().isString(),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { phone, avatar } = req.body;

      // Mettre à jour l'utilisateur
      const updatedUser = await prisma.user.update({
        where: { id: req.user!.id },
        data: {
          ...(phone !== undefined && { phone }),
          ...(avatar !== undefined && { avatar }),
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatar: true,
        },
      });

      res.json(updatedUser);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ========== GESTION DES ÉLÈVES ==========

// Lister tous les élèves (filtre optionnel par classe)
router.get('/students', async (req: AuthRequest, res) => {
  try {
    const { classId } = req.query;
    const students = await prisma.student.findMany({
      where: {
        ...(classId && typeof classId === 'string' && classId.trim()
          ? { classId: classId.trim() }
          : {}),
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatar: true,
            isActive: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
            level: true,
          },
        },
      },
      orderBy: {
        user: {
          lastName: 'asc',
        },
      },
    });

    res.json(
      students.map((s) => decryptStudentRecord(s as Record<string, unknown>))
    );
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir les détails d'un élève
router.get('/students/:studentId', async (req: AuthRequest, res) => {
  try {
    const { studentId } = req.params;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatar: true,
            isActive: true,
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
        absences: {
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
          take: 10,
        },
        conducts: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 5,
        },
        grades: {
          include: {
            course: true,
          },
          orderBy: {
            date: 'desc',
          },
          take: 10,
        },
      },
    });

    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    res.json(decryptStudentRecord(student as Record<string, unknown>));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== GESTION DE LA CONDUITE ==========

// Lister les évaluations de conduite
router.get('/conducts', async (req: AuthRequest, res) => {
  try {
    const educatorId = await getEducatorId(req.user!.id);

    if (!educatorId) {
      return res.status(404).json({ error: 'Profil éducateur non trouvé' });
    }

    const { studentId, period, academicYear } = req.query;

    const conducts = await prisma.conduct.findMany({
      where: {
        ...(studentId && { studentId: studentId as string }),
        ...(period && { period: period as string }),
        ...(academicYear && { academicYear: academicYear as string }),
        evaluatedByRole: 'EDUCATOR',
        evaluatedById: req.user!.id,
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            class: {
              select: {
                name: true,
                level: true,
              },
            },
          },
        },
        evaluatedBy: {
          select: {
            firstName: true,
            lastName: true,
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

// Créer ou mettre à jour une évaluation de conduite
router.post(
  '/conducts',
  [
    body('studentId').notEmpty().withMessage('ID élève requis'),
    body('period').notEmpty().withMessage('Période requise'),
    body('academicYear').notEmpty().withMessage('Année scolaire requise'),
    body('punctuality').isFloat({ min: 0, max: 20 }).withMessage('Ponctualité entre 0 et 20'),
    body('respect').isFloat({ min: 0, max: 20 }).withMessage('Respect entre 0 et 20'),
    body('participation').isFloat({ min: 0, max: 20 }).withMessage('Participation entre 0 et 20'),
    body('behavior').isFloat({ min: 0, max: 20 }).withMessage('Comportement entre 0 et 20'),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const educatorId = await getEducatorId(req.user!.id);

      if (!educatorId) {
        return res.status(404).json({ error: 'Profil éducateur non trouvé' });
      }

      const {
        studentId,
        period,
        academicYear,
        punctuality,
        respect,
        participation,
        behavior,
        comments,
      } = req.body;

      // Calculer la moyenne
      const average = (punctuality + respect + participation + behavior) / 4;

      // Vérifier si une évaluation existe déjà
      const existingConduct = await prisma.conduct.findUnique({
        where: {
          studentId_period_academicYear: {
            studentId,
            period,
            academicYear,
          },
        },
      });

      let conduct;

      if (existingConduct) {
        // Mettre à jour l'évaluation existante
        conduct = await prisma.conduct.update({
          where: { id: existingConduct.id },
          data: {
            punctuality,
            respect,
            participation,
            behavior,
            average,
            comments,
            evaluatedById: req.user!.id,
            evaluatedByRole: 'EDUCATOR',
          },
          include: {
            student: {
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
      } else {
        // Créer une nouvelle évaluation
        conduct = await prisma.conduct.create({
          data: {
            studentId,
            period,
            academicYear,
            punctuality,
            respect,
            participation,
            behavior,
            average,
            comments,
            evaluatedById: req.user!.id,
            evaluatedByRole: 'EDUCATOR',
          },
          include: {
            student: {
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
      }

      res.status(201).json(conduct);
    } catch (error: any) {
      if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Une évaluation existe déjà pour cette période' });
      }
      res.status(500).json({ error: error.message });
    }
  }
);

// Obtenir une évaluation de conduite spécifique
router.get('/conducts/:conductId', async (req: AuthRequest, res) => {
  try {
    const { conductId } = req.params;

    const conduct = await prisma.conduct.findUnique({
      where: { id: conductId },
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            class: {
              select: {
                name: true,
                level: true,
              },
            },
          },
        },
        evaluatedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!conduct) {
      return res.status(404).json({ error: 'Évaluation de conduite non trouvée' });
    }

    // Vérifier que l'éducateur a le droit de voir cette évaluation
    if (conduct.evaluatedByRole !== 'EDUCATOR' || conduct.evaluatedById !== req.user!.id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    res.json(conduct);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mettre à jour une évaluation de conduite
router.put(
  '/conducts/:conductId',
  [
    body('punctuality').optional().isFloat({ min: 0, max: 20 }),
    body('respect').optional().isFloat({ min: 0, max: 20 }),
    body('participation').optional().isFloat({ min: 0, max: 20 }),
    body('behavior').optional().isFloat({ min: 0, max: 20 }),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { conductId } = req.params;
      const { punctuality, respect, participation, behavior, comments } = req.body;

      // Vérifier que l'évaluation existe et appartient à cet éducateur
      const existingConduct = await prisma.conduct.findUnique({
        where: { id: conductId },
      });

      if (!existingConduct) {
        return res.status(404).json({ error: 'Évaluation de conduite non trouvée' });
      }

      if (existingConduct.evaluatedByRole !== 'EDUCATOR' || existingConduct.evaluatedById !== req.user!.id) {
        return res.status(403).json({ error: 'Accès refusé' });
      }

      // Calculer la nouvelle moyenne si les notes changent
      const newPunctuality = punctuality !== undefined ? punctuality : existingConduct.punctuality;
      const newRespect = respect !== undefined ? respect : existingConduct.respect;
      const newParticipation = participation !== undefined ? participation : existingConduct.participation;
      const newBehavior = behavior !== undefined ? behavior : existingConduct.behavior;
      const average = (newPunctuality + newRespect + newParticipation + newBehavior) / 4;

      const updatedConduct = await prisma.conduct.update({
        where: { id: conductId },
        data: {
          ...(punctuality !== undefined && { punctuality }),
          ...(respect !== undefined && { respect }),
          ...(participation !== undefined && { participation }),
          ...(behavior !== undefined && { behavior }),
          average,
          ...(comments !== undefined && { comments }),
        },
        include: {
          student: {
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

      res.json(updatedConduct);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.delete('/conducts/:conductId', async (req: AuthRequest, res) => {
  try {
    const { conductId } = req.params;

    const existingConduct = await prisma.conduct.findUnique({
      where: { id: conductId },
      select: {
        id: true,
        evaluatedByRole: true,
        evaluatedById: true,
      },
    });

    if (!existingConduct) {
      return res.status(404).json({ error: 'Évaluation de conduite non trouvée' });
    }

    if (
      existingConduct.evaluatedByRole !== 'EDUCATOR' ||
      existingConduct.evaluatedById !== req.user!.id
    ) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    await prisma.conduct.delete({
      where: { id: conductId },
    });

    res.json({ message: 'Évaluation supprimée avec succès' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== STATISTIQUES ==========

// Obtenir les statistiques de l'éducateur
router.get('/stats', async (req: AuthRequest, res) => {
  try {
    const educatorId = await getEducatorId(req.user!.id);

    if (!educatorId) {
      return res.status(404).json({ error: 'Profil éducateur non trouvé' });
    }

    const totalStudents = await prisma.student.count({
      where: { isActive: true },
    });

    const totalConducts = await prisma.conduct.count({
      where: {
        evaluatedByRole: 'EDUCATOR',
        evaluatedById: req.user!.id,
      },
    });

    const recentConducts = await prisma.conduct.count({
      where: {
        evaluatedByRole: 'EDUCATOR',
        evaluatedById: req.user!.id,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 derniers jours
        },
      },
    });

    res.json({
      totalStudents,
      totalConducts,
      recentConducts,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const DAY_LABELS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

// ========== CLASSES, ENSEIGNANTS, PARENTS ==========

router.get('/classes', async (_req: AuthRequest, res) => {
  try {
    const classes = await prisma.class.findMany({
      include: {
        teacher: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
        _count: { select: { students: true, courses: true } },
      },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });
    res.json(classes);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/teachers', async (_req: AuthRequest, res) => {
  try {
    const teachers = await prisma.teacher.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatar: true,
            isActive: true,
          },
        },
        classes: { select: { id: true, name: true, level: true } },
        courses: { select: { id: true, name: true, code: true, classId: true } },
      },
      orderBy: { user: { lastName: 'asc' } },
    });
    res.json(teachers);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/parents', async (req: AuthRequest, res) => {
  try {
    const { classId } = req.query;
    const classFilter =
      classId && typeof classId === 'string' && classId.trim() ? classId.trim() : null;

    const parents = await prisma.parent.findMany({
      where: classFilter
        ? {
            students: {
              some: {
                student: { classId: classFilter, isActive: true },
              },
            },
          }
        : undefined,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatar: true,
            isActive: true,
          },
        },
        students: {
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true } },
                class: { select: { id: true, name: true, level: true } },
              },
            },
          },
        },
        _count: { select: { students: true } },
      },
      orderBy: { user: { lastName: 'asc' } },
    });
    res.json(parents);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

// ========== EMPLOIS DU TEMPS (lecture seule) ==========

router.get('/schedules', async (req: AuthRequest, res) => {
  try {
    const { classId, teacherId } = req.query;
    const schedules = await prisma.schedule.findMany({
      where: {
        ...(classId && typeof classId === 'string' && classId.trim()
          ? { classId: classId.trim() }
          : {}),
        ...(teacherId && typeof teacherId === 'string' && teacherId.trim()
          ? {
              OR: [
                { course: { teacherId: teacherId.trim() } },
                { substituteTeacherId: teacherId.trim() },
              ],
            }
          : {}),
      },
      include: {
        class: { select: { id: true, name: true, level: true } },
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            teacher: {
              select: {
                id: true,
                user: { select: { firstName: true, lastName: true, email: true } },
              },
            },
          },
        },
        substituteTeacher: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    const slots = schedules.map((s) => ({
      id: s.id,
      courseId: s.course.id,
      courseName: s.course.name,
      courseCode: s.course.code,
      classId: s.class.id,
      className: s.class.name,
      classLevel: s.class.level,
      teacherId: s.course.teacher.id,
      teacherName: `${s.course.teacher.user?.firstName ?? ''} ${s.course.teacher.user?.lastName ?? ''}`.trim(),
      dayOfWeek: s.dayOfWeek,
      dayLabel: DAY_LABELS[s.dayOfWeek] ?? `J${s.dayOfWeek}`,
      dayShort: DAY_SHORT[s.dayOfWeek] ?? String(s.dayOfWeek),
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room,
      substituteTeacher: s.substituteTeacher
        ? {
            id: s.substituteTeacher.id,
            firstName: s.substituteTeacher.user?.firstName,
            lastName: s.substituteTeacher.user?.lastName,
          }
        : null,
    }));

    res.json({ slots });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

// ========== MESSAGERIE INTERNE ==========

router.get('/messaging/messages', async (req: AuthRequest, res) => {
  try {
    const { unread } = req.query;
    const receivedWhere: { receiverId: string; read?: boolean } = { receiverId: req.user!.id };
    if (unread === 'true') receivedWhere.read = false;

    const [received, sent] = await Promise.all([
      prisma.message.findMany({
        where: receivedWhere,
        include: {
          sender: {
            select: { id: true, firstName: true, lastName: true, email: true, avatar: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.message.findMany({
        where: { senderId: req.user!.id },
        include: {
          receiver: {
            select: { id: true, firstName: true, lastName: true, email: true, avatar: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    ]);

    res.json({ received, sent });
  } catch (error: unknown) {
    console.error('GET /educator/messaging/messages:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/messaging/threads', async (req: AuthRequest, res) => {
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
  } catch (error: unknown) {
    console.error('GET /educator/messaging/threads:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/messaging/thread', async (req: AuthRequest, res) => {
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
  } catch (error: unknown) {
    console.error('GET /educator/messaging/thread:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/messaging/contacts', async (req: AuthRequest, res) => {
  try {
    const [admins, teachers, educators, parents, students] = await Promise.all([
      prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isActive: true },
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
        orderBy: { lastName: 'asc' },
        take: 80,
      }),
      prisma.user.findMany({
        where: { role: 'TEACHER', isActive: true },
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
        orderBy: { lastName: 'asc' },
        take: 300,
      }),
      prisma.user.findMany({
        where: { role: 'EDUCATOR', isActive: true, id: { not: req.user!.id } },
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
        orderBy: { lastName: 'asc' },
        take: 80,
      }),
      prisma.user.findMany({
        where: { role: 'PARENT', isActive: true },
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
        orderBy: { lastName: 'asc' },
        take: 500,
      }),
      prisma.user.findMany({
        where: { role: 'STUDENT', isActive: true },
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
        orderBy: { lastName: 'asc' },
        take: 500,
      }),
    ]);

    res.json({ admins, teachers, educators, parents, students });
  } catch (error: unknown) {
    console.error('GET /educator/messaging/contacts:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.post('/messaging/send', async (req: AuthRequest, res) => {
  try {
    const {
      receiverId,
      subject,
      content,
      category,
      threadKey,
      attachmentUrls,
      broadcastClassId,
      broadcastAudience,
    } = req.body as {
      receiverId?: string;
      subject?: string;
      content?: string;
      category?: string;
      threadKey?: string;
      attachmentUrls?: string[];
      broadcastClassId?: string;
      broadcastAudience?: 'parents' | 'students' | 'all';
    };

    const { createInternalPlatformMessage, makeDmThreadKey, isPlatformMessagingRole } = await import(
      '../utils/internal-messaging.util'
    );

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

    if (broadcastClassId && typeof broadcastClassId === 'string' && broadcastClassId.trim()) {
      const classId = broadcastClassId.trim();
      if (!content || typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ error: 'Contenu requis' });
      }

      const audience = broadcastAudience ?? 'all';
      const students = await prisma.student.findMany({
        where: { classId, isActive: true },
        select: {
          userId: true,
          parents: { select: { parent: { select: { userId: true } } } },
        },
      });

      const targetUserIds = new Set<string>();
      if (audience === 'parents' || audience === 'all') {
        for (const st of students) {
          for (const p of st.parents) {
            targetUserIds.add(p.parent.userId);
          }
        }
      }
      if (audience === 'students' || audience === 'all') {
        for (const st of students) {
          targetUserIds.add(st.userId);
        }
      }

      if (targetUserIds.size === 0) {
        return res.status(400).json({ error: 'Aucun destinataire dans cette classe.' });
      }

      const batchKey = `class_${classId}_${Date.now()}`;
      const created: string[] = [];
      for (const uid of targetUserIds) {
        const msg = await createInternalPlatformMessage({
          senderId: req.user!.id,
          receiverId: uid,
          subject: subject?.trim() || null,
          content: content.trim(),
          category: cat,
          threadKey: batchKey,
          attachmentUrls,
        });
        created.push(msg.id);
      }
      return res.status(201).json({ ok: true, count: created.length, threadKey: batchKey, messageIds: created });
    }

    if (!receiverId || typeof receiverId !== 'string' || !receiverId.trim()) {
      return res.status(400).json({ error: 'receiverId requis (ou broadcastClassId).' });
    }
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Contenu requis' });
    }

    const recv = await prisma.user.findUnique({
      where: { id: receiverId.trim() },
      select: { id: true, role: true, isActive: true },
    });
    if (!recv || !recv.isActive) {
      return res.status(404).json({ error: 'Destinataire introuvable' });
    }
    if (!isPlatformMessagingRole(recv.role)) {
      return res.status(400).json({ error: 'Destinataire non autorisé pour la messagerie éducateur.' });
    }

    const tk =
      threadKey && String(threadKey).trim().length > 0
        ? String(threadKey).trim()
        : makeDmThreadKey(req.user!.id, recv.id);

    const msg = await createInternalPlatformMessage({
      senderId: req.user!.id,
      receiverId: recv.id,
      subject: subject?.trim() || null,
      content: content.trim(),
      category: cat,
      threadKey: tk,
      attachmentUrls,
    });

    res.status(201).json(msg);
  } catch (error: unknown) {
    console.error('POST /educator/messaging/send:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.put('/messaging/:id/read', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.message.findFirst({
      where: { id: req.params.id, receiverId: req.user!.id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Message introuvable' });
    }
    const message = await prisma.message.update({
      where: { id: existing.id },
      data: { read: true, readAt: new Date() },
    });
    res.json(message);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

export default router;
