import express from 'express';
import type { Prisma, MessageCategory, MessageChannel } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  inviteNewUserToSetPassword,
  resolveAdminProvidedOrInvitePassword,
} from '../utils/admin-user-initial-password.util';
import { optionalPasswordPolicyValidator, PASSWORD_POLICY_HINT } from '../utils/password.util';
import prisma from '../utils/prisma';
import { deleteStoredUploadUrl } from '../utils/upload-persist.util';
import { resolveStoredFileAccessUrl } from '../utils/upload-access-token.util';
import { computeClassBulletinRanks, enrichReportCardsWithTermHistory } from '../utils/report-card.util';
import {
  assertScheduleConstraints,
  autoGenerateTimetableForClass,
  normalizeRoomKey,
} from '../utils/timetable-constraints.util';
import {
  notifyParentsOfAttendanceChange,
  notifyParentsForAbsenceById,
  shouldNotifyParentsOnAttendanceChange,
} from '../utils/attendance-parent-notify.util';
import { notifyParentsNewAssignment } from '../utils/parent-notify.util';
import { countFaceEnrollments } from '../utils/face-recognition.util';
import { punchStudentCourseAttendance, punchTeacherCourseAttendance } from '../utils/attendance-punch.util';
import QRCode from 'qrcode';
import { generateDigitalCardPublicId } from '../utils/digital-card.util';
import staffAdminRoutes from './admin-staff.routes';
import parentAdminRoutes from './admin-parent.routes';
import tuitionCatalogRoutes from './admin-tuition-catalog.routes';
import {
  enforceTuitionFeeAmounts,
  TuitionLevelAmountError,
} from '../utils/tuition-level-amount.util';
import accountingRoutes from './admin-accounting.routes';
import disciplineAdminRoutes from './admin-discipline.routes';
import adminDigitalLibraryRoutes from './admin-digital-library.routes';
import extracurricularAdminRoutes from './admin-extracurricular.routes';
import tracksAdminRoutes from './admin-tracks.routes';
import orientationAdminRoutes from './admin-orientation.routes';
import adminReportsRoutes from './admin-reports.routes';
import adminAppBrandingRoutes from './admin-app-branding.routes';
import adminWorkspacesRoutes from './admin-workspaces.routes';
import adminSchoolsRoutes from './admin-schools.routes';
import { attachSchoolContext } from '../middleware/school-context.middleware';
import { guardAdminStudentRoute } from '../middleware/school-resource-guard.middleware';
import type { SchoolContextRequest } from '../utils/school-context.util';
import {
  assertClassInSchool,
  assertPaymentInSchool,
  assertStudentInSchool,
  assertTuitionFeeInSchool,
  mergeWhereWithSchoolScope,
  scopedPaymentWhere,
  scopedTuitionFeeWhere,
  SchoolAccessDeniedError,
  studentBelongsToSchool,
} from '../utils/school-access-guard.util';
import {
  absenceWhereRelationsExist,
  assignmentWhereRelationsExist,
  gradeWhereRelationsExist,
} from '../utils/prisma-relation-exists.util';
import {
  studentScopeWhere,
  classScopeWhere,
  admissionScopeWhere,
} from '../utils/school-context.util';
import libraryManagementRoutes from './shared/library-management.routes';
import { maybeNotifyMaterialStockAlert } from '../utils/material-stock-notify.util';
import {
  listPendingCashPayments,
  rejectCashPayment,
  validateCashPayment,
} from '../utils/cash-payment-validation.util';
import {
  assignTuitionFeeInvoiceNumbers,
  autoReceiptUrl,
  notifyTuitionFeeChanged,
  runAutomaticTuitionReminders,
} from '../utils/tuition-financial-automation.util';
import { runMongoBackup } from '../utils/mongodb-backup.util';
import fs from 'node:fs/promises';
import path from 'node:path';
import { EVALUATION_TYPE_VALUES } from '../utils/evaluation-type.util';
import {
  createGradeChangeRequest,
  createReportCardChangeRequest,
  gradeToPayload,
  workflowStatusLabel,
  type ReportCardPayload,
} from '../utils/academic-change-request.util';
import type { AuthRequest } from '../middleware/auth.middleware';
import {
  isTeacherEngagementKind,
  normalizeTeacherEngagementKind,
} from '../utils/teacher-engagement-kind.util';
import { getMetricsSummary, getSlowEndpoints } from '../utils/performance-metrics.util';
import { authorizeAdminOrStaffFinance } from '../middleware/authorize-admin-or-staff-finance.middleware';
import { enrollStudentFromAdmission } from '../utils/admission-enroll.util';
import {
  findScheduleByIdWithRelations,
  findSchedulesWithRelations,
} from '../utils/safe-schedule-query.util';

const router = express.Router();

// ADMIN complet, ou STAFF économat sur les routes financières / de suivi autorisées
router.use(authenticate);
router.use(authorizeAdminOrStaffFinance);
router.use(adminSchoolsRoutes);
router.use(adminWorkspacesRoutes);

function shouldSkipSchoolContext(path: string, method: string): boolean {
  if (path === '/schools' && (method === 'GET' || method === 'POST')) return true;
  if (path === '/schools/manage' && method === 'GET') return true;
  if (path === '/schools/active') return true;
  if (path.startsWith('/schools/by-slug/')) return true;
  if (/^\/schools\/[a-f0-9]{24}$/i.test(path) && method === 'PUT') return true;
  if (path.startsWith('/workspaces')) return true;
  if (path === '/notifications' || path.startsWith('/notifications')) return true;
  return false;
}

router.use((req, res, next) => {
  if (shouldSkipSchoolContext(req.path, req.method)) return next();
  return attachSchoolContext(req as SchoolContextRequest, res, next);
});

router.use('/students/:id', guardAdminStudentRoute);
router.use('/students/:studentId', guardAdminStudentRoute);

router.use(staffAdminRoutes);
router.use(parentAdminRoutes);
router.use(tuitionCatalogRoutes);
router.use(accountingRoutes);
router.use(disciplineAdminRoutes);
router.use(adminDigitalLibraryRoutes);
router.use(extracurricularAdminRoutes);
router.use(tracksAdminRoutes);
router.use(orientationAdminRoutes);
router.use(adminReportsRoutes);
router.use(adminAppBrandingRoutes);
router.use(libraryManagementRoutes);

// ========== GESTION DES ÉLÈVES ==========

