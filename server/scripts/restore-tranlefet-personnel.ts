/**
 * Restaure le personnel Tranlefet et l'élève Soan KOUAME (profils + école).
 * Usage: npx tsx scripts/restore-tranlefet-personnel.ts [--confirm]
 */
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { Gender, Role, StaffCategory, SupportStaffKind } from '@prisma/client';
import prisma from '../src/utils/prisma';
import { ensureDefaultSchool } from '../src/utils/ensure-default-school.util';
import { generateDigitalCardPublicId } from '../src/utils/digital-card.util';

dotenv.config();

const DEFAULT_PASSWORD = 'Tranlefet2025!';

type PersonSpec = {
  key: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  phone?: string;
  teacher?: { specialization: string; employeeId: string };
  staff?: {
    employeeId: string;
    staffCategory: StaffCategory;
    supportKind?: SupportStaffKind;
    jobTitle: string;
  };
  educator?: { specialization: string; employeeId: string };
  student?: { studentId: string; gender: Gender; dateOfBirth: Date };
};

const PEOPLE: PersonSpec[] = [
  {
    key: 'student-soan',
    email: 'kouamesergealain@live.fr',
    firstName: 'Soan',
    lastName: 'KOUAME',
    role: 'STUDENT',
    student: {
      studentId: 'CPTB-SOAN-001',
      gender: 'MALE',
      dateOfBirth: new Date('2012-05-15'),
    },
  },
  {
    key: 'de-nguessan',
    email: 'amela.nguessan@tranlefet.ci',
    firstName: 'Amela Apollinen',
    lastName: "N'GUESSAN",
    role: 'STAFF',
    staff: {
      employeeId: 'STF-DE-001',
      staffCategory: 'SUPPORT',
      supportKind: 'STUDIES_DIRECTOR',
      jobTitle: 'Directrice des études',
    },
  },
  {
    key: 'sec-fodio',
    email: 'marie.fodio@tranlefet.ci',
    firstName: 'Marie',
    lastName: 'FODIO',
    role: 'STAFF',
    staff: {
      employeeId: 'STF-SEC-001',
      staffCategory: 'SUPPORT',
      supportKind: 'SECRETARY',
      jobTitle: 'Secrétaire',
    },
  },
  {
    key: 'bib-koua',
    email: 'jeanmarc.koua@tranlefet.ci',
    firstName: 'Jean Marc',
    lastName: 'KOUA',
    role: 'STAFF',
    staff: {
      employeeId: 'STF-BIB-001',
      staffCategory: 'SUPPORT',
      supportKind: 'LIBRARIAN',
      jobTitle: 'Bibliothécaire',
    },
  },
  {
    key: 'eco-kouame',
    email: 'sergealain.kouame@tranlefet.ci',
    firstName: 'Kouamé Serge Alain',
    lastName: 'KOUAME',
    role: 'STAFF',
    staff: {
      employeeId: 'STF-ECO-001',
      staffCategory: 'SUPPORT',
      supportKind: 'BURSAR',
      jobTitle: 'Économe',
    },
  },
  {
    key: 'prof-eps',
    email: 'laurent.kouassi@tranlefet.ci',
    firstName: 'Kan Laurent',
    lastName: 'KOUASSI',
    role: 'TEACHER',
    teacher: { specialization: 'EPS', employeeId: 'EMP-EPS-001' },
  },
  {
    key: 'prof-svt',
    email: 'daniel.toure@tranlefet.ci',
    firstName: 'Mifé Ladeban Daniel',
    lastName: 'TOURE',
    role: 'TEACHER',
    teacher: { specialization: 'SVT', employeeId: 'EMP-SVT-001' },
  },
  {
    key: 'prof-pc',
    email: 'souleymane.coulibaly@tranlefet.ci',
    firstName: 'Souleymane',
    lastName: 'COULIBALY',
    role: 'TEACHER',
    teacher: { specialization: 'Physique-Chimie', employeeId: 'EMP-PC-001' },
  },
  {
    key: 'prof-maths',
    email: 'arsene.kouassi@tranlefet.ci',
    firstName: 'Kouakou Arsene',
    lastName: 'KOUASSI',
    role: 'TEACHER',
    teacher: { specialization: 'Mathématiques', employeeId: 'EMP-MATH-001' },
  },
  {
    key: 'prof-hg',
    email: 'tesse.karidioula@tranlefet.ci',
    firstName: 'Tesse',
    lastName: 'KARIDIOULA',
    role: 'TEACHER',
    teacher: { specialization: 'Histoire-Géographie', employeeId: 'EMP-HG-001' },
  },
  {
    key: 'prof-edhc',
    email: 'aime.kouakou@tranlefet.ci',
    firstName: "N'guessan Aimé",
    lastName: 'KOUAKOU',
    role: 'TEACHER',
    teacher: { specialization: 'EDHC / Anglais', employeeId: 'EMP-EDHC-001' },
  },
  {
    key: 'prof-esp',
    email: 'desire.soro@tranlefet.ci',
    firstName: 'Tiorna Désiré',
    lastName: 'SORO',
    role: 'TEACHER',
    teacher: { specialization: 'Espagnol', employeeId: 'EMP-ESP-001' },
  },
  {
    key: 'prof-ang',
    email: 'philemon.toure@tranlefet.ci',
    firstName: 'Philémon',
    lastName: 'TOURE',
    role: 'TEACHER',
    teacher: { specialization: 'Anglais', employeeId: 'EMP-ANG-001' },
  },
  {
    key: 'prof-fr',
    email: 'eliezer.yao@tranlefet.ci',
    firstName: 'Ange Eliezer',
    lastName: 'YAO',
    role: 'TEACHER',
    teacher: { specialization: 'Français', employeeId: 'EMP-FR-001' },
  },
  {
    key: 'edu-konan',
    email: 'jonathan.konan@tranlefet.ci',
    firstName: 'Yéliké Jonathan Avril',
    lastName: 'KONAN',
    role: 'EDUCATOR',
    educator: { specialization: 'Éducateur', employeeId: 'EDU-001' },
  },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]/g, '');
}

