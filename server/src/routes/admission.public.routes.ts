import express from 'express';
import { body, validationResult } from 'express-validator';
import prisma from '../utils/prisma';
import { admissionReportCardUpload } from '../middleware/upload.middleware';
import { notifyAdminsOfNewAdmission } from '../utils/admission-notify.util';
import {
  admissionGradeDataForCreate,
  isAdmissionSecondaryLevel,
  parseAdmissionGradeFields,
  validateAdmissionGrades,
  validateAdmissionTerm3ReportCard,
} from '../utils/admission-grades.util';
import { term3ReportCardDataFromUpload, unlinkUploadedFile } from '../utils/admission-upload.util';
import { publicServerErrorMessage } from '../utils/http-error.util';
import {
  readSchoolSlugFromRequest,
  resolveSchoolBySlug,
} from '../utils/school-context.util';
import { ensureDefaultSchool } from '../utils/ensure-default-school.util';
import { publicFormLimiter } from '../middleware/rate-limit.middleware';

const router = express.Router();

router.use(publicFormLimiter);

async function generateUniqueReference(): Promise<string> {
  const year = new Date().getFullYear();
  for (let i = 0; i < 12; i++) {
    const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const reference = `ADM-${year}-${suffix}`;
    const exists = await prisma.admission.findUnique({ where: { reference } });
    if (!exists) return reference;
  }
  const fallback = `ADM-${year}-${Date.now().toString(36).toUpperCase()}`;
  return fallback;
}

/**
 * Soumission publique d'une demande d'inscription
 */
const admissionValidators = [
  body('firstName').trim().notEmpty().withMessage('Prénom requis'),
  body('lastName').trim().notEmpty().withMessage('Nom requis'),
  body('email').isEmail().withMessage('Email invalide'),
  body('dateOfBirth').isISO8601().withMessage('Date de naissance invalide'),
  body('gender').isIn(['MALE', 'FEMALE', 'OTHER']).withMessage('Genre invalide'),
  body('desiredLevel').trim().notEmpty().withMessage('Niveau souhaité requis'),
  body('academicYear').trim().notEmpty().withMessage('Année scolaire requise'),
  body('matricule')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 40 })
    .withMessage('Numéro matricule : 40 caractères maximum'),
];

