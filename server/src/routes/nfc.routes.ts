import express from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma';
import { punchStudentCourseAttendance, punchStaffAttendance, punchTeacherCourseAttendance } from '../utils/attendance-punch.util';
import { matchStudentScanId, matchTeacherScanId, matchStaffScanId } from '../utils/scan-id.util';
import { verifyDeviceApiKey } from '../middleware/device-api-key.middleware';
import { deviceBiometricLimiter } from '../middleware/rate-limit.middleware';

const router = express.Router();

router.use(deviceBiometricLimiter);
router.use(verifyDeviceApiKey);

// Endpoint pour recevoir un scan NFC depuis un appareil externe
router.post(
  '/scan',
  [
    body('nfcId').notEmpty().withMessage('nfcId est requis'),
    body('date').optional().isISO8601().withMessage('Format de date invalide'),
    body('courseId').optional().isString().withMessage('courseId doit être une chaîne'),
    body('autoStatus').optional().isIn(['PRESENT', 'LATE']).withMessage('autoStatus doit être PRESENT ou LATE'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { nfcId, date, courseId, autoStatus } = req.body;
      const scanDate = date ? new Date(date) : new Date();
      const status = autoStatus || 'PRESENT';

      // Rechercher d'abord un étudiant avec cet ID NFC
      let student = await prisma.student.findFirst({
        where: matchStudentScanId(nfcId),
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
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
      });

      // Si c'est un étudiant
      if (student) {
        if (!courseId) {
          return res.status(400).json({ 
            error: 'courseId est requis pour enregistrer la présence d\'un étudiant',
            type: 'STUDENT',
            student: {
              id: student.id,
              name: `${student.user.firstName} ${student.user.lastName}`,
              studentId: student.studentId,
            }
          });
        }

        // Vérifier que le cours existe
        const course = await prisma.course.findUnique({
          where: { id: courseId },
          include: {
            teacher: {
              select: {
                id: true,
              },
            },
          },
        });

        if (!course) {
          return res.status(404).json({ error: 'Cours non trouvé' });
        }

        // Pointage entrée / sortie
        const punch = await punchStudentCourseAttendance({
          studentId: student.id,
          courseId,
          teacherId: course.teacher.id,
          at: scanDate,
          source: 'NFC',
        });

        const absence = await prisma.absence.findUnique({
          where: { id: punch.absence.id },
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
            course: { select: { name: true, code: true } },
          },
        });

        const phaseLabel =
          punch.punchPhase === 'CHECK_IN'
            ? 'Entrée enregistrée'
            : punch.punchPhase === 'CHECK_OUT'
              ? 'Sortie enregistrée'
              : 'Pointage déjà complet (entrée et sortie)';

        return res.status(200).json({
          success: true,
          message: `${phaseLabel} — ${student.user.firstName} ${student.user.lastName}`,
          type: 'STUDENT',
          punchPhase: punch.punchPhase,
          data: {
            absence: absence
              ? {
                  id: absence.id,
                  status: absence.status,
                  date: absence.date,
                  checkInAt: absence.checkInAt,
                  checkOutAt: absence.checkOutAt,
                }
              : punch.absence,
            student: {
              id: student.id,
              name: `${student.user.firstName} ${student.user.lastName}`,
              studentId: student.studentId,
              class: student.class?.name,
            },
            course: {
              id: course.id,
              name: course.name,
              code: course.code,
            },
          },
        });
      }

      // Personnel administratif (secrétariat, etc.)
      const staffMember = await prisma.staffMember.findFirst({
        where: matchStaffScanId(nfcId),
        include: {
          user: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
      });

      if (staffMember) {
        const punch = await punchStaffAttendance({
          staffId: staffMember.id,
          at: scanDate,
          source: 'NFC',
        });
        const phaseLabel =
          punch.punchPhase === 'CHECK_IN'
            ? 'Entrée enregistrée'
            : punch.punchPhase === 'CHECK_OUT'
              ? 'Sortie enregistrée'
              : 'Pointage déjà complet';

        return res.status(200).json({
          success: true,
          message: `${phaseLabel} — ${staffMember.user.firstName} ${staffMember.user.lastName}`,
          type: 'STAFF',
          punchPhase: punch.punchPhase,
          data: {
            attendance: punch.attendance,
            staff: {
              id: staffMember.id,
              name: `${staffMember.user.firstName} ${staffMember.user.lastName}`,
              employeeId: staffMember.employeeId,
            },
          },
        });
      }

      // Si ce n'est pas un étudiant ni personnel, chercher un professeur
      let teacher = await prisma.teacher.findFirst({
        where: matchTeacherScanId(nfcId),
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Si c'est un professeur
      if (teacher) {
        try {
          const punch = await punchTeacherCourseAttendance({
            teacherId: teacher.id,
            at: scanDate,
            source: 'NFC',
            courseId: courseId || undefined,
          });

          const checkout = punch.attendance.checkOutAt;
          const checkoutLabel = checkout
            ? `${String(checkout.getHours()).padStart(2, '0')}:${String(checkout.getMinutes()).padStart(2, '0')}`
            : '—';

          return res.status(200).json({
            success: true,
            message: `Arrivée enregistrée — fin de séance prévue à ${checkoutLabel} (emploi du temps) · ${punch.attendance.teachingMinutes ?? 0} min décomptées depuis le pointage`,
            type: 'TEACHER',
            punchPhase: punch.punchPhase,
            data: {
              attendance: punch.attendance,
              teacher: {
                id: teacher.id,
                name: `${teacher.user.firstName} ${teacher.user.lastName}`,
                employeeId: teacher.employeeId,
                specialization: teacher.specialization,
              },
              courseId: punch.courseId,
              schedule: punch.slot
                ? {
                    startTime: punch.slot.startTime,
                    endTime: punch.slot.endTime,
                    room: punch.slot.room,
                  }
                : null,
            },
          });
        } catch (e: unknown) {
          const statusCode = (e as { statusCode?: number })?.statusCode ?? 400;
          return res.status(statusCode).json({
            success: false,
            error: e instanceof Error ? e.message : 'Pointage impossible',
            type: 'TEACHER',
          });
        }
      }

      // Si ni étudiant, personnel ni professeur trouvé
      return res.status(404).json({
        success: false,
        error: 'Aucun utilisateur trouvé avec cet ID NFC',
        nfcId,
        message: 'Vérifiez que la carte NFC est correctement enregistrée dans le système',
      });
    } catch (error: any) {
      console.error('Erreur lors du scan NFC externe:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erreur serveur',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }
);

// Endpoint pour obtenir les informations d'un utilisateur par NFC ID (sans enregistrer)
router.get(
  '/info/:nfcId',
  async (req, res) => {
    try {
      const { nfcId } = req.params;

      // Rechercher un étudiant
      const student = await prisma.student.findFirst({
        where: matchStudentScanId(nfcId),
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
            select: {
              id: true,
              name: true,
              level: true,
            },
          },
        },
      });

      if (student) {
        return res.json({
          type: 'STUDENT',
          data: {
            id: student.id,
            name: `${student.user.firstName} ${student.user.lastName}`,
            studentId: student.studentId,
            email: student.user.email,
            avatar: student.user.avatar,
            class: student.class,
          },
        });
      }

      // Rechercher un professeur
      const teacher = await prisma.teacher.findFirst({
        where: matchTeacherScanId(nfcId),
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
          classes: {
            select: {
              id: true,
              name: true,
              level: true,
            },
          },
        },
      });

      if (teacher) {
        return res.json({
          type: 'TEACHER',
          data: {
            id: teacher.id,
            name: `${teacher.user.firstName} ${teacher.user.lastName}`,
            employeeId: teacher.employeeId,
            email: teacher.user.email,
            avatar: teacher.user.avatar,
            specialization: teacher.specialization,
            classes: teacher.classes,
          },
        });
      }

      return res.status(404).json({
        error: 'Aucun utilisateur trouvé avec cet ID NFC',
        nfcId,
      });
    } catch (error: any) {
      console.error('Erreur lors de la récupération des infos NFC:', error);
      res.status(500).json({
        error: error.message || 'Erreur serveur',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }
);

// Endpoint pour lister les cours disponibles (pour les appareils externes)
router.get(
  '/courses',
  async (req, res) => {
    try {
      const { date } = req.query;
      const queryDate = date ? new Date(date as string) : new Date();

      // Récupérer les cours du jour
      const dayOfWeek = queryDate.getDay(); // 0 = Dimanche, 1 = Lundi, etc.

      const schedules = await prisma.schedule.findMany({
        where: {
          dayOfWeek,
        },
        include: {
          course: {
            select: {
              id: true,
              name: true,
              code: true,
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
      });

      const courses = schedules.map((schedule) => ({
        id: schedule.course.id,
        name: schedule.course.name,
        code: schedule.course.code,
        class: schedule.class,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        room: schedule.room,
      }));

      res.json({
        date: queryDate.toISOString().split('T')[0],
        dayOfWeek,
        courses,
      });
    } catch (error: any) {
      console.error('Erreur lors de la récupération des cours:', error);
      res.status(500).json({
        error: error.message || 'Erreur serveur',
      });
    }
  }
);

export default router;