async function findExistingUser(spec: PersonSpec) {
  const byEmail = await prisma.user.findUnique({ where: { email: spec.email } });
  if (byEmail) return byEmail;

  const candidates = await prisma.user.findMany({
    where: {
      OR: [
        {
          AND: [
            { firstName: { contains: spec.firstName.split(' ')[0], mode: 'insensitive' } },
            { lastName: { contains: spec.lastName.split(' ').pop() ?? spec.lastName, mode: 'insensitive' } },
          ],
        },
        { lastName: { equals: spec.lastName, mode: 'insensitive' } },
      ],
    },
  });

  const target = normalize(`${spec.firstName}${spec.lastName}`);
  return (
    candidates.find((u) => normalize(`${u.firstName}${u.lastName}`) === target) ??
    candidates.find(
      (u) =>
        normalize(u.lastName) === normalize(spec.lastName) &&
        normalize(u.firstName).includes(normalize(spec.firstName.split(' ')[0])),
    ) ??
    null
  );
}

async function ensureSchoolMember(schoolId: string, userId: string): Promise<void> {
  await prisma.schoolMember.upsert({
    where: { schoolId_userId: { schoolId, userId } },
    create: { schoolId, userId, isDefault: true },
    update: {},
  });
}

async function restorePerson(
  spec: PersonSpec,
  schoolId: string,
  hashedPassword: string,
  defaultClassId: string | null,
): Promise<'created' | 'updated' | 'skipped'> {
  let user = await findExistingUser(spec);
  let action: 'created' | 'updated' = 'updated';

  if (!user) {
    action = 'created';
    user = await prisma.user.create({
      data: {
        email: spec.email,
        password: hashedPassword,
        firstName: spec.firstName,
        lastName: spec.lastName,
        role: spec.role,
        phone: spec.phone,
        isActive: true,
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: spec.firstName,
        lastName: spec.lastName,
        role: spec.role,
        isActive: true,
        ...(user.email !== spec.email ? {} : {}),
      },
    });
  }

  await ensureSchoolMember(schoolId, user.id);

  if (spec.teacher) {
    await prisma.teacher.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        employeeId: spec.teacher.employeeId,
        specialization: spec.teacher.specialization,
        hireDate: new Date('2023-09-01'),
        contractType: 'CDI',
      },
      update: {
        specialization: spec.teacher.specialization,
        employeeId: spec.teacher.employeeId,
      },
    });
  }

  if (spec.staff) {
    await prisma.staffMember.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        employeeId: spec.staff.employeeId,
        staffCategory: spec.staff.staffCategory,
        supportKind: spec.staff.supportKind,
        jobTitle: spec.staff.jobTitle,
        hireDate: new Date('2023-09-01'),
        contractType: 'CDI',
        schoolId,
      },
      update: {
        employeeId: spec.staff.employeeId,
        staffCategory: spec.staff.staffCategory,
        supportKind: spec.staff.supportKind,
        jobTitle: spec.staff.jobTitle,
        schoolId,
      },
    });
  }

  if (spec.educator) {
    await prisma.educator.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        employeeId: spec.educator.employeeId,
        specialization: spec.educator.specialization,
        hireDate: new Date('2023-09-01'),
        contractType: 'CDI',
      },
      update: {
        employeeId: spec.educator.employeeId,
        specialization: spec.educator.specialization,
      },
    });
  }

  if (spec.student) {
    await prisma.student.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        studentId: spec.student.studentId,
        dateOfBirth: spec.student.dateOfBirth,
        gender: spec.student.gender,
        schoolId,
        classId: defaultClassId,
        digitalCardPublicId: generateDigitalCardPublicId(),
        enrollmentStatus: 'ACTIVE',
        isActive: true,
      },
      update: {
        studentId: spec.student.studentId,
        schoolId,
        ...(defaultClassId ? { classId: defaultClassId } : {}),
        enrollmentStatus: 'ACTIVE',
        isActive: true,
        archivedAt: null,
      },
    });
  }

  console.log(`  [${action}] ${spec.lastName} ${spec.firstName} <${user.email}> — ${spec.role}`);
  return action;
}