router.post(
  '/',
  (req, res, next) => {
    admissionReportCardUpload.single('term3ReportCard')(req, res, (err: unknown) => {
      if (err) {
        const message =
          err instanceof Error ? err.message : 'Échec du téléversement du bulletin.';
        return res.status(400).json({ error: message });
      }
      next();
    });
  },
  admissionValidators,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        unlinkUploadedFile(req.file);
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth,
        gender,
        desiredLevel,
        academicYear,
        previousSchool,
        matricule,
        parentName,
        parentPhone,
        parentEmail,
        address,
        motivation,
      } = req.body;

      const emailNorm = String(email).trim().toLowerCase();
      const levelTrim = String(desiredLevel).trim();

      if (!isAdmissionSecondaryLevel(levelTrim)) {
        unlinkUploadedFile(req.file);
        return res.status(400).json({
          error:
            'Ce formulaire est réservé aux candidatures de la 6ème à la Terminale. Choisissez un niveau dans la liste.',
        });
      }

      const grades = parseAdmissionGradeFields(req.body as Record<string, unknown>);
      const gradeError = validateAdmissionGrades(levelTrim, grades);
      if (gradeError) {
        unlinkUploadedFile(req.file);
        return res.status(400).json({ error: gradeError });
      }

      const bulletinError = validateAdmissionTerm3ReportCard(levelTrim, Boolean(req.file));
      if (bulletinError) {
        unlinkUploadedFile(req.file);
        return res.status(400).json({ error: bulletinError });
      }
      if (!isAdmissionSecondaryLevel(levelTrim) && req.file) {
        unlinkUploadedFile(req.file);
        return res.status(400).json({
          error: 'Le bulletin du 3e trimestre est requis pour les niveaux de la 6ème à la Terminale.',
        });
      }

      const reportCard = await term3ReportCardDataFromUpload(req);

      const openDuplicate = await prisma.admission.findFirst({
        where: {
          email: emailNorm,
          academicYear: String(academicYear).trim(),
          status: { in: ['PENDING', 'UNDER_REVIEW', 'WAITLIST', 'ACCEPTED'] },
        },
      });

      if (openDuplicate) {
        unlinkUploadedFile(req.file);
        return res.status(409).json({
          error:
            'Une demande est déjà en cours pour cet email sur cette année scolaire. Utilisez le suivi avec votre numéro de dossier.',
          reference: openDuplicate.reference,
        });
      }

      const reference = await generateUniqueReference();

      let schoolId: string | undefined;
      const slug = readSchoolSlugFromRequest(req);
      if (slug) {
        const school = await resolveSchoolBySlug(slug);
        if (!school) {
          unlinkUploadedFile(req.file);
          return res.status(400).json({
            error: 'Établissement inconnu. Vérifiez le lien de pré-inscription.',
          });
        }
        schoolId = school.id;
      } else {
        schoolId = await ensureDefaultSchool();
      }

      const admission = await prisma.admission.create({
        data: {
          reference,
          schoolId,
          firstName: String(firstName).trim(),
          lastName: String(lastName).trim(),
          email: emailNorm,
          phone: phone ? String(phone).trim() : undefined,
          dateOfBirth: new Date(dateOfBirth),
          gender,
          desiredLevel: levelTrim,
          academicYear: String(academicYear).trim(),
          previousSchool: previousSchool ? String(previousSchool).trim() : undefined,
          matricule: matricule ? String(matricule).trim() : undefined,
          parentName: parentName ? String(parentName).trim() : undefined,
          parentPhone: parentPhone ? String(parentPhone).trim() : undefined,
          parentEmail: parentEmail ? String(parentEmail).trim().toLowerCase() : undefined,
          address: address ? String(address).trim() : undefined,
          motivation: motivation ? String(motivation).trim() : undefined,
          ...admissionGradeDataForCreate(levelTrim, req.body as Record<string, unknown>),
          ...(reportCard ?? {}),
        },
        select: {
          id: true,
          reference: true,
          status: true,
          firstName: true,
          lastName: true,
          academicYear: true,
          desiredLevel: true,
          createdAt: true,
        },
      });

      res.status(201).json({
        message: 'Demande enregistrée. Conservez votre numéro de dossier pour le suivi.',
        admission,
      });

      void notifyAdminsOfNewAdmission({
        reference: admission.reference,
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        email: emailNorm,
        phone: phone ? String(phone).trim() : null,
        desiredLevel: String(desiredLevel).trim(),
        academicYear: String(academicYear).trim(),
        parentName: parentName ? String(parentName).trim() : null,
        parentPhone: parentPhone ? String(parentPhone).trim() : null,
        parentEmail: parentEmail ? String(parentEmail).trim().toLowerCase() : null,
        matricule: matricule ? String(matricule).trim() : null,
      }).catch((notifyError: unknown) => {
        console.error('notifyAdminsOfNewAdmission:', notifyError);
      });
    } catch (error: unknown) {
      unlinkUploadedFile(req.file);
      console.error('admission.public POST:', error);
      res.status(500).json({ error: publicServerErrorMessage(error) });
    }
  }
);

/**
 * Suivi public d'un dossier par numéro de référence
 */
router.get('/track/:reference', async (req, res) => {
  try {
    const reference = String(req.params.reference).trim().toUpperCase();
    const row = await prisma.admission.findUnique({
      where: { reference },
      select: {
        reference: true,
        status: true,
        firstName: true,
        lastName: true,
        matricule: true,
        desiredLevel: true,
        academicYear: true,
        gradeTerm1: true,
        gradeTerm2: true,
        gradeAnnualGeneral: true,
        gradeAnnualSpecific: true,
        gradeAnnualLiterary: true,
        term3ReportCardUrl: true,
        term3ReportCardOriginalName: true,
        createdAt: true,
        updatedAt: true,
        enrolledStudentId: true,
        proposedClass: {
          select: { id: true, name: true, level: true, academicYear: true },
        },
      },
    });

    if (!row) {
      return res.status(404).json({ error: 'Dossier introuvable' });
    }

    const { enrolledStudentId, ...rest } = row;
    const enrolledStudent = enrolledStudentId
      ? await prisma.student.findUnique({
          where: { id: enrolledStudentId },
          select: {
            studentId: true,
            user: { select: { email: true } },
          },
        })
      : null;

    res.json({ ...rest, enrolledStudent });
  } catch (error: unknown) {
    console.error('admission.public track:', error);
    res.status(500).json({ error: publicServerErrorMessage(error) });
  }
});

export default router;
