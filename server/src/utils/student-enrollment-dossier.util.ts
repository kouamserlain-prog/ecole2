import QRCode from 'qrcode';
import prisma from '../utils/prisma';
import { generateDigitalCardPublicId } from './digital-card.util';

const IDENTITY_DOC_LABELS: Record<string, string> = {
  NATIONAL_ID: "Pièce d'identité nationale",
  BIRTH_CERTIFICATE: 'Acte de naissance',
  PASSPORT: 'Passeport',
  RESIDENCE_PERMIT: 'Titre de séjour',
  PHOTO_ID: "Photo d'identité",
  OTHER: 'Autre document',
};

export type StudentEnrollmentDossierPayload = {
  generatedAt: string;
  school: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    principalName?: string | null;
  } | null;
  student: {
    id: string;
    studentId: string;
    enrollmentDate: string;
    enrollmentStatus: string;
    stateAssignment?: string | null;
    dateOfBirth: string;
    gender: string;
    address?: string | null;
    emergencyContact?: string | null;
    emergencyPhone?: string | null;
    emergencyContact2?: string | null;
    emergencyPhone2?: string | null;
    medicalInfo?: string | null;
    allergies?: string | null;
    specialNeeds?: string | null;
  };
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
  };
  class: {
    name: string;
    level: string;
    academicYear: string;
    trackName?: string | null;
  } | null;
  subjectOptions: { name: string; code?: string | null }[];
  parents: {
    relation?: string | null;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
  }[];
  admission: {
    reference: string;
    desiredLevel?: string | null;
    academicYear?: string | null;
    previousSchool?: string | null;
    motivation?: string | null;
    parentName?: string | null;
    parentPhone?: string | null;
    parentEmail?: string | null;
    gradeTerm1?: number | null;
    gradeTerm2?: number | null;
    gradeAnnualGeneral?: number | null;
    gradeAnnualSpecific?: number | null;
    gradeAnnualLiterary?: number | null;
    term3ReportCardOriginalName?: string | null;
    reviewedAt?: string | null;
  } | null;
  identityDocuments: {
    type: string;
    typeLabel: string;
    label?: string | null;
    originalName: string;
    createdAt: string;
  }[];
  digitalCard: {
    cardPageUrl: string;
    qrDataUrl: string;
  } | null;
};

export async function buildStudentEnrollmentDossierPayload(
  studentId: string,
): Promise<StudentEnrollmentDossierPayload | null> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      class: {
        select: {
          name: true,
          level: true,
          academicYear: true,
          track: { select: { name: true } },
        },
      },
      school: {
        select: {
          name: true,
          address: true,
          phone: true,
          email: true,
          principalName: true,
        },
      },
      subjectOptions: {
        include: { option: { select: { name: true, code: true } } },
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
  });

  if (!student) return null;

  const admission = await prisma.admission.findFirst({
    where: { enrolledStudentId: student.id },
    orderBy: { reviewedAt: 'desc' },
    select: {
      reference: true,
      desiredLevel: true,
      academicYear: true,
      previousSchool: true,
      motivation: true,
      parentName: true,
      parentPhone: true,
      parentEmail: true,
      gradeTerm1: true,
      gradeTerm2: true,
      gradeAnnualGeneral: true,
      gradeAnnualSpecific: true,
      gradeAnnualLiterary: true,
      term3ReportCardOriginalName: true,
      reviewedAt: true,
    },
  });

  const identityDocs = await prisma.identityDocument.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: 'desc' },
    select: {
      type: true,
      label: true,
      originalName: true,
      createdAt: true,
    },
  });

  let digitalCard: StudentEnrollmentDossierPayload['digitalCard'] = null;
  try {
    let publicId = student.digitalCardPublicId;
    if (!publicId) {
      publicId = generateDigitalCardPublicId();
      await prisma.student.update({
        where: { id: student.id },
        data: { digitalCardPublicId: publicId },
      });
    }
    const frontendBase =
      (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim() ||
      'http://localhost:3000';
    const cardPageUrl = `${frontendBase.replace(/\/+$/, '')}/carte-etudiant/${encodeURIComponent(publicId)}`;
    const qrDataUrl = await QRCode.toDataURL(cardPageUrl, {
      margin: 1,
      width: 200,
      errorCorrectionLevel: 'M',
    });
    digitalCard = { cardPageUrl, qrDataUrl };
  } catch {
    digitalCard = null;
  }

  return {
    generatedAt: new Date().toISOString(),
    school: student.school
      ? {
          name: student.school.name,
          address: student.school.address,
          phone: student.school.phone,
          email: student.school.email,
          principalName: student.school.principalName,
        }
      : null,
    student: {
      id: student.id,
      studentId: student.studentId,
      enrollmentDate: student.enrollmentDate.toISOString(),
      enrollmentStatus: student.enrollmentStatus,
      stateAssignment: student.stateAssignment,
      dateOfBirth: student.dateOfBirth.toISOString(),
      gender: student.gender,
      address: student.address,
      emergencyContact: student.emergencyContact,
      emergencyPhone: student.emergencyPhone,
      emergencyContact2: student.emergencyContact2,
      emergencyPhone2: student.emergencyPhone2,
      medicalInfo: student.medicalInfo,
      allergies: student.allergies,
      specialNeeds: student.specialNeeds,
    },
    user: {
      firstName: student.user.firstName,
      lastName: student.user.lastName,
      email: student.user.email,
      phone: student.user.phone,
    },
    class: student.class
      ? {
          name: student.class.name,
          level: student.class.level,
          academicYear: student.class.academicYear,
          trackName: student.class.track?.name ?? null,
        }
      : null,
    subjectOptions: student.subjectOptions.map((so) => ({
      name: so.option.name,
      code: so.option.code,
    })),
    parents: student.parents.map((sp) => ({
      relation: sp.relation,
      firstName: sp.parent.user.firstName,
      lastName: sp.parent.user.lastName,
      email: sp.parent.user.email,
      phone: sp.parent.user.phone,
    })),
    admission: admission
      ? {
          reference: admission.reference,
          desiredLevel: admission.desiredLevel,
          academicYear: admission.academicYear,
          previousSchool: admission.previousSchool,
          motivation: admission.motivation,
          parentName: admission.parentName,
          parentPhone: admission.parentPhone,
          parentEmail: admission.parentEmail,
          gradeTerm1: admission.gradeTerm1,
          gradeTerm2: admission.gradeTerm2,
          gradeAnnualGeneral: admission.gradeAnnualGeneral,
          gradeAnnualSpecific: admission.gradeAnnualSpecific,
          gradeAnnualLiterary: admission.gradeAnnualLiterary,
          term3ReportCardOriginalName: admission.term3ReportCardOriginalName,
          reviewedAt: admission.reviewedAt?.toISOString() ?? null,
        }
      : null,
    identityDocuments: identityDocs.map((doc) => ({
      type: doc.type,
      typeLabel: IDENTITY_DOC_LABELS[doc.type] ?? doc.type,
      label: doc.label,
      originalName: doc.originalName,
      createdAt: doc.createdAt.toISOString(),
    })),
    digitalCard,
  };
}
