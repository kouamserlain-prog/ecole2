import type { Request } from 'express';
import prisma from './prisma';
import {
  inviteNewUserToSetPassword,
  resolveAdminProvidedOrInvitePassword,
} from './admin-user-initial-password.util';
import { generateDigitalCardPublicId } from './digital-card.util';

export type EnrollFromAdmissionBody = {
  password?: string;
  studentId?: string;
  classId?: string;
  stateAssignment?: 'STATE_ASSIGNED' | 'NOT_STATE_ASSIGNED';
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  medicalInfo?: string;
};

export type EnrollFromAdmissionResult = {
  message: string;
  user: Record<string, unknown>;
  reference: string;
  passwordSetupEmailSent: boolean;
};

async function generateUniqueStudentId(firstName: string, lastName: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const initials = `${firstName[0]?.toUpperCase() || 'X'}${lastName[0]?.toUpperCase() || 'X'}`;
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    const candidate = `STU${initials}${random}`;
    const taken = await prisma.student.findUnique({ where: { studentId: candidate } });
    if (!taken) return candidate;
  }
  return `STU${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Crée le compte élève à partir d’un dossier de pré-inscription accepté.
 */
export async function enrollStudentFromAdmission(
  admissionId: string,
  reviewerUserId: string,
  body: EnrollFromAdmissionBody,
  req?: Pick<Request, 'ip' | 'socket' | 'get'>,
): Promise<EnrollFromAdmissionResult> {
  const admission = await prisma.admission.findUnique({
    where: { id: admissionId },
  });

  if (!admission) {
    throw Object.assign(new Error('Dossier introuvable'), { statusCode: 404 });
  }
  if (admission.status !== 'ACCEPTED') {
    throw Object.assign(
      new Error('Le dossier doit être au statut « Accepté » avant de créer le compte élève'),
      { statusCode: 400 },
    );
  }
  if (admission.enrolledStudentId) {
    throw Object.assign(new Error('Un compte élève existe déjà pour ce dossier'), { statusCode: 400 });
  }

  const email = admission.email.trim().toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw Object.assign(
      new Error(
        'Cet email est déjà utilisé par un compte. Utilisez un autre email sur le dossier ou fusionnez manuellement.',
      ),
      { statusCode: 400 },
    );
  }

  let studentId = body.studentId ? String(body.studentId).trim() : '';
  if (!studentId && admission.matricule?.trim()) {
    studentId = admission.matricule.trim();
  }
  if (!studentId) {
    studentId = await generateUniqueStudentId(admission.firstName, admission.lastName);
  } else {
    const taken = await prisma.student.findUnique({ where: { studentId } });
    if (taken) {
      throw Object.assign(new Error("Ce numéro d'élève existe déjà"), { statusCode: 400 });
    }
  }

  const classId = body.classId || admission.proposedClassId || undefined;
  let schoolId = admission.schoolId ?? undefined;
  if (!schoolId && classId) {
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: { schoolId: true },
    });
    schoolId = cls?.schoolId ?? undefined;
  }

  const { hashedPassword, shouldSendSetupEmail } = await resolveAdminProvidedOrInvitePassword(
    body.password,
  );

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName: admission.firstName,
      lastName: admission.lastName,
      phone: admission.phone ?? undefined,
      role: 'STUDENT',
      studentProfile: {
        create: {
          studentId,
          digitalCardPublicId: generateDigitalCardPublicId(),
          dateOfBirth: admission.dateOfBirth,
          gender: admission.gender,
          address: body.address ?? admission.address ?? undefined,
          emergencyContact: body.emergencyContact ?? admission.parentName ?? undefined,
          emergencyPhone: body.emergencyPhone ?? admission.parentPhone ?? undefined,
          medicalInfo: body.medicalInfo ?? undefined,
          classId: classId ?? undefined,
          schoolId: schoolId ?? undefined,
          stateAssignment: body.stateAssignment ?? 'NOT_STATE_ASSIGNED',
        },
      },
    },
    include: {
      studentProfile: {
        include: { class: true },
      },
    },
  });

  const createdStudent = user.studentProfile;
  if (!createdStudent) {
    throw Object.assign(new Error('Profil élève non créé'), { statusCode: 500 });
  }

  await prisma.admission.update({
    where: { id: admission.id },
    data: {
      status: 'ENROLLED',
      enrolledStudentId: createdStudent.id,
      reviewedById: reviewerUserId,
      reviewedAt: new Date(),
    },
  });

  if (req) {
    try {
      await prisma.securityEvent.create({
        data: {
          userId: reviewerUserId,
          type: 'admission_enrolled',
          description: `Inscription finalisée: ${admission.reference} → ${studentId}`,
          ipAddress: req.ip || req.socket?.remoteAddress,
          userAgent: req.get?.('user-agent'),
          severity: 'info',
        },
      });
    } catch {
      /* ignore */
    }
  }

  if (shouldSendSetupEmail) {
    try {
      await inviteNewUserToSetPassword(user.id, user.email, admission.firstName);
    } catch (inviteErr) {
      console.error('Invitation mot de passe (admission):', inviteErr);
    }
  }

  const { password: _pw, ...userWithoutPassword } = user;
  return {
    message: 'Élève inscrit et compte créé',
    user: userWithoutPassword as unknown as Record<string, unknown>,
    reference: admission.reference,
    passwordSetupEmailSent: shouldSendSetupEmail,
  };
}