// Rechercher un élève par NFC ID
router.get('/students/nfc/:nfcId', async (req: SchoolContextRequest, res) => {
  try {
    const { nfcId } = req.params;
    const schoolId = req.schoolId!;

    const student = await prisma.student.findFirst({
      where: {
        nfcId,
        ...studentScopeWhere(schoolId),
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
        class: {
          select: {
            id: true,
            name: true,
            level: true,
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
                    phone: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({ error: 'Aucun élève trouvé avec cet ID NFC' });
    }

    res.json(student);
  } catch (error: any) {
    console.error('Error fetching student by NFC ID:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Lister tous les élèves
router.get('/students', async (req: SchoolContextRequest, res) => {
  try {
    const { classId, isActive, enrollmentStatus } = req.query;
    const schoolId = req.schoolId!;

    const students = await prisma.student.findMany({
      where: {
        ...studentScopeWhere(schoolId),
        ...(classId && { classId: classId as string }),
        ...(isActive !== undefined && { isActive: isActive === 'true' }),
        ...(enrollmentStatus &&
          typeof enrollmentStatus === 'string' && {
            enrollmentStatus: enrollmentStatus as
              | 'ACTIVE'
              | 'SUSPENDED'
              | 'GRADUATED'
              | 'ARCHIVED',
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
        class: {
          select: {
            id: true,
            name: true,
            level: true,
          },
        },
        parents: {
          include: {
            parent: {
              include: {
                user: {
                  select: {
                    id: true,
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
      },
    });

    res.json(students);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Créer un élève
router.post(
  '/students',
  [
    body('email').isEmail(),
    body('password')
      .optional({ values: 'falsy' })
      .trim()
      .custom(optionalPasswordPolicyValidator)
      .withMessage(PASSWORD_POLICY_HINT),
    body('firstName').notEmpty(),
    body('lastName').notEmpty(),
    body('studentId').notEmpty(),
    body('dateOfBirth').isISO8601(),
    body('gender').isIn(['MALE', 'FEMALE', 'OTHER']),
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
        studentId,
        dateOfBirth,
        gender,
        address,
        emergencyContact,
        emergencyPhone,
        emergencyContact2,
        emergencyPhone2,
        medicalInfo,
        allergies,
        specialNeeds,
        classId,
        enrollmentStatus,
      } = req.body;

      // Vérifier si l'email existe déjà
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return res.status(400).json({ error: 'Cet email est déjà utilisé' });
      }

      // Vérifier si le studentId existe déjà
      const existingStudent = await prisma.student.findUnique({
        where: { studentId },
      });

      if (existingStudent) {
        return res.status(400).json({ error: 'Ce numéro d\'élève existe déjà' });
      }

      const { hashedPassword, shouldSendSetupEmail } = await resolveAdminProvidedOrInvitePassword(password);

      // Créer l'utilisateur et le profil élève
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          phone,
          role: 'STUDENT',
          studentProfile: {
            create: {
              studentId,
              dateOfBirth: new Date(dateOfBirth),
              gender,
              address,
              emergencyContact,
              emergencyPhone,
              emergencyContact2,
              emergencyPhone2,
              medicalInfo,
              allergies,
              specialNeeds,
              digitalCardPublicId: generateDigitalCardPublicId(),
              classId,
              ...(enrollmentStatus &&
              ['ACTIVE', 'SUSPENDED', 'GRADUATED', 'ARCHIVED'].includes(enrollmentStatus) && {
                enrollmentStatus,
              }),
            },
          },
        },
        include: {
          studentProfile: {
            include: {
              class: true,
            },
          },
        },
      });

      // Enregistrer l'événement de sécurité pour l'activité
      try {
        await prisma.securityEvent.create({
          data: {
            userId: (req as any).user?.id,
            type: 'student_added',
            description: `Élève créé: ${firstName} ${lastName} (${studentId})${classId ? ' - Classe assignée' : ''}`,
            ipAddress: req.ip || req.socket.remoteAddress,
            userAgent: req.get('user-agent'),
            severity: 'info',
          },
        });
      } catch (eventError) {
        // Ne pas faire échouer la création de l'élève si l'événement échoue
        console.error('Erreur lors de la création de l\'événement de sécurité:', eventError);
      }

      if (shouldSendSetupEmail) {
        try {
          await inviteNewUserToSetPassword(user.id, user.email, user.firstName);
        } catch (inviteErr) {
          console.error('Invitation mot de passe (élève):', inviteErr);
        }
      }

      const { password: _pw, ...userWithoutPassword } = user;
      res.status(201).json({ ...userWithoutPassword, passwordSetupEmailSent: shouldSendSetupEmail });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Obtenir un élève par ID
router.get('/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[a-f\d]{24}$/i.test(id)) {
      return res.status(400).json({ error: 'Identifiant élève invalide' });
    }

    const student = await prisma.student.findUnique({
      where: { id },
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
        class: {
          select: {
            id: true,
            name: true,
            level: true,
            academicYear: true,
            trackId: true,
            track: { select: { id: true, name: true, code: true } },
          },
        },
        subjectOptions: {
          include: { option: { select: { id: true, name: true, code: true } } },
        },
        parents: {
          include: {
            parent: {
              include: {
                user: {
                  select: {
                    id: true,
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
        schoolHistory: {
          orderBy: { createdAt: 'desc' },
        },
        transfers: {
          orderBy: { createdAt: 'desc' },
          take: 80,
        },
        _count: {
          select: {
            grades: true,
            absences: true,
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    res.json(student);
  } catch (error: unknown) {
    console.error('GET /admin/students/:id:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Erreur serveur',
    });
  }
});

// Carte étudiant numérique (QR + lien public)
router.get('/students/:id/digital-card', async (req, res) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      select: { id: true, digitalCardPublicId: true },
    });
    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    let publicId = student.digitalCardPublicId;
    if (!publicId) {
      publicId = generateDigitalCardPublicId();
      await prisma.student.update({
        where: { id: student.id },
        data: { digitalCardPublicId: publicId },
      });
    }

    const frontendBase =
      (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim() || 'http://localhost:3000';
    const cardPageUrl = `${frontendBase.replace(/\/+$/, '')}/carte-etudiant/${encodeURIComponent(publicId)}`;
    const qrDataUrl = await QRCode.toDataURL(cardPageUrl, { margin: 1, width: 240, errorCorrectionLevel: 'M' });

    res.json({ publicId, cardPageUrl, qrDataUrl });
  } catch (error: any) {
    console.error('GET /admin/students/:id/digital-card:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Historique scolaire (ligne manuelle)
router.post('/students/:id/school-history', async (req, res) => {
  try {
    const { academicYear, className, classLevel, establishment, notes, classId } = req.body;
    if (!academicYear || typeof academicYear !== 'string') {
      return res.status(400).json({ error: 'Année scolaire requise' });
    }

    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    const row = await prisma.studentSchoolHistory.create({
      data: {
        studentId: student.id,
        academicYear: String(academicYear).trim(),
        className: className != null ? String(className) : undefined,
        classLevel: classLevel != null ? String(classLevel) : undefined,
        establishment: establishment != null ? String(establishment) : undefined,
        notes: notes != null ? String(notes) : undefined,
        classId: typeof classId === 'string' && classId.length > 0 ? classId : undefined,
      },
    });

    res.status(201).json(row);
  } catch (error: any) {
    console.error('POST /admin/students/:id/school-history:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.delete('/students/:studentId/school-history/:historyId', async (req, res) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.studentId },
      select: { id: true },
    });
    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    const row = await prisma.studentSchoolHistory.findFirst({
      where: { id: req.params.historyId, studentId: student.id },
    });
    if (!row) {
      return res.status(404).json({ error: 'Entrée introuvable' });
    }

    await prisma.studentSchoolHistory.delete({ where: { id: row.id } });
    res.json({ message: 'Entrée supprimée' });
  } catch (error: any) {
    console.error('DELETE school-history:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Transfert / mutation / réinscription / départ de classe
router.post('/students/:id/transfer', async (req, res) => {
  try {
    const { effectiveDate, reason, notes, transferType, toClassId } = req.body;
    const typeRaw = typeof transferType === 'string' ? transferType : 'CLASS_CHANGE';
    if (!['CLASS_CHANGE', 'REENROLLMENT', 'MUTATION', 'DEPARTURE'].includes(typeRaw)) {
      return res.status(400).json({ error: 'Type de mouvement invalide' });
    }
    if (!effectiveDate) {
      return res.status(400).json({ error: 'Date effective requise' });
    }

    const eff = new Date(effectiveDate);
    if (Number.isNaN(eff.getTime())) {
      return res.status(400).json({ error: 'Date invalide' });
    }

    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      select: { id: true, classId: true },
    });
    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    const adminUser = (req as { user?: { id?: string } }).user;
    const fromClassId = student.classId;

    if (typeRaw === 'DEPARTURE') {
      await prisma.studentTransfer.create({
        data: {
          studentId: student.id,
          fromClassId,
          toClassId: null,
          effectiveDate: eff,
          transferType: 'DEPARTURE',
          reason: reason != null ? String(reason) : undefined,
          notes: notes != null ? String(notes) : undefined,
          createdById: adminUser?.id,
        },
      });
      const updated = await prisma.student.update({
        where: { id: student.id },
        data: { classId: null },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
          class: true,
        },
      });
      return res.status(201).json({ transfer: true, student: updated });
    }

    if (!toClassId || typeof toClassId !== 'string') {
      return res.status(400).json({ error: 'Classe de destination requise' });
    }

    const targetClass = await prisma.class.findUnique({ where: { id: toClassId } });
    if (!targetClass) {
      return res.status(400).json({ error: 'Classe de destination introuvable' });
    }

    await prisma.studentTransfer.create({
      data: {
        studentId: student.id,
        fromClassId,
        toClassId,
        effectiveDate: eff,
        transferType: typeRaw as 'CLASS_CHANGE' | 'REENROLLMENT' | 'MUTATION' | 'DEPARTURE',
        reason: reason != null ? String(reason) : undefined,
        notes: notes != null ? String(notes) : undefined,
        createdById: adminUser?.id,
      },
    });

    const extra: {
      classId: string;
      enrollmentStatus?: 'ACTIVE';
      lastReenrollmentAt?: Date;
    } = { classId: toClassId };

    if (typeRaw === 'REENROLLMENT') {
      extra.enrollmentStatus = 'ACTIVE';
      extra.lastReenrollmentAt = new Date();
    }

    const updated = await prisma.student.update({
      where: { id: student.id },
      data: extra,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
        class: true,
      },
    });

    res.status(201).json({ transfer: true, student: updated });
  } catch (error: any) {
    console.error('POST /admin/students/:id/transfer:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Archivage dossier (ancien élève)
router.post('/students/:id/archive', async (req, res) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    const updated = await prisma.student.update({
      where: { id: student.id },
      data: {
        enrollmentStatus: 'ARCHIVED',
        isActive: false,
        archivedAt: new Date(),
      },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
        class: true,
      },
    });

    res.json(updated);
  } catch (error: any) {
    console.error('POST /admin/students/:id/archive:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Documents d'identité d'un élève (admin)
router.get('/students/:id/identity-documents', async (req, res) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    const documents = await prisma.identityDocument.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: {
          select: { firstName: true, lastName: true, role: true, email: true },
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
    console.error('GET /admin/students/:id/identity-documents:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.delete('/students/:studentId/identity-documents/:docId', async (req, res) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.studentId },
      select: { id: true },
    });
    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    const doc = await prisma.identityDocument.findFirst({
      where: { id: req.params.docId, studentId: student.id },
    });
    if (!doc) {
      return res.status(404).json({ error: 'Document introuvable' });
    }

    await prisma.identityDocument.delete({ where: { id: doc.id } });
    await deleteStoredUploadUrl(doc.fileUrl);

    res.json({ message: 'Document supprimé' });
  } catch (error: any) {
    console.error('DELETE admin identity-document:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Mettre à jour un élève
router.put('/students/:id', async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const {
      firstName,
      lastName,
      phone,
      address,
      emergencyContact,
      emergencyPhone,
      emergencyContact2,
      emergencyPhone2,
      medicalInfo,
      allergies,
      specialNeeds,
      classId,
      isActive,
      nfcId,
      enrollmentStatus,
      subjectOptionIds,
    } = body;

    const emptyToNull = (v: unknown): string | null | undefined => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      if (typeof v !== 'string') return undefined;
      const t = v.trim();
      return t.length === 0 ? null : t;
    };

    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    if (
      enrollmentStatus !== undefined &&
      typeof enrollmentStatus === 'string' &&
      !['ACTIVE', 'SUSPENDED', 'GRADUATED', 'ARCHIVED'].includes(enrollmentStatus)
    ) {
      return res.status(400).json({ error: 'Statut d\'inscription invalide' });
    }

    // Mettre à jour l'utilisateur
    if (firstName || lastName || phone !== undefined) {
      await prisma.user.update({
        where: { id: student.userId },
        data: {
          ...(typeof firstName === 'string' && firstName.trim() && { firstName: firstName.trim() }),
          ...(typeof lastName === 'string' && lastName.trim() && { lastName: lastName.trim() }),
          ...(phone !== undefined && {
            phone: typeof phone === 'string' && phone.trim() ? phone.trim() : null,
          }),
        },
      });
    }

    const studentData: Prisma.StudentUncheckedUpdateInput = {};

    if (address !== undefined) studentData.address = emptyToNull(address) ?? null;
    if (emergencyContact !== undefined) studentData.emergencyContact = emptyToNull(emergencyContact) ?? null;
    if (emergencyPhone !== undefined) studentData.emergencyPhone = emptyToNull(emergencyPhone) ?? null;
    if (emergencyContact2 !== undefined) studentData.emergencyContact2 = emptyToNull(emergencyContact2) ?? null;
    if (emergencyPhone2 !== undefined) studentData.emergencyPhone2 = emptyToNull(emergencyPhone2) ?? null;
    if (medicalInfo !== undefined) studentData.medicalInfo = emptyToNull(medicalInfo) ?? null;
    if (allergies !== undefined) studentData.allergies = emptyToNull(allergies) ?? null;
    if (specialNeeds !== undefined) studentData.specialNeeds = emptyToNull(specialNeeds) ?? null;

    if (classId !== undefined) {
      studentData.classId =
        typeof classId === 'string' && classId.trim().length > 0 ? classId.trim() : null;
    }
    if (isActive !== undefined) studentData.isActive = Boolean(isActive);
    if (nfcId !== undefined) {
      studentData.nfcId = typeof nfcId === 'string' && nfcId.trim() ? nfcId.trim() : null;
    }
    if (enrollmentStatus !== undefined && typeof enrollmentStatus === 'string') {
      studentData.enrollmentStatus = enrollmentStatus as
        | 'ACTIVE'
        | 'SUSPENDED'
        | 'GRADUATED'
        | 'ARCHIVED';
    }

    const updatedStudent = await prisma.student.update({
      where: { id: req.params.id },
      data: studentData,
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
        class: true,
        schoolHistory: { orderBy: { createdAt: 'desc' } },
        transfers: { orderBy: { createdAt: 'desc' }, take: 80 },
        subjectOptions: {
          include: { option: { select: { id: true, name: true, code: true } } },
        },
      },
    });

    if (Array.isArray(subjectOptionIds)) {
      const academicYear =
        updatedStudent.class?.academicYear ??
        (typeof body.academicYear === 'string' && body.academicYear.trim()
          ? body.academicYear.trim()
          : new Date().getFullYear().toString());
      const ids = subjectOptionIds.map(String).filter(Boolean);
      await prisma.studentSubjectOption.deleteMany({
        where: { studentId: req.params.id, academicYear },
      });
      if (ids.length > 0) {
        await prisma.studentSubjectOption.createMany({
          data: ids.map((optionId) => ({
            studentId: req.params.id,
            optionId,
            academicYear,
          })),
        });
      }
      const withOptions = await prisma.student.findUnique({
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
            },
          },
          class: true,
          schoolHistory: { orderBy: { createdAt: 'desc' } },
          transfers: { orderBy: { createdAt: 'desc' }, take: 80 },
          subjectOptions: {
            include: { option: { select: { id: true, name: true, code: true } } },
          },
        },
      });
      return res.json(withOptions ?? updatedStudent);
    }

    res.json(updatedStudent);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Supprimer un élève
router.delete('/students/:id', async (req, res) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    // Utiliser une transaction pour supprimer toutes les relations dans le bon ordre
    await prisma.$transaction(async (tx) => {
      // 1. Supprimer les relations StudentParent
      await tx.studentParent.deleteMany({
        where: { studentId: req.params.id },
      });

      await tx.studentPickupAuthorization.deleteMany({
        where: { studentId: req.params.id },
      });

      await tx.parentConsent.deleteMany({
        where: { studentId: req.params.id },
      });

      // 2. Supprimer les absences associées
      await tx.absence.deleteMany({
        where: { studentId: req.params.id },
      });

      // 3. Supprimer les notes associées
      await tx.grade.deleteMany({
        where: { studentId: req.params.id },
      });

      // 4. Supprimer les assignments associés
      await tx.studentAssignment.deleteMany({
        where: { studentId: req.params.id },
      });

      await tx.identityDocument.deleteMany({
        where: { studentId: req.params.id },
      });

      await tx.studentSchoolHistory.deleteMany({
        where: { studentId: req.params.id },
      });

      await tx.studentTransfer.deleteMany({
        where: { studentId: req.params.id },
      });

      // 5. Supprimer le profil élève
      await tx.student.delete({
        where: { id: req.params.id },
      });

      // 6. Supprimer l'utilisateur associé
      await tx.user.delete({
        where: { id: student.userId },
      });
    });

    res.json({ message: 'Élève supprimé avec succès' });
  } catch (error: any) {
    console.error('Erreur lors de la suppression de l\'élève:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur lors de la suppression',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ========== GESTION DES CLASSES ==========

// Lister toutes les classes
router.get('/classes', async (req: SchoolContextRequest, res) => {
  try {
    const schoolId = req.schoolId!;
    const classes = await prisma.class.findMany({
      where: classScopeWhere(schoolId),
      include: {
        track: {
          select: { id: true, name: true, code: true, academicYear: true },
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
        students: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: {
          select: {
            students: true,
          },
        },
      },
    });

    res.json(classes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Créer une classe
router.post(
  '/classes',
  [
    body('name').notEmpty(),
    body('level').notEmpty(),
    body('academicYear').notEmpty(),
  ],
  async (req: SchoolContextRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, level, room, capacity, academicYear, teacherId, trackId } = req.body;
      const schoolId = req.schoolId!;

      const newClass = await prisma.class.create({
        data: {
          name,
          level,
          room,
          capacity: capacity || 30,
          academicYear,
          schoolId,
          teacherId,
          trackId: typeof trackId === 'string' && trackId.trim() ? trackId.trim() : undefined,
        },
        include: {
          track: {
            select: { id: true, name: true, code: true, academicYear: true },
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
      });

      res.status(201).json(newClass);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.patch('/classes/:id', async (req, res) => {
  try {
    const existing = await prisma.class.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Classe introuvable' });
    }
    const b = req.body as Record<string, unknown>;
    const data: Prisma.ClassUncheckedUpdateInput = {};
    if (typeof b.name === 'string' && b.name.trim()) data.name = b.name.trim();
    if (typeof b.level === 'string' && b.level.trim()) data.level = b.level.trim();
    if (b.room !== undefined) data.room = typeof b.room === 'string' ? b.room.trim() || null : null;
    if (b.capacity !== undefined) data.capacity = Number(b.capacity) || 30;
    if (typeof b.academicYear === 'string' && b.academicYear.trim()) {
      data.academicYear = b.academicYear.trim();
    }
    if (b.teacherId !== undefined) {
      data.teacherId = typeof b.teacherId === 'string' && b.teacherId.trim() ? b.teacherId.trim() : null;
    }
    if (b.trackId !== undefined) {
      data.trackId = typeof b.trackId === 'string' && b.trackId.trim() ? b.trackId.trim() : null;
    }
    const updated = await prisma.class.update({
      where: { id: req.params.id },
      data,
      include: {
        track: { select: { id: true, name: true, code: true, academicYear: true } },
        teacher: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    res.json(updated);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

// ========== GESTION DES ENSEIGNANTS ==========

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

// ========== GESTION DES ÉDUCATEURS ==========

// Rechercher un éducateur par NFC ID
router.get('/educators/nfc/:nfcId', async (req, res) => {
  try {
    const { nfcId } = req.params;

    const educator = await prisma.educator.findFirst({
      where: { nfcId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!educator) {
      return res.status(404).json({ error: 'Éducateur non trouvé' });
    }

    res.json(educator);
  } catch (error: any) {
    console.error('Error finding educator by NFC:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Lister tous les éducateurs
router.get('/educators', async (req, res) => {
  try {
    const educators = await prisma.educator.findMany({
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
      },
    });

    res.json(educators);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Créer un éducateur
router.post(
  '/educators',
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
        salary,
      } = req.body;

      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return res.status(400).json({ error: 'Cet email est déjà utilisé' });
      }

      const existingEmployee = await prisma.educator.findUnique({
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
          role: 'EDUCATOR',
          educatorProfile: {
            create: {
              employeeId,
              specialization,
              hireDate: new Date(hireDate),
              contractType: contractType || 'CDI',
              salary,
            },
          },
        },
        include: {
          educatorProfile: true,
        },
      });

      if (shouldSendSetupEmail) {
        try {
          await inviteNewUserToSetPassword(user.id, user.email, user.firstName);
        } catch (inviteErr) {
          console.error('Invitation mot de passe (éducateur):', inviteErr);
        }
      }

      const { password: _pw, ...userWithoutPassword } = user;
      res.status(201).json({ ...userWithoutPassword, passwordSetupEmailSent: shouldSendSetupEmail });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Obtenir un éducateur par ID
router.get('/educators/:id', async (req, res) => {
  try {
    const educator = await prisma.educator.findUnique({
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
        // La relation est portée par User (evaluatedConducts), pas directement par Educator.
      },
    });

    if (!educator) {
      return res.status(404).json({ error: 'Éducateur non trouvé' });
    }

    res.json(educator);
  } catch (error: any) {
    console.error('Erreur dans /admin/educators/:id:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Mettre à jour un éducateur
router.put('/educators/:id', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      specialization,
      contractType,
      salary,
      isActive,
      nfcId,
    } = req.body;

    const educator = await prisma.educator.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!educator) {
      return res.status(404).json({ error: 'Éducateur non trouvé' });
    }

    // Mettre à jour l'utilisateur
    await prisma.user.update({
      where: { id: educator.userId },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    // Mettre à jour le profil éducateur
    const updatedEducator = await prisma.educator.update({
      where: { id: req.params.id },
      data: {
        ...(specialization !== undefined && { specialization }),
        ...(contractType !== undefined && { contractType }),
        ...(salary !== undefined && { salary }),
        ...(nfcId !== undefined && { nfcId: nfcId || null }),
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
            isActive: true,
          },
        },
        // La relation est portée par User (evaluatedConducts), pas directement par Educator.
      },
    });

    res.json(updatedEducator);
  } catch (error: any) {
    console.error('Erreur dans /admin/educators/:id PUT:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Supprimer un éducateur
router.delete('/educators/:id', async (req, res) => {
  try {
    const educator = await prisma.educator.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });

    if (!educator) {
      return res.status(404).json({ error: 'Éducateur non trouvé' });
    }

    // Utiliser une transaction pour supprimer toutes les relations dans le bon ordre
    await prisma.$transaction(async (tx) => {
      // 1. Supprimer les évaluations de conduite créées par cet éducateur
      // Note: On ne supprime pas les évaluations, on les garde pour l'historique
      // Mais on pourrait mettre à jour evaluatedByRole si nécessaire

      // 2. Supprimer le profil éducateur
      await tx.educator.delete({
        where: { id: req.params.id },
      });

      // 3. Supprimer l'utilisateur associé
      await tx.user.delete({
        where: { id: educator.userId },
      });
    });

    res.json({ message: 'Éducateur supprimé avec succès' });
  } catch (error: any) {
    console.error('Erreur lors de la suppression de l\'éducateur:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur lors de la suppression',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ========== GESTION ACADÉMIQUE ==========

// Obtenir toutes les notes
router.get('/grades', async (req, res) => {
  try {
    const { studentId, courseId, classId } = req.query;

    const grades = await prisma.grade.findMany({
      where: {
        AND: [
          gradeWhereRelationsExist,
          ...(studentId ? [{ studentId: studentId as string }] : []),
          ...(courseId ? [{ courseId: courseId as string }] : []),
          ...(classId ? [{ student: { classId: classId as string } }] : []),
        ],
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
        course: {
          select: {
            name: true,
            code: true,
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

    res.json(grades);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir toutes les absences
router.get('/absences', async (req, res) => {
  try {
    const { studentId, courseId, classId, date } = req.query;

    const absences = await prisma.absence.findMany({
      where: {
        AND: [
          absenceWhereRelationsExist,
          ...(studentId ? [{ studentId: studentId as string }] : []),
          ...(courseId ? [{ courseId: courseId as string }] : []),
          ...(classId ? [{ student: { classId: classId as string } }] : []),
          ...(date
            ? [
                {
                  date: {
                    gte: new Date(date as string),
                    lt: new Date(
                      new Date(date as string).setDate(new Date(date as string).getDate() + 1),
                    ),
                  },
                },
              ]
            : []),
        ],
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
        course: {
          select: {
            name: true,
            code: true,
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

    res.json(absences);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Statistiques d’assiduité (agrégats sur une période)
router.get('/absences/stats', async (req, res) => {
  try {
    const { classId, from, to } = req.query as { classId?: string; from?: string; to?: string };
    const where: Record<string, unknown> = {};
    if (classId) {
      where.student = { classId };
    }
    if (from || to) {
      const d: { gte?: Date; lte?: Date } = {};
      if (from) d.gte = new Date(from);
      if (to) {
        const t = new Date(to);
        t.setHours(23, 59, 59, 999);
        d.lte = t;
      }
      where.date = d;
    }

    const rows = await prisma.absence.findMany({
      where,
      select: {
        status: true,
        excused: true,
        minutesLate: true,
        hasMedicalCertificate: true,
        sanctionNote: true,
        studentId: true,
      },
    });

    let present = 0;
    let absentUnexcused = 0;
    let late = 0;
    let excusedAbsent = 0;
    let medicalCerts = 0;
    let withSanction = 0;
    let lateMinutesSum = 0;
    let lateMinutesCount = 0;
    const lateByStudent = new Map<string, number>();

    for (const r of rows) {
      if (r.status === 'PRESENT') present++;
      else if (r.status === 'LATE') {
        late++;
        if (r.minutesLate != null && r.minutesLate > 0) {
          lateMinutesSum += r.minutesLate;
          lateMinutesCount++;
          lateByStudent.set(r.studentId, (lateByStudent.get(r.studentId) || 0) + 1);
        }
      } else if (r.status === 'ABSENT') {
        if (r.excused) excusedAbsent++;
        else absentUnexcused++;
      } else if (r.status === 'EXCUSED') {
        excusedAbsent++;
      }
      if (r.hasMedicalCertificate) medicalCerts++;
      if (r.sanctionNote && String(r.sanctionNote).trim()) withSanction++;
    }

    const topLateStudents = [...lateByStudent.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([studentId, count]) => ({ studentId, lateSessions: count }));

    const total = rows.length;
    const punctualityRate =
      total > 0 ? Math.round(((present + late) / total) * 1000) / 10 : 0;

    res.json({
      total,
      present,
      absentUnexcused,
      late,
      excusedAbsent,
      medicalCertificates: medicalCerts,
      sanctionsRecorded: withSanction,
      avgLateMinutes:
        lateMinutesCount > 0 ? Math.round((lateMinutesSum / lateMinutesCount) * 10) / 10 : null,
      punctualityRate,
      topLateStudents,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.post('/absences/:id/notify-parents', async (req, res) => {
  try {
    const result = await notifyParentsForAbsenceById(req.params.id);
    if (!result.notified) {
      return res.status(404).json({ error: 'Absence ou cours introuvable' });
    }
    res.json({ ok: true, message: 'Notification envoyée aux parents' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Obtenir tous les devoirs
router.get('/assignments', async (req, res) => {
  try {
    const { courseId, classId } = req.query;

    const assignments = await prisma.assignment.findMany({
      where: {
        AND: [
          assignmentWhereRelationsExist,
          ...(courseId ? [{ courseId: courseId as string }] : []),
          ...(classId ? [{ course: { classId: classId as string } }] : []),
        ],
      },
      include: {
        course: {
          select: {
            name: true,
            code: true,
            class: {
              select: {
                name: true,
                level: true,
              },
            },
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
        students: {
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
        },
      },
      orderBy: {
        dueDate: 'desc',
      },
    });

    res.json(assignments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir tous les cours (optionnel: ?classId=)
router.get('/courses', async (req, res) => {
  try {
    const { classId } = req.query;
    const courses = await prisma.course.findMany({
      where: {
        ...(classId ? { classId: classId as string } : {}),
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            level: true,
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
    });

    res.json(courses);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir un cours avec les élèves (pour le pointage admin)
router.get('/courses/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        class: {
          include: {
            students: {
              where: { isActive: true },
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
        teacher: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    });
    if (!course) return res.status(404).json({ error: 'Cours non trouvé' });
    res.json(course);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Créer une matière / cours rattaché à une classe
router.post(
  '/courses',
  [
    body('name').notEmpty().withMessage('Nom requis'),
    body('code').notEmpty().withMessage('Code requis'),
    body('classId').notEmpty().withMessage('classId requis'),
    body('teacherId').notEmpty().withMessage('teacherId requis'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { name, code, description, classId, teacherId, weeklyHours } = req.body;

      const [cls, teacher, codeTaken] = await Promise.all([
        prisma.class.findUnique({ where: { id: classId } }),
        prisma.teacher.findUnique({ where: { id: teacherId } }),
        prisma.course.findUnique({ where: { code: String(code).trim() } }),
      ]);
      if (!cls) return res.status(400).json({ error: 'Classe introuvable' });
      if (!teacher) return res.status(400).json({ error: 'Enseignant introuvable' });
      if (codeTaken) return res.status(400).json({ error: 'Ce code matière existe déjà' });

      const course = await prisma.course.create({
        data: {
          name: String(name).trim(),
          code: String(code).trim(),
          description: description != null ? String(description) : undefined,
          weeklyHours:
            weeklyHours !== undefined && weeklyHours !== null && weeklyHours !== ''
              ? Number(weeklyHours)
              : undefined,
          classId,
          teacherId,
        },
        include: {
          class: { select: { id: true, name: true, level: true } },
          teacher: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      });
      res.status(201).json(course);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Mettre à jour une matière / cours
router.put(
  '/courses/:courseId',
  [
    body('name').optional().notEmpty(),
    body('code').optional().notEmpty(),
    body('classId').optional().notEmpty(),
    body('teacherId').optional().notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { courseId } = req.params;
      const { name, code, description, classId, teacherId, weeklyHours } = req.body;

      const existing = await prisma.course.findUnique({ where: { id: courseId } });
      if (!existing) return res.status(404).json({ error: 'Cours non trouvé' });

      if (code && String(code).trim() !== existing.code) {
        const taken = await prisma.course.findUnique({ where: { code: String(code).trim() } });
        if (taken) return res.status(400).json({ error: 'Ce code matière existe déjà' });
      }
      if (classId) {
        const cls = await prisma.class.findUnique({ where: { id: classId } });
        if (!cls) return res.status(400).json({ error: 'Classe introuvable' });
      }
      if (teacherId) {
        const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
        if (!teacher) return res.status(400).json({ error: 'Enseignant introuvable' });
      }

      const course = await prisma.course.update({
        where: { id: courseId },
        data: {
          ...(name != null && { name: String(name).trim() }),
          ...(code != null && { code: String(code).trim() }),
          ...(description !== undefined && {
            description: description === null || description === '' ? null : String(description),
          }),
          ...(classId != null && { classId }),
          ...(teacherId != null && { teacherId }),
          ...(weeklyHours !== undefined && {
            weeklyHours:
              weeklyHours === null || weeklyHours === ''
                ? null
                : Number(weeklyHours),
          }),
        },
        include: {
          class: { select: { id: true, name: true, level: true } },
          teacher: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      });
      res.json(course);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Supprimer une matière / cours (et données liées)
router.delete('/courses/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params;
    const existing = await prisma.course.findUnique({ where: { id: courseId } });
    if (!existing) return res.status(404).json({ error: 'Cours non trouvé' });

    await prisma.schedule.deleteMany({ where: { courseId } });
    const assignments = await prisma.assignment.findMany({
      where: { courseId },
      select: { id: true },
    });
    const assignmentIds = assignments.map((a) => a.id);
    if (assignmentIds.length > 0) {
      await prisma.studentAssignment.deleteMany({
        where: { assignmentId: { in: assignmentIds } },
      });
    }
    await prisma.assignment.deleteMany({ where: { courseId } });
    await prisma.absence.deleteMany({ where: { courseId } });
    await prisma.grade.deleteMany({ where: { courseId } });
    await prisma.course.delete({ where: { id: courseId } });

    res.json({ ok: true, message: 'Cours supprimé' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CALENDRIER SCOLAIRE ==========

router.get('/school-calendar-events', async (req, res) => {
  try {
    const { academicYear } = req.query;
    const events = await prisma.schoolCalendarEvent.findMany({
      where: academicYear ? { academicYear: academicYear as string } : {},
      orderBy: { startDate: 'asc' },
    });
    res.json(events);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post(
  '/school-calendar-events',
  [
    body('title').notEmpty(),
    body('startDate').isISO8601(),
    body('endDate').isISO8601(),
    body('academicYear').notEmpty(),
    body('type').optional().isIn(['HOLIDAY', 'VACATION', 'EXAM_PERIOD', 'MEETING', 'OTHER']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { title, description, type, startDate, endDate, academicYear, allDay } = req.body;
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end < start) {
        return res.status(400).json({ error: 'La date de fin doit être après la date de début' });
      }
      const event = await prisma.schoolCalendarEvent.create({
        data: {
          title: String(title).trim(),
          description:
            description != null && description !== '' ? String(description) : undefined,
          type: type || 'OTHER',
          startDate: start,
          endDate: end,
          academicYear: String(academicYear).trim(),
          allDay: allDay !== false,
        },
      });
      res.status(201).json(event);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.put(
  '/school-calendar-events/:id',
  [
    body('title').optional().notEmpty(),
    body('startDate').optional().isISO8601(),
    body('endDate').optional().isISO8601(),
    body('type').optional().isIn(['HOLIDAY', 'VACATION', 'EXAM_PERIOD', 'MEETING', 'OTHER']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { id } = req.params;
      const { title, description, type, startDate, endDate, academicYear, allDay } = req.body;

      const existing = await prisma.schoolCalendarEvent.findUnique({ where: { id } });
      if (!existing) return res.status(404).json({ error: 'Événement introuvable' });

      const nextStart = startDate ? new Date(startDate) : existing.startDate;
      const nextEnd = endDate ? new Date(endDate) : existing.endDate;
      if (nextEnd < nextStart) {
        return res.status(400).json({ error: 'La date de fin doit être après la date de début' });
      }

      const event = await prisma.schoolCalendarEvent.update({
        where: { id },
        data: {
          ...(title != null && { title: String(title).trim() }),
          ...(description !== undefined && {
            description: description === null || description === '' ? null : String(description),
          }),
          ...(type != null && { type }),
          ...(startDate != null && { startDate: nextStart }),
          ...(endDate != null && { endDate: nextEnd }),
          ...(academicYear != null && { academicYear: String(academicYear).trim() }),
          ...(allDay !== undefined && { allDay: Boolean(allDay) }),
        },
      });
      res.json(event);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.delete('/school-calendar-events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.schoolCalendarEvent.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Événement introuvable' });
    }
    res.status(500).json({ error: error.message });
  }
});

// ========== GALERIE PHOTOS (fil portail) ==========

router.get('/school-gallery-items', async (_req, res) => {
  try {
    const items = await prisma.schoolGalleryItem.findMany({
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    });
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/school-gallery-items', async (req, res) => {
  try {
    const { title, caption, imageUrl, sortOrder, published } = req.body;
    if (!imageUrl || !String(imageUrl).trim()) {
      return res.status(400).json({ error: 'imageUrl est requis' });
    }
    const pub = Boolean(published);
    const item = await prisma.schoolGalleryItem.create({
      data: {
        title: title != null && String(title).trim() ? String(title).trim() : null,
        caption: caption != null && String(caption).trim() ? String(caption).trim() : null,
        imageUrl: String(imageUrl).trim(),
        sortOrder: Number.isFinite(Number(sortOrder)) ? Math.trunc(Number(sortOrder)) : 0,
        published: pub,
        publishedAt: pub ? new Date() : null,
      },
    });
    res.status(201).json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/school-gallery-items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, caption, imageUrl, sortOrder, published } = req.body;
    const existing = await prisma.schoolGalleryItem.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Élément introuvable' });

    const pub = published !== undefined ? Boolean(published) : existing.published;
    const item = await prisma.schoolGalleryItem.update({
      where: { id },
      data: {
        ...(title !== undefined && {
          title: title != null && String(title).trim() ? String(title).trim() : null,
        }),
        ...(caption !== undefined && {
          caption: caption != null && String(caption).trim() ? String(caption).trim() : null,
        }),
        ...(imageUrl !== undefined && { imageUrl: String(imageUrl).trim() }),
        ...(sortOrder !== undefined && {
          sortOrder: Number.isFinite(Number(sortOrder)) ? Math.trunc(Number(sortOrder)) : existing.sortOrder,
        }),
        ...(published !== undefined && {
          published: pub,
          publishedAt: pub && !existing.published ? new Date() : !pub ? null : existing.publishedAt,
        }),
      },
    });
    res.json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/school-gallery-items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.schoolGalleryItem.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ error: 'Élément introuvable' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Pointage des élèves (admin) : enregistrer les présences pour un cours/date
router.post(
  '/absences/take-attendance',
  [
    body('courseId').notEmpty(),
    body('date').isISO8601(),
    body('attendance').isArray(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { courseId, date, attendance, notifyParentsOnSave = true, attendanceSource = 'MANUAL' } =
        req.body;

      const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true, teacherId: true, name: true, code: true },
      });
      if (!course) return res.status(404).json({ error: 'Cours non trouvé' });

      const attendanceDate = new Date(date);
      const startOfDay = new Date(attendanceDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(startOfDay);
      endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

      await prisma.absence.deleteMany({
        where: {
          courseId,
          date: { gte: startOfDay, lt: endOfDay },
        },
      });

      const absences = await Promise.all(
        attendance.map((att: any) => {
          const status = att.status || 'ABSENT';
          const minutesLate =
            status === 'LATE' && att.minutesLate != null && att.minutesLate !== ''
              ? Math.max(0, Math.min(480, Number(att.minutesLate)))
              : null;
          return prisma.absence.create({
            data: {
              studentId: att.studentId,
              courseId,
              teacherId: course.teacherId,
              date: attendanceDate,
              status,
              reason: att.reason ?? undefined,
              excused: att.excused || false,
              justificationDocuments: Array.isArray(att.justificationDocuments)
                ? att.justificationDocuments
                : [],
              hasMedicalCertificate: !!att.hasMedicalCertificate,
              sanctionNote: att.sanctionNote ? String(att.sanctionNote).trim() : undefined,
              minutesLate: minutesLate ?? undefined,
              attendanceSource: att.attendanceSource || attendanceSource || 'MANUAL',
            },
          });
        })
      );

      if (notifyParentsOnSave !== false) {
        await Promise.allSettled(
          absences.map(async (a) => {
            if (!shouldNotifyParentsOnAttendanceChange(a.status, a.excused)) return;
            await notifyParentsOfAttendanceChange({
              studentId: a.studentId,
              status: a.status,
              date: a.date,
              courseName: course.name,
              courseCode: course.code,
              minutesLate: a.minutesLate,
            });
            await prisma.absence.update({
              where: { id: a.id },
              data: { parentNotifiedAt: new Date() },
            });
          })
        );
      }

      res.status(201).json(absences);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Créer une note (Admin)
router.post(
  '/grades',
  [
    body('studentId').notEmpty(),
    body('courseId').notEmpty(),
    body('teacherId').notEmpty(),
    body('evaluationType').isIn([...EVALUATION_TYPE_VALUES]),
    body('title').notEmpty(),
    body('score').isFloat({ min: 0 }),
    body('maxScore').isFloat({ min: 0 }),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        studentId,
        courseId,
        teacherId,
        evaluationType,
        title,
        score,
        maxScore,
        coefficient,
        date,
        comments,
      } = req.body;

      const request = await createGradeChangeRequest({
        kind: 'CREATE',
        requestedByUserId: req.user!.id,
        studentId,
        payload: {
          studentId,
          courseId,
          teacherId,
          evaluationType,
          title,
          score: parseFloat(score),
          maxScore: parseFloat(maxScore) || 20,
          coefficient: parseFloat(coefficient) || 1,
          date: date ? new Date(date) : new Date(),
          comments: comments ?? null,
        },
      });

      res.status(202).json({
        message:
          'Demande enregistrée. Validation requise : professeur principal, éducateur, directeur des études.',
        request: {
          ...request,
          statusLabel: workflowStatusLabel(request.status),
        },
      });
    } catch (error: any) {
      const statusCode = error.statusCode ?? 500;
      console.error('Erreur lors de la création de la note:', error);
      res.status(statusCode).json({ 
        error: error.message || 'Erreur serveur',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

// Mettre à jour une note (Admin)
router.put('/grades/:id', async (req: AuthRequest, res) => {
  try {
    const { title, score, maxScore, coefficient, comments, date, evaluationType } = req.body;

    const grade = await prisma.grade.findUnique({
      where: { id: req.params.id },
    });

    if (!grade) {
      return res.status(404).json({ error: 'Note non trouvée' });
    }

    const request = await createGradeChangeRequest({
      kind: 'UPDATE',
      requestedByUserId: req.user!.id,
      gradeId: grade.id,
      studentId: grade.studentId,
      previousPayload: gradeToPayload(grade),
      payload: {
        studentId: grade.studentId,
        courseId: grade.courseId,
        teacherId: grade.teacherId,
        evaluationType: evaluationType ?? grade.evaluationType,
        title: title ?? grade.title,
        score: score !== undefined ? parseFloat(score) : grade.score,
        maxScore: maxScore !== undefined ? parseFloat(maxScore) : grade.maxScore,
        coefficient: coefficient !== undefined ? parseFloat(coefficient) : grade.coefficient,
        date: date ? new Date(date) : grade.date,
        comments: comments !== undefined ? comments : grade.comments,
      },
    });

    res.status(202).json({
      message:
        'Demande de modification enregistrée. Validation en 3 étapes requise avant prise en compte.',
      request: {
        ...request,
        statusLabel: workflowStatusLabel(request.status),
      },
    });
  } catch (error: any) {
    const statusCode = error.statusCode ?? 500;
    console.error('Erreur lors de la mise à jour de la note:', error);
    res.status(statusCode).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Supprimer une note (Admin)
router.delete('/grades/:id', async (req: AuthRequest, res) => {
  try {
    const grade = await prisma.grade.findUnique({
      where: { id: req.params.id },
    });

    if (!grade) {
      return res.status(404).json({ error: 'Note non trouvée' });
    }

    const request = await createGradeChangeRequest({
      kind: 'DELETE',
      requestedByUserId: req.user!.id,
      gradeId: grade.id,
      studentId: grade.studentId,
      previousPayload: gradeToPayload(grade),
      payload: gradeToPayload(grade),
    });

    res.status(202).json({
      message:
        'Demande de suppression enregistrée. Validation en 3 étapes requise avant prise en compte.',
      request: {
        ...request,
        statusLabel: workflowStatusLabel(request.status),
      },
    });
  } catch (error: any) {
    const statusCode = error.statusCode ?? 500;
    console.error('Erreur lors de la suppression de la note:', error);
    res.status(statusCode).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Initialiser le pointage (admin) : tous les élèves du cours marqués absents
router.post(
  '/absences/init-attendance',
  [
    body('courseId').notEmpty(),
    body('date').isISO8601(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { courseId, date } = req.body;

      const course = await prisma.course.findFirst({
        where: { id: courseId },
        include: {
          class: {
            include: {
              students: {
                where: { isActive: true },
              },
            },
          },
        },
      });
      if (!course) return res.status(404).json({ error: 'Cours non trouvé' });

      const students = course.class?.students || [];
      const attendanceDate = new Date(date);
      const startOfDay = new Date(attendanceDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(startOfDay);
      endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

      await prisma.absence.deleteMany({
        where: {
          courseId,
          date: { gte: startOfDay, lt: endOfDay },
        },
      });

      const absences = await Promise.all(
        students.map((s: any) =>
          prisma.absence.create({
            data: {
              studentId: s.id,
              courseId,
              teacherId: course.teacherId,
              date: attendanceDate,
              status: 'ABSENT',
              excused: false,
              justificationDocuments: [],
              attendanceSource: 'MANUAL',
            },
          })
        )
      );

      res.status(201).json({
        message: `Pointage initialisé: ${absences.length} élèves marqués absents`,
        total: absences.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Enregistrer la présence d'un élève via scan NFC (admin)
router.post(
  '/absences/nfc-attendance',
  [
    body('courseId').notEmpty(),
    body('studentId').notEmpty(),
    body('date').isISO8601(),
    body('status').optional().isIn(['PRESENT', 'ABSENT', 'LATE']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const {
        courseId,
        studentId,
        date,
        status = 'PRESENT',
        minutesLate,
        attendanceSource = 'NFC',
        notifyParentsOnSave = true,
      } = req.body;

      const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true, teacherId: true, name: true, code: true },
      });
      if (!course) return res.status(404).json({ error: 'Cours non trouvé' });

      const attendanceDate = new Date(date);
      const resolvedStatus = (status || 'PRESENT') as 'PRESENT' | 'ABSENT' | 'LATE';
      const lateMins =
        resolvedStatus === 'LATE' && minutesLate != null && minutesLate !== ''
          ? Math.max(0, Math.min(480, Number(minutesLate)))
          : null;

      const sourceNorm =
        attendanceSource === 'FACE'
          ? 'FACE'
          : attendanceSource === 'BIOMETRIC'
            ? 'BIOMETRIC'
            : attendanceSource === 'MANUAL'
              ? 'MANUAL'
              : 'NFC';

      const punch = await punchStudentCourseAttendance({
        studentId,
        courseId,
        teacherId: course.teacherId,
        at: attendanceDate,
        source: sourceNorm,
        forceStatus: resolvedStatus,
        minutesLate: lateMins,
        notifyParents: notifyParentsOnSave !== false,
      });

      const absence = await prisma.absence.findUnique({
        where: { id: punch.absence.id },
        include: {
          student: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      });

      res.status(201).json({
        ...absence,
        punchPhase: punch.punchPhase,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Créer une absence (Admin)
router.post(
  '/absences',
  [
    body('studentId').notEmpty(),
    body('courseId').notEmpty(),
    body('teacherId').notEmpty(),
    body('date').isISO8601(),
    body('status').isIn(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        studentId,
        courseId,
        teacherId,
        date,
        status,
        excused,
        reason,
        justificationDocuments,
        hasMedicalCertificate,
        minutesLate,
        sanctionNote,
        attendanceSource,
        notifyParents: notifyParentsBody = true,
      } = req.body;

      const lateMins =
        status === 'LATE' && minutesLate != null && minutesLate !== ''
          ? Math.max(0, Math.min(480, Number(minutesLate)))
          : undefined;

      const absence = await prisma.absence.create({
        data: {
          studentId,
          courseId,
          teacherId,
          date: new Date(date),
          status,
          excused: excused || false,
          reason,
          justificationDocuments: Array.isArray(justificationDocuments) ? justificationDocuments : [],
          hasMedicalCertificate: !!hasMedicalCertificate,
          minutesLate: lateMins,
          sanctionNote: sanctionNote ? String(sanctionNote).trim() : undefined,
          attendanceSource: attendanceSource ? String(attendanceSource) : 'MANUAL',
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
          course: {
            select: {
              name: true,
              code: true,
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
      });

      if (
        notifyParentsBody !== false &&
        shouldNotifyParentsOnAttendanceChange(absence.status, absence.excused)
      ) {
        const c = await prisma.course.findUnique({
          where: { id: courseId },
          select: { name: true, code: true },
        });
        if (c) {
          void notifyParentsOfAttendanceChange({
            studentId: absence.studentId,
            status: absence.status,
            date: absence.date,
            courseName: c.name,
            courseCode: c.code,
            minutesLate: absence.minutesLate,
          }).then(() =>
            prisma.absence.update({
              where: { id: absence.id },
              data: { parentNotifiedAt: new Date() },
            })
          );
        }
      }

      res.status(201).json(absence);
    } catch (error: any) {
      console.error('Erreur lors de la création de l\'absence:', error);
      res.status(500).json({ 
        error: error.message || 'Erreur serveur',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

// Mettre à jour une absence (Admin)
router.put('/absences/:id', async (req, res) => {
  try {
    const {
      status,
      excused,
      reason,
      date,
      justificationDocuments,
      justificationSubmittedAt,
      hasMedicalCertificate,
      minutesLate,
      sanctionNote,
      attendanceSource,
      notifyParents,
    } = req.body;

    const absence = await prisma.absence.findUnique({
      where: { id: req.params.id },
    });

    if (!absence) {
      return res.status(404).json({ error: 'Absence non trouvée' });
    }

    const lateMins =
      minutesLate !== undefined
        ? minutesLate === null || minutesLate === ''
          ? null
          : Math.max(0, Math.min(480, Number(minutesLate)))
        : undefined;

    const updatedAbsence = await prisma.absence.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status }),
        ...(status && status !== 'LATE' ? { minutesLate: null } : {}),
        ...(excused !== undefined && { excused }),
        ...(reason !== undefined && { reason }),
        ...(date && { date: new Date(date) }),
        ...(justificationDocuments !== undefined && {
          justificationDocuments: Array.isArray(justificationDocuments) ? justificationDocuments : [],
        }),
        ...(justificationSubmittedAt !== undefined && {
          justificationSubmittedAt: justificationSubmittedAt
            ? new Date(justificationSubmittedAt)
            : null,
        }),
        ...(hasMedicalCertificate !== undefined && { hasMedicalCertificate: !!hasMedicalCertificate }),
        ...(lateMins !== undefined && { minutesLate: lateMins }),
        ...(sanctionNote !== undefined && {
          sanctionNote: sanctionNote == null || sanctionNote === '' ? null : String(sanctionNote).trim(),
        }),
        ...(attendanceSource !== undefined && {
          attendanceSource: attendanceSource ? String(attendanceSource) : null,
        }),
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
        course: {
          select: {
            name: true,
            code: true,
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
    });

    if (notifyParents === true) {
      try {
        await notifyParentsForAbsenceById(updatedAbsence.id);
      } catch (e) {
        console.error('notifyParentsForAbsenceById:', e);
      }
    }

    res.json(updatedAbsence);
  } catch (error: any) {
    console.error('Erreur lors de la mise à jour de l\'absence:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Supprimer une absence (Admin)
router.delete('/absences/:id', async (req, res) => {
  try {
    const absence = await prisma.absence.findUnique({
      where: { id: req.params.id },
    });

    if (!absence) {
      return res.status(404).json({ error: 'Absence non trouvée' });
    }

    await prisma.absence.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Absence supprimée avec succès' });
  } catch (error: any) {
    console.error('Erreur lors de la suppression de l\'absence:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Créer un devoir (Admin)
router.post(
  '/assignments',
  [
    body('courseId').notEmpty(),
    body('teacherId').notEmpty(),
    body('title').notEmpty(),
    body('dueDate').isISO8601(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        courseId,
        teacherId,
        title,
        description,
        dueDate,
        attachments,
      } = req.body;

      const assignment = await prisma.assignment.create({
        data: {
          courseId,
          teacherId,
          title,
          description: description || null,
          dueDate: new Date(dueDate),
          attachments: attachments || [],
        },
        include: {
          course: {
            select: {
              name: true,
              code: true,
              class: {
                select: {
                  name: true,
                  level: true,
                },
              },
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
      });

      const courseWithClass = await prisma.course.findUnique({
        where: { id: courseId },
        select: {
          name: true,
          class: { select: { students: { select: { id: true } } } },
        },
      });
      const studentIds = courseWithClass?.class?.students.map((s) => s.id) ?? [];
      if (studentIds.length > 0) {
        void notifyParentsNewAssignment({
          studentIds,
          title,
          courseName: courseWithClass?.name ?? 'cours',
          dueDate: new Date(dueDate),
        }).catch((err) => console.error('notifyParentsNewAssignment:', err));
      }

      res.status(201).json(assignment);
    } catch (error: any) {
      console.error('Erreur lors de la création du devoir:', error);
      res.status(500).json({ 
        error: error.message || 'Erreur serveur',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

// Mettre à jour un devoir (Admin)
router.put('/assignments/:id', async (req, res) => {
  try {
    const { title, description, dueDate, maxScore } = req.body;

    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Devoir non trouvé' });
    }

    const updatedAssignment = await prisma.assignment.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(dueDate && { dueDate: new Date(dueDate) }),
        ...(maxScore !== undefined && { maxScore: maxScore ? parseFloat(maxScore) : null }),
      },
      include: {
        course: {
          select: {
            name: true,
            code: true,
            class: {
              select: {
                name: true,
                level: true,
              },
            },
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
    });

    res.json(updatedAssignment);
  } catch (error: any) {
    console.error('Erreur lors de la mise à jour du devoir:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Supprimer un devoir (Admin)
router.delete('/assignments/:id', async (req, res) => {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Devoir non trouvé' });
    }

    // Utiliser une transaction pour supprimer toutes les relations dans le bon ordre
    await prisma.$transaction(async (tx) => {
      // 1. Supprimer tous les StudentAssignment liés
      await tx.studentAssignment.deleteMany({
        where: { assignmentId: req.params.id },
      });

      // 2. Supprimer l'Assignment
      await tx.assignment.delete({
        where: { id: req.params.id },
      });
    });

    res.json({ message: 'Devoir supprimé avec succès' });
  } catch (error: any) {
    console.error('Erreur lors de la suppression du devoir:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Obtenir une note par ID (Admin)
router.get('/grades/:id', async (req, res) => {
  try {
    const grade = await prisma.grade.findUnique({
      where: { id: req.params.id },
      include: {
        student: {
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
        },
        course: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        teacher: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!grade) {
      return res.status(404).json({ error: 'Note non trouvée' });
    }

    res.json(grade);
  } catch (error: any) {
    console.error('Erreur dans /admin/grades/:id:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Obtenir une absence par ID (Admin)
router.get('/absences/:id', async (req, res) => {
  try {
    const absence = await prisma.absence.findUnique({
      where: { id: req.params.id },
      include: {
        student: {
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
        },
        course: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        teacher: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!absence) {
      return res.status(404).json({ error: 'Absence non trouvée' });
    }

    res.json(absence);
  } catch (error: any) {
    console.error('Erreur dans /admin/absences/:id:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Obtenir un devoir par ID (Admin)
router.get('/assignments/:id', async (req, res) => {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      include: {
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            class: {
              select: {
                id: true,
                name: true,
                level: true,
              },
            },
          },
        },
        teacher: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        students: {
          include: {
            student: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Devoir non trouvé' });
    }

    res.json(assignment);
  } catch (error: any) {
    console.error('Erreur dans /admin/assignments/:id:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ========== GESTION DES RÔLES ==========

// Obtenir tous les utilisateurs avec leurs rôles
router.get('/users', async (req, res) => {
  try {
    const { role, isActive } = req.query;

    const users = await prisma.user.findMany({
      where: {
        ...(role && { role: role as any }),
        ...(isActive !== undefined && { isActive: isActive === 'true' }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
        teacherProfile: {
          select: {
            id: true,
            employeeId: true,
            specialization: true,
          },
        },
        studentProfile: {
          select: {
            id: true,
            studentId: true,
            class: {
              select: {
                id: true,
                name: true,
                level: true,
              },
            },
          },
        },
        parentProfile: {
          select: {
            id: true,
            profession: true,
          },
        },
        educatorProfile: {
          select: { id: true, employeeId: true, specialization: true },
        },
        staffProfile: {
          select: {
            id: true,
            employeeId: true,
            staffCategory: true,
            supportKind: true,
            jobTitle: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(users);
  } catch (error: any) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Changer le rôle d'un utilisateur
router.put('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;

    if (!['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'].includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.params.id },
      data: { role: role as any },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });

    res.json(updatedUser);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir un utilisateur par ID
router.get('/users/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        teacherProfile: {
          include: {
            classes: true,
            courses: true,
          },
        },
        studentProfile: {
          include: {
            class: true,
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
          },
        },
        parentProfile: {
          include: {
            students: {
              include: {
                student: {
                  include: {
                    class: true,
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
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json(user);
  } catch (error: any) {
    console.error(`Erreur lors de la récupération de l'utilisateur ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Mettre à jour un utilisateur
router.put('/users/:id', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, isActive } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(email && { email }),
        ...(phone !== undefined && { phone }),
        ...(isActive !== undefined && { isActive }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(updatedUser);
  } catch (error: any) {
    console.error(`Erreur lors de la mise à jour de l'utilisateur ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Supprimer un utilisateur
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Ne pas permettre la suppression de son propre compte
    if (user.id === req.user!.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
    }

    // Supprimer l'utilisateur (cascade supprimera les profils associés)
    await prisma.user.delete({
      where: { id: req.params.id },
    });

    res.status(204).send();
  } catch (error: any) {
    console.error(`Erreur lors de la suppression de l'utilisateur ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Obtenir les statistiques par rôle
router.get('/roles/stats', async (req, res) => {
  try {
    const [admins, teachers, students, parents, educators, staff, activeUsers, inactiveUsers] =
      await Promise.all([
        prisma.user.count({ where: { role: 'ADMIN' } }),
        prisma.user.count({ where: { role: 'TEACHER' } }),
        prisma.user.count({ where: { role: 'STUDENT' } }),
        prisma.user.count({ where: { role: 'PARENT' } }),
        prisma.user.count({ where: { role: 'EDUCATOR' } }),
        prisma.user.count({ where: { role: 'STAFF' } }),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({ where: { isActive: false } }),
      ]);

    res.json({
      admins,
      teachers,
      students,
      parents,
      educators,
      staff,
      activeUsers,
      inactiveUsers,
      total: admins + teachers + students + parents + educators + staff,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== SUIVI PÉDAGOGIQUE ==========

// Statistiques pédagogiques par classe
router.get('/pedagogical/class-stats', async (req, res) => {
  try {
    const { classId } = req.query;

    if (!classId) {
      return res.status(400).json({ error: 'classId requis' });
    }

    const students = await prisma.student.findMany({
      where: { classId: classId as string },
      include: {
        user: {
          select: { firstName: true, lastName: true },
        },
        grades: {
          include: {
            course: true,
          },
        },
        absences: true,
      },
    });

    const classStats = students.map((student) => {
      const grades = student.grades || [];
      const totalScore = grades.reduce((sum, g) => sum + (g.score / g.maxScore) * 20 * g.coefficient, 0);
      const totalCoefficient = grades.reduce((sum, g) => sum + g.coefficient, 0);
      const average = totalCoefficient > 0 ? totalScore / totalCoefficient : 0;
      const absences = student.absences?.filter((a) => !a.excused).length || 0;

      return {
        studentId: student.studentId,
        firstName: student.user?.firstName || '',
        lastName: student.user?.lastName || '',
        average,
        absences,
        totalGrades: grades.length,
      };
    });

    res.json(classStats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Progression d'un élève
router.get('/pedagogical/student-progress/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { period } = req.query; // 'month', 'semester', 'year'

    const student = await prisma.student.findUnique({
      where: { studentId },
      include: {
        grades: {
          include: {
            course: true,
          },
          orderBy: {
            date: 'asc',
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    // Grouper les notes par période
    const progress = student.grades.map((grade) => ({
      date: grade.date,
      course: grade.course.name,
      score: (grade.score / grade.maxScore) * 20,
      coefficient: grade.coefficient,
    }));

    res.json(progress);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Statistiques par matière
router.get('/pedagogical/course-stats', async (req, res) => {
  try {
    const { courseId, classId } = req.query;

    const where: any = {};
    if (courseId) where.courseId = courseId as string;
    if (classId) {
      where.student = { classId: classId as string };
    }

    const grades = await prisma.grade.findMany({
      where,
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            class: {
              select: {
                name: true,
              },
            },
          },
        },
        course: true,
      },
    });

    const courseStats = {
      totalGrades: grades.length,
      average: grades.length > 0
        ? grades.reduce((sum, g) => sum + (g.score / g.maxScore) * 20, 0) / grades.length
        : 0,
      distribution: {
        excellent: grades.filter((g) => (g.score / g.maxScore) * 20 >= 16).length,
        good: grades.filter((g) => (g.score / g.maxScore) * 20 >= 12 && (g.score / g.maxScore) * 20 < 16).length,
        average: grades.filter((g) => (g.score / g.maxScore) * 20 >= 10 && (g.score / g.maxScore) * 20 < 12).length,
        weak: grades.filter((g) => (g.score / g.maxScore) * 20 < 10).length,
      },
    };

    res.json(courseStats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Élèves en difficulté
router.get('/pedagogical/students-at-risk', async (req, res) => {
  try {
    const { classId } = req.query;

    const students = await prisma.student.findMany({
      where: classId ? { classId: classId as string } : {},
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
        grades: {
          include: {
            course: true,
          },
        },
        absences: true,
      },
    });

    const atRiskStudents = students
      .map((student) => {
        const grades = student.grades || [];
        const totalScore = grades.reduce((sum, g) => sum + (g.score / g.maxScore) * 20 * g.coefficient, 0);
        const totalCoefficient = grades.reduce((sum, g) => sum + g.coefficient, 0);
        const average = totalCoefficient > 0 ? totalScore / totalCoefficient : 0;
        const unexcusedAbsences = student.absences?.filter((a) => !a.excused).length || 0;

        return {
          studentId: student.studentId,
          firstName: student.user.firstName,
          lastName: student.user.lastName,
          email: student.user.email,
          class: student.class?.name || 'Non assigné',
          average,
          unexcusedAbsences,
          totalGrades: grades.length,
          riskLevel: average < 10 || unexcusedAbsences > 5 ? 'high' : average < 12 ? 'medium' : 'low',
        };
      })
      .filter((s) => s.riskLevel !== 'low')
      .sort((a, b) => {
        if (a.riskLevel === 'high' && b.riskLevel !== 'high') return -1;
        if (a.riskLevel !== 'high' && b.riskLevel === 'high') return 1;
        return a.average - b.average;
      });

    res.json(atRiskStudents);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== COMMUNICATION ==========

// Obtenir tous les messages
router.get('/messages', async (req, res) => {
  try {
    const { userId, unread } = req.query;

    const messages = await prisma.message.findMany({
      where: {
        ...(userId && { receiverId: userId as string }),
        ...(unread === 'true' && { read: false }),
      },
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
        receiver: {
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
    });

    res.json(messages);
  } catch (error: any) {
    console.error('Erreur lors de la récupération des messages:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Envoyer un message (1:1, ou diffusion parents par classe / par niveau)
router.post('/messages', async (req, res) => {
  try {
    const {
      receiverId,
      subject,
      content,
      category,
      channels,
      threadKey: bodyThreadKey,
      attachmentUrls: rawAttachments,
      broadcastClassId,
      broadcastLevel,
      academicYear,
    } = req.body as {
      receiverId?: string;
      subject?: string;
      content?: string;
      category?: string;
      channels?: string[];
      threadKey?: string;
      attachmentUrls?: string[];
      broadcastClassId?: string;
      broadcastLevel?: string;
      academicYear?: string;
    };

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Le contenu est requis' });
    }

    const {
      makeDmThreadKey,
      createInternalPlatformMessage,
      notifyUserNewMessage,
    } = await import('../utils/internal-messaging.util');

    const attachmentUrls = Array.isArray(rawAttachments)
      ? rawAttachments.filter((u) => typeof u === 'string' && u.trim()).map((u) => u.trim())
      : [];

    const validCategories = ['GENERAL', 'ACADEMIC', 'ABSENCE', 'PAYMENT', 'CONDUCT', 'URGENT', 'ANNOUNCEMENT'] as const;
    const messageCategory: MessageCategory =
      category && validCategories.includes(category as MessageCategory)
        ? (category as MessageCategory)
        : 'GENERAL';

    /** Diffusion : tous les parents d’élèves actifs de la classe */
    if (broadcastClassId && String(broadcastClassId).trim()) {
      const classId = String(broadcastClassId).trim();
      const students = await prisma.student.findMany({
        where: { classId, isActive: true },
        select: {
          parents: { select: { parent: { select: { userId: true } } } },
        },
      });
      const parentUserIds = [...new Set(students.flatMap((s) => s.parents.map((p) => p.parent.userId)))];
      if (parentUserIds.length === 0) {
        return res.status(400).json({ error: 'Aucun parent à joindre pour cette classe.' });
      }
      const batchKey = `class_${classId}_${Date.now()}`;
      for (const pid of parentUserIds) {
        await createInternalPlatformMessage({
          senderId: req.user!.id,
          receiverId: pid,
          subject: subject && String(subject).trim() ? String(subject).trim() : null,
          content: content.trim(),
          category: messageCategory,
          threadKey: batchKey,
          attachmentUrls,
        });
      }
      return res.status(201).json({
        ok: true,
        broadcast: true,
        scope: 'class',
        count: parentUserIds.length,
        threadKey: batchKey,
      });
    }

    /** Diffusion : parents d’élèves actifs de toutes les classes d’un niveau (ex. « 6ème ») */
    if (broadcastLevel && String(broadcastLevel).trim() && academicYear && String(academicYear).trim()) {
      const level = String(broadcastLevel).trim();
      const year = String(academicYear).trim();
      const classes = await prisma.class.findMany({
        where: { level, academicYear: year },
        select: { id: true },
      });
      if (classes.length === 0) {
        return res.status(404).json({ error: 'Aucune classe pour ce niveau et cette année scolaire.' });
      }
      const classIds = classes.map((c) => c.id);
      const students = await prisma.student.findMany({
        where: { classId: { in: classIds }, isActive: true },
        select: {
          parents: { select: { parent: { select: { userId: true } } } },
        },
      });
      const parentUserIds = [...new Set(students.flatMap((s) => s.parents.map((p) => p.parent.userId)))];
      if (parentUserIds.length === 0) {
        return res.status(400).json({ error: 'Aucun parent à joindre pour ce niveau.' });
      }
      const batchKey = `level_${year}_${level.replace(/\s+/g, '_')}_${Date.now()}`;
      for (const pid of parentUserIds) {
        await createInternalPlatformMessage({
          senderId: req.user!.id,
          receiverId: pid,
          subject: subject && String(subject).trim() ? String(subject).trim() : null,
          content: content.trim(),
          category: messageCategory,
          threadKey: batchKey,
          attachmentUrls,
        });
      }
      return res.status(201).json({
        ok: true,
        broadcast: true,
        scope: 'level',
        count: parentUserIds.length,
        threadKey: batchKey,
      });
    }

    if (!receiverId) {
      return res.status(400).json({
        error: 'receiverId requis (ou utilisez broadcastClassId / broadcastLevel + academicYear).',
      });
    }

    // Valider les canaux
    const validChannels = ['PLATFORM', 'EMAIL', 'SMS'];
    const selectedChannels = channels && Array.isArray(channels)
      ? (channels.filter((c: string) => validChannels.includes(c)) as MessageChannel[])
      : (['PLATFORM'] as MessageChannel[]);

    if (selectedChannels.length === 0) {
      return res.status(400).json({ error: 'Au moins un canal doit être sélectionné' });
    }

    // Récupérer les informations du destinataire
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
      },
    });

    if (!receiver) {
      return res.status(404).json({ error: 'Destinataire non trouvé' });
    }

    // Récupérer les informations de l'expéditeur
    const sender = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        firstName: true,
        lastName: true,
      },
    });

    const dmKey =
      bodyThreadKey && String(bodyThreadKey).trim().length > 0
        ? String(bodyThreadKey).trim()
        : makeDmThreadKey(req.user!.id, receiverId);

    // Créer le message dans la base de données
    const message = await prisma.message.create({
      data: {
        senderId: req.user!.id,
        receiverId,
        subject,
        content,
        category: messageCategory,
        channels: selectedChannels,
        threadKey: dmKey,
        attachmentUrls,
        sentViaSMS: false,
        sentViaEmail: false,
        smsStatus: selectedChannels.includes('SMS') ? 'pending' : null,
        emailStatus: selectedChannels.includes('EMAIL') ? 'pending' : null,
      },
      include: {
        receiver: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        sender: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    await notifyUserNewMessage({
      receiverUserId: receiver.id,
      receiverRole: receiver.role,
      senderDisplayName: `${sender?.firstName ?? ''} ${sender?.lastName ?? ''}`.trim() || 'Administration',
      subject: message.subject,
      contentSnippet: message.content,
    });

    // Envoyer via les différents canaux
    const sendResults = {
      email: { success: false, error: null as string | null },
      sms: { success: false, error: null as string | null },
    };

    // Envoyer par email si demandé
    if (selectedChannels.includes('EMAIL') && receiver.email) {
      const { sendMessageEmail } = await import('../utils/email.util');
      const emailResult = await sendMessageEmail(
        receiver.email,
        subject || 'Message de School Manager',
        content,
        `${sender?.firstName} ${sender?.lastName}`
      );

      if (emailResult.success) {
        sendResults.email.success = true;
        await prisma.message.update({
          where: { id: message.id },
          data: {
            sentViaEmail: true,
            emailStatus: 'sent',
          },
        });
      } else {
        sendResults.email.error = emailResult.error || 'Erreur inconnue';
        await prisma.message.update({
          where: { id: message.id },
          data: {
            emailStatus: 'failed',
          },
        });
      }
    }

    // Envoyer par SMS si demandé
    if (selectedChannels.includes('SMS') && receiver.phone) {
      const { sendSMS, formatPhoneNumber, isValidPhoneNumber } = await import('../utils/sms.util');

      if (isValidPhoneNumber(receiver.phone)) {
        const formattedPhone = formatPhoneNumber(receiver.phone);
        const smsContent = subject ? `${subject}\n\n${content}` : content;

        // Limiter la longueur du SMS (160 caractères)
        const smsText = smsContent.length > 160 ? smsContent.substring(0, 157) + '...' : smsContent;

        const smsResult = await sendSMS(formattedPhone, smsText);

        if (smsResult.success) {
          sendResults.sms.success = true;
          await prisma.message.update({
            where: { id: message.id },
            data: {
              sentViaSMS: true,
              smsStatus: 'sent',
            },
          });
        } else {
          sendResults.sms.error = smsResult.error || 'Erreur inconnue';
          await prisma.message.update({
            where: { id: message.id },
            data: {
              smsStatus: 'failed',
            },
          });
        }
      } else {
        sendResults.sms.error = 'Numéro de téléphone invalide';
        await prisma.message.update({
          where: { id: message.id },
          data: {
            smsStatus: 'failed',
          },
        });
      }
    }

    // Récupérer le message mis à jour
    const updatedMessage = await prisma.message.findUnique({
      where: { id: message.id },
      include: {
        receiver: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        sender: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    res.status(201).json({
      ...updatedMessage,
      sendResults, // Inclure les résultats d'envoi pour information
    });
  } catch (error: any) {
    console.error('Erreur lors de l\'envoi du message:', error);
    res.status(500).json({ error: error.message || 'Erreur lors de l\'envoi du message' });
  }
});

// Obtenir un message par ID
router.get('/messages/:id', async (req, res) => {
  try {
    const message = await prisma.message.findUnique({
      where: { id: req.params.id },
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
        receiver: {
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
    });

    if (!message) {
      return res.status(404).json({ error: 'Message non trouvé' });
    }

    res.json(message);
  } catch (error: any) {
    console.error(`Erreur lors de la récupération du message ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Marquer un message comme lu
router.put('/messages/:id/read', async (req, res) => {
  try {
    const message = await prisma.message.update({
      where: { id: req.params.id },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    res.json(message);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir une annonce par ID
router.get('/announcements/:id', async (req, res) => {
  try {
    const announcement = await prisma.announcement.findUnique({
      where: { id: req.params.id },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
        targetClass: {
          select: {
            id: true,
            name: true,
            level: true,
          },
        },
      },
    });

    if (!announcement) {
      return res.status(404).json({ error: 'Annonce non trouvée' });
    }

    res.json(announcement);
  } catch (error: any) {
    console.error(`Erreur lors de la récupération de l'annonce ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Obtenir toutes les annonces
router.get('/announcements', async (req, res) => {
  try {
    const { published, targetRole, targetClass } = req.query;

    const announcements = await prisma.announcement.findMany({
      where: {
        ...(published !== undefined && { published: published === 'true' }),
        ...(targetRole && { targetRole: targetRole as any }),
        ...(targetClass && { targetClassId: targetClass as string }),
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
        targetClass: {
          select: {
            id: true,
            name: true,
            level: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(announcements);
  } catch (error: any) {
    console.error('Erreur lors de la récupération des annonces:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Créer une annonce
router.post('/announcements', async (req, res) => {
  try {
    const {
      title,
      content,
      targetRole,
      targetClass,
      priority,
      expiresAt,
      portalCategory,
      coverImageUrl,
      imageUrls,
    } = req.body;
    const {
      normalizePortalCategory,
      normalizeCoverImageUrl,
      parseImageUrlsField,
    } = await import('../utils/announcement-portal-fields.util');

    if (!title || !content) {
      return res.status(400).json({ error: 'title et content sont requis' });
    }

    // Valider le priority
    const validPriorities = ['low', 'normal', 'high', 'urgent'];
    const finalPriority = priority && validPriorities.includes(priority) ? priority : 'normal';

    // Valider le targetRole si fourni
    let finalTargetRole = null;
    if (targetRole) {
      const validRoles = ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'EDUCATOR', 'STAFF'];
      if (validRoles.includes(targetRole)) {
        finalTargetRole = targetRole;
      }
    }

    // Vérifier que targetClass existe si fourni
    if (targetClass) {
      const classExists = await prisma.class.findUnique({
        where: { id: targetClass },
      });
      if (!classExists) {
        return res.status(400).json({ error: 'Classe non trouvée' });
      }
    }

    const announcement = await prisma.announcement.create({
      data: {
        authorId: req.user!.id,
        title: title.trim(),
        content: content.trim(),
        targetRole: finalTargetRole,
        targetClassId: targetClass || null,
        priority: finalPriority,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        portalCategory: normalizePortalCategory(portalCategory),
        coverImageUrl: normalizeCoverImageUrl(coverImageUrl),
        imageUrls: parseImageUrlsField(imageUrls),
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
        targetClass: {
          select: {
            id: true,
            name: true,
            level: true,
          },
        },
      },
    });

    res.status(201).json(announcement);
  } catch (error: any) {
    console.error('Erreur lors de la création de l\'annonce:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Publier une annonce
router.put('/announcements/:id/publish', async (req, res) => {
  try {
    const announcement = await prisma.announcement.update({
      where: { id: req.params.id },
      data: {
        published: true,
        publishedAt: new Date(),
      },
    });

    const { notifyUsersAboutPublishedAnnouncement } = await import(
      '../utils/announcement-publish-notify.util'
    );
    setImmediate(() => {
      notifyUsersAboutPublishedAnnouncement(announcement.id).catch((err) => {
        console.error('notifyUsersAboutPublishedAnnouncement:', err);
      });
    });

    res.json(announcement);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mettre à jour une annonce
router.put('/announcements/:id', async (req, res) => {
  try {
    const { title, content, targetRole, targetClass, priority, expiresAt, portalCategory, coverImageUrl, imageUrls } =
      req.body;
    const {
      normalizePortalCategory,
      normalizeCoverImageUrl,
      parseImageUrlsField,
    } = await import('../utils/announcement-portal-fields.util');

    const announcement = await prisma.announcement.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(content && { content }),
        ...(targetRole && { targetRole }),
        ...(targetClass && { targetClassId: targetClass }),
        ...(priority && { priority }),
        ...(expiresAt && { expiresAt: new Date(expiresAt) }),
        ...(req.body.portalCategory !== undefined && {
          portalCategory: normalizePortalCategory(portalCategory),
        }),
        ...(req.body.coverImageUrl !== undefined && {
          coverImageUrl: normalizeCoverImageUrl(coverImageUrl),
        }),
        ...(req.body.imageUrls !== undefined && {
          imageUrls: parseImageUrlsField(imageUrls),
        }),
      },
    });

    res.json(announcement);
  } catch (error: any) {
    console.error(`Erreur lors de la mise à jour de l'annonce ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Supprimer une annonce
router.delete('/announcements/:id', async (req, res) => {
  try {
    const announcement = await prisma.announcement.findUnique({
      where: { id: req.params.id },
    });

    if (!announcement) {
      return res.status(404).json({ error: 'Annonce non trouvée' });
    }

    await prisma.announcement.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Annonce supprimée avec succès' });
  } catch (error: any) {
    console.error(`Erreur lors de la suppression de l'annonce ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Supprimer un message
router.delete('/messages/:id', async (req, res) => {
  try {
    const message = await prisma.message.findUnique({
      where: { id: req.params.id },
    });

    if (!message) {
      return res.status(404).json({ error: 'Message non trouvé' });
    }

    await prisma.message.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Message supprimé avec succès' });
  } catch (error: any) {
    console.error(`Erreur lors de la suppression du message ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Obtenir les notifications
router.get('/notifications', async (req, res) => {
  try {
    const { userId, unread } = req.query;

    const notifications = await prisma.notification.findMany({
      where: {
        ...(userId && { userId: userId as string }),
        ...(unread === 'true' && { read: false }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // Augmenté pour permettre plus de notifications
    });

    res.json(notifications);
  } catch (error: any) {
    console.error('Erreur dans /admin/notifications:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/** État des canaux d’alerte (sans secrets) — pilotage admin */
router.get('/notifications/channel-status', async (_req, res) => {
  try {
    const { isWebPushConfigured } = await import('../utils/push-send.util');
    const { isSmtpConfigured } = await import('../utils/email.util');
    const { isTwilioConfigured } = await import('../utils/sms.util');
    res.json({
      pushWeb: isWebPushConfigured(),
      emailSmtp: isSmtpConfigured(),
      smsTwilio: isTwilioConfigured(),
      attendanceParentNotify: process.env.NOTIFY_PARENTS_ON_ATTENDANCE?.trim() !== 'false',
      announcementUrgentSms: process.env.ANNOUNCEMENT_URGENT_SMS?.trim() === 'true',
      tuitionSmsOverdue: process.env.TUITION_REMINDER_SMS_OVERDUE?.trim() === 'true',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

/** Vérifie in-app + e-mail + push pour le compte admin courant */
router.post('/notifications/test', async (req, res) => {
  try {
    const { notifyUsersImportant } = await import('../utils/notify-important.util');
    await notifyUsersImportant([req.user!.id], {
      type: 'test',
      title: 'Test des notifications',
      content:
        'Si vous voyez ceci dans la cloche, recevez un e-mail et une notification push (navigateur), les canaux correspondants sont correctement configurés.',
      email: undefined,
    });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Marquer toutes les notifications comme lues (doit être avant /notifications/:id/read)
router.put('/notifications/read-all', async (req, res) => {
  try {
    const { userId } = req.query;
    const currentUser = (req as any).user;

    // Construire le filtre where
    const where: any = {
      read: false,
    };

    // Si userId est fourni, filtrer par utilisateur, sinon utiliser l'utilisateur actuel
    if (userId) {
      where.userId = userId as string;
    } else if (currentUser?.id) {
      where.userId = currentUser.id;
    } else {
      // Si aucun userId n'est fourni et aucun utilisateur actuel, on marque toutes les notifications (pour admin)
      // On garde seulement le filtre read: false
    }

    // Mettre à jour toutes les notifications non lues
    const result = await prisma.notification.updateMany({
      where,
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    res.json({ 
      message: `${result.count} notification(s) marquée(s) comme lue(s)`,
      count: result.count 
    });
  } catch (error: any) {
    console.error('Erreur lors du marquage de toutes les notifications comme lues:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ========== GESTION DE LA CONDUITE ==========

// Obtenir toutes les évaluations de conduite
router.get('/conduct', async (req, res) => {
  try {
    const { studentId, period, academicYear } = req.query;

    const conducts = await prisma.conduct.findMany({
      where: {
        ...(studentId && { studentId: studentId as string }),
        ...(period && { period: period as string }),
        ...(academicYear && { academicYear: academicYear as string }),
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
    console.error('Erreur lors de la récupération des évaluations de conduite:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Créer ou mettre à jour une évaluation de conduite (Admin)
router.post('/conduct', async (req, res) => {
  try {
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

    if (!studentId || !period || !academicYear) {
      return res.status(400).json({ error: 'studentId, period et academicYear sont requis' });
    }

    // Vérifier que l'étudiant existe
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    // Calculer la moyenne
    const avg = (parseFloat(punctuality || 0) + parseFloat(respect || 0) + 
                 parseFloat(participation || 0) + parseFloat(behavior || 0)) / 4;

    // Créer ou mettre à jour l'évaluation de conduite
    const conduct = await prisma.conduct.upsert({
      where: {
        studentId_period_academicYear: {
          studentId,
          period,
          academicYear,
        },
      },
      update: {
        punctuality: parseFloat(punctuality || 0),
        respect: parseFloat(respect || 0),
        participation: parseFloat(participation || 0),
        behavior: parseFloat(behavior || 0),
        average: avg,
        comments: comments || null,
        evaluatedById: req.user!.id,
        evaluatedByRole: 'ADMIN',
      },
      create: {
        studentId,
        period,
        academicYear,
        punctuality: parseFloat(punctuality || 0),
        respect: parseFloat(respect || 0),
        participation: parseFloat(participation || 0),
        behavior: parseFloat(behavior || 0),
        average: avg,
        comments: comments || null,
        evaluatedById: req.user!.id,
        evaluatedByRole: 'ADMIN',
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
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    res.status(201).json(conduct);
  } catch (error: any) {
    console.error('Erreur lors de la création/mise à jour de l\'évaluation de conduite:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Mettre à jour une évaluation de conduite (Admin)
router.put('/conduct/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      punctuality,
      respect,
      participation,
      behavior,
      comments,
    } = req.body;

    const conduct = await prisma.conduct.findUnique({
      where: { id },
    });

    if (!conduct) {
      return res.status(404).json({ error: 'Évaluation de conduite non trouvée' });
    }

    // Calculer la nouvelle moyenne
    const avg = (parseFloat(punctuality || conduct.punctuality) + 
                 parseFloat(respect || conduct.respect) + 
                 parseFloat(participation || conduct.participation) + 
                 parseFloat(behavior || conduct.behavior)) / 4;

    const updatedConduct = await prisma.conduct.update({
      where: { id },
      data: {
        ...(punctuality !== undefined && { punctuality: parseFloat(punctuality) }),
        ...(respect !== undefined && { respect: parseFloat(respect) }),
        ...(participation !== undefined && { participation: parseFloat(participation) }),
        ...(behavior !== undefined && { behavior: parseFloat(behavior) }),
        average: avg,
        ...(comments !== undefined && { comments }),
        evaluatedById: req.user!.id,
        evaluatedByRole: 'ADMIN',
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
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    res.json(updatedConduct);
  } catch (error: any) {
    console.error('Erreur lors de la mise à jour de l\'évaluation de conduite:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Supprimer une évaluation de conduite (Admin)
router.delete('/conduct/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const conduct = await prisma.conduct.findUnique({
      where: { id },
    });

    if (!conduct) {
      return res.status(404).json({ error: 'Évaluation de conduite non trouvée' });
    }

    await prisma.conduct.delete({
      where: { id },
    });

    res.json({ message: 'Évaluation de conduite supprimée avec succès' });
  } catch (error: any) {
    console.error('Erreur lors de la suppression de l\'évaluation de conduite:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Marquer une notification comme lue
router.put('/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier si la notification existe
    const existingNotification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!existingNotification) {
      return res.status(404).json({ error: 'Notification non trouvée' });
    }

    const notification = await prisma.notification.update({
      where: { id },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    res.json(notification);
  } catch (error: any) {
    console.error('Erreur dans /admin/notifications/:id/read:', error);
    // Si c'est une erreur de notification non trouvée, retourner 404
    if (error.code === 'P2025' || error.message?.includes('not found')) {
      return res.status(404).json({ error: 'Notification non trouvée' });
    }
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Supprimer une notification
router.delete('/notifications/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier si la notification existe
    const existingNotification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!existingNotification) {
      return res.status(404).json({ error: 'Notification non trouvée' });
    }

    await prisma.notification.delete({
      where: { id },
    });

    res.json({ message: 'Notification supprimée avec succès' });
  } catch (error: any) {
    console.error(`Erreur lors de la suppression de la notification ${req.params.id}:`, error);
    // Si c'est une erreur de notification non trouvée, retourner 404
    if (error.code === 'P2025' || error.message?.includes('not found')) {
      return res.status(404).json({ error: 'Notification non trouvée' });
    }
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ========== GESTION DES EMPLOIS DU TEMPS ==========

const scheduleInclude = {
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
} as const;

// Obtenir tous les emplois du temps
router.get('/schedules', async (req, res) => {
  try {
    const { classId, courseId, teacherId, room } = req.query;

    const where: Parameters<typeof findSchedulesWithRelations>[0] = {};
    if (classId) where.classId = classId as string;
    if (courseId) where.courseId = courseId as string;
    if (teacherId) {
      where.OR = [
        { course: { teacherId: teacherId as string } },
        { substituteTeacherId: teacherId as string },
      ];
    }

    let schedules = await findSchedulesWithRelations(where);

    const roomKey = typeof room === 'string' ? normalizeRoomKey(room) : null;
    if (roomKey) {
      schedules = schedules.filter((s) => normalizeRoomKey(s.room) === roomKey);
    }

    res.json(schedules);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/schedules/auto-generate', async (req, res) => {
  try {
    const result = await autoGenerateTimetableForClass(prisma, {
      classId: String(req.body.classId),
      clearExisting: Boolean(req.body.clearExisting),
      days: Array.isArray(req.body.days)
        ? req.body.days.map((v: unknown) => parseInt(String(v), 10))
        : undefined,
      slotDurationMinutes:
        req.body.slotDurationMinutes != null
          ? parseInt(String(req.body.slotDurationMinutes), 10)
          : undefined,
      morningStart: req.body.morningStart,
      morningEnd: req.body.morningEnd,
      afternoonStart: req.body.afternoonStart,
      afternoonEnd: req.body.afternoonEnd,
    });
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Créer un emploi du temps
router.post('/schedules', async (req, res) => {
  try {
    const {
      classId,
      courseId,
      dayOfWeek,
      startTime,
      endTime,
      room,
      substituteTeacherId,
      replacementNote,
    } = req.body;

    if (!classId || !courseId || dayOfWeek === undefined || !startTime || !endTime) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    try {
      await assertScheduleConstraints(prisma, {
        classId: String(classId),
        courseId: String(courseId),
        dayOfWeek: parseInt(String(dayOfWeek), 10),
        startTime: String(startTime),
        endTime: String(endTime),
        room: room ? String(room) : null,
        substituteTeacherId: substituteTeacherId ? String(substituteTeacherId) : null,
      });
    } catch (e: unknown) {
      if (e instanceof Error) {
        return res.status(400).json({ error: e.message });
      }
      return res.status(400).json({ error: 'Contrainte non respectée' });
    }

    const schedule = await prisma.schedule.create({
      data: {
        classId,
        courseId,
        dayOfWeek: parseInt(String(dayOfWeek), 10),
        startTime: String(startTime),
        endTime: String(endTime),
        room: room ? String(room) : null,
        substituteTeacherId: substituteTeacherId ? String(substituteTeacherId) : null,
        replacementNote: replacementNote ? String(replacementNote) : null,
      },
      include: scheduleInclude,
    });

    res.status(201).json(schedule);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtenir un emploi du temps par ID
router.get('/schedules/:id', async (req, res) => {
  try {
    const schedule = await findScheduleByIdWithRelations(req.params.id);

    if (!schedule) {
      return res.status(404).json({ error: 'Emploi du temps non trouvé' });
    }

    res.json(schedule);
  } catch (error: any) {
    console.error('Erreur dans /admin/schedules/:id:', error);
    res.status(500).json({
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// Mettre à jour un emploi du temps
router.put('/schedules/:id', async (req, res) => {
  try {
    const { dayOfWeek, startTime, endTime, room, substituteTeacherId, replacementNote } = req.body;

    const current = await prisma.schedule.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: 'Emploi du temps non trouvé' });

    const nextDay = dayOfWeek !== undefined ? parseInt(String(dayOfWeek), 10) : current.dayOfWeek;
    const nextStart = startTime ? String(startTime) : current.startTime;
    const nextEnd = endTime ? String(endTime) : current.endTime;
    const nextRoom = room !== undefined ? (room ? String(room) : null) : current.room;
    const nextSubstitute =
      substituteTeacherId !== undefined
        ? substituteTeacherId
          ? String(substituteTeacherId)
          : null
        : current.substituteTeacherId;

    try {
      await assertScheduleConstraints(
        prisma,
        {
          classId: current.classId,
          courseId: current.courseId,
          dayOfWeek: nextDay,
          startTime: nextStart,
          endTime: nextEnd,
          room: nextRoom,
          substituteTeacherId: nextSubstitute,
        },
        current.id
      );
    } catch (e: unknown) {
      if (e instanceof Error) return res.status(400).json({ error: e.message });
      return res.status(400).json({ error: 'Contrainte non respectée' });
    }

    const schedule = await prisma.schedule.update({
      where: { id: req.params.id },
      data: {
        dayOfWeek: nextDay,
        startTime: nextStart,
        endTime: nextEnd,
        room: nextRoom,
        substituteTeacherId: nextSubstitute,
        ...(replacementNote !== undefined && {
          replacementNote: replacementNote ? String(replacementNote) : null,
        }),
      },
      include: scheduleInclude,
    });

    res.json(schedule);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Supprimer un emploi du temps
router.delete('/schedules/:id', async (req, res) => {
  try {
    await prisma.schedule.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Emploi du temps supprimé' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== CONTRÔLE D'ACCÈS ==========

router.get('/access-control/overview', async (_req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const [studentBadges, teacherBadges, staffBadges, studentBio, teacherBio, staffBio, faceCounts, byType, criticalToday] =
      await Promise.all([
        prisma.student.count({ where: { nfcId: { not: null } } }),
        prisma.teacher.count({ where: { nfcId: { not: null } } }),
        prisma.staffMember.count({ where: { nfcId: { not: null } } }),
        prisma.student.count({ where: { biometricId: { not: null } } }),
        prisma.teacher.count({ where: { biometricId: { not: null } } }),
        prisma.staffMember.count({ where: { biometricId: { not: null } } }),
        countFaceEnrollments(),
        prisma.securityEvent.groupBy({
          by: ['type'],
          where: { createdAt: { gte: startOfDay, lt: endOfDay } },
          _count: true,
        }),
        prisma.securityEvent.count({
          where: {
            createdAt: { gte: startOfDay, lt: endOfDay },
            severity: 'critical',
          },
        }),
      ]);

    const typeCount = new Map<string, number>(
      byType.map((x: any) => [String(x.type), Number(x?._count?.type ?? x?._count ?? 0)])
    );
    const sum = (types: string[]) => types.reduce((acc, t) => acc + (typeCount.get(t) ?? 0), 0);
    const todayEntries = sum(['badge_entry', 'biometric_entry', 'manual_entry', 'visitor_entry']);
    const todayExits = sum(['badge_exit', 'biometric_exit', 'manual_exit', 'visitor_exit']);
    const visitorIn = typeCount.get('visitor_entry') ?? 0;
    const visitorOut = typeCount.get('visitor_exit') ?? 0;

    res.json({
      badgesAssigned: studentBadges + teacherBadges + staffBadges,
      biometricsEnrolled: studentBio + teacherBio + staffBio,
      faceEnrolled: faceCounts.total,
      faceEnrolledBreakdown: faceCounts,
      todayEntries,
      todayExits,
      activeVisitorsEstimate: visitorIn - visitorOut,
      criticalAlertsToday: criticalToday,
    });
  } catch (error: any) {
    console.error('GET /access-control/overview:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.get('/access-control/entry-logs', async (req, res) => {
  try {
    const { type, limit = 100 } = req.query;
    const validLimit = Math.min(Math.max(parseInt(String(limit), 10) || 100, 1), 500);
    const rows = await prisma.securityEvent.findMany({
      where: {
        type: {
          in: [
            'badge_entry',
            'badge_exit',
            'biometric_entry',
            'biometric_exit',
            'manual_entry',
            'manual_exit',
            'visitor_entry',
            'visitor_exit',
          ],
        },
        ...(type && typeof type === 'string' && { type }),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: validLimit,
    });
    res.json(rows);
  } catch (error: any) {
    console.error('GET /access-control/entry-logs:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.post('/access-control/entry-logs', async (req, res) => {
  try {
    const { type, description, severity, userId, metadata } = req.body;
    if (!type || typeof type !== 'string') {
      return res.status(400).json({ error: 'type est requis' });
    }
    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({ error: 'description est requise' });
    }
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: String(userId) } });
      if (!user) return res.status(400).json({ error: 'Utilisateur introuvable' });
    }
    const row = await prisma.securityEvent.create({
      data: {
        userId: userId || req.user?.id || null,
        type: type.trim(),
        description: metadata ? `${description.trim()} | ${JSON.stringify(metadata)}` : description.trim(),
        severity: severity || 'info',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      },
    });
    res.status(201).json(row);
  } catch (error: any) {
    console.error('POST /access-control/entry-logs:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.get('/access-control/appointments', async (req, res) => {
  try {
    const { from, to, status } = req.query;
    const where: Record<string, unknown> = {};
    if (status && typeof status === 'string') where.status = status;
    if (from && to && typeof from === 'string' && typeof to === 'string') {
      const fromD = new Date(from);
      const toD = new Date(to);
      if (!Number.isNaN(fromD.getTime()) && !Number.isNaN(toD.getTime())) {
        where.scheduledStart = { gte: fromD, lte: toD };
      }
    } else {
      // Fenêtre par défaut limitée pour éviter des scans historiques trop lourds.
      const now = new Date();
      const in90d = new Date();
      in90d.setDate(in90d.getDate() + 90);
      where.scheduledStart = { gte: now, lte: in90d };
    }
    const rows = await prisma.parentTeacherAppointment.findMany({
      where,
      include: {
        parent: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        teacher: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        student: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { scheduledStart: 'asc' },
      take: 500,
    });
    res.json(rows);
  } catch (error: any) {
    console.error('GET /access-control/appointments:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.get('/access-control/cctv', async (_req, res) => {
  try {
    const alerts = await prisma.securityEvent.findMany({
      where: { severity: { in: ['warning', 'critical'] } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json({
      provider: process.env.CCTV_PROVIDER || 'Non configuré',
      status: process.env.CCTV_ENABLED === 'true' ? 'online' : 'monitoring-only',
      monitoredZones: Number(process.env.CCTV_ZONE_COUNT || 0),
      lastAlerts: alerts,
    });
  } catch (error: any) {
    console.error('GET /access-control/cctv:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.get('/access-control/alarm', async (_req, res) => {
  try {
    const latestCritical = await prisma.securityEvent.findFirst({
      where: { severity: 'critical' },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      provider: process.env.ALARM_PROVIDER || 'Non configuré',
      armed: process.env.ALARM_ARMED === 'true',
      mode: process.env.ALARM_MODE || 'unset',
      lastCriticalEvent: latestCritical,
    });
  } catch (error: any) {
    console.error('GET /access-control/alarm:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// ========== SÉCURITÉ & CONFIDENTIALITÉ ==========

// Obtenir les logs de connexion
router.get('/security/login-logs', async (req, res) => {
  try {
    const { userId, limit = 100 } = req.query;

    const limitNum = parseInt(limit as string) || 100;
    const validLimit = limitNum > 0 && limitNum <= 1000 ? limitNum : 100;

    const logs = await prisma.loginLog.findMany({
      where: {
        ...(userId && { userId: userId as string }),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: validLimit,
    });

    res.json(logs);
  } catch (error: any) {
    console.error('Erreur lors de la récupération des logs de connexion:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Obtenir les événements de sécurité
router.get('/security/events', async (req, res) => {
  try {
    const { userId, severity, limit = 100 } = req.query;

    const limitNum = parseInt(limit as string) || 100;
    const validLimit = limitNum > 0 && limitNum <= 1000 ? limitNum : 100;

    const events = await prisma.securityEvent.findMany({
      where: {
        ...(userId && { userId: userId as string }),
        ...(severity && { severity: severity as string }),
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: validLimit,
    });

    res.json(events);
  } catch (error: any) {
    console.error('Erreur lors de la récupération des événements de sécurité:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Obtenir les statistiques de sécurité
router.get('/security/stats', async (req, res) => {
  try {
    const [totalLogins, successfulLogins, failedLogins, recentEvents, criticalEvents] = await Promise.all([
      prisma.loginLog.count(),
      prisma.loginLog.count({ where: { success: true } }),
      prisma.loginLog.count({ where: { success: false } }),
      prisma.securityEvent.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 derniers jours
          },
        },
      }),
      prisma.securityEvent.count({ where: { severity: 'critical' } }),
    ]);

    res.json({
      totalLogins,
      successfulLogins,
      failedLogins,
      recentEvents,
      criticalEvents,
      successRate: totalLogins > 0 ? (successfulLogins / totalLogins) * 100 : 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/security/data-protection-summary', async (_req, res) => {
  try {
    const [consentsTotal, consentsGranted, gdprEvents, lastBackupEvent] = await Promise.all([
      prisma.parentConsent.count(),
      prisma.parentConsent.count({ where: { granted: true } }),
      prisma.securityEvent.count({
        where: { type: { in: ['gdpr_data_export', 'gdpr_erasure_request'] } },
      }),
      prisma.securityEvent.findFirst({
        where: { type: { in: ['backup_success', 'backup_failure'] } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const backupDirRaw = process.env.MONGODB_BACKUP_DIR?.trim();
    const backupDir = backupDirRaw
      ? path.isAbsolute(backupDirRaw)
        ? backupDirRaw
        : path.resolve(process.cwd(), backupDirRaw)
      : path.resolve(process.cwd(), 'backups', 'mongodb');
    const backupFiles = await fs.readdir(backupDir).catch(() => []);
    const backupArchives = backupFiles.filter(
      (f) => f.startsWith('mongo-backup-') && f.endsWith('.archive.gz')
    );

    res.json({
      rgpdEnabled: true,
      privacyPolicyUrl: '/privacy',
      consent: {
        total: consentsTotal,
        granted: consentsGranted,
        deniedOrPending: Math.max(0, consentsTotal - consentsGranted),
      },
      gdprRequestsTracked: gdprEvents,
      sensitiveEncryptionConfigured: Boolean(
        process.env.SENSITIVE_FIELD_ENCRYPTION_KEY?.trim()
      ),
      scheduledBackupsEnabled: ['1', 'true', 'yes'].includes(
        (process.env.ENABLE_SCHEDULED_MONGODB_BACKUPS || '').toLowerCase()
      ),
      backupCron: process.env.MONGODB_BACKUP_CRON || '0 3 * * *',
      backupRetentionDays: Number(process.env.MONGODB_BACKUP_RETENTION_DAYS || 14),
      backupArchiveCount: backupArchives.length,
      lastBackupEvent,
    });
  } catch (error: any) {
    console.error('GET /security/data-protection-summary:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.get('/security/role-permissions', async (_req, res) => {
  try {
    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: true,
    });
    const rolePermissions: Record<string, string[]> = {
      ADMIN: ['all:*'],
      TEACHER: [
        'teacher:profile',
        'teacher:attendance',
        'teacher:grades',
        'teacher:assignments',
        'teacher:appointments',
      ],
      STUDENT: ['student:profile', 'student:grades', 'student:attendance', 'student:assignments'],
      PARENT: ['parent:children', 'parent:attendance', 'parent:grades', 'parent:appointments'],
      EDUCATOR: ['educator:profile', 'educator:discipline', 'educator:reports', 'educator:messaging'],
      STAFF: ['staff:profile', 'staff:attendance', 'staff:admin-ops'],
    };
    res.json({
      roles: usersByRole.map((r) => ({
        role: r.role,
        users: r._count,
        permissions: rolePermissions[r.role] || [],
      })),
    });
  } catch (error: any) {
    console.error('GET /security/role-permissions:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.get('/security/2fa/users', async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        twoFactorSettings: {
          select: {
            enabled: true,
            method: true,
            lastVerifiedAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
    });
    const total = users.length;
    const enabled = users.filter((u) => u.twoFactorSettings?.enabled).length;
    res.json({
      summary: { totalUsers: total, enabled2FA: enabled, rate: total ? (enabled / total) * 100 : 0 },
      users,
    });
  } catch (error: any) {
    console.error('GET /security/2fa/users:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.patch('/security/2fa/users/:userId', async (req, res) => {
  try {
    const { enabled } = req.body as { enabled?: boolean };
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled doit être booléen' });
    }
    const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (enabled) {
      return res.status(400).json({
        error: "Activation admin directe non autorisée. L'utilisateur doit configurer 2FA via son compte.",
      });
    }
    await prisma.userTwoFactorSettings.updateMany({
      where: { userId: user.id },
      data: { enabled: false },
    });
    await prisma.securityEvent.create({
      data: {
        userId: req.user?.id || null,
        type: 'two_factor_disabled_by_admin',
        description: `2FA désactivée pour ${user.email}`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        severity: 'warning',
      },
    });
    res.json({ ok: true, enabled: false });
  } catch (error: any) {
    console.error('PATCH /security/2fa/users/:userId:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.get('/security/performance/slow-endpoints', async (req, res) => {
  try {
    const limitRaw = Number.parseInt(String(req.query.limit ?? '5'), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 20) : 5;
    res.json({
      generatedAt: new Date().toISOString(),
      summary: getMetricsSummary(),
      topSlowEndpoints: getSlowEndpoints(limit),
    });
  } catch (error: any) {
    console.error('GET /security/performance/slow-endpoints:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.post('/security/backups/run', async (req, res) => {
  try {
    const result = await runMongoBackup();
    if (result.ok) {
      await prisma.securityEvent.create({
        data: {
          userId: req.user?.id || null,
          type: 'backup_success',
          description: `Sauvegarde MongoDB réussie: ${result.archivePath}`,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          severity: 'info',
        },
      });
      return res.json(result);
    }
    await prisma.securityEvent.create({
      data: {
        userId: req.user?.id || null,
        type: 'backup_failure',
        description: `Échec sauvegarde MongoDB: ${result.error}`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        severity: 'warning',
      },
    });
    return res.status(500).json(result);
  } catch (error: any) {
    console.error('POST /security/backups/run:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Changer le mot de passe d'un utilisateur
router.put('/security/users/:id/password', async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: req.params.id },
      data: { password: hashedPassword },
    });

    // Enregistrer l'événement de sécurité
    await prisma.securityEvent.create({
      data: {
        userId: req.user!.id,
        type: 'password_change',
        description: `Mot de passe modifié pour l'utilisateur ${req.params.id}`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        severity: 'info',
      },
    });

    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Envoyer un lien e-mail pour définir / réinitialiser le mot de passe (admin)
router.post('/security/users/:id/password-invite', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, email: true, firstName: true },
    });
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    await inviteNewUserToSetPassword(user.id, user.email, user.firstName);

    await prisma.securityEvent.create({
      data: {
        userId: req.user!.id,
        type: 'password_reset_invite',
        description: `Invitation de réinitialisation envoyée à ${user.email}`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        severity: 'info',
      },
    });

    res.json({ message: 'Lien de définition du mot de passe envoyé par e-mail (48 h).' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Désactiver/Activer un compte utilisateur
router.put('/security/users/:id/status', async (req, res) => {
  try {
    const { isActive } = req.body;

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive },
    });

    // Enregistrer l'événement de sécurité
    await prisma.securityEvent.create({
      data: {
        userId: req.user!.id,
        type: isActive ? 'account_activated' : 'account_deactivated',
        description: `Compte ${isActive ? 'activé' : 'désactivé'} pour ${user.email}`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        severity: 'warning',
      },
    });

    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ========== STATISTIQUES ==========

// Tableau de bord avec statistiques
router.get('/dashboard', async (req: SchoolContextRequest, res) => {
  try {
    const schoolId = req.schoolId!;
    const studentWhere = studentScopeWhere(schoolId);
    const [
      totalStudents,
      totalTeachers,
      totalClasses,
      activeStudents,
      totalParents,
      totalEducators,
    ] = await Promise.all([
      prisma.student.count({ where: studentWhere }),
      prisma.teacher.count({
        where: { OR: [{ classes: { some: { schoolId } } }, { courses: { some: { class: { schoolId } } } }] },
      }),
      prisma.class.count({ where: classScopeWhere(schoolId) }),
      prisma.student.count({
        where: { ...studentWhere, isActive: true, enrollmentStatus: 'ACTIVE' },
      }),
      prisma.parent.count({
        where: {
          students: {
            some: { student: studentWhere },
          },
        },
      }),
      prisma.educator.count(),
    ]);

    res.json({
      totalStudents,
      totalTeachers,
      totalClasses,
      activeStudents,
      totalParents,
      totalEducators,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** KPI consolidés + séries courtes pour tableaux de bord et vue direction */
router.get('/dashboard/kpis', async (req: SchoolContextRequest, res) => {
  try {
    const schoolId = req.schoolId!;
    const studentWhere = studentScopeWhere(schoolId);
    const admissionWhere = admissionScopeWhere(schoolId, req.school?.isDefault);
    const now = new Date();
    const d30 = new Date(now);
    d30.setDate(d30.getDate() - 30);
    const d180 = new Date(now);
    d180.setDate(d180.getDate() - 180);

    const [
      admissionsPending,
      admissionsUnderReview,
      tuitionUnpaid,
      payments30d,
      payments6m,
      saSubmitted,
      saTotal,
    ] = await Promise.all([
      prisma.admission.count({ where: { ...admissionWhere, status: 'PENDING' } }),
      prisma.admission.count({ where: { ...admissionWhere, status: 'UNDER_REVIEW' } }),
      prisma.tuitionFee.aggregate({
        where: { isPaid: false, student: studentWhere },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          paidAt: { gte: d30, lte: now },
          student: studentWhere,
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.findMany({
        where: {
          status: 'COMPLETED',
          paidAt: { gte: d180, lte: now },
          student: studentWhere,
        },
        select: { amount: true, paidAt: true },
      }),
      prisma.studentAssignment.count({
        where: { submitted: true, student: studentWhere },
      }),
      prisma.studentAssignment.count({ where: { student: studentWhere } }),
    ]);

    const aggCount = (a: { _count?: number | { _all?: number } }) => {
      const c = a._count;
      if (c == null) return 0;
      return typeof c === 'number' ? c : c._all ?? 0;
    };

    const monthPay = new Map<string, number>();
    for (const p of payments6m) {
      if (!p.paidAt) continue;
      const d = new Date(p.paidAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthPay.set(key, (monthPay.get(key) ?? 0) + p.amount);
    }
    const paymentsByMonth = [...monthPay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => {
        const [y, mo] = month.split('-');
        return { month, label: `${mo}/${y}`, amount: Math.round(amount * 100) / 100 };
      });

    const allStudents = await prisma.student.findMany({
      where: { isActive: true, enrollmentStatus: 'ACTIVE' },
      select: {
        grades: { select: { score: true, maxScore: true, coefficient: true } },
        absences: { select: { excused: true } },
      },
      take: 800,
    });
    let h = 0;
    let m = 0;
    for (const s of allStudents) {
      const grades = s.grades || [];
      const totalScore = grades.reduce(
        (sum, g) => sum + (g.maxScore > 0 ? (g.score / g.maxScore) * 20 * g.coefficient : 0),
        0
      );
      const totalCoef = grades.reduce((sum, g) => sum + g.coefficient, 0);
      const avg = totalCoef > 0 ? totalScore / totalCoef : 0;
      const unexcused = s.absences?.filter((a) => !a.excused).length || 0;
      if (avg < 10 || unexcused > 5) h++;
      else if (avg < 12) m++;
    }

    const submissionRate =
      saTotal > 0 ? Math.round((saSubmitted / saTotal) * 1000) / 10 : null;

    res.json({
      generatedAt: now.toISOString(),
      cards: {
        admissionsPending,
        admissionsUnderReview,
        tuitionUnpaidAmount: Math.round((tuitionUnpaid._sum.amount ?? 0) * 100) / 100,
        tuitionUnpaidCount: aggCount(tuitionUnpaid),
        paymentsCompleted30dAmount: Math.round((payments30d._sum.amount ?? 0) * 100) / 100,
        paymentsCompleted30dCount: aggCount(payments30d),
        studentAssignmentsSubmissionRate: submissionRate,
        atRiskHigh: h,
        atRiskMedium: m,
      },
      charts: {
        paymentsByMonth,
      },
    });
  } catch (error: any) {
    console.error('GET /admin/dashboard/kpis:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// ========== GÉNÉRATION DE BULLETINS ==========

// Générer les données pour les bulletins
router.get('/report-cards/generate-data', async (req, res) => {
  try {
    const { classId, period, academicYear } = req.query;

    if (!classId || !period || !academicYear) {
      return res.status(400).json({ error: 'classId, period et academicYear sont requis' });
    }

    // Calculer les dates de début et fin de période
    const periodDates = getPeriodDates(period as string, academicYear as string);
    
    // Récupérer tous les élèves de la classe
    const students = await prisma.student.findMany({
      where: { classId: classId as string },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
        class: {
          select: {
            name: true,
            level: true,
          },
        },
      },
    });

    // Récupérer tous les cours de la classe pour inclure les matières sans notes
    const classCourses = await prisma.course.findMany({
      where: { classId: classId as string },
      select: {
        id: true,
        name: true,
        code: true,
        teacher: {
          select: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    // Pour chaque élève, calculer les moyennes par matière
    const reportCardData = await Promise.all(
      students.map(async (student) => {
        // Récupérer toutes les notes de l'élève dans la période
        const grades = await prisma.grade.findMany({
          where: {
            studentId: student.id,
            date: {
              gte: periodDates.start,
              lte: periodDates.end,
            },
          },
          include: {
            course: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        });

        // Calculer les moyennes par cours (seulement pour les cours avec notes)
        const courseAverages: Record<string, { total: number; count: number; average: number }> = {};

        grades.forEach((grade) => {
          const courseId = grade.courseId;
          if (!courseAverages[courseId]) {
            courseAverages[courseId] = { total: 0, count: 0, average: 0 };
          }
          const gradeOn20 = (grade.score / grade.maxScore) * 20;
          courseAverages[courseId].total += gradeOn20 * grade.coefficient;
          courseAverages[courseId].count += grade.coefficient;
        });

        // Calculer la moyenne finale pour chaque cours
        Object.keys(courseAverages).forEach((courseId) => {
          const course = courseAverages[courseId];
          course.average = course.count > 0 ? course.total / course.count : 0;
        });

        // Ajouter les cours sans notes avec moyenne 0
        classCourses.forEach((course) => {
          if (!courseAverages[course.id]) {
            courseAverages[course.id] = { total: 0, count: 0, average: 0 };
          }
        });

        // Calculer la moyenne générale (seulement pour les cours avec notes)
        let totalWeightedAverage = 0;
        let totalCoefficient = 0;
        Object.entries(courseAverages).forEach(([courseId, course]) => {
          // Vérifier si ce cours a des notes
          const hasGrades = grades.some(g => g.courseId === courseId);
          if (hasGrades && course.count > 0) {
            totalWeightedAverage += course.average * course.count;
            totalCoefficient += course.count;
          }
        });
        const overallAverage = totalCoefficient > 0 ? totalWeightedAverage / totalCoefficient : 0;

        const periodAbsences = await prisma.absence.findMany({
          where: {
            studentId: student.id,
            date: { gte: periodDates.start, lte: periodDates.end },
          },
          select: { status: true, excused: true },
        });
        const absences = {
          total: periodAbsences.filter((a) => a.status === 'ABSENT').length,
          unexcused: periodAbsences.filter((a) => a.status === 'ABSENT' && !a.excused).length,
          excused: periodAbsences.filter((a) => a.status === 'ABSENT' && a.excused).length,
          late: periodAbsences.filter((a) => a.status === 'LATE').length,
        };

        return {
          studentId: student.id,
          userId: student.userId,
          studentIdNumber: student.studentId,
          gender: student.gender,
          dateOfBirth: student.dateOfBirth,
          address: student.address,
          user: student.user,
          class: student.class,
          grades,
          courseAverages,
          allCourses: classCourses.map((c) => ({
            id: c.id,
            name: c.name,
            code: c.code,
            teacherName: c.teacher?.user
              ? `${c.teacher.user.lastName} ${c.teacher.user.firstName}`.trim()
              : undefined,
          })),
          average: overallAverage,
          totalStudents: students.length,
          absences,
        };
      })
    );

    // Trier par moyenne décroissante et attribuer les rangs
    reportCardData.sort((a, b) => b.average - a.average);
    reportCardData.forEach((student: any, index) => {
      student.rank = index + 1;
    });

    await enrichReportCardsWithTermHistory(
      classId as string,
      academicYear as string,
      period as string,
      reportCardData,
    );

    res.json(reportCardData);
  } catch (error: any) {
    console.error('Erreur lors de la génération des données de bulletins:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Sauvegarder les bulletins
router.post('/report-cards/save', async (req: AuthRequest, res) => {
  try {
    const { classId, period, academicYear } = req.body;

    if (!classId || !period || !academicYear) {
      return res.status(400).json({ error: 'classId, period et academicYear sont requis' });
    }

    // Générer les données (réutiliser la logique)
    const periodDates = getPeriodDates(period, academicYear);
    
    const students = await prisma.student.findMany({
      where: { classId },
      include: {
        user: true,
      },
    });

    const changeRequests: Awaited<ReturnType<typeof createReportCardChangeRequest>>[] = [];
    let skippedUnchanged = 0;

    await Promise.all(
      students.map(async (student) => {
        const grades = await prisma.grade.findMany({
          where: {
            studentId: student.id,
            date: {
              gte: periodDates.start,
              lte: periodDates.end,
            },
          },
        });

        // Calculer la moyenne
        let totalWeightedAverage = 0;
        let totalCoefficient = 0;
        const courseAverages: Record<string, { total: number; count: number }> = {};

        grades.forEach((grade) => {
          const courseId = grade.courseId;
          if (!courseAverages[courseId]) {
            courseAverages[courseId] = { total: 0, count: 0 };
          }
          const gradeOn20 = (grade.score / grade.maxScore) * 20;
          courseAverages[courseId].total += gradeOn20 * grade.coefficient;
          courseAverages[courseId].count += grade.coefficient;
        });

        Object.values(courseAverages).forEach((course) => {
          const courseAverage = course.count > 0 ? course.total / course.count : 0;
          totalWeightedAverage += courseAverage * course.count;
          totalCoefficient += course.count;
        });

        const average = totalCoefficient > 0 ? totalWeightedAverage / totalCoefficient : 0;

        // Calculer le rang (simplifié, peut être amélioré)
        const allAverages = await Promise.all(
          students.map(async (s) => {
            const sGrades = await prisma.grade.findMany({
              where: {
                studentId: s.id,
                date: {
                  gte: periodDates.start,
                  lte: periodDates.end,
                },
              },
            });
            let sTotal = 0;
            let sCoeff = 0;
            const sCourseAvg: Record<string, { total: number; count: number }> = {};
            sGrades.forEach((g) => {
              if (!sCourseAvg[g.courseId]) sCourseAvg[g.courseId] = { total: 0, count: 0 };
              const gOn20 = (g.score / g.maxScore) * 20;
              sCourseAvg[g.courseId].total += gOn20 * g.coefficient;
              sCourseAvg[g.courseId].count += g.coefficient;
            });
            Object.values(sCourseAvg).forEach((c) => {
              const cAvg = c.count > 0 ? c.total / c.count : 0;
              sTotal += cAvg * c.count;
              sCoeff += c.count;
            });
            return sCoeff > 0 ? sTotal / sCoeff : 0;
          })
        );

        allAverages.sort((a, b) => b - a);
        const rank = allAverages.findIndex((a) => a <= average) + 1;

        const periodLabel = getPeriodLabel(period);
        
        const existingReportCard = await prisma.reportCard.findUnique({
          where: {
            studentId_period_academicYear: {
              studentId: student.id,
              period: periodLabel,
              academicYear,
            },
          },
        });

        const proposed: ReportCardPayload = {
          studentId: student.id,
          period: periodLabel,
          academicYear,
          average,
          rank,
          published: existingReportCard?.published ?? false,
          comments: existingReportCard?.comments ?? null,
        };

        if (existingReportCard) {
          const avgChanged = Math.abs(existingReportCard.average - average) > 0.001;
          const rankChanged = (existingReportCard.rank ?? 0) !== rank;
          if (!avgChanged && !rankChanged) {
            skippedUnchanged += 1;
            return;
          }
          const previous: ReportCardPayload = {
            studentId: existingReportCard.studentId,
            period: existingReportCard.period,
            academicYear: existingReportCard.academicYear,
            average: existingReportCard.average,
            rank: existingReportCard.rank,
            comments: existingReportCard.comments,
            published: existingReportCard.published,
          };
          const request = await createReportCardChangeRequest({
            kind: 'UPDATE',
            requestedByUserId: req.user!.id,
            reportCardId: existingReportCard.id,
            studentId: student.id,
            payload: proposed,
            previousPayload: previous,
          });
          changeRequests.push(request);
        } else {
          const request = await createReportCardChangeRequest({
            kind: 'CREATE',
            requestedByUserId: req.user!.id,
            studentId: student.id,
            payload: proposed,
          });
          changeRequests.push(request);
        }
      })
    );

    res.json({
      message:
        changeRequests.length > 0
          ? `${changeRequests.length} demande(s) de bulletin soumise(s) au circuit de validation (prof principal → éducateur → directeur des études).`
          : 'Aucune modification de moyenne à soumettre.',
      count: changeRequests.length,
      skippedUnchanged,
      requests: changeRequests.map((r) => ({
        id: r.id,
        studentId: r.studentId,
        status: r.status,
        statusLabel: workflowStatusLabel(r.status),
      })),
    });
  } catch (error: any) {
    const statusCode = error.statusCode ?? 500;
    console.error('Erreur lors de la sauvegarde des bulletins:', error);
    res.status(statusCode).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Obtenir les bulletins
router.get('/report-cards', async (req, res) => {
  try {
    const { classId, period, academicYear } = req.query;

    const where: any = {};
    if (classId) {
      where.student = { classId: classId as string };
    }
    if (period) {
      where.period = period as string;
    }
    if (academicYear) {
      where.academicYear = academicYear as string;
    }

    const reportCards = await prisma.reportCard.findMany({
      where,
      orderBy: [
        { academicYear: 'desc' },
        { period: 'desc' },
        { average: 'desc' },
      ],
    });

    res.json(reportCards);
  } catch (error: any) {
    console.error('Erreur lors de la récupération des bulletins:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Template par défaut des bulletins (personnalisation)
router.get('/report-cards/template/default', async (_req, res) => {
  try {
    const template = await prisma.reportCardTemplate.findFirst({
      where: { isDefault: true },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(template);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.put('/report-cards/template/default', async (req, res) => {
  try {
    const { name, description, settings } = req.body as {
      name?: string;
      description?: string;
      settings?: Record<string, unknown>;
    };

    await prisma.reportCardTemplate.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });

    const existing = await prisma.reportCardTemplate.findFirst({
      where: { name: name?.trim() || 'Template bulletin par défaut' },
      orderBy: { updatedAt: 'desc' },
    });

    const template = existing
      ? await prisma.reportCardTemplate.update({
          where: { id: existing.id },
          data: {
            description: description?.trim() || null,
            settings: (settings || {}) as any,
            isDefault: true,
          },
        })
      : await prisma.reportCardTemplate.create({
          data: {
            name: name?.trim() || 'Template bulletin par défaut',
            description: description?.trim() || null,
            settings: (settings || {}) as any,
            isDefault: true,
          },
        });

    res.json(template);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Historique résultats + progression élève
router.get('/grades/history/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, classId: true },
    });
    if (!student) return res.status(404).json({ error: 'Élève introuvable' });

    const grades = await prisma.grade.findMany({
      where: { studentId },
      include: {
        course: { select: { id: true, name: true, code: true } },
      },
      orderBy: { date: 'asc' },
    });

    const monthlyMap = new Map<string, { total: number; coeff: number }>();
    for (const g of grades) {
      const key = `${g.date.getFullYear()}-${String(g.date.getMonth() + 1).padStart(2, '0')}`;
      const value = monthlyMap.get(key) || { total: 0, coeff: 0 };
      const on20 = (g.score / g.maxScore) * 20;
      value.total += on20 * g.coefficient;
      value.coeff += g.coefficient;
      monthlyMap.set(key, value);
    }

    const progression = [...monthlyMap.entries()].map(([month, v]) => ({
      month,
      average: v.coeff > 0 ? v.total / v.coeff : 0,
    }));

    const reportCards = await prisma.reportCard.findMany({
      where: { studentId },
      orderBy: [{ academicYear: 'asc' }, { createdAt: 'asc' }],
    });

    res.json({
      studentId,
      history: grades,
      progression,
      reportCards,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Classements et rangs par classe / période
router.get('/grades/rankings', async (req, res) => {
  try {
    const { classId, period = 'trim1', academicYear } = req.query as {
      classId?: string;
      period?: string;
      academicYear?: string;
    };
    if (!classId || !academicYear) {
      return res.status(400).json({ error: 'classId et academicYear sont requis' });
    }

    const { rows, periodLabel, periodDates } = await computeClassBulletinRanks(
      classId,
      period,
      academicYear
    );

    const students = await prisma.student.findMany({
      where: { classId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    const byId = new Map(students.map((s) => [s.id, s]));

    res.json({
      classId,
      period,
      periodLabel,
      periodDates,
      rows: rows.map((r) => ({
        ...r,
        student: byId.get(r.studentId) || null,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Conseils de classe
router.get('/class-councils', async (req, res) => {
  try {
    const { classId, period, academicYear } = req.query;
    const councils = await prisma.classCouncilSession.findMany({
      where: {
        ...(classId ? { classId: classId as string } : {}),
        ...(period ? { period: period as string } : {}),
        ...(academicYear ? { academicYear: academicYear as string } : {}),
      },
      include: {
        class: { select: { id: true, name: true, level: true } },
      },
      orderBy: { meetingDate: 'desc' },
    });
    res.json(councils);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.post('/class-councils', async (req, res) => {
  try {
    const {
      classId,
      period,
      academicYear,
      title,
      meetingDate,
      summary,
      decisions,
      recommendations,
    } = req.body;
    if (!classId || !period || !academicYear || !meetingDate) {
      return res.status(400).json({
        error: 'classId, period, academicYear et meetingDate sont requis',
      });
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
        createdById: (req as any).user?.id || null,
      },
      include: { class: { select: { id: true, name: true, level: true } } },
    });
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.put('/class-councils/:id', async (req, res) => {
  try {
    const {
      title,
      meetingDate,
      summary,
      decisions,
      recommendations,
    } = req.body;

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
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// Fonctions utilitaires
function getPeriodDates(period: string, academicYear: string): { start: Date; end: Date } {
  const [yearStart, yearEnd] = academicYear.split('-').map(Number);
  let start: Date;
  let end: Date;

  switch (period) {
    case 'trim1':
      start = new Date(yearStart, 8, 1); // Septembre
      end = new Date(yearStart, 10, 30); // Novembre
      break;
    case 'trim2':
      start = new Date(yearStart, 11, 1); // Décembre
      end = new Date(yearEnd, 1, 28); // Février
      break;
    case 'trim3':
      start = new Date(yearEnd, 2, 1); // Mars
      end = new Date(yearEnd, 6, 30); // Juillet
      break;
    case 'sem1':
      start = new Date(yearStart, 8, 1); // Septembre
      end = new Date(yearEnd, 1, 28); // Février
      break;
    case 'sem2':
      start = new Date(yearEnd, 2, 1); // Mars
      end = new Date(yearEnd, 6, 30); // Juillet
      break;
    default:
      start = new Date(yearStart, 8, 1);
      end = new Date(yearEnd, 6, 30);
  }

  return { start, end };
}

function getPeriodLabel(period: string): string {
  const labels: Record<string, string> = {
    trim1: 'Trimestre 1',
    trim2: 'Trimestre 2',
    trim3: 'Trimestre 3',
    sem1: 'Semestre 1',
    sem2: 'Semestre 2',
  };
  return labels[period] || period;
}

// ========== GESTION DES FRAIS DE SCOLARITÉ ==========

// Obtenir tous les frais de scolarité
router.get('/tuition-fees', async (req: SchoolContextRequest, res) => {
  try {
    const { studentId, classId, academicYear, period, isPaid, grouped } = req.query;
    const schoolId = req.schoolId!;

    const where: Record<string, unknown> = {};
    if (studentId) {
      where.studentId = studentId as string;
    }
    if (classId) {
      where.student = { classId: classId as string };
    }
    if (academicYear) {
      where.academicYear = academicYear as string;
    }
    if (period) {
      where.period = period as string;
    }
    if (isPaid !== undefined) {
      where.isPaid = isPaid === 'true';
    }
    if (req.query.feeType) {
      where.feeType = req.query.feeType as string;
    }

    const scopedWhere = mergeWhereWithSchoolScope(where, scopedTuitionFeeWhere(schoolId));

    // Si grouped=true, retourner les frais regroupés par élève et parent
    if (grouped === 'true') {
      const tuitionFees = await prisma.tuitionFee.findMany({
        where: scopedWhere,
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
            },
          },
          payments: {
            include: {
              payer: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  role: true,
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Regrouper par élève
      const groupedByStudent: { [key: string]: any } = {};
      
      tuitionFees.forEach((fee: any) => {
        const studentId = fee.studentId;
        if (!groupedByStudent[studentId]) {
          groupedByStudent[studentId] = {
            student: {
              id: fee.student.id,
              name: `${fee.student.user.firstName} ${fee.student.user.lastName}`,
              email: fee.student.user.email,
              class: fee.student.class?.name || 'Non assigné',
              level: fee.student.class?.level || '',
            },
            fees: [],
            totalAmount: 0,
            totalPaid: 0,
            byParent: {} as { [key: string]: any },
          };
        }
        
        groupedByStudent[studentId].fees.push(fee);
        groupedByStudent[studentId].totalAmount += fee.amount;
        
        // Calculer le total payé pour ce frais
        const feeTotalPaid = fee.payments
          .filter((p: any) => p.status === 'COMPLETED')
          .reduce((sum: number, p: any) => sum + p.amount, 0);
        groupedByStudent[studentId].totalPaid += feeTotalPaid;
        
        // Regrouper les paiements par parent pour cet élève
        fee.payments.forEach((payment: any) => {
          const payerId = payment.payerId;
          if (payment.payer.role === 'PARENT' || payment.payer.role === 'STUDENT') {
            if (!groupedByStudent[studentId].byParent[payerId]) {
              groupedByStudent[studentId].byParent[payerId] = {
                payer: {
                  id: payment.payer.id,
                  name: `${payment.payer.firstName} ${payment.payer.lastName}`,
                  email: payment.payer.email,
                  role: payment.payer.role,
                },
                payments: [],
                totalPaid: 0,
              };
            }
            
            groupedByStudent[studentId].byParent[payerId].payments.push(payment);
            if (payment.status === 'COMPLETED') {
              groupedByStudent[studentId].byParent[payerId].totalPaid += payment.amount;
            }
          }
        });
      });

      // Convertir en tableau et calculer les totaux par parent
      const result = Object.values(groupedByStudent).map((group: any) => {
        // Convertir byParent en tableau
        group.byParent = Object.values(group.byParent);
        // Calculer le montant restant
        group.remainingAmount = group.totalAmount - group.totalPaid;
        group.paymentProgress = group.totalAmount > 0 
          ? (group.totalPaid / group.totalAmount) * 100 
          : 0;
        return group;
      });

      return res.json(result);
    }

    // Sinon, retourner la liste simple
    const tuitionFees = await prisma.tuitionFee.findMany({
      where: scopedWhere,
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

    res.json(tuitionFees);
  } catch (error: any) {
    console.error('Erreur lors de la récupération des frais de scolarité:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Créer un frais de scolarité pour un élève
router.post('/tuition-fees', async (req: SchoolContextRequest, res) => {
  try {
    console.log('Requête reçue pour créer un frais de scolarité:', req.body);
    const {
      studentId,
      academicYear,
      period,
      amount,
      dueDate,
      description,
      feeType,
      billingPeriod,
      baseAmount,
      discountAmount,
      scholarshipLabel,
      catalogId,
      scheduleTemplateId,
      installmentIndex,
    } = req.body;

    if (!studentId || !academicYear || !period || amount == null || !dueDate) {
      console.error('Champs manquants:', { studentId, academicYear, period, amount, dueDate });
      return res.status(400).json({ error: 'studentId, academicYear, period, amount et dueDate sont requis' });
    }

    // Vérifier que l'élève existe
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      console.error('Élève non trouvé:', studentId);
      return res.status(404).json({ error: 'Élève non trouvé' });
    }

    try {
      await assertStudentInSchool(studentId, req.schoolId);
    } catch (e) {
      if (e instanceof SchoolAccessDeniedError) {
        return res.status(e.status).json({ error: e.message });
      }
      throw e;
    }

    // Vérifier si un frais similaire existe déjà
    const existingFee = await prisma.tuitionFee.findFirst({
      where: {
        studentId,
        academicYear,
        period,
      },
    });

    if (existingFee) {
      console.error('Frais déjà existant pour:', { studentId, academicYear, period });
      return res.status(400).json({ error: 'Un frais de scolarité existe déjà pour cet élève, cette période et cette année scolaire' });
    }

    let amountValue: number;
    let baseVal: number;
    let disc: number;
    let resolvedCatalogId: string | null = catalogId ? String(catalogId) : null;
    try {
      const enforced = await enforceTuitionFeeAmounts({
        studentId,
        academicYear: String(academicYear),
        feeType: feeType ?? 'TUITION',
        amount,
        baseAmount,
        discountAmount,
        catalogId: resolvedCatalogId,
      });
      amountValue = enforced.amount;
      baseVal = enforced.baseAmount;
      disc = enforced.discountAmount;
      resolvedCatalogId = enforced.catalogId;
    } catch (e) {
      if (e instanceof TuitionLevelAmountError) {
        return res.status(e.status).json({ error: e.message });
      }
      throw e;
    }

    const dueDateValue = new Date(dueDate);
    if (isNaN(dueDateValue.getTime())) {
      return res.status(400).json({ error: 'La date d\'échéance est invalide' });
    }

    // Préparer les données pour Prisma
    const tuitionFeeData = {
      studentId,
      academicYear: String(academicYear),
      period: String(period),
      amount: amountValue,
      dueDate: dueDateValue,
      description: description ? String(description) : null,
      isPaid: false,
      ...(feeType && { feeType }),
      ...(billingPeriod && { billingPeriod }),
      baseAmount: baseVal,
      discountAmount: disc,
      ...(scholarshipLabel && { scholarshipLabel: String(scholarshipLabel) }),
      ...(resolvedCatalogId && { catalogId: resolvedCatalogId }),
      ...(scheduleTemplateId && { scheduleTemplateId: String(scheduleTemplateId) }),
      ...(installmentIndex != null && { installmentIndex: Number(installmentIndex) }),
    };

    console.log('Données à insérer dans Prisma:', tuitionFeeData);

    // Créer le frais de scolarité
    const tuitionFee = await prisma.tuitionFee.create({
      data: tuitionFeeData,
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
      },
    });

    console.log('Frais de scolarité créé avec succès:', tuitionFee.id);

    notifyTuitionFeeChanged({
      studentId: tuitionFee.studentId,
      period: tuitionFee.period,
      academicYear: tuitionFee.academicYear,
      amount: tuitionFee.amount,
      dueDate: tuitionFee.dueDate,
      kind: 'created',
    }).catch((err) => console.error('Notification frais (création):', err));

    res.status(201).json(tuitionFee);
  } catch (error: any) {
    console.error('Erreur lors de la création du frais de scolarité:', error);
    console.error('Stack:', error.stack);
    console.error('Body reçu:', req.body);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      code: error.code,
    });
  }
});

// Créer des frais de scolarité pour plusieurs élèves (par classe)
router.post('/tuition-fees/bulk', async (req: SchoolContextRequest, res) => {
  try {
    const {
      classId,
      academicYear,
      period,
      amount,
      dueDate,
      description,
      studentIds,
      feeType,
      billingPeriod,
      baseAmount,
      discountAmount,
      scholarshipLabel,
      catalogId,
      scheduleTemplateId,
    } = req.body;

    if (!academicYear || !period || !dueDate) {
      return res.status(400).json({ error: 'academicYear, period et dueDate sont requis' });
    }

    const discBulk = discountAmount != null ? Math.max(0, parseFloat(String(discountAmount))) : 0;
    const feeTypeBulk = feeType ?? 'TUITION';
    const useLevelRates = feeTypeBulk === 'TUITION';

    if (!classId && (!studentIds || studentIds.length === 0)) {
      return res.status(400).json({ error: 'classId ou studentIds est requis' });
    }

    if (classId) {
      try {
        await assertClassInSchool(String(classId), req.schoolId);
      } catch (e) {
        if (e instanceof SchoolAccessDeniedError) {
          return res.status(e.status).json({ error: e.message });
        }
        throw e;
      }
    }

    if (!useLevelRates && amount == null) {
      return res.status(400).json({ error: 'amount est requis pour ce type de frais' });
    }

    let amountNet = amount != null ? parseFloat(String(amount)) : 0;
    const baseBulk = baseAmount != null ? parseFloat(String(baseAmount)) : null;
    if (!useLevelRates) {
      if (baseBulk != null && !Number.isNaN(baseBulk)) {
        amountNet = Math.max(0, Math.round(baseBulk - discBulk));
      } else if (discBulk > 0) {
        amountNet = Math.max(0, Math.round(amountNet - discBulk));
      }
    }

    // Récupérer les élèves
    let students;
    if (classId) {
      students = await prisma.student.findMany({
        where: {
          classId: classId as string,
          isActive: true,
        },
        include: { class: { select: { level: true, name: true } } },
      });
    } else {
      students = await prisma.student.findMany({
        where: {
          id: { in: studentIds },
          isActive: true,
        },
        include: { class: { select: { level: true, name: true } } },
      });
    }

    if (students.length === 0) {
      return res.status(404).json({ error: 'Aucun élève trouvé' });
    }

    const createdFees: any[] = [];
    const skippedFees: Array<{ studentId: string; reason: string }> = [];

    for (const student of students) {
      // Vérifier si un frais similaire existe déjà
      const existingFee = await prisma.tuitionFee.findFirst({
        where: {
          studentId: student.id,
          academicYear,
          period,
        },
      });

      if (existingFee) {
        skippedFees.push({
          studentId: student.id,
          reason: 'Frais déjà existant',
        });
        continue;
      }

      let lineAmount = amountNet;
      let lineBase = baseBulk != null && !Number.isNaN(baseBulk) ? Math.round(baseBulk) : amountNet;
      let lineCatalogId = catalogId ? String(catalogId) : null;

      if (useLevelRates) {
        try {
          const enforced = await enforceTuitionFeeAmounts({
            studentId: student.id,
            academicYear: String(academicYear),
            feeType: 'TUITION',
            discountAmount: discBulk,
            catalogId: lineCatalogId,
          });
          lineAmount = enforced.amount;
          lineBase = enforced.baseAmount;
          lineCatalogId = enforced.catalogId;
        } catch (e) {
          skippedFees.push({
            studentId: student.id,
            reason: e instanceof TuitionLevelAmountError ? e.message : 'Montant niveau introuvable',
          });
          continue;
        }
      }

      // Créer le frais de scolarité
      const tuitionFee = await prisma.tuitionFee.create({
        data: {
          studentId: student.id,
          academicYear,
          period,
          amount: lineAmount,
          dueDate: new Date(dueDate),
          description: description || null,
          isPaid: false,
          feeType: feeTypeBulk,
          ...(billingPeriod && { billingPeriod }),
          baseAmount: lineBase,
          discountAmount: discBulk,
          ...(scholarshipLabel && { scholarshipLabel: String(scholarshipLabel) }),
          ...(lineCatalogId && { catalogId: lineCatalogId }),
          ...(scheduleTemplateId && { scheduleTemplateId: String(scheduleTemplateId) }),
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

      createdFees.push(tuitionFee);

      notifyTuitionFeeChanged({
        studentId: tuitionFee.studentId,
        period: tuitionFee.period,
        academicYear: tuitionFee.academicYear,
        amount: tuitionFee.amount,
        dueDate: tuitionFee.dueDate,
        kind: 'created',
      }).catch((err) => console.error('Notification frais (lot):', err));
    }

    res.status(201).json({
      message: 'Frais de scolarité créés avec succès',
      created: createdFees.length,
      skipped: skippedFees.length,
      details: {
        created: createdFees,
        skipped: skippedFees,
      },
    });
  } catch (error: any) {
    console.error('Erreur lors de la création en masse des frais de scolarité:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Mettre à jour un frais de scolarité
router.put('/tuition-fees/:id', async (req: SchoolContextRequest, res) => {
  try {
    const { id } = req.params;
    try {
      await assertTuitionFeeInSchool(id, req.schoolId);
    } catch (e) {
      if (e instanceof SchoolAccessDeniedError) {
        return res.status(e.status).json({ error: e.message });
      }
      throw e;
    }
    const {
      academicYear,
      period,
      amount,
      dueDate,
      description,
      isPaid,
      feeType,
      billingPeriod,
      baseAmount,
      discountAmount,
      scholarshipLabel,
      catalogId,
      scheduleTemplateId,
      installmentIndex,
    } = req.body;

    const tuitionFee = await prisma.tuitionFee.findUnique({
      where: { id },
    });

    if (!tuitionFee) {
      return res.status(404).json({ error: 'Frais de scolarité non trouvé' });
    }

    const effectiveFeeType = feeType !== undefined ? feeType : tuitionFee.feeType;
    let computedAmount = Number(tuitionFee.amount);
    let nextBaseParsed =
      baseAmount !== undefined ? parseFloat(String(baseAmount)) : Number(tuitionFee.baseAmount ?? tuitionFee.amount);
    let nextDisc =
      discountAmount !== undefined
        ? Math.max(0, parseFloat(String(discountAmount)))
        : Number(tuitionFee.discountAmount ?? 0);
    let nextCatalogId =
      catalogId !== undefined ? (catalogId ? String(catalogId) : null) : tuitionFee.catalogId;

    const amountsTouched =
      amount !== undefined || baseAmount !== undefined || discountAmount !== undefined || feeType !== undefined;

    if (effectiveFeeType === 'TUITION' && amountsTouched) {
      try {
        const enforced = await enforceTuitionFeeAmounts({
          studentId: tuitionFee.studentId,
          academicYear: academicYear ? String(academicYear) : tuitionFee.academicYear,
          feeType: 'TUITION',
          amount,
          baseAmount: nextBaseParsed,
          discountAmount: nextDisc,
          catalogId: nextCatalogId,
        });
        computedAmount = enforced.amount;
        nextBaseParsed = enforced.baseAmount;
        nextDisc = enforced.discountAmount;
        nextCatalogId = enforced.catalogId;
      } catch (e) {
        if (e instanceof TuitionLevelAmountError) {
          return res.status(e.status).json({ error: e.message });
        }
        throw e;
      }
    } else if (amountsTouched) {
      if (nextBaseParsed !== undefined && !Number.isNaN(nextBaseParsed)) {
        computedAmount = Math.max(0, Math.round(nextBaseParsed - nextDisc));
      } else if (amount !== undefined) {
        const a = parseFloat(String(amount));
        if (!Number.isNaN(a)) computedAmount = Math.max(0, Math.round(a));
      } else if (discountAmount !== undefined && tuitionFee.baseAmount != null) {
        computedAmount = Math.max(0, Math.round(Number(tuitionFee.baseAmount) - nextDisc));
      }
    }

    const previousAmount = Number(tuitionFee.amount);

    const updatedTuitionFee = await prisma.tuitionFee.update({
      where: { id },
      data: {
        ...(academicYear && { academicYear }),
        ...(period && { period }),
        ...(amount !== undefined || baseAmount !== undefined || discountAmount !== undefined
          ? { amount: computedAmount }
          : {}),
        ...(dueDate && { dueDate: new Date(dueDate) }),
        ...(description !== undefined && { description }),
        ...(isPaid !== undefined && { isPaid }),
        ...(feeType !== undefined && { feeType }),
        ...(billingPeriod !== undefined && { billingPeriod }),
        ...(amountsTouched && {
          baseAmount: nextBaseParsed,
          discountAmount: nextDisc,
          ...(effectiveFeeType === 'TUITION' && nextCatalogId != null && { catalogId: nextCatalogId }),
        }),
        ...(scholarshipLabel !== undefined && {
          scholarshipLabel: scholarshipLabel ? String(scholarshipLabel) : null,
        }),
        ...(catalogId !== undefined && effectiveFeeType !== 'TUITION' && { catalogId: catalogId || null }),
        ...(scheduleTemplateId !== undefined && { scheduleTemplateId: scheduleTemplateId || null }),
        ...(installmentIndex !== undefined && {
          installmentIndex: installmentIndex != null ? Number(installmentIndex) : null,
        }),
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
        payments: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    notifyTuitionFeeChanged({
      studentId: updatedTuitionFee.studentId,
      period: updatedTuitionFee.period,
      academicYear: updatedTuitionFee.academicYear,
      amount: updatedTuitionFee.amount,
      dueDate: updatedTuitionFee.dueDate,
      kind: 'updated',
      previousAmount,
    }).catch((err) => console.error('Notification frais (mise à jour):', err));

    res.json(updatedTuitionFee);
  } catch (error: any) {
    console.error('Erreur lors de la mise à jour du frais de scolarité:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Supprimer un frais de scolarité
router.delete('/tuition-fees/:id', async (req: SchoolContextRequest, res) => {
  try {
    const { id } = req.params;
    try {
      await assertTuitionFeeInSchool(id, req.schoolId);
    } catch (e) {
      if (e instanceof SchoolAccessDeniedError) {
        return res.status(e.status).json({ error: e.message });
      }
      throw e;
    }

    const tuitionFee = await prisma.tuitionFee.findUnique({
      where: { id },
    });

    if (!tuitionFee) {
      return res.status(404).json({ error: 'Frais de scolarité non trouvé' });
    }

    // Supprimer les paiements associés
    await prisma.payment.deleteMany({
      where: { tuitionFeeId: id },
    });

    // Supprimer le frais de scolarité
    await prisma.tuitionFee.delete({
      where: { id },
    });

    res.json({ message: 'Frais de scolarité supprimé avec succès' });
  } catch (error: any) {
    console.error('Erreur lors de la suppression du frais de scolarité:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Créer des frais de scolarité de test
router.post('/tuition-fees/create-test', async (req, res) => {
  try {
    // Récupérer tous les étudiants actifs
    const students = await prisma.student.findMany({
      where: {
        isActive: true,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (students.length === 0) {
      return res.status(404).json({ error: 'Aucun étudiant actif trouvé' });
    }

    // Année scolaire actuelle
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const academicYear = currentMonth >= 8 
      ? `${currentYear}-${currentYear + 1}` 
      : `${currentYear - 1}-${currentYear}`;

    // Périodes possibles
    const periods = [
      'Trimestre 1',
      'Trimestre 2',
      'Trimestre 3',
      'Semestre 1',
      'Semestre 2',
      'Frais d\'inscription',
      'Frais de scolarité annuelle',
    ];

    // Montants possibles (en FCFA)
    const amounts = [50000, 75000, 100000, 125000, 150000, 200000, 250000];

    let createdCount = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let overdueCount = 0;

    for (const student of students) {
      // Créer 2-4 frais par étudiant
      const numFees = Math.floor(Math.random() * 3) + 2;

      for (let i = 0; i < numFees; i++) {
        const period = periods[Math.floor(Math.random() * periods.length)];
        const amount = amounts[Math.floor(Math.random() * amounts.length)];
        
        // Générer une date d'échéance
        const dueDate = new Date();
        const daysOffset = Math.floor(Math.random() * 90) - 30; // Entre -30 et +60 jours
        dueDate.setDate(dueDate.getDate() + daysOffset);

        // Déterminer le statut (30% payé, 50% en attente, 20% en retard)
        const statusRand = Math.random();
        let isPaid = false;
        let paidAt: Date | null = null;

        if (statusRand < 0.3) {
          // Frais payé
          isPaid = true;
          paidAt = new Date(dueDate);
          paidAt.setDate(paidAt.getDate() - Math.floor(Math.random() * 30)); // Payé avant l'échéance
          paidCount++;
        } else if (statusRand < 0.8) {
          // Frais en attente
          pendingCount++;
        } else {
          // Frais en retard
          overdueCount++;
        }

        // Vérifier si un frais similaire existe déjà
        const existingFee = await prisma.tuitionFee.findFirst({
          where: {
            studentId: student.id,
            academicYear,
            period,
          },
        });

        if (existingFee) {
          continue; // Ignorer si le frais existe déjà
        }

        // Créer le frais de scolarité
        const tuitionFee = await prisma.tuitionFee.create({
          data: {
            studentId: student.id,
            academicYear,
            period,
            amount,
            dueDate,
            description: `Frais de scolarité pour ${period} - ${academicYear}`,
            isPaid,
            paidAt,
          },
        });

        createdCount++;

        // Si le frais est payé, créer un paiement associé
        if (isPaid && paidAt) {
          const paymentMethods = ['CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CASH'];
          const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];

          await prisma.payment.create({
            data: {
              tuitionFeeId: tuitionFee.id,
              studentId: student.id,
              payerId: student.userId,
              payerRole: 'STUDENT',
              amount,
              paymentMethod: paymentMethod as any,
              status: 'COMPLETED',
              paymentReference: `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
              transactionId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
              paidAt,
            },
          });
        }
      }
    }

    res.json({
      message: 'Frais de scolarité de test créés avec succès',
      summary: {
        totalCreated: createdCount,
        paid: paidCount,
        pending: pendingCount,
        overdue: overdueCount,
        students: students.length,
      },
    });
  } catch (error: any) {
    console.error('Erreur lors de la création des frais de scolarité de test:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ========== GESTION DES PAIEMENTS ==========

// Obtenir tous les paiements regroupés par élève et par parent
router.get('/payments/grouped', async (req: SchoolContextRequest, res) => {
  try {
    const schoolId = req.schoolId!;
    const payments = await prisma.payment.findMany({
      where: scopedPaymentWhere(schoolId),
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
        payer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        tuitionFee: {
          select: {
            id: true,
            period: true,
            academicYear: true,
            amount: true,
            dueDate: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Regrouper par élève
    const groupedByStudent: { [key: string]: any } = {};
    
    payments.forEach((payment: any) => {
      const studentId = payment.studentId;
      if (!groupedByStudent[studentId]) {
        groupedByStudent[studentId] = {
          student: {
            id: payment.student.id,
            name: `${payment.student.user.firstName} ${payment.student.user.lastName}`,
            email: payment.student.user.email,
            class: payment.student.class?.name || 'Non assigné',
            level: payment.student.class?.level || '',
          },
          payments: [],
          totalPaid: 0,
          byParent: {} as { [key: string]: any },
        };
      }
      
      groupedByStudent[studentId].payments.push(payment);
      if (payment.status === 'COMPLETED') {
        groupedByStudent[studentId].totalPaid += payment.amount;
      }
      
      // Regrouper par parent pour cet élève
      const payerId = payment.payerId;
      if (!groupedByStudent[studentId].byParent[payerId]) {
        groupedByStudent[studentId].byParent[payerId] = {
          parent: {
            id: payment.payer.id,
            name: `${payment.payer.firstName} ${payment.payer.lastName}`,
            email: payment.payer.email,
            role: payment.payer.role,
          },
          payments: [],
          totalPaid: 0,
        };
      }
      
      groupedByStudent[studentId].byParent[payerId].payments.push(payment);
      if (payment.status === 'COMPLETED') {
        groupedByStudent[studentId].byParent[payerId].totalPaid += payment.amount;
      }
    });

    // Convertir en tableau et calculer les totaux par parent
    const result = Object.values(groupedByStudent).map((group: any) => {
      // Convertir byParent en tableau
      group.byParent = Object.values(group.byParent);
      return group;
    });

    res.json(result);
  } catch (error: any) {
    console.error('Erreur lors de la récupération des paiements regroupés:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Obtenir tous les paiements (liste simple)
router.get('/payments', async (req: SchoolContextRequest, res) => {
  try {
    const schoolId = req.schoolId!;
    const payments = await prisma.payment.findMany({
      where: scopedPaymentWhere(schoolId),
      include: {
        student: {
          select: {
            id: true,
            studentId: true,
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
        payer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        tuitionFee: {
          select: {
            id: true,
            period: true,
            academicYear: true,
            amount: true,
            dueDate: true,
            description: true,
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

router.get('/payments/pending-cash', async (req: SchoolContextRequest, res) => {
  try {
    const rows = await listPendingCashPayments(prisma, req.schoolId);
    res.json(rows);
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur serveur' });
  }
});

router.post('/payments/:id/validate-cash', async (req: SchoolContextRequest, res) => {
  try {
    const admin = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, firstName: true, lastName: true, role: true },
    });
    if (!admin) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const name = [admin.firstName, admin.lastName].filter(Boolean).join(' ').trim() || 'Administration';
    const payment = await validateCashPayment(prisma, req.params.id, {
      id: admin.id,
      role: admin.role,
      name,
    }, req.schoolId);
    res.json({ payment, message: 'Paiement espèces validé et pris en compte' });
  } catch (e: unknown) {
    if (e instanceof SchoolAccessDeniedError) {
      return res.status(e.status).json({ error: e.message });
    }
    const err = e as Error & { status?: number };
    if (err.status && err.status !== 500) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
});

router.post('/payments/:id/reject-cash', async (req: SchoolContextRequest, res) => {
  try {
    const admin = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { firstName: true, lastName: true },
    });
    const name = [admin?.firstName, admin?.lastName].filter(Boolean).join(' ').trim() || 'Administration';
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    const payment = await rejectCashPayment(prisma, req.params.id, { name }, reason, req.schoolId);
    res.json({ payment, message: 'Déclaration espèces refusée' });
  } catch (e: unknown) {
    if (e instanceof SchoolAccessDeniedError) {
      return res.status(e.status).json({ error: e.message });
    }
    const err = e as Error & { status?: number };
    if (err.status && err.status !== 500) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
});

/** Numérotation automatique des factures (lignes de frais sans numéro). */
router.post('/tuition-fees/assign-invoices', async (req, res) => {
  try {
    const { academicYear, prefix, limit } = req.body ?? {};
    const result = await assignTuitionFeeInvoiceNumbers({
      academicYear: academicYear != null ? String(academicYear) : null,
      prefix: prefix != null ? String(prefix) : undefined,
      limit: limit != null ? Number(limit) : undefined,
    });
    res.json({
      message: `${result.updated} facture(s) numérotée(s)`,
      ...result,
    });
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Erreur serveur' });
  }
});

/** Déclenche les relances automatiques (notifications in-app / e-mail). */
router.post('/tuition-fees/run-reminders', async (_req, res) => {
  try {
    const result = await runAutomaticTuitionReminders();
    res.json({
      message: `${result.notifiedFees} ligne(s) relancée(s), ${result.parentNotifications} notification(s) parent approx.`,
      ...result,
    });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur serveur' });
  }
});

/** Enregistrement d’un encaissement au guichet (espèces ou virement sur place). */
router.post('/tuition-fees/counter-payment', async (req, res) => {
  try {
    const adminId = req.user!.id;
    const { tuitionFeeId, amount, paymentMethod, notes } = req.body ?? {};
    if (!tuitionFeeId || amount == null || !paymentMethod) {
      return res.status(400).json({ error: 'tuitionFeeId, amount et paymentMethod sont requis' });
    }
    const method = String(paymentMethod).toUpperCase();
    if (method !== 'CASH' && method !== 'BANK_TRANSFER') {
      return res.status(400).json({ error: 'paymentMethod doit être CASH ou BANK_TRANSFER' });
    }
    const payAmount = Math.round(Number(amount));
    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      return res.status(400).json({ error: 'Montant invalide' });
    }

    const fee = await prisma.tuitionFee.findUnique({
      where: { id: String(tuitionFeeId) },
      include: { student: { select: { id: true } } },
    });
    if (!fee) return res.status(404).json({ error: 'Ligne de frais introuvable' });

    const completed = await prisma.payment.findMany({
      where: { tuitionFeeId: fee.id, status: 'COMPLETED' },
    });
    const totalPaid = completed.reduce((s, p) => s + p.amount, 0);
    const remaining = Math.max(0, Math.round(fee.amount) - totalPaid);
    if (remaining <= 0) {
      return res.status(400).json({ error: 'Cette ligne est déjà soldée' });
    }
    if (payAmount > remaining) {
      return res.status(400).json({ error: `Montant max : ${remaining} FCFA` });
    }

    const paymentReference = `GUI-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const noteParts = [`Guichet / administration`, notes ? String(notes) : null].filter(Boolean);

    const payment = await prisma.payment.create({
      data: {
        tuitionFeeId: fee.id,
        studentId: fee.studentId,
        payerId: adminId,
        payerRole: 'ADMIN',
        amount: payAmount,
        paymentMethod: method as 'CASH' | 'BANK_TRANSFER',
        status: 'COMPLETED',
        paymentReference,
        transactionId: `GUICHET-${Date.now()}`,
        receiptUrl: autoReceiptUrl(paymentReference),
        notes: noteParts.join(' — '),
        paidAt: new Date(),
      },
    });

    const newTotal = totalPaid + payAmount;
    const isFullyPaid = newTotal >= fee.amount;
    await prisma.tuitionFee.update({
      where: { id: fee.id },
      data: {
        isPaid: isFullyPaid,
        paidAt: isFullyPaid ? new Date() : fee.paidAt,
      },
    });

    res.status(201).json({ payment, message: 'Paiement guichet enregistré' });
  } catch (e: unknown) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur serveur' });
  }
});

// ========== INSCRIPTIONS & ADMISSIONS ==========

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


// ========== GESTION MATÉRIELLE ==========

router.get('/material/rooms', async (req, res) => {
  try {
    const { search, isActive } = req.query;
    const rooms = await prisma.materialRoom.findMany({
      where: {
        ...(search &&
          typeof search === 'string' &&
          search.trim() && {
            OR: [
              { name: { contains: search.trim() } },
              { code: { contains: search.trim() } },
              { building: { contains: search.trim() } },
            ],
          }),
        ...(isActive !== undefined && { isActive: isActive === 'true' }),
      },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            equipmentStored: true,
            reservations: true,
          },
        },
      },
    });
    res.json(rooms);
  } catch (error: any) {
    console.error('GET /material/rooms:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.post('/material/rooms', async (req, res) => {
  try {
    const { name, code, building, floor, capacity, description, isActive } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Le nom de la salle est requis' });
    }
    const room = await prisma.materialRoom.create({
      data: {
        name: name.trim(),
        code: code?.trim() || null,
        building: building?.trim() || null,
        floor: floor?.trim() || null,
        capacity: capacity != null && capacity !== '' ? Number(capacity) : null,
        description: description?.trim() || null,
        isActive: isActive !== false,
      },
    });
    res.status(201).json(room);
  } catch (error: any) {
    console.error('POST /material/rooms:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.put('/material/rooms/:id', async (req, res) => {
  try {
    const existing = await prisma.materialRoom.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Salle introuvable' });
    }
    const { name, code, building, floor, capacity, description, isActive } = req.body;
    const room = await prisma.materialRoom.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(code !== undefined && { code: code ? String(code).trim() : null }),
        ...(building !== undefined && { building: building ? String(building).trim() : null }),
        ...(floor !== undefined && { floor: floor ? String(floor).trim() : null }),
        ...(capacity !== undefined && {
          capacity: capacity != null && capacity !== '' ? Number(capacity) : null,
        }),
        ...(description !== undefined && { description: description ? String(description).trim() : null }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });
    res.json(room);
  } catch (error: any) {
    console.error('PUT /material/rooms/:id:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.delete('/material/rooms/:id', async (req, res) => {
  try {
    const existing = await prisma.materialRoom.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Salle introuvable' });
    }
    const [eqCount, maintCount, resCount] = await Promise.all([
      prisma.materialEquipment.count({ where: { roomId: req.params.id } }),
      prisma.materialMaintenance.count({ where: { roomId: req.params.id } }),
      prisma.materialRoomReservation.count({ where: { roomId: req.params.id } }),
    ]);
    if (eqCount > 0 || maintCount > 0 || resCount > 0) {
      await prisma.materialRoom.update({
        where: { id: req.params.id },
        data: { isActive: false },
      });
      return res.json({ ok: true, deactivated: true });
    }
    await prisma.materialRoom.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (error: any) {
    console.error('DELETE /material/rooms/:id:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.get('/material/equipment', async (req, res) => {
  try {
    const { search, category, roomId, isActive } = req.query;
    const list = await prisma.materialEquipment.findMany({
      where: {
        ...(search &&
          typeof search === 'string' &&
          search.trim() && {
            OR: [
              { name: { contains: search.trim() } },
              { serialNumber: { contains: search.trim() } },
            ],
          }),
        ...(category && typeof category === 'string' && category.trim() && { category: category.trim() }),
        ...(roomId && typeof roomId === 'string' && { roomId }),
        ...(isActive !== undefined && { isActive: isActive === 'true' }),
      },
      include: { room: { select: { id: true, name: true, code: true } } },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    res.json(list);
  } catch (error: any) {
    console.error('GET /material/equipment:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.post('/material/equipment', async (req, res) => {
  try {
    const { roomId, name, category, serialNumber, quantity, condition, notes, purchasedAt, isActive } =
      req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Le nom de l’équipement est requis' });
    }
    if (!category || typeof category !== 'string' || !category.trim()) {
      return res.status(400).json({ error: 'La catégorie est requise' });
    }
    if (roomId) {
      const r = await prisma.materialRoom.findUnique({ where: { id: roomId } });
      if (!r) return res.status(400).json({ error: 'Salle de stockage invalide' });
    }
    const eq = await prisma.materialEquipment.create({
      data: {
        roomId: roomId || null,
        name: name.trim(),
        category: category.trim(),
        serialNumber: serialNumber?.trim() || null,
        quantity: Math.max(1, Number(quantity) || 1),
        condition: condition || 'GOOD',
        notes: notes?.trim() || null,
        purchasedAt: purchasedAt ? new Date(purchasedAt) : null,
        isActive: isActive !== false,
      },
      include: { room: { select: { id: true, name: true, code: true } } },
    });
    res.status(201).json(eq);
  } catch (error: any) {
    console.error('POST /material/equipment:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.put('/material/equipment/:id', async (req, res) => {
  try {
    const existing = await prisma.materialEquipment.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Équipement introuvable' });
    }
    const { roomId, name, category, serialNumber, quantity, condition, notes, purchasedAt, isActive } =
      req.body;
    if (roomId) {
      const r = await prisma.materialRoom.findUnique({ where: { id: roomId } });
      if (!r) return res.status(400).json({ error: 'Salle de stockage invalide' });
    }
    const eq = await prisma.materialEquipment.update({
      where: { id: req.params.id },
      data: {
        ...(roomId !== undefined && { roomId: roomId || null }),
        ...(name !== undefined && { name: String(name).trim() }),
        ...(category !== undefined && { category: String(category).trim() }),
        ...(serialNumber !== undefined && { serialNumber: serialNumber ? String(serialNumber).trim() : null }),
        ...(quantity !== undefined && { quantity: Math.max(1, Number(quantity) || 1) }),
        ...(condition !== undefined && { condition }),
        ...(notes !== undefined && { notes: notes ? String(notes).trim() : null }),
        ...(purchasedAt !== undefined && {
          purchasedAt: purchasedAt ? new Date(purchasedAt) : null,
        }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
      include: { room: { select: { id: true, name: true, code: true } } },
    });
    res.json(eq);
  } catch (error: any) {
    console.error('PUT /material/equipment/:id:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.delete('/material/equipment/:id', async (req, res) => {
  try {
    const existing = await prisma.materialEquipment.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Équipement introuvable' });
    }
    const activeAlloc = await prisma.materialAllocation.count({
      where: { equipmentId: req.params.id, status: 'ACTIVE' },
    });
    if (activeAlloc > 0) {
      await prisma.materialEquipment.update({
        where: { id: req.params.id },
        data: { isActive: false },
      });
      return res.json({ ok: true, deactivated: true });
    }
    await prisma.materialEquipment.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (error: any) {
    console.error('DELETE /material/equipment/:id:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.get('/material/maintenance', async (req, res) => {
  try {
    const { status, equipmentId, roomId } = req.query;
    const list = await prisma.materialMaintenance.findMany({
      where: {
        ...(status && typeof status === 'string' && { status: status as any }),
        ...(equipmentId && typeof equipmentId === 'string' && { equipmentId }),
        ...(roomId && typeof roomId === 'string' && { roomId }),
      },
      include: {
        equipment: { select: { id: true, name: true, category: true } },
        room: { select: { id: true, name: true, code: true } },
        reportedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { openedAt: 'desc' },
    });
    res.json(list);
  } catch (error: any) {
    console.error('GET /material/maintenance:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.post('/material/maintenance', async (req, res) => {
  try {
    const {
      equipmentId,
      roomId,
      title,
      description,
      status,
      priority,
      costEstimate,
      costActual,
      reportedById,
      assigneeId,
    } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Le titre est requis' });
    }
    if (!equipmentId && !roomId) {
      return res.status(400).json({ error: 'Renseignez un équipement ou une salle' });
    }
    if (equipmentId) {
      const e = await prisma.materialEquipment.findUnique({ where: { id: equipmentId } });
      if (!e) return res.status(400).json({ error: 'Équipement invalide' });
    }
    if (roomId) {
      const r = await prisma.materialRoom.findUnique({ where: { id: roomId } });
      if (!r) return res.status(400).json({ error: 'Salle invalide' });
    }
    if (reportedById) {
      const u = await prisma.user.findUnique({ where: { id: reportedById } });
      if (!u) return res.status(400).json({ error: 'Signaleur invalide' });
    }
    if (assigneeId) {
      const u = await prisma.user.findUnique({ where: { id: assigneeId } });
      if (!u) return res.status(400).json({ error: 'Assigné invalide' });
    }
    const row = await prisma.materialMaintenance.create({
      data: {
        equipmentId: equipmentId || null,
        roomId: roomId || null,
        title: title.trim(),
        description: description?.trim() || null,
        status: status || 'OPEN',
        priority: priority?.trim() || 'normal',
        costEstimate: costEstimate != null ? Number(costEstimate) : null,
        costActual: costActual != null ? Number(costActual) : null,
        reportedById: reportedById || null,
        assigneeId: assigneeId || null,
      },
      include: {
        equipment: { select: { id: true, name: true, category: true } },
        room: { select: { id: true, name: true, code: true } },
        reportedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    res.status(201).json(row);
  } catch (error: any) {
    console.error('POST /material/maintenance:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.patch('/material/maintenance/:id', async (req, res) => {
  try {
    const existing = await prisma.materialMaintenance.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Demande introuvable' });
    }
    const {
      title,
      description,
      status,
      priority,
      costEstimate,
      costActual,
      assigneeId,
      closedAt,
    } = req.body;
    if (assigneeId) {
      const u = await prisma.user.findUnique({ where: { id: assigneeId } });
      if (!u) return res.status(400).json({ error: 'Assigné invalide' });
    }
    const nextStatus = status ?? existing.status;
    const row = await prisma.materialMaintenance.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title: String(title).trim() }),
        ...(description !== undefined && { description: description ? String(description).trim() : null }),
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority: String(priority).trim() }),
        ...(costEstimate !== undefined && {
          costEstimate: costEstimate != null ? Number(costEstimate) : null,
        }),
        ...(costActual !== undefined && { costActual: costActual != null ? Number(costActual) : null }),
        ...(assigneeId !== undefined && { assigneeId: assigneeId || null }),
        ...(closedAt !== undefined && { closedAt: closedAt ? new Date(closedAt) : null }),
        ...((nextStatus === 'RESOLVED' || nextStatus === 'CANCELLED') &&
          !existing.closedAt && { closedAt: new Date() }),
      },
      include: {
        equipment: { select: { id: true, name: true, category: true } },
        room: { select: { id: true, name: true, code: true } },
        reportedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    res.json(row);
  } catch (error: any) {
    console.error('PATCH /material/maintenance/:id:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.get('/material/allocations', async (req, res) => {
  try {
    const { status, equipmentId } = req.query;
    const list = await prisma.materialAllocation.findMany({
      where: {
        ...(status && typeof status === 'string' && { status: status as any }),
        ...(equipmentId && typeof equipmentId === 'string' && { equipmentId }),
      },
      include: {
        equipment: { select: { id: true, name: true, category: true, quantity: true } },
      },
      orderBy: { startDate: 'desc' },
    });
    res.json(list);
  } catch (error: any) {
    console.error('GET /material/allocations:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.post('/material/allocations', async (req, res) => {
  try {
    const { equipmentId, targetType, targetId, quantity, startDate, endDate, purpose, notes } = req.body;
    if (!equipmentId || !targetType || !targetId) {
      return res.status(400).json({ error: 'Équipement, type de cible et identifiant cible sont requis' });
    }
    const eq = await prisma.materialEquipment.findUnique({ where: { id: equipmentId } });
    if (!eq) return res.status(400).json({ error: 'Équipement invalide' });
    const qty = Math.max(1, Number(quantity) || 1);
    if (qty > eq.quantity) {
      return res.status(400).json({ error: 'Quantité supérieure au stock déclaré' });
    }
    if (targetType === 'USER') {
      const u = await prisma.user.findUnique({ where: { id: targetId } });
      if (!u) return res.status(400).json({ error: 'Utilisateur cible invalide' });
    } else if (targetType === 'CLASS') {
      const c = await prisma.class.findUnique({ where: { id: targetId } });
      if (!c) return res.status(400).json({ error: 'Classe cible invalide' });
    } else if (targetType === 'ROOM') {
      const r = await prisma.materialRoom.findUnique({ where: { id: targetId } });
      if (!r) return res.status(400).json({ error: 'Salle cible invalide' });
    } else {
      return res.status(400).json({ error: 'Type de cible invalide' });
    }
    const activeSum = await prisma.materialAllocation.aggregate({
      where: { equipmentId, status: 'ACTIVE' },
      _sum: { quantity: true },
    });
    const used = activeSum._sum.quantity ?? 0;
    if (used + qty > eq.quantity) {
      return res.status(400).json({
        error: `Stock insuffisant (${used} déjà alloué(s) sur ${eq.quantity})`,
      });
    }
    const row = await prisma.materialAllocation.create({
      data: {
        equipmentId,
        targetType,
        targetId: String(targetId),
        quantity: qty,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        purpose: purpose?.trim() || null,
        notes: notes?.trim() || null,
        status: 'ACTIVE',
      },
      include: {
        equipment: { select: { id: true, name: true, category: true, quantity: true } },
      },
    });
    res.status(201).json(row);
  } catch (error: any) {
    console.error('POST /material/allocations:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.patch('/material/allocations/:id', async (req, res) => {
  try {
    const existing = await prisma.materialAllocation.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Allocation introuvable' });
    }
    const { status, endDate, notes } = req.body;
    const row = await prisma.materialAllocation.update({
      where: { id: req.params.id },
      data: {
        ...(status !== undefined && { status }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(notes !== undefined && { notes: notes ? String(notes).trim() : null }),
        ...(status === 'RETURNED' && { endDate: new Date() }),
      },
      include: {
        equipment: { select: { id: true, name: true, category: true, quantity: true } },
      },
    });
    res.json(row);
  } catch (error: any) {
    console.error('PATCH /material/allocations/:id:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// --- Gestion de stock (fournitures, entretien, sécurité, approvisionnement) ---

router.get('/material/stock-items', async (req, res) => {
  try {
    const { search, type, lowStockOnly, isActive } = req.query;
    const rows = await prisma.materialStockItem.findMany({
      where: {
        ...(search &&
          typeof search === 'string' &&
          search.trim() && {
            OR: [
              { name: { contains: search.trim() } },
              { category: { contains: search.trim() } },
              { location: { contains: search.trim() } },
            ],
          }),
        ...(type && typeof type === 'string' && { type: type as any }),
        ...(isActive !== undefined && { isActive: isActive === 'true' }),
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
    const filtered =
      lowStockOnly === 'true'
        ? rows.filter((r) => Number(r.currentQty) <= Number(r.safetyQty))
        : rows;
    res.json(filtered);
  } catch (error: any) {
    console.error('GET /material/stock-items:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.post('/material/stock-items', async (req, res) => {
  try {
    const { name, category, type, unit, currentQty, safetyQty, reorderQty, location, notes, isActive } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Le nom de l’article est requis' });
    }
    const row = await prisma.materialStockItem.create({
      data: {
        name: name.trim(),
        category: category?.trim() || null,
        type: type || 'OTHER',
        unit: unit?.trim() || 'unité',
        currentQty: Number(currentQty) || 0,
        safetyQty: Math.max(0, Number(safetyQty) || 0),
        reorderQty: reorderQty != null && reorderQty !== '' ? Number(reorderQty) : null,
        location: location?.trim() || null,
        notes: notes?.trim() || null,
        isActive: isActive !== false,
      },
    });
    if (row.isActive) {
      maybeNotifyMaterialStockAlert(
        {
          id: row.id,
          name: row.name,
          unit: row.unit,
          safetyQty: row.safetyQty,
          currentQty: Math.max(Number(row.safetyQty) || 0, 1) + 1,
        },
        Number(row.currentQty),
      ).catch((err) => console.error('maybeNotifyMaterialStockAlert(create):', err));
    }
    res.status(201).json(row);
  } catch (error: any) {
    console.error('POST /material/stock-items:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.patch('/material/stock-items/:id', async (req, res) => {
  try {
    const existing = await prisma.materialStockItem.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Article introuvable' });
    const { name, category, type, unit, currentQty, safetyQty, reorderQty, location, notes, isActive } = req.body;
    const row = await prisma.materialStockItem.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(category !== undefined && { category: category ? String(category).trim() : null }),
        ...(type !== undefined && { type }),
        ...(unit !== undefined && { unit: unit ? String(unit).trim() : 'unité' }),
        ...(currentQty !== undefined && { currentQty: Number(currentQty) || 0 }),
        ...(safetyQty !== undefined && { safetyQty: Math.max(0, Number(safetyQty) || 0) }),
        ...(reorderQty !== undefined && {
          reorderQty: reorderQty != null && reorderQty !== '' ? Number(reorderQty) : null,
        }),
        ...(location !== undefined && { location: location ? String(location).trim() : null }),
        ...(notes !== undefined && { notes: notes ? String(notes).trim() : null }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });
    if (row.isActive && (currentQty !== undefined || safetyQty !== undefined)) {
      maybeNotifyMaterialStockAlert(
        {
          id: existing.id,
          name: existing.name,
          unit: existing.unit,
          safetyQty: Number(existing.safetyQty),
          currentQty: Number(existing.currentQty),
        },
        Number(row.currentQty),
        safetyQty !== undefined ? Math.max(0, Number(safetyQty) || 0) : undefined,
      ).catch((err) => console.error('maybeNotifyMaterialStockAlert(patch):', err));
    }
    res.json(row);
  } catch (error: any) {
    console.error('PATCH /material/stock-items/:id:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.get('/material/stock-items/:id/movements', async (req, res) => {
  try {
    const item = await prisma.materialStockItem.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Article introuvable' });
    const rows = await prisma.materialStockMovement.findMany({
      where: { itemId: req.params.id },
      orderBy: { occurredAt: 'desc' },
    });
    res.json(rows);
  } catch (error: any) {
    console.error('GET /material/stock-items/:id/movements:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.post('/material/stock-items/:id/movements', async (req, res) => {
  try {
    const item = await prisma.materialStockItem.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Article introuvable' });
    const { type, quantity, countedQty, unitCost, note, reference, occurredAt } = req.body;
    if (!type || typeof type !== 'string') {
      return res.status(400).json({ error: 'Type de mouvement requis' });
    }
    const qty = Number(quantity);
    let delta = 0;
    if (type === 'IN') delta = Math.abs(qty || 0);
    else if (type === 'OUT') delta = -Math.abs(qty || 0);
    else if (type === 'ADJUSTMENT') delta = qty || 0;
    else if (type === 'INVENTORY_COUNT') {
      const c = Number(countedQty);
      if (!Number.isFinite(c) || c < 0) {
        return res.status(400).json({ error: 'countedQty requis pour INVENTORY_COUNT' });
      }
      delta = c - Number(item.currentQty);
    } else {
      return res.status(400).json({ error: 'Type de mouvement invalide' });
    }
    if (delta === 0) return res.status(400).json({ error: 'Mouvement nul' });
    const nextQty = Number(item.currentQty) + delta;
    if (nextQty < 0) return res.status(400).json({ error: 'Stock insuffisant' });
    const unitCostN = unitCost != null && unitCost !== '' ? Number(unitCost) : null;
    const totalCost = unitCostN != null ? Math.abs(delta) * unitCostN : null;

    const [, movement] = await prisma.$transaction([
      prisma.materialStockItem.update({
        where: { id: item.id },
        data: { currentQty: nextQty },
      }),
      prisma.materialStockMovement.create({
        data: {
          itemId: item.id,
          type,
          quantity: delta,
          unitCost: unitCostN,
          totalCost,
          note: note?.trim() || null,
          reference: reference?.trim() || null,
          occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
        },
      }),
    ]);
    if (item.isActive) {
      maybeNotifyMaterialStockAlert(
        {
          id: item.id,
          name: item.name,
          unit: item.unit,
          safetyQty: Number(item.safetyQty),
          currentQty: Number(item.currentQty),
        },
        nextQty,
      ).catch((err) => console.error('maybeNotifyMaterialStockAlert(movement):', err));
    }
    res.status(201).json(movement);
  } catch (error: any) {
    console.error('POST /material/stock-items/:id/movements:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.get('/material/stock-orders', async (req, res) => {
  try {
    const { status } = req.query;
    const rows = await prisma.materialStockOrder.findMany({
      where: {
        ...(status && typeof status === 'string' && { status: status as any }),
      },
      include: {
        lines: {
          include: {
            item: { select: { id: true, name: true, unit: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  } catch (error: any) {
    console.error('GET /material/stock-orders:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.post('/material/stock-orders', async (req, res) => {
  try {
    const { supplierName, expectedAt, notes, lines } = req.body as {
      supplierName?: string;
      expectedAt?: string;
      notes?: string;
      lines?: Array<{ itemId: string; qtyOrdered: number; unitCost?: number; notes?: string }>;
    };
    if (!supplierName || !supplierName.trim()) {
      return res.status(400).json({ error: 'Le fournisseur est requis' });
    }
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'Au moins une ligne de commande est requise' });
    }
    const checkedLines = await Promise.all(
      lines.map(async (l) => {
        const item = await prisma.materialStockItem.findUnique({ where: { id: l.itemId } });
        if (!item) throw new Error(`Article introuvable (${l.itemId})`);
        return {
          itemId: l.itemId,
          qtyOrdered: Math.max(0.01, Number(l.qtyOrdered) || 0.01),
          unitCost: l.unitCost != null ? Number(l.unitCost) : null,
          notes: l.notes?.trim() || null,
        };
      })
    );
    const orderNumber = `CMD-${Date.now()}`;
    const row = await prisma.materialStockOrder.create({
      data: {
        orderNumber,
        supplierName: supplierName.trim(),
        status: 'ORDERED',
        orderedAt: new Date(),
        expectedAt: expectedAt ? new Date(expectedAt) : null,
        notes: notes?.trim() || null,
        lines: { create: checkedLines },
      },
      include: {
        lines: {
          include: { item: { select: { id: true, name: true, unit: true } } },
        },
      },
    });
    res.status(201).json(row);
  } catch (error: any) {
    console.error('POST /material/stock-orders:', error);
    res.status(400).json({ error: error.message || 'Erreur serveur' });
  }
});

router.patch('/material/stock-orders/:id', async (req, res) => {
  try {
    const existing = await prisma.materialStockOrder.findUnique({
      where: { id: req.params.id },
      include: { lines: true },
    });
    if (!existing) return res.status(404).json({ error: 'Commande introuvable' });
    const { status, receivedLines, notes } = req.body as {
      status?: string;
      receivedLines?: Array<{ lineId: string; qtyReceived: number }>;
      notes?: string;
    };
    if (Array.isArray(receivedLines) && receivedLines.length > 0) {
      await prisma.$transaction(
        receivedLines.map((entry) =>
          prisma.materialStockOrderLine.update({
            where: { id: entry.lineId },
            data: { qtyReceived: Math.max(0, Number(entry.qtyReceived) || 0) },
          })
        )
      );
    }
    const refreshedLines = await prisma.materialStockOrderLine.findMany({ where: { orderId: existing.id } });
    const allReceived = refreshedLines.length > 0 && refreshedLines.every((l) => l.qtyReceived >= l.qtyOrdered);
    const anyReceived = refreshedLines.some((l) => l.qtyReceived > 0);
    const derivedStatus = allReceived ? 'RECEIVED' : anyReceived ? 'PARTIALLY_RECEIVED' : existing.status;
    const finalStatus = status || derivedStatus;
    const row = await prisma.materialStockOrder.update({
      where: { id: existing.id },
      data: {
        status: finalStatus as any,
        ...(notes !== undefined && { notes: notes ? String(notes).trim() : null }),
        ...((finalStatus === 'RECEIVED' || finalStatus === 'PARTIALLY_RECEIVED') && { receivedAt: new Date() }),
      },
      include: {
        lines: {
          include: { item: { select: { id: true, name: true, unit: true } } },
        },
      },
    });
    res.json(row);
  } catch (error: any) {
    console.error('PATCH /material/stock-orders/:id:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.get('/material/stock-periodic-inventories', async (req, res) => {
  try {
    const { from, to, type } = req.query;
    const where: Record<string, unknown> = { type: 'INVENTORY_COUNT' };
    if (from && typeof from === 'string' && to && typeof to === 'string') {
      const fromD = new Date(from);
      const toD = new Date(to);
      if (!Number.isNaN(fromD.getTime()) && !Number.isNaN(toD.getTime())) {
        where.occurredAt = { gte: fromD, lte: toD };
      }
    }
    if (type && typeof type === 'string') {
      where.item = { type: type as any };
    }
    const rows = await prisma.materialStockMovement.findMany({
      where,
      include: {
        item: { select: { id: true, name: true, type: true, unit: true } },
      },
      orderBy: { occurredAt: 'desc' },
    });
    res.json(rows);
  } catch (error: any) {
    console.error('GET /material/stock-periodic-inventories:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// --- Réservations de salles & créneaux indisponibles (12.1) ---

router.get('/material/room-reservations', async (req, res) => {
  try {
    const { roomId, from, to, status } = req.query;
    const where: Record<string, unknown> = {};
    if (roomId && typeof roomId === 'string') where.roomId = roomId;
    if (status && typeof status === 'string') where.status = status;
    if (from && typeof from === 'string' && to && typeof to === 'string') {
      const fromD = new Date(from);
      const toD = new Date(to);
      if (!Number.isNaN(fromD.getTime()) && !Number.isNaN(toD.getTime())) {
        where.AND = [{ startAt: { lte: toD } }, { endAt: { gte: fromD } }];
      }
    }
    const list = await prisma.materialRoomReservation.findMany({
      where,
      include: {
        room: { select: { id: true, name: true, code: true } },
        requesterUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { startAt: 'asc' },
    });
    res.json(list);
  } catch (error: any) {
    console.error('GET /material/room-reservations:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.post('/material/room-reservations', async (req, res) => {
  try {
    const { roomId, title, startAt, endAt, status, requesterName, requesterUserId, notes } = req.body;
    if (!roomId || typeof roomId !== 'string') {
      return res.status(400).json({ error: 'roomId est requis' });
    }
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Le titre est requis' });
    }
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Dates invalides' });
    }
    if (end <= start) {
      return res.status(400).json({ error: 'La fin doit être après le début' });
    }
    const room = await prisma.materialRoom.findUnique({ where: { id: roomId } });
    if (!room) return res.status(400).json({ error: 'Salle introuvable' });
    const st = status === 'PENDING' || status === 'CONFIRMED' || status === 'CANCELLED' ? status : 'CONFIRMED';
    if (st !== 'CANCELLED') {
      const overlap = await prisma.materialRoomReservation.findFirst({
        where: {
          roomId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          AND: [{ startAt: { lt: end } }, { endAt: { gt: start } }],
        },
      });
      if (overlap) {
        return res.status(409).json({ error: 'Créneau déjà réservé pour cette salle' });
      }
    }
    if (requesterUserId) {
      const u = await prisma.user.findUnique({ where: { id: String(requesterUserId) } });
      if (!u) return res.status(400).json({ error: 'Utilisateur demandeur invalide' });
    }
    const row = await prisma.materialRoomReservation.create({
      data: {
        roomId,
        title: title.trim(),
        startAt: start,
        endAt: end,
        status: st,
        requesterName: requesterName?.trim() || null,
        requesterUserId: requesterUserId || null,
        notes: notes?.trim() || null,
      },
      include: {
        room: { select: { id: true, name: true, code: true } },
        requesterUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    res.status(201).json(row);
  } catch (error: any) {
    console.error('POST /material/room-reservations:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.patch('/material/room-reservations/:id', async (req, res) => {
  try {
    const existing = await prisma.materialRoomReservation.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Réservation introuvable' });
    const { title, startAt, endAt, status, requesterName, requesterUserId, notes } = req.body;
    const start = startAt != null ? new Date(startAt) : existing.startAt;
    const end = endAt != null ? new Date(endAt) : existing.endAt;
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Dates invalides' });
    }
    if (end <= start) {
      return res.status(400).json({ error: 'La fin doit être après le début' });
    }
    const nextStatus =
      status === 'PENDING' || status === 'CONFIRMED' || status === 'CANCELLED' ? status : existing.status;
    if (nextStatus !== 'CANCELLED') {
      const overlap = await prisma.materialRoomReservation.findFirst({
        where: {
          roomId: existing.roomId,
          id: { not: existing.id },
          status: { in: ['PENDING', 'CONFIRMED'] },
          AND: [{ startAt: { lt: end } }, { endAt: { gt: start } }],
        },
      });
      if (overlap) {
        return res.status(409).json({ error: 'Créneau déjà réservé pour cette salle' });
      }
    }
    if (requesterUserId !== undefined && requesterUserId) {
      const u = await prisma.user.findUnique({ where: { id: String(requesterUserId) } });
      if (!u) return res.status(400).json({ error: 'Utilisateur demandeur invalide' });
    }
    const row = await prisma.materialRoomReservation.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title: String(title).trim() }),
        ...(startAt !== undefined && { startAt: start }),
        ...(endAt !== undefined && { endAt: end }),
        ...(status !== undefined && { status: nextStatus }),
        ...(requesterName !== undefined && { requesterName: requesterName ? String(requesterName).trim() : null }),
        ...(requesterUserId !== undefined && { requesterUserId: requesterUserId || null }),
        ...(notes !== undefined && { notes: notes ? String(notes).trim() : null }),
      },
      include: {
        room: { select: { id: true, name: true, code: true } },
        requesterUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    res.json(row);
  } catch (error: any) {
    console.error('PATCH /material/room-reservations/:id:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.delete('/material/room-reservations/:id', async (req, res) => {
  try {
    const existing = await prisma.materialRoomReservation.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Réservation introuvable' });
    await prisma.materialRoomReservation.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (error: any) {
    console.error('DELETE /material/room-reservations/:id:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.get('/material/room-unavailable-slots', async (req, res) => {
  try {
    const { roomKey } = req.query;
    const list = await prisma.roomScheduleUnavailableSlot.findMany({
      where:
        roomKey && typeof roomKey === 'string' && roomKey.trim()
          ? { roomKey: roomKey.trim() }
          : {},
      orderBy: [{ roomKey: 'asc' }, { dayOfWeek: 'asc' }],
    });
    res.json(list);
  } catch (error: any) {
    console.error('GET /material/room-unavailable-slots:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.post('/material/room-unavailable-slots', async (req, res) => {
  try {
    const { roomKey, dayOfWeek, startTime, endTime, reason } = req.body;
    if (!roomKey || typeof roomKey !== 'string' || !roomKey.trim()) {
      return res.status(400).json({ error: 'roomKey est requis (ex. id de salle matérielle)' });
    }
    const dow = Number(dayOfWeek);
    if (!Number.isInteger(dow) || dow < 0 || dow > 6) {
      return res.status(400).json({ error: 'dayOfWeek doit être entre 0 (dimanche) et 6' });
    }
    if (!startTime || !endTime || typeof startTime !== 'string' || typeof endTime !== 'string') {
      return res.status(400).json({ error: 'startTime et endTime (HH:MM) sont requis' });
    }
    const row = await prisma.roomScheduleUnavailableSlot.create({
      data: {
        roomKey: roomKey.trim(),
        dayOfWeek: dow,
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        reason: reason?.trim() || null,
      },
    });
    res.status(201).json(row);
  } catch (error: any) {
    console.error('POST /material/room-unavailable-slots:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.delete('/material/room-unavailable-slots/:id', async (req, res) => {
  try {
    const existing = await prisma.roomScheduleUnavailableSlot.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Créneau introuvable' });
    await prisma.roomScheduleUnavailableSlot.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (error: any) {
    console.error('DELETE /material/room-unavailable-slots/:id:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

router.get('/material/rooms/:id/occupancy', async (req, res) => {
  try {
    const room = await prisma.materialRoom.findUnique({ where: { id: req.params.id } });
    if (!room) return res.status(404).json({ error: 'Salle introuvable' });
    const { from, to, academicYear } = req.query;
    const fromD = from && typeof from === 'string' ? new Date(from) : null;
    const toD = to && typeof to === 'string' ? new Date(to) : null;
    const keys = [room.id, room.code, room.name].filter((k): k is string => Boolean(k && String(k).trim()));
    const norm = (s: string) => s.trim().toLowerCase();
    const keyNorms = keys.map(norm);

    const unavailableSlots = await prisma.roomScheduleUnavailableSlot.findMany({
      where: { roomKey: { in: keys } },
      orderBy: [{ dayOfWeek: 'asc' }],
    });

    let reservations: Awaited<ReturnType<typeof prisma.materialRoomReservation.findMany>> = [];
    if (fromD && toD && !Number.isNaN(fromD.getTime()) && !Number.isNaN(toD.getTime())) {
      reservations = await prisma.materialRoomReservation.findMany({
        where: {
          roomId: room.id,
          status: { in: ['PENDING', 'CONFIRMED'] },
          AND: [{ startAt: { lte: toD } }, { endAt: { gte: fromD } }],
        },
        orderBy: { startAt: 'asc' },
      });
    }

    const scheduleWhere: Record<string, unknown> = { room: { not: null } };
    if (academicYear && typeof academicYear === 'string' && academicYear.trim()) {
      scheduleWhere.class = { academicYear: academicYear.trim() };
    }
    const schedules = await prisma.schedule.findMany({
      where: scheduleWhere,
      include: {
        class: { select: { id: true, name: true, academicYear: true } },
        course: { select: { name: true, code: true } },
      },
    });
    const scheduleSlots = schedules
      .filter((s) => {
        const r = norm(String(s.room || ''));
        if (!r) return false;
        return keyNorms.some((k) => r === k || (k.length >= 2 && r.includes(k)));
      })
      .map((s) => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.room,
        className: s.class.name,
        classId: s.class.id,
        academicYear: s.class.academicYear,
        courseName: s.course.name,
        courseCode: s.course.code,
      }));

    res.json({
      room: {
        id: room.id,
        name: room.name,
        code: room.code,
        capacity: room.capacity,
        building: room.building,
        floor: room.floor,
      },
      period:
        fromD && toD && !Number.isNaN(fromD.getTime()) && !Number.isNaN(toD.getTime())
          ? { from: fromD.toISOString(), to: toD.toISOString() }
          : null,
      reservations,
      unavailableSlots,
      scheduleSlots,
    });
  } catch (error: any) {
    console.error('GET /material/rooms/:id/occupancy:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

// ========== RAPPORTS & STATISTIQUES (agrégats) ==========

router.get('/reports/summary', async (_req, res) => {
  try {
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [
      studentsTotal,
      studentsActive,
      teachersTotal,
      educatorsTotal,
      classesTotal,
      coursesTotal,
      assignmentsPublished,
      studentAssignmentStats,
      admissionPending,
      admissionUnderReview,
      admissionAccepted,
      admissionRejected,
      admissionWaitlist,
      admissionEnrolled,
      admissionTotal,
      admissionByYear,
      paymentGroup,
      tuitionUnpaid,
      absenceTotals,
      allStudents,
      paymentsRecent,
      usersTotal,
    ] = await Promise.all([
      prisma.student.count(),
      prisma.student.count({
        where: { isActive: true, enrollmentStatus: 'ACTIVE' },
      }),
      prisma.teacher.count(),
      prisma.educator.count(),
      prisma.class.count(),
      prisma.course.count(),
      prisma.assignment.count(),
      prisma.studentAssignment
        .findMany({ select: { submitted: true } })
        .then((rows) => ({
          total: rows.length,
          submitted: rows.filter((r) => r.submitted).length,
        })),
      prisma.admission.count({ where: { status: 'PENDING' } }),
      prisma.admission.count({ where: { status: 'UNDER_REVIEW' } }),
      prisma.admission.count({ where: { status: 'ACCEPTED' } }),
      prisma.admission.count({ where: { status: 'REJECTED' } }),
      prisma.admission.count({ where: { status: 'WAITLIST' } }),
      prisma.admission.count({ where: { status: 'ENROLLED' } }),
      prisma.admission.count(),
      prisma.admission.groupBy({
        by: ['academicYear'],
        _count: true,
        orderBy: { academicYear: 'desc' },
        take: 12,
      }),
      prisma.payment.groupBy({
        by: ['status'],
        _sum: { amount: true },
        _count: true,
      }),
      prisma.tuitionFee.aggregate({
        where: { isPaid: false },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.absence
        .findMany({ select: { excused: true } })
        .then((rows) => ({
          total: rows.length,
          excused: rows.filter((a) => a.excused).length,
        })),
      prisma.student.findMany({
        include: {
          grades: { select: { score: true, maxScore: true, coefficient: true } },
          absences: { select: { excused: true } },
          class: { select: { id: true, name: true } },
        },
      }),
      prisma.payment.findMany({
        where: {
          status: 'COMPLETED',
          paidAt: { gte: sixMonthsAgo },
        },
        select: { amount: true, paidAt: true },
      }),
      prisma.user.count(),
    ]);

    const gradesList = allStudents.flatMap((s) => s.grades);
    let gradeAverage: number | null = null;
    if (gradesList.length > 0) {
      let num = 0;
      let den = 0;
      for (const g of gradesList) {
        const max = g.maxScore > 0 ? g.maxScore : 20;
        const normalized = (g.score / max) * 20;
        num += normalized * g.coefficient;
        den += g.coefficient;
      }
      gradeAverage = den > 0 ? Math.round((num / den) * 100) / 100 : null;
    }

    const byClassMap = new Map<
      string,
      { classId: string; className: string; sum: number; coef: number; gradeCount: number }
    >();
    for (const s of allStudents) {
      if (!s.classId || !s.class) continue;
      const key = s.classId;
      if (!byClassMap.has(key)) {
        byClassMap.set(key, {
          classId: key,
          className: s.class.name,
          sum: 0,
          coef: 0,
          gradeCount: 0,
        });
      }
      const bucket = byClassMap.get(key)!;
      for (const g of s.grades) {
        const max = g.maxScore > 0 ? g.maxScore : 20;
        const normalized = (g.score / max) * 20;
        bucket.sum += normalized * g.coefficient;
        bucket.coef += g.coefficient;
        bucket.gradeCount += 1;
      }
    }
    const averagesByClass = [...byClassMap.values()]
      .map((b) => ({
        classId: b.classId,
        className: b.className,
        average:
          b.coef > 0 ? Math.round((b.sum / b.coef) * 100) / 100 : null,
        gradeCount: b.gradeCount,
      }))
      .filter((x) => x.gradeCount > 0)
      .sort((a, b) => (b.average ?? 0) - (a.average ?? 0))
      .slice(0, 12);

    let atRiskHigh = 0;
    let atRiskMedium = 0;
    for (const student of allStudents) {
      const grades = student.grades || [];
      const totalScore = grades.reduce(
        (sum, g) => sum + (g.maxScore > 0 ? g.score / g.maxScore : 0) * 20 * g.coefficient,
        0
      );
      const totalCoefficient = grades.reduce((sum, g) => sum + g.coefficient, 0);
      const average = totalCoefficient > 0 ? totalScore / totalCoefficient : 0;
      const unexcusedAbsences = student.absences?.filter((a) => !a.excused).length || 0;
      const riskLevel =
        average < 10 || unexcusedAbsences > 5
          ? 'high'
          : average < 12
            ? 'medium'
            : 'low';
      if (riskLevel === 'high') atRiskHigh += 1;
      else if (riskLevel === 'medium') atRiskMedium += 1;
    }

    const paymentsByMonth: { month: string; label: string; amount: number }[] = [];
    const monthKeys = new Map<string, number>();
    for (const p of paymentsRecent) {
      if (!p.paidAt) continue;
      const d = new Date(p.paidAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthKeys.set(key, (monthKeys.get(key) ?? 0) + p.amount);
    }
    for (const [month, amount] of [...monthKeys.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const [y, m] = month.split('-');
      const label = `${m}/${y}`;
      paymentsByMonth.push({ month, label, amount: Math.round(amount * 100) / 100 });
    }

    const gbCount = (row: { _count: number | { _all?: number } }) =>
      typeof row._count === 'number' ? row._count : row._count?._all ?? 0;

    const paymentTotals = {
      completedAmount: 0,
      pendingAmount: 0,
      failedAmount: 0,
      otherAmount: 0,
      byStatus: paymentGroup.map((p) => ({
        status: p.status,
        count: gbCount(p),
        sum: p._sum.amount ?? 0,
      })),
    };
    for (const p of paymentGroup) {
      const sum = p._sum.amount ?? 0;
      if (p.status === 'COMPLETED') paymentTotals.completedAmount += sum;
      else if (p.status === 'PENDING') paymentTotals.pendingAmount += sum;
      else if (p.status === 'FAILED') paymentTotals.failedAmount += sum;
      else paymentTotals.otherAmount += sum;
    }

    res.json({
      generatedAt: now.toISOString(),
      dashboard: {
        studentsTotal,
        studentsActive,
        teachersTotal,
        educatorsTotal,
        classesTotal,
        coursesTotal,
        assignmentsPublished,
        usersTotal,
      },
      financial: {
        paymentTotals,
        tuitionOutstandingAmount: tuitionUnpaid._sum.amount ?? 0,
        tuitionOutstandingCount: tuitionUnpaid._count,
        paymentsByMonth,
      },
      academic: {
        gradesCount: gradesList.length,
        gradeAverage,
        assignmentsPublished,
        studentAssignmentStats,
        absenceTotals,
        averagesByClass,
      },
      admissions: {
        pending: admissionPending,
        underReview: admissionUnderReview,
        accepted: admissionAccepted,
        rejected: admissionRejected,
        waitlist: admissionWaitlist,
        enrolled: admissionEnrolled,
        total: admissionTotal,
        byAcademicYear: admissionByYear.map((a) => ({
          academicYear: a.academicYear,
          count: gbCount(a),
        })),
      },
      performance: {
        atRiskHigh,
        atRiskMedium,
        atRiskTotal: atRiskHigh + atRiskMedium,
        submissionRate:
          studentAssignmentStats.total > 0
            ? Math.round(
                (studentAssignmentStats.submitted / studentAssignmentStats.total) * 1000
              ) / 10
            : null,
        absenceExcusedRate:
          absenceTotals.total > 0
            ? Math.round((absenceTotals.excused / absenceTotals.total) * 1000) / 10
            : null,
      },
    });
  } catch (error: any) {
    console.error('GET /reports/summary:', error);
    res.status(500).json({ error: error.message || 'Erreur serveur' });
  }
});

export default router;

