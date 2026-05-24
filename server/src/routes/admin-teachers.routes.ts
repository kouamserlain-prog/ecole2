import express from 'express';
import type { Prisma } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma';
import {
  inviteNewUserToSetPassword,
  resolveAdminProvidedOrInvitePassword,
} from '../utils/admin-user-initial-password.util';
import { optionalPasswordPolicyValidator, PASSWORD_POLICY_HINT } from '../utils/password.util';
import { deleteStoredUploadUrl } from '../utils/upload-persist.util';
import { resolveStoredFileAccessUrl } from '../utils/upload-access-token.util';
import { punchTeacherCourseAttendance } from '../utils/attendance-punch.util';
import { normalizeRoomKey } from '../utils/timetable-constraints.util';
import {
  isTeacherEngagementKind,
  normalizeTeacherEngagementKind,
} from '../utils/teacher-engagement-kind.util';

const router = express.Router();


// Rechercher un enseignant par NFC ID
router.get('/teachers/nfc/:nfcId', async (req, res) => {
  try {
    const { nfcId } = req.params;

    const teacher = await prisma.teacher.findFirst({
      where: { nfcId },
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
        classes: {
          select: {
            id: true,
            name: true,
            level: true,
          },
        },
        courses: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!teacher) {
      return res.status(404).json({ error: 'Aucun enseignant trouvé avec cet ID NFC' });
    }

    res.json(teacher);
  } catch (error: any) {
    console.error('Error fetching teacher by NFC ID:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Enregistrer la présence d'un enseignant via NFC (arrivée + départ auto + heures)
router.post('/teachers/nfc-attendance', async (req, res) => {
  try {
    const { teacherId, date, courseId } = req.body;

    if (!teacherId || !date) {
      return res.status(400).json({ error: 'teacherId et date sont requis' });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (!teacher) {
      return res.status(404).json({ error: 'Enseignant non trouvé' });
    }

    const punch = await punchTeacherCourseAttendance({
      teacherId,
      at: new Date(date),
      source: 'ADMIN',
      courseId: courseId || undefined,
      recordedByUserId: req.user!.id,
    });

    res.status(201).json({
      message: 'Pointage enseignant enregistré',
      punchPhase: punch.punchPhase,
      attendance: punch.attendance,
    });
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number })?.statusCode ?? 500;
    console.error('Error recording teacher NFC attendance:', error);
    res.status(statusCode).json({
      error: error instanceof Error ? error.message : 'Erreur serveur',
    });
  }
});

// Historique pointages enseignants (par session de cours)
router.get('/teachers/attendance', async (req, res) => {
  try {
    const { teacherId, from, to } = req.query;
    const where: { teacherId?: string; attendanceDate?: { gte?: string; lte?: string } } = {};
    if (teacherId && typeof teacherId === 'string') where.teacherId = teacherId;
    if (from && typeof from === 'string') {
      where.attendanceDate = { ...where.attendanceDate, gte: from.slice(0, 10) };
    }
    if (to && typeof to === 'string') {
      where.attendanceDate = { ...where.attendanceDate, lte: to.slice(0, 10) };
    }

    const rows = await prisma.teacherAttendance.findMany({
      where,
      orderBy: [{ attendanceDate: 'desc' }, { updatedAt: 'desc' }],
      include: {
        teacher: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    const courseIds = [...new Set(rows.map((r) => r.courseId).filter(Boolean))] as string[];
    const courses =
      courseIds.length > 0
        ? await prisma.course.findMany({
            where: { id: { in: courseIds } },
            select: { id: true, name: true, code: true },
          })
        : [];
    const courseMap = new Map(courses.map((c) => [c.id, c]));

    res.json(
      rows.map((r) => ({
        ...r,
        course: r.courseId ? courseMap.get(r.courseId) ?? null : null,
      })),
    );
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

// Lister tous les enseignants
router.get('/teachers', async (req, res) => {
  try {
    const engagementKindRaw = req.query.engagementKind;
    const where =
      typeof engagementKindRaw === 'string' && isTeacherEngagementKind(engagementKindRaw)
        ? { engagementKind: engagementKindRaw }
        : undefined;

    const teachers = await prisma.teacher.findMany({
      where,
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
        classes: true,
        courses: true,
      },
    });

    res.json(teachers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Créer un enseignant
router.post(
  '/teachers',
  [
    body('email').isEmail(),
    body('password')
      .optional({ values: 'falsy' })
      .trim()
      .custom(optionalPasswordPolicyValidator)
      .withMessage(PASSWORD_POLICY_HINT),
    body('firstName').notEmpty(),
    body('lastName').notEmpty(),
    body('employeeId').notEmpty(),
    body('specialization').notEmpty(),
    body('hireDate').isISO8601(),
    body('engagementKind').optional().isIn(['PERMANENT', 'VACATAIRE']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        email,
        password,
        firstName,
        lastName,
        phone,
        employeeId,
        specialization,
        hireDate,
        contractType,
        engagementKind,
        salary,
        bio,
        maxWeeklyHours,
      } = req.body;

      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return res.status(400).json({ error: 'Cet email est déjà utilisé' });
      }

      const existingEmployee = await prisma.teacher.findUnique({
        where: { employeeId },
      });

      if (existingEmployee) {
        return res.status(400).json({ error: 'Ce numéro d\'employé existe déjà' });
      }

      const { hashedPassword, shouldSendSetupEmail } = await resolveAdminProvidedOrInvitePassword(password);

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          phone,
          role: 'TEACHER',
          teacherProfile: {
            create: {
              employeeId,
              specialization,
              hireDate: new Date(hireDate),
              contractType: contractType || 'CDI',
              engagementKind: normalizeTeacherEngagementKind(engagementKind),
              salary,
              ...(bio !== undefined && typeof bio === 'string' && bio.trim()
                ? { bio: bio.trim().slice(0, 4000) }
                : {}),
              ...(maxWeeklyHours !== undefined &&
              maxWeeklyHours !== '' &&
              !Number.isNaN(parseFloat(String(maxWeeklyHours)))
                ? { maxWeeklyHours: parseFloat(String(maxWeeklyHours)) }
                : {}),
            },
          },
        },
        include: {
          teacherProfile: true,
        },
      });

      if (shouldSendSetupEmail) {
        try {
          await inviteNewUserToSetPassword(user.id, user.email, user.firstName);
        } catch (inviteErr) {
          console.error('Invitation mot de passe (enseignant):', inviteErr);
        }
      }

      const { password: _pw, ...userWithoutPassword } = user;
      res.status(201).json({ ...userWithoutPassword, passwordSetupEmailSent: shouldSendSetupEmail });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Obtenir un enseignant par ID
router.get('/teachers/:id', async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: req.params.id },
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
        classes: {
          select: {
            id: true,
            name: true,
            level: true,
            academicYear: true,
          },
        },
        courses: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
                level: true,
              },
            },
          },
        },
        qualifications: { orderBy: { createdAt: 'desc' } },
        careerHistory: { orderBy: { startDate: 'desc' } },
        professionalTrainings: { orderBy: { createdAt: 'desc' } },
        administrativeDocuments: {
          orderBy: { createdAt: 'desc' },
          include: {
            uploadedBy: { select: { firstName: true, lastName: true, role: true } },
          },
        },
        performanceReviews: { orderBy: { createdAt: 'desc' }, take: 50 },
        scheduleAvailabilitySlots: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
      },
    });

    if (!teacher) {
      return res.status(404).json({ error: 'Enseignant non trouvé' });
    }

    const programmedWeeklyHours = teacher.courses.reduce(
      (sum, c) => sum + (c.weeklyHours ?? 0),
      0
    );

    res.json({
      ...teacher,
      workloadSummary: {
        programmedWeeklyHours,
        courseCount: teacher.courses.length,
        maxWeeklyHours: teacher.maxWeeklyHours ?? null,
      },
    });
  } catch (error: any) {
    console.error('Erreur dans /admin/teachers/:id:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Mettre à jour un enseignant
router.put('/teachers/:id', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      specialization,
      contractType,
      engagementKind,
      salary,
      isActive,
      nfcId,
      biometricId,
      bio,
      maxWeeklyHours,
    } = req.body;

    const teacher = await prisma.teacher.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!teacher) {
      return res.status(404).json({ error: 'Enseignant non trouvé' });
    }

    if (
      firstName ||
      lastName ||
      phone !== undefined ||
      isActive !== undefined
    ) {
      await prisma.user.update({
        where: { id: teacher.userId },
        data: {
          ...(typeof firstName === 'string' && firstName.trim() && { firstName: firstName.trim() }),
          ...(typeof lastName === 'string' && lastName.trim() && { lastName: lastName.trim() }),
          ...(phone !== undefined && {
            phone: typeof phone === 'string' && phone.trim() ? phone.trim() : null,
          }),
          ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        },
      });
    }

    const data: Prisma.TeacherUncheckedUpdateInput = {};
    if (specialization !== undefined && typeof specialization === 'string' && specialization.trim()) {
      data.specialization = specialization.trim();
    }
    if (contractType !== undefined && typeof contractType === 'string' && contractType.trim()) {
      data.contractType = contractType.trim();
    }
    if (engagementKind !== undefined && isTeacherEngagementKind(engagementKind)) {
      data.engagementKind = engagementKind;
    }
    if (salary !== undefined) {
      data.salary =
        salary === null || salary === ''
          ? null
          : !Number.isNaN(parseFloat(String(salary)))
            ? parseFloat(String(salary))
            : null;
    }
    if (nfcId !== undefined) {
      data.nfcId = typeof nfcId === 'string' && nfcId.trim() ? nfcId.trim() : null;
    }
    if (biometricId !== undefined) {
      data.biometricId =
        typeof biometricId === 'string' && biometricId.trim() ? biometricId.trim() : null;
    }
    if (bio !== undefined) {
      data.bio =
        typeof bio === 'string' && bio.trim().length > 0 ? bio.trim().slice(0, 4000) : null;
    }
    if (maxWeeklyHours !== undefined) {
      if (maxWeeklyHours === null || maxWeeklyHours === '') {
        data.maxWeeklyHours = null;
      } else {
        const n = parseFloat(String(maxWeeklyHours));
        data.maxWeeklyHours = Number.isNaN(n) ? null : n;
      }
    }

    const updatedTeacher = await prisma.teacher.update({
      where: { id: req.params.id },
      data,
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
        classes: true,
        courses: true,
        qualifications: { orderBy: { createdAt: 'desc' } },
        careerHistory: { orderBy: { startDate: 'desc' } },
        professionalTrainings: { orderBy: { createdAt: 'desc' } },
        administrativeDocuments: {
          orderBy: { createdAt: 'desc' },
          include: {
            uploadedBy: { select: { firstName: true, lastName: true, role: true } },
          },
        },
        performanceReviews: { orderBy: { createdAt: 'desc' }, take: 50 },
        scheduleAvailabilitySlots: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
      },
    });

    const programmedWeeklyHours = updatedTeacher.courses.reduce(
      (sum, c) => sum + (c.weeklyHours ?? 0),
      0
    );

    res.json({
      ...updatedTeacher,
      workloadSummary: {
        programmedWeeklyHours,
        courseCount: updatedTeacher.courses.length,
        maxWeeklyHours: updatedTeacher.maxWeeklyHours ?? null,
      },
    });
  } catch (error: any) {
    console.error('Erreur dans /admin/teachers/:id PUT:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Liste des évaluations RH d'un enseignant
router.get('/teachers/:id/performance-reviews', async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!teacher) {
      return res.status(404).json({ error: 'Enseignant non trouvé' });
    }
    const reviews = await prisma.teacherPerformanceReview.findMany({
      where: { teacherId: teacher.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(reviews);
  } catch (error: any) {
    console.error('GET admin teacher reviews:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Liste des demandes de congé d'un enseignant
router.get('/teachers/:id/leaves', async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!teacher) {
      return res.status(404).json({ error: 'Enseignant non trouvé' });
    }
    const leaves = await prisma.teacherLeave.findMany({
      where: { teacherId: teacher.id },
      orderBy: { startDate: 'desc' },
    });
    res.json(leaves);
  } catch (error: any) {
    console.error('GET admin teacher leaves:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Disponibilités hebdomadaires d'un enseignant (emplois du temps)
router.get('/teachers/:id/schedule-availability', async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!teacher) return res.status(404).json({ error: 'Enseignant non trouvé' });

    const slots = await prisma.teacherScheduleAvailabilitySlot.findMany({
      where: { teacherId: teacher.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    res.json(slots);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.post('/teachers/:id/schedule-availability', async (req, res) => {
  try {
    const { dayOfWeek, startTime, endTime, label } = req.body;
    if (dayOfWeek === undefined || !startTime || !endTime) {
      return res.status(400).json({ error: 'dayOfWeek, startTime et endTime sont requis' });
    }
    const teacher = await prisma.teacher.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!teacher) return res.status(404).json({ error: 'Enseignant non trouvé' });

    const created = await prisma.teacherScheduleAvailabilitySlot.create({
      data: {
        teacherId: teacher.id,
        dayOfWeek: parseInt(String(dayOfWeek), 10),
        startTime: String(startTime).trim(),
        endTime: String(endTime).trim(),
        label: label ? String(label).trim() : null,
      },
    });
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.delete('/teachers/:id/schedule-availability/:slotId', async (req, res) => {
  try {
    const found = await prisma.teacherScheduleAvailabilitySlot.findFirst({
      where: { id: req.params.slotId, teacherId: req.params.id },
      select: { id: true },
    });
    if (!found) return res.status(404).json({ error: 'Créneau non trouvé' });

    await prisma.teacherScheduleAvailabilitySlot.delete({ where: { id: found.id } });
    res.json({ message: 'Créneau supprimé' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// --- Dossier enseignant : documents administratifs ---
router.get('/teachers/:id/administrative-documents', async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!teacher) {
      return res.status(404).json({ error: 'Enseignant non trouvé' });
    }
    const docs = await prisma.teacherAdministrativeDocument.findMany({
      where: { teacherId: teacher.id },
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: { select: { firstName: true, lastName: true, role: true, email: true } },
      },
    });
    res.json(docs);
  } catch (error: any) {
    console.error('GET teacher administrative-documents:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.delete('/teachers/:teacherId/administrative-documents/:docId', async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: req.params.teacherId },
      select: { id: true },
    });
    if (!teacher) {
      return res.status(404).json({ error: 'Enseignant non trouvé' });
    }
    const doc = await prisma.teacherAdministrativeDocument.findFirst({
      where: { id: req.params.docId, teacherId: teacher.id },
    });
    if (!doc) {
      return res.status(404).json({ error: 'Document introuvable' });
    }
    await prisma.teacherAdministrativeDocument.delete({ where: { id: doc.id } });
    await deleteStoredUploadUrl(doc.fileUrl);
    res.json({ message: 'Document supprimé' });
  } catch (error: any) {
    console.error('DELETE teacher administrative-document:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Qualifications / diplômes
router.post('/teachers/:id/qualifications', async (req, res) => {
  try {
    const { title, institution, field, obtainedAt, notes } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Intitulé du diplôme requis' });
    }
    const teacher = await prisma.teacher.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!teacher) {
      return res.status(404).json({ error: 'Enseignant non trouvé' });
    }
    let obt: Date | null = null;
    if (obtainedAt) {
      const d = new Date(String(obtainedAt));
      obt = Number.isNaN(d.getTime()) ? null : d;
    }
    const row = await prisma.teacherQualification.create({
      data: {
        teacherId: teacher.id,
        title: title.trim().slice(0, 200),
        institution: institution ? String(institution).trim().slice(0, 200) : null,
        field: field ? String(field).trim().slice(0, 200) : null,
        obtainedAt: obt,
        notes: notes ? String(notes).trim().slice(0, 2000) : null,
      },
    });
    res.status(201).json(row);
  } catch (error: any) {
    console.error('POST teacher qualification:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.delete('/teachers/:teacherId/qualifications/:qualId', async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: req.params.teacherId },
      select: { id: true },
    });
    if (!teacher) {
      return res.status(404).json({ error: 'Enseignant non trouvé' });
    }
    const row = await prisma.teacherQualification.findFirst({
      where: { id: req.params.qualId, teacherId: teacher.id },
    });
    if (!row) {
      return res.status(404).json({ error: 'Entrée introuvable' });
    }
    await prisma.teacherQualification.delete({ where: { id: row.id } });
    res.json({ message: 'Qualification supprimée' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Historique professionnel
router.post('/teachers/:id/career-history', async (req, res) => {
  try {
    const { institution, role, startDate, endDate, country, notes } = req.body;
    if (!institution || typeof institution !== 'string' || !institution.trim()) {
      return res.status(400).json({ error: 'Établissement requis' });
    }
    if (!role || typeof role !== 'string' || !role.trim()) {
      return res.status(400).json({ error: 'Fonction / poste requis' });
    }
    if (!startDate) {
      return res.status(400).json({ error: 'Date de début requise' });
    }
    const sd = new Date(String(startDate));
    if (Number.isNaN(sd.getTime())) {
      return res.status(400).json({ error: 'Date de début invalide' });
    }
    let ed: Date | null = null;
    if (endDate) {
      const e = new Date(String(endDate));
      ed = Number.isNaN(e.getTime()) ? null : e;
    }
    const teacher = await prisma.teacher.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!teacher) {
      return res.status(404).json({ error: 'Enseignant non trouvé' });
    }
    const row = await prisma.teacherCareerHistory.create({
      data: {
        teacherId: teacher.id,
        institution: institution.trim().slice(0, 200),
        role: role.trim().slice(0, 200),
        startDate: sd,
        endDate: ed,
        country: country ? String(country).trim().slice(0, 120) : null,
        notes: notes ? String(notes).trim().slice(0, 2000) : null,
      },
    });
    res.status(201).json(row);
  } catch (error: any) {
    console.error('POST teacher career-history:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.delete('/teachers/:teacherId/career-history/:entryId', async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: req.params.teacherId },
      select: { id: true },
    });
    if (!teacher) {
      return res.status(404).json({ error: 'Enseignant non trouvé' });
    }
    const row = await prisma.teacherCareerHistory.findFirst({
      where: { id: req.params.entryId, teacherId: teacher.id },
    });
    if (!row) {
      return res.status(404).json({ error: 'Entrée introuvable' });
    }
    await prisma.teacherCareerHistory.delete({ where: { id: row.id } });
    res.json({ message: 'Entrée supprimée' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Formation continue
router.post('/teachers/:id/professional-trainings', async (req, res) => {
  try {
    const { title, organization, hours, completedAt, notes } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Intitulé de la formation requis' });
    }
    const teacher = await prisma.teacher.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!teacher) {
      return res.status(404).json({ error: 'Enseignant non trouvé' });
    }
    let comp: Date | null = null;
    if (completedAt) {
      const c = new Date(String(completedAt));
      comp = Number.isNaN(c.getTime()) ? null : c;
    }
    let hrs: number | null = null;
    if (hours !== undefined && hours !== null && hours !== '') {
      const h = parseFloat(String(hours));
      hrs = Number.isNaN(h) ? null : h;
    }
    const row = await prisma.teacherProfessionalTraining.create({
      data: {
        teacherId: teacher.id,
        title: title.trim().slice(0, 200),
        organization: organization ? String(organization).trim().slice(0, 200) : null,
        hours: hrs,
        completedAt: comp,
        notes: notes ? String(notes).trim().slice(0, 2000) : null,
      },
    });
    res.status(201).json(row);
  } catch (error: any) {
    console.error('POST teacher professional-training:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.delete('/teachers/:teacherId/professional-trainings/:trainingId', async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: req.params.teacherId },
      select: { id: true },
    });
    if (!teacher) {
      return res.status(404).json({ error: 'Enseignant non trouvé' });
    }
    const row = await prisma.teacherProfessionalTraining.findFirst({
      where: { id: req.params.trainingId, teacherId: teacher.id },
    });
    if (!row) {
      return res.status(404).json({ error: 'Entrée introuvable' });
    }
    await prisma.teacherProfessionalTraining.delete({ where: { id: row.id } });
    res.json({ message: 'Formation supprimée' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Indisponibilités de salles (emplois du temps)
router.get('/schedule-room-blocks', async (_req, res) => {
  try {
    const blocks = await prisma.roomScheduleUnavailableSlot.findMany({
      orderBy: [{ roomKey: 'asc' }, { dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    res.json(blocks);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.post('/schedule-room-blocks', async (req, res) => {
  try {
    const { room, dayOfWeek, startTime, endTime, reason } = req.body;
    const roomKey = normalizeRoomKey(room);
    if (!roomKey || dayOfWeek === undefined || !startTime || !endTime) {
      return res.status(400).json({ error: 'room, dayOfWeek, startTime et endTime sont requis' });
    }
    const created = await prisma.roomScheduleUnavailableSlot.create({
      data: {
        roomKey,
        dayOfWeek: parseInt(String(dayOfWeek), 10),
        startTime: String(startTime).trim(),
        endTime: String(endTime).trim(),
        reason: reason ? String(reason).trim() : null,
      },
    });
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.delete('/schedule-room-blocks/:blockId', async (req, res) => {
  try {
    await prisma.roomScheduleUnavailableSlot.delete({ where: { id: req.params.blockId } });
    res.json({ message: 'Bloc salle supprimé' });
  } catch (error: any) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Bloc non trouvé' });
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Évaluation du personnel — enregistrer une fiche pour un enseignant
router.post(
  '/teachers/:id/performance-reviews',
  [
    body('periodLabel').notEmpty().withMessage('Période requise'),
    body('academicYear').notEmpty().withMessage('Année scolaire requise'),
    body('overallScore').optional().isFloat({ min: 0, max: 20 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const teacher = await prisma.teacher.findUnique({
        where: { id: req.params.id },
        select: { id: true },
      });
      if (!teacher) {
        return res.status(404).json({ error: 'Enseignant non trouvé' });
      }

      const {
        periodLabel,
        academicYear,
        overallScore,
        objectives,
        achievements,
        improvements,
        reviewerName,
      } = req.body;

      const review = await prisma.teacherPerformanceReview.create({
        data: {
          teacherId: teacher.id,
          periodLabel: String(periodLabel).trim(),
          academicYear: String(academicYear).trim(),
          overallScore:
            overallScore !== undefined && overallScore !== null && overallScore !== ''
              ? parseFloat(String(overallScore))
              : null,
          objectives: objectives?.trim() || null,
          achievements: achievements?.trim() || null,
          improvements: improvements?.trim() || null,
          reviewerName: reviewerName?.trim() || null,
        },
      });

      res.status(201).json(review);
    } catch (error: any) {
      console.error('POST /admin/teachers/:id/performance-reviews:', error);
      res.status(500).json({ error: error.message || 'Erreur serveur' });
    }
  }
);

// Congés enseignant — statut (validation direction)
router.patch('/teachers/:teacherId/leaves/:leaveId', async (req, res) => {
  try {
    const { status, adminComment } = req.body;
    if (!['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }

    const leave = await prisma.teacherLeave.findFirst({
      where: { id: req.params.leaveId, teacherId: req.params.teacherId },
    });
    if (!leave) {
      return res.status(404).json({ error: 'Demande introuvable' });
    }

    const updated = await prisma.teacherLeave.update({
      where: { id: leave.id },
      data: {
        status,
        ...(adminComment !== undefined && {
          adminComment: adminComment === null || adminComment === '' ? null : String(adminComment).trim(),
        }),
      },
    });

    res.json(updated);
  } catch (error: any) {
    console.error('PATCH admin teacher leave:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// ——— Ressources humaines (vues agrégées direction) ———

/** Tous les congés enseignants (filtre optionnel ?status=PENDING|…) */
router.get('/hr/teacher-leaves', async (req, res) => {
  try {
    const { status } = req.query;
    const where: { status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' } = {};
    if (
      typeof status === 'string' &&
      ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(status)
    ) {
      where.status = status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
    }

    const leaves = await prisma.teacherLeave.findMany({
      where,
      orderBy: { startDate: 'desc' },
      include: {
        teacher: {
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
        },
      },
    });

    res.json(leaves);
  } catch (error: any) {
    console.error('GET /admin/hr/teacher-leaves:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

/** Toutes les fiches d’évaluation du personnel enseignant */
router.get('/hr/teacher-performance-reviews', async (req, res) => {
  try {
    const reviews = await prisma.teacherPerformanceReview.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        teacher: {
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

    res.json(reviews);
  } catch (error: any) {
    console.error('GET /admin/hr/teacher-performance-reviews:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Supprimer un enseignant
router.delete('/teachers/:id', async (req, res) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!teacher) {
      return res.status(404).json({ error: 'Enseignant non trouvé' });
    }

    // Utiliser une transaction pour supprimer toutes les relations dans le bon ordre
    await prisma.$transaction(async (tx) => {
      // 1. Supprimer les StudentAssignments liés aux assignments de l'enseignant
      const assignments = await tx.assignment.findMany({
        where: { teacherId: req.params.id },
        select: { id: true },
      });
      if (assignments.length > 0) {
        await tx.studentAssignment.deleteMany({
          where: { assignmentId: { in: assignments.map((a) => a.id) } },
        });
      }

      // 2. Supprimer les assignments de l'enseignant
      await tx.assignment.deleteMany({
        where: { teacherId: req.params.id },
      });

      // 3. Supprimer les grades de l'enseignant
      await tx.grade.deleteMany({
        where: { teacherId: req.params.id },
      });

      // 4. Supprimer les absences de l'enseignant
      await tx.absence.deleteMany({
        where: { teacherId: req.params.id },
      });

      // 5. Supprimer les schedules liés aux courses de l'enseignant
      const courses = await tx.course.findMany({
        where: { teacherId: req.params.id },
        select: { id: true },
      });
      if (courses.length > 0) {
        const courseIds = courses.map((c) => c.id);
        await tx.schedule.deleteMany({
          where: { courseId: { in: courseIds } },
        });
        // Notes / absences liées au cours (autre enseignant que celui supprimé)
        await tx.grade.deleteMany({ where: { courseId: { in: courseIds } } });
        await tx.absence.deleteMany({ where: { courseId: { in: courseIds } } });
      }

      // 6. Supprimer les courses de l'enseignant
      await tx.course.deleteMany({
        where: { teacherId: req.params.id },
      });

      // 7. Retirer l'enseignant des classes (mettre teacherId à null)
      await tx.class.updateMany({
        where: { teacherId: req.params.id },
        data: { teacherId: null },
      });

      await tx.teacherLeave.deleteMany({
        where: { teacherId: req.params.id },
      });
      await tx.teacherPerformanceReview.deleteMany({
        where: { teacherId: req.params.id },
      });

      await tx.parentTeacherAppointment.deleteMany({
        where: { teacherId: req.params.id },
      });

      await tx.teacherAttendance.deleteMany({
        where: { teacherId: req.params.id },
      });

      await tx.teacherScheduleAvailabilitySlot.deleteMany({
        where: { teacherId: req.params.id },
      });

      const adminDocs = await tx.teacherAdministrativeDocument.findMany({
        where: { teacherId: req.params.id },
      });
      for (const d of adminDocs) {
        await deleteStoredUploadUrl(d.fileUrl);
      }
      await tx.teacherAdministrativeDocument.deleteMany({
        where: { teacherId: req.params.id },
      });

      await tx.teacherQualification.deleteMany({
        where: { teacherId: req.params.id },
      });
      await tx.teacherCareerHistory.deleteMany({
        where: { teacherId: req.params.id },
      });
      await tx.teacherProfessionalTraining.deleteMany({
        where: { teacherId: req.params.id },
      });

      // 8. Supprimer le profil enseignant
      await tx.teacher.delete({
        where: { id: req.params.id },
      });

      // 9. Supprimer l'utilisateur associé
      await tx.user.delete({
        where: { id: teacher.userId },
      });
    });

    res.json({ message: 'Enseignant supprimé avec succès' });
  } catch (error: any) {
    console.error('Erreur lors de la suppression de l\'enseignant:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur lors de la suppression',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});


export default router;
