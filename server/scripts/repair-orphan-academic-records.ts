/**
 * Supprime les notes, absences et créneaux d'emploi du temps dont le cours (ou remplaçant) n'existe plus.
 * Corrige les erreurs Prisma « Field course is required… got null ».
 * Réaligne aussi les comptes démo (mot de passe password123) et les liens parent–élève.
 */
import bcrypt from 'bcryptjs';
import prisma from '../src/utils/prisma';

const SEED_DEMO_PASSWORD = 'password123';

const SEED_DEMO_EMAILS = [
  'admin@school.com',
  'superadmin@tranlefet.ci',
  'teacher1@school.com',
  'teacher2@school.com',
  'teacher3@school.com',
  'student1@school.com',
  'student2@school.com',
  'student3@school.com',
  'student4@school.com',
  'student5@school.com',
  'student6@school.com',
  'student7@school.com',
  'student8@school.com',
  'student9@school.com',
  'parent1@school.com',
  'parent2@school.com',
  'educator1@school.com',
  'educator2@school.com',
  'secretary@school.com',
  'bursar@school.com',
  'studies@school.com',
  'nurse@school.com',
  'librarian@school.com',
  'accountant@school.com',
] as const;

async function ensureSeedDemoPasswords(): Promise<string> {
  const hash = await bcrypt.hash(SEED_DEMO_PASSWORD, 10);
  for (const email of SEED_DEMO_EMAILS) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, password: true, isActive: true },
    });
    if (!user) continue;
    const valid = await bcrypt.compare(SEED_DEMO_PASSWORD, user.password);
    if (!valid || !user.isActive) {
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hash, isActive: true },
      });
      console.log(`Compte démo réaligné (mot de passe / actif) : ${email}`);
    }
  }
  return hash;
}

const DEMO_TEACHERS = [
  {
    email: 'teacher1@school.com',
    firstName: 'Marie',
    lastName: 'Martin',
    employeeId: 'EMP001',
    specialization: 'Mathématiques',
  },
  {
    email: 'teacher2@school.com',
    firstName: 'Pierre',
    lastName: 'Durand',
    employeeId: 'EMP002',
    specialization: 'Français',
  },
  {
    email: 'teacher3@school.com',
    firstName: 'Sophie',
    lastName: 'Bernard',
    employeeId: 'EMP003',
    specialization: 'Histoire-Géographie',
  },
] as const;

async function ensureMissingDemoTeachers(hash: string): Promise<void> {
  for (const t of DEMO_TEACHERS) {
    const existing = await prisma.user.findUnique({
      where: { email: t.email },
      include: { teacherProfile: true },
    });
    if (!existing) {
      await prisma.user.create({
        data: {
          email: t.email,
          password: hash,
          firstName: t.firstName,
          lastName: t.lastName,
          role: 'TEACHER',
          isActive: true,
          teacherProfile: {
            create: {
              employeeId: t.employeeId,
              specialization: t.specialization,
              hireDate: new Date('2020-09-01'),
              contractType: 'CDI',
            },
          },
        },
      });
      console.log(`Enseignant démo créé : ${t.email}`);
      continue;
    }
    if (existing.role === 'TEACHER' && !existing.teacherProfile) {
      const empFree = !(await prisma.teacher.findUnique({ where: { employeeId: t.employeeId } }));
      if (empFree) {
        await prisma.teacher.create({
          data: {
            userId: existing.id,
            employeeId: t.employeeId,
            specialization: t.specialization,
            hireDate: new Date('2020-09-01'),
            contractType: 'CDI',
          },
        });
        console.log(`Profil enseignant démo rétabli : ${t.email}`);
      }
    }
  }
}

