import type { Prisma } from '@prisma/client';
import { PLATFORM_MESSAGING_ROLES } from './internal-messaging.util';
import { classScopeWhere, studentScopeWhere } from './school-context.util';

/**
 * Utilisateurs pouvant être destinataires de la messagerie interne pour un établissement.
 * Ne se limite pas à school_members (souvent incomplet) : inclut aussi les profils rattachés à l’école.
 */
export function schoolMessagingRecipientUsersWhere(
  schoolId: string,
  isDefaultSchool = false,
): Prisma.UserWhereInput {
  const classScope = classScopeWhere(schoolId, isDefaultSchool);
  const studentScope = studentScopeWhere(schoolId, isDefaultSchool);
  const teacherScope: Prisma.TeacherWhereInput = {
    OR: [{ classes: { some: classScope } }, { courses: { some: { class: classScope } } }],
  };
  const educatorScope: Prisma.EducatorWhereInput = {
    classAssignments: { some: { class: classScope } },
  };
  const staffScope: Prisma.StaffMemberWhereInput = isDefaultSchool
    ? { OR: [{ schoolId }, { schoolId: null }] }
    : { schoolId };

  return {
    isActive: true,
    role: { in: [...PLATFORM_MESSAGING_ROLES] },
    OR: [
      { schoolMemberships: { some: { schoolId } } },
      { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      { teacherProfile: { is: teacherScope } },
      { studentProfile: { is: studentScope } },
      { educatorProfile: { is: educatorScope } },
      { staffProfile: { is: staffScope } },
      {
        parentProfile: {
          is: {
            students: { some: { student: studentScope } },
          },
        },
      },
    ],
  };
}
