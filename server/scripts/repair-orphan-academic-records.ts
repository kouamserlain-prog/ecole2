/**
 * Supprime les notes, absences et créneaux d'emploi du temps dont le cours (ou remplaçant) n'existe plus.
 * Corrige les erreurs Prisma « Field course is required… got null ».
 */
import prisma from '../src/utils/prisma';

async function main() {
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

  if (
    orphanGrades.length +
      orphanAbsences.length +
      orphanSchedules.length +
      orphanAssignments.length +
      orphanSa.length ===
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