async function ensureDefaultClass(schoolId: string): Promise<string | null> {
  const existing = await prisma.class.findFirst({
    where: { schoolId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (existing) return existing.id;

  const track = await prisma.schoolTrack.upsert({
    where: { code: 'CPTB-COL' },
    create: {
      name: 'Collège Tranlefet',
      code: 'CPTB-COL',
      levels: ['6ème', '5ème', '4ème', '3ème'],
      academicYear: '2025-2026',
    },
    update: {},
  });

  const cls = await prisma.class.create({
    data: {
      name: '6ème A',
      level: '6ème',
      academicYear: '2025-2026',
      schoolId,
      trackId: track.id,
      capacity: 40,
    },
  });
  return cls.id;
}

async function main() {
  const confirmed = process.argv.includes('--confirm');
  if (!confirmed) {
    console.log('Aperçu — relancez avec --confirm pour appliquer.');
    console.log(`Personnes à restaurer : ${PEOPLE.length}`);
    for (const p of PEOPLE) {
      console.log(`  - ${p.lastName} ${p.firstName} (${p.role}) <${p.email}>`);
    }
    console.log(`\nMot de passe par défaut (nouveaux comptes) : ${DEFAULT_PASSWORD}`);
    process.exit(0);
  }

  const schoolId = await ensureDefaultSchool();
  const defaultClassId = await ensureDefaultClass(schoolId);
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  console.log(`Établissement : ${schoolId}`);
  console.log(`Classe par défaut élève : ${defaultClassId ?? 'aucune'}`);
  console.log('Restauration…\n');

  let created = 0;
  let updated = 0;
  for (const person of PEOPLE) {
    const result = await restorePerson(person, schoolId, hashedPassword, defaultClassId);
    if (result === 'created') created += 1;
    else if (result === 'updated') updated += 1;
  }

  console.log(`\nTerminé : ${created} créé(s), ${updated} mis à jour.`);
  if (created > 0) {
    console.log(`Mot de passe initial des nouveaux comptes : ${DEFAULT_PASSWORD}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
