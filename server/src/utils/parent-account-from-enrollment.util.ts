import prisma from './prisma';
import {
  inviteNewUserToSetPassword,
  resolveAdminProvidedOrInvitePassword,
} from './admin-user-initial-password.util';

const TITLE_PREFIX =
  /^(m\.?|mme\.?|mr\.?|mrs\.?|mlle\.?|madame|monsieur|papa|maman|père|mère|pere|mere)$/i;

/** Dérive prénom / nom à partir du libellé « parent / tuteur » du dossier. */
export function parseParentDisplayName(raw: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) {
    return { firstName: 'Parent', lastName: 'Tuteur' };
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const withoutTitles = parts.filter((p) => !TITLE_PREFIX.test(p.replace(/\./g, '')));
  const tokens = withoutTitles.length > 0 ? withoutTitles : parts;
  if (tokens.length === 1) {
    return { firstName: 'Parent', lastName: tokens[0]! };
  }
  return {
    firstName: tokens.slice(0, -1).join(' '),
    lastName: tokens[tokens.length - 1]!,
  };
}

export type ParentEnrollmentInput = {
  parentEmail?: string | null;
  parentName?: string | null;
  parentPhone?: string | null;
  studentId: string;
  studentUserEmail?: string;
  relation?: 'father' | 'mother' | 'guardian' | 'other';
};

export type ParentEnrollmentResult = {
  attempted: boolean;
  created: boolean;
  linked: boolean;
  parentSetupEmailSent: boolean;
  skippedReason?: string;
  parentUserId?: string;
};

/**
 * Crée ou rattache un compte PARENT à partir des coordonnées du dossier d’inscription,
 * puis lie l’élève nouvellement inscrit.
 */
export async function ensureParentAccountForEnrolledStudent(
  input: ParentEnrollmentInput,
): Promise<ParentEnrollmentResult> {
  const email = String(input.parentEmail ?? '')
    .trim()
    .toLowerCase();
  if (!email || !email.includes('@')) {
    return {
      attempted: false,
      created: false,
      linked: false,
      parentSetupEmailSent: false,
      skippedReason: 'parent_email_missing',
    };
  }

  const studentEmail = String(input.studentUserEmail ?? '')
    .trim()
    .toLowerCase();
  if (studentEmail && email === studentEmail) {
    return {
      attempted: true,
      created: false,
      linked: false,
      parentSetupEmailSent: false,
      skippedReason: 'same_email_as_student',
    };
  }

  const relation = input.relation ?? 'guardian';
  const { firstName, lastName } = parseParentDisplayName(input.parentName);
  const phone = input.parentPhone?.trim() || undefined;

  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: { parentProfile: true },
  });

  if (existingUser) {
    if (existingUser.role !== 'PARENT') {
      return {
        attempted: true,
        created: false,
        linked: false,
        parentSetupEmailSent: false,
        skippedReason: 'email_used_by_other_role',
      };
    }

    const parent =
      existingUser.parentProfile ??
      (await prisma.parent.create({ data: { userId: existingUser.id } }));

    if (phone && !existingUser.phone) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { phone },
      });
    }

    const existingLink = await prisma.studentParent.findFirst({
      where: { parentId: parent.id, studentId: input.studentId },
    });
    if (existingLink) {
      return {
        attempted: true,
        created: false,
        linked: true,
        parentSetupEmailSent: false,
        parentUserId: existingUser.id,
      };
    }

    await prisma.studentParent.create({
      data: {
        parentId: parent.id,
        studentId: input.studentId,
        relation,
      },
    });

    return {
      attempted: true,
      created: false,
      linked: true,
      parentSetupEmailSent: false,
      parentUserId: existingUser.id,
    };
  }

  const { hashedPassword, shouldSendSetupEmail } =
    await resolveAdminProvidedOrInvitePassword(undefined);

  const parentUser = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone,
      role: 'PARENT',
      isActive: true,
      parentProfile: { create: {} },
    },
  });

  const parentProfile = await prisma.parent.findUnique({
    where: { userId: parentUser.id },
  });
  if (!parentProfile) {
    throw new Error('Profil parent non créé');
  }

  await prisma.studentParent.create({
    data: {
      parentId: parentProfile.id,
      studentId: input.studentId,
      relation,
    },
  });

  let parentSetupEmailSent = false;
  if (shouldSendSetupEmail) {
    try {
      await inviteNewUserToSetPassword(parentUser.id, parentUser.email, firstName);
      parentSetupEmailSent = true;
    } catch (inviteErr) {
      console.error('Invitation mot de passe (parent):', inviteErr);
    }
  }

  return {
    attempted: true,
    created: true,
    linked: true,
    parentSetupEmailSent,
    parentUserId: parentUser.id,
  };
}