async function main() {
  const hash = await ensureSeedDemoPasswords();
  await ensureMissingDemoTeachers(hash);

  const courseIds = new Set(
    (await prisma.course.findMany({ select: { id: true } })).map((c) => c.id),
  );
  const teacherIds = new Set(
    (await prisma.teacher.findMany({ select: { id: true } })).map((t) => t.id),
  );

  const grades = await prisma.grade.findMany({ select: { id: true, courseId: true, teacherId: true } });
  const orphanGrades = grades.filter((g) => !courseIds.has(g.courseId) || !teacherIds.has(g.teacherId));
  if (orphanGrades.length > 0) {
    await prisma.grade.deleteMany({ where: { id: { in: orphanGrades.map((g) => g.id) } } });
    console.log(`Notes orphelines supprimées : ${orphanGrades.length}`);
  }

  const absences = await prisma.absence.findMany({ select: { id: true, courseId: true, teacherId: true } });
  const orphanAbsences = absences.filter(
    (a) => !courseIds.has(a.courseId) || !teacherIds.has(a.teacherId),
  );
  if (orphanAbsences.length > 0) {
    await prisma.absence.deleteMany({ where: { id: { in: orphanAbsences.map((a) => a.id) } } });
    console.log(`Absences orphelines supprimées : ${orphanAbsences.length}`);
  }

  const schedules = await prisma.schedule.findMany({
    select: { id: true, classId: true, courseId: true, substituteTeacherId: true },
  });
  const classIds = new Set(
    (await prisma.class.findMany({ select: { id: true } })).map((c) => c.id),
  );
  const orphanSchedules = schedules.filter((s) => {
    if (!courseIds.has(s.courseId)) return true;
    if (!classIds.has(s.classId)) return true;
    if (s.substituteTeacherId && !teacherIds.has(s.substituteTeacherId)) return true;
    return false;
  });
  if (orphanSchedules.length > 0) {
    await prisma.schedule.deleteMany({ where: { id: { in: orphanSchedules.map((s) => s.id) } } });
    console.log(`Créneaux EDT orphelins supprimés : ${orphanSchedules.length}`);
  }

  const assignments = await prisma.assignment.findMany({ select: { id: true, courseId: true, teacherId: true } });
  const orphanAssignments = assignments.filter(
    (a) => !courseIds.has(a.courseId) || !teacherIds.has(a.teacherId),
  );
  if (orphanAssignments.length > 0) {
    const orphanAssignmentIds = orphanAssignments.map((a) => a.id);
    await prisma.studentAssignment.deleteMany({ where: { assignmentId: { in: orphanAssignmentIds } } });
    await prisma.assignment.deleteMany({ where: { id: { in: orphanAssignmentIds } } });
    console.log(`Devoirs orphelins supprimés : ${orphanAssignments.length}`);
  }

  const studentAssignments = await prisma.studentAssignment.findMany({
    select: { id: true, assignmentId: true },
  });
  const assignmentIds = new Set(
    (await prisma.assignment.findMany({ select: { id: true } })).map((a) => a.id),
  );
  const orphanSa = studentAssignments.filter((sa) => !assignmentIds.has(sa.assignmentId));
  if (orphanSa.length > 0) {
    await prisma.studentAssignment.deleteMany({ where: { id: { in: orphanSa.map((s) => s.id) } } });
    console.log(`Soumissions orphelines supprimées : ${orphanSa.length}`);
  }

  const parentIds = new Set((await prisma.parent.findMany({ select: { id: true } })).map((p) => p.id));
  const studentIds = new Set((await prisma.student.findMany({ select: { id: true } })).map((s) => s.id));
  const appointments = await prisma.parentTeacherAppointment.findMany({
    select: { id: true, parentId: true, teacherId: true, studentId: true },
  });
  const orphanAppointments = appointments.filter(
    (a) => !parentIds.has(a.parentId) || !teacherIds.has(a.teacherId) || !studentIds.has(a.studentId),
  );
  if (orphanAppointments.length > 0) {
    await prisma.parentTeacherAppointment.deleteMany({
      where: { id: { in: orphanAppointments.map((a) => a.id) } },
    });
    console.log(`Rendez-vous parents-enseignants orphelins supprimés : ${orphanAppointments.length}`);
  }

  const elearningCourses = await prisma.elearningCourse.findMany({
    select: { id: true, teacherId: true, classId: true, courseId: true },
  });
  const orphanElearning = elearningCourses.filter((row) => {
    if (!teacherIds.has(row.teacherId)) return true;
    if (row.classId && !classIds.has(row.classId)) return true;
    if (row.courseId && !courseIds.has(row.courseId)) return true;
    return false;
  });
  if (orphanElearning.length > 0) {
    await prisma.elearningCourse.deleteMany({ where: { id: { in: orphanElearning.map((r) => r.id) } } });
    console.log(`Parcours e-learning orphelins supprimés : ${orphanElearning.length}`);
  }

  const studentsMissingSchool = await prisma.student.findMany({
    where: {
      OR: [{ schoolId: null }, { schoolId: '' }],
      classId: { not: null },
    },
    select: { id: true, class: { select: { schoolId: true } } },
  });
  let schoolIdAligned = 0;
  for (const s of studentsMissingSchool) {
    const fromClass = s.class?.schoolId;
    if (!fromClass) continue;
    await prisma.student.update({
      where: { id: s.id },
      data: { schoolId: fromClass },
    });
    schoolIdAligned += 1;
  }
  if (schoolIdAligned > 0) {
    console.log(`Élèves : schoolId recopié depuis la classe : ${schoolIdAligned}`);
  }

  const seedParentLinks: Array<{ parentEmail: string; studentEmail: string; relation: string }> = [
    { parentEmail: 'parent1@school.com', studentEmail: 'student1@school.com', relation: 'mother' },
    { parentEmail: 'parent2@school.com', studentEmail: 'student2@school.com', relation: 'father' },
  ];
  for (const link of seedParentLinks) {
    const parentUser = await prisma.user.findUnique({
      where: { email: link.parentEmail },
      select: { parentProfile: { select: { id: true } } },
    });
    const studentUser = await prisma.user.findUnique({
      where: { email: link.studentEmail },
      select: { studentProfile: { select: { id: true } } },
    });
    const parentId = parentUser?.parentProfile?.id;
    const studentId = studentUser?.studentProfile?.id;
    if (!parentId || !studentId) continue;
    const existing = await prisma.studentParent.findFirst({ where: { parentId, studentId } });
    if (!existing) {
      await prisma.studentParent.create({ data: { parentId, studentId, relation: link.relation } });
      console.log(`Lien parent-élève rétabli : ${link.parentEmail} → ${link.studentEmail}`);
    }
  }

  const nurseUser = await prisma.user.findUnique({
    where: { email: 'nurse@school.com' },
    select: { staffProfile: { select: { id: true, visibleStaffModules: true } } },
  });
  if (nurseUser?.staffProfile) {
    const mods = new Set(nurseUser.staffProfile.visibleStaffModules);
    if (!mods.has('communication_mgmt')) {
      mods.add('communication_mgmt');
      await prisma.staffMember.update({
        where: { id: nurseUser.staffProfile.id },
        data: { visibleStaffModules: [...mods] },
      });
      console.log('Module communication_mgmt accordé à nurse@school.com');
    }
  }

  if (
    orphanGrades.length +
      orphanAbsences.length +
      orphanSchedules.length +
      orphanAssignments.length +
      orphanSa.length +
      orphanAppointments.length +
      orphanElearning.length ===
    0
  ) {
    console.log('Aucun enregistrement orphelin trouvé.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
