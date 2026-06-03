/**
 * Supprime tous les cours (matières) et leurs données liées :
 * notes, absences, devoirs, emploi du temps, e-learning, classes virtuelles, pointages prof.
 */
import dotenv from 'dotenv';
import prisma from '../src/utils/prisma';

dotenv.config();

async function deleteElearningForCourses(courseIds: string[]): Promise<number> {
  const elearningCourses = await prisma.elearningCourse.findMany({
    where: { courseId: { in: courseIds } },
    select: { id: true },
  });
  const elearningIds = elearningCourses.map((e) => e.id);
  if (elearningIds.length === 0) return 0;

  const lessons = await prisma.elearningLesson.findMany({
    where: { elearningCourseId: { in: elearningIds } },
    select: { id: true },
  });
  const lessonIds = lessons.map((l) => l.id);

  const quizzes = await prisma.elearningQuiz.findMany({
    where: { lessonId: { in: lessonIds } },
    select: { id: true },
  });
  const quizIds = quizzes.map((q) => q.id);

  if (lessonIds.length > 0) {
    await prisma.elearningLessonProgress.deleteMany({ where: { lessonId: { in: lessonIds } } });
  }
  if (quizIds.length > 0) {
    await prisma.elearningQuizAttempt.deleteMany({ where: { quizId: { in: quizIds } } });
    await prisma.elearningQuizQuestion.deleteMany({ where: { quizId: { in: quizIds } } });
  }
  if (lessonIds.length > 0) {
    await prisma.elearningQuiz.deleteMany({ where: { lessonId: { in: lessonIds } } });
    await prisma.elearningLesson.deleteMany({ where: { id: { in: lessonIds } } });
  }

  await prisma.virtualClassSession.deleteMany({
    where: { OR: [{ courseId: { in: courseIds } }, { elearningCourseId: { in: elearningIds } }] },
  });
  const deleted = await prisma.elearningCourse.deleteMany({ where: { id: { in: elearningIds } } });
  return deleted.count;
}

async function main() {
  const courses = await prisma.course.findMany({ select: { id: true, name: true, code: true } });
  if (courses.length === 0) {
    console.log('Aucun cours à supprimer.');
    return;
  }

  const courseIds = courses.map((c) => c.id);
  console.log(`Suppression de ${courses.length} cours…`);

  const assignments = await prisma.assignment.findMany({
    where: { courseId: { in: courseIds } },
    select: { id: true },
  });
  const assignmentIds = assignments.map((a) => a.id);

  const [
    schedules,
    studentAssignments,
    assignmentsDeleted,
    absences,
    grades,
    teacherAtt,
    virtualSessions,
  ] = await prisma.$transaction([
    prisma.schedule.deleteMany({ where: { courseId: { in: courseIds } } }),
    assignmentIds.length > 0
      ? prisma.studentAssignment.deleteMany({ where: { assignmentId: { in: assignmentIds } } })
      : prisma.studentAssignment.deleteMany({ where: { id: { in: [] } } }),
    prisma.assignment.deleteMany({ where: { courseId: { in: courseIds } } }),
    prisma.absence.deleteMany({ where: { courseId: { in: courseIds } } }),
    prisma.grade.deleteMany({ where: { courseId: { in: courseIds } } }),
    prisma.teacherAttendance.deleteMany({ where: { courseId: { in: courseIds } } }),
    prisma.virtualClassSession.deleteMany({ where: { courseId: { in: courseIds } } }),
  ]);

  const elearningDeleted = await deleteElearningForCourses(courseIds);
  const coursesDeleted = await prisma.course.deleteMany({ where: { id: { in: courseIds } } });

  console.log('Cours supprimés:', coursesDeleted.count);
  console.log('Créneaux EDT supprimés:', schedules.count);
  console.log('Devoirs supprimés:', assignmentsDeleted.count);
  console.log('Réponses devoirs supprimées:', studentAssignments.count);
  console.log('Absences supprimées:', absences.count);
  console.log('Notes supprimées:', grades.count);
  console.log('Pointages prof supprimés:', teacherAtt.count);
  console.log('Sessions virtuelles supprimées:', virtualSessions.count);
  console.log('Parcours e-learning supprimés:', elearningDeleted);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
