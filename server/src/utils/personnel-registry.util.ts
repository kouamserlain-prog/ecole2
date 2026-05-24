import type { Prisma } from '@prisma/client';
import prisma from './prisma';
import { educatorClassAssignmentInclude } from './educator-class-assignment.util';

export type PersonnelKind = 'STAFF' | 'EDUCATOR';

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatar: true,
  isActive: true,
} as const satisfies Prisma.UserSelect;

const STAFF_CAT_LABEL: Record<string, string> = {
  ADMINISTRATION: 'Administration',
  SUPPORT: 'Soutien',
  SECURITY: 'Sécurité / gardiennage',
};

const SUPPORT_KIND_LABEL: Record<string, string> = {
  LIBRARIAN: 'Bibliothécaire',
  NURSE: 'Infirmier(e)',
  SECRETARY: 'Secrétaire',
  ACCOUNTANT: 'Comptabilité',
  STUDIES_DIRECTOR: 'Directeur(trice) des études',
  BURSAR: 'Économe',
  IT: 'Informatique',
  MAINTENANCE: 'Maintenance',
  OTHER: 'Autre',
};

export type PersonnelRegistryEntry = {
  id: string;
  kind: PersonnelKind;
  employeeId: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    avatar: string | null;
    isActive: boolean;
  };
  hireDate: string;
  contractType: string | null;
  salary: number | null;
  displayCategory: string;
  displaySubCategory: string | null;
  displayRole: string | null;
  manager: { id: string; name: string } | null;
  staffCategory?: string;
  supportKind?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  specialization?: string | null;
  jobDescription?: {
    id: string;
    title: string;
    code: string | null;
  } | null;
};

function staffSchoolScopeWhere(schoolId: string | undefined) {
  if (!schoolId) return {};
  return { schoolId };
}

export async function listPersonnelRegistry(schoolId?: string): Promise<PersonnelRegistryEntry[]> {
  const [staffRows, educatorRows] = await Promise.all([
    prisma.staffMember.findMany({
      where: staffSchoolScopeWhere(schoolId),
      include: {
        user: { select: userSelect },
        jobDescription: { select: { id: true, title: true, code: true } },
        manager: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.educator.findMany({
      include: {
        user: { select: userSelect },
        ...educatorClassAssignmentInclude,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const staff: PersonnelRegistryEntry[] = staffRows.map((s) => ({
    id: s.id,
    kind: 'STAFF',
    employeeId: s.employeeId,
    user: s.user,
    hireDate: s.hireDate.toISOString(),
    contractType: s.contractType,
    salary: s.salary,
    displayCategory: STAFF_CAT_LABEL[s.staffCategory] ?? s.staffCategory,
    displaySubCategory: s.supportKind
      ? (SUPPORT_KIND_LABEL[s.supportKind] ?? s.supportKind)
      : null,
    displayRole: s.jobTitle,
    manager: s.manager
      ? {
          id: s.manager.id,
          name: `${s.manager.user.firstName} ${s.manager.user.lastName}`.trim(),
        }
      : null,
    staffCategory: s.staffCategory,
    supportKind: s.supportKind,
    jobTitle: s.jobTitle,
    department: s.department,
    jobDescription: s.jobDescription,
  }));

  const educators: PersonnelRegistryEntry[] = educatorRows.map((e) => {
    const classLabels = e.classAssignments.map(
      (a) => `${a.class.name} (${a.class.level})`,
    );
    return {
      id: e.id,
      kind: 'EDUCATOR',
      employeeId: e.employeeId,
      user: e.user,
      hireDate: e.hireDate.toISOString(),
      contractType: e.contractType,
      salary: e.salary,
      displayCategory: 'Éducateur',
      displaySubCategory:
        classLabels.length > 0
          ? `${classLabels.length} classe${classLabels.length > 1 ? 's' : ''}`
          : 'Aucune classe assignée',
      displayRole: e.specialization,
      manager: null,
      specialization: e.specialization,
    };
  });

  return [...staff, ...educators].sort((a, b) => {
    const na = `${a.user.lastName} ${a.user.firstName}`.toLocaleLowerCase('fr');
    const nb = `${b.user.lastName} ${b.user.firstName}`.toLocaleLowerCase('fr');
    return na.localeCompare(nb, 'fr');
  });
}
