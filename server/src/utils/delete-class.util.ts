import type { Prisma, PrismaClient } from '@prisma/client';

type Tx = Prisma.TransactionClient;

async function deleteCourseWithDependencies(tx: Tx, courseId: string): Promise<void> {
  await tx.schedule.deleteMany({ where: { courseId } });
  await tx.virtualClassSession.deleteMany({ where: { courseId } });

  const assignments = await tx.assignment.findMany({
    where: { courseId },
    select: { id: true },
  });
  const assignmentIds = assignments.map((a) => a.id);
  if (assignmentIds.length > 0) {
    await tx.studentAssignment.deleteMany({
      where: { assignmentId: { in: assignmentIds } },
    });
  }
  await tx.assignment.deleteMany({ where: { courseId } });
  await tx.absence.deleteMany({ where: { courseId } });
  await tx.grade.deleteMany({ where: { courseId } });

  const elearningCourses = await tx.elearningCourse.findMany({
    where: { courseId },
    select: { id: true },
  });
  for (const ec of elearningCourses) {
    await tx.elearningCourse.delete({ where: { id: ec.id } });
  }

  await tx.course.delete({ where: { id: courseId } });
}

async function deleteElearningCoursesForClass(tx: Tx, classId: string): Promise<void> {
  const courses = await tx.elearningCourse.findMany({
    where: { classId },
    select: { id: true },
  });
  for (const ec of courses) {
    await tx.elearningCourse.delete({ where: { id: ec.id } });
  }
}

/** Supprime une classe vide (sans élèves) et toutes les données pédagogiques associées. */
export async function deleteClassWithDependencies(
  prisma: PrismaClient,
  classId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const courses = await tx.course.findMany({
      where: { classId },
      select: { id: true },
    });
    for (const course of courses) {
      await deleteCourseWithDependencies(tx, course.id);
    }

    await tx.schedule.deleteMany({ where: { classId } });
    await tx.classCouncilSession.deleteMany({ where: { classId } });
    await deleteElearningCoursesForClass(tx, classId);
    await tx.virtualClassSession.deleteMany({ where: { classId } });

    await tx.announcement.updateMany({
      where: { targetClassId: classId },
      data: { targetClassId: null },
    });
    await tx.admission.updateMany({
      where: { proposedClassId: classId },
      data: { proposedClassId: null },
    });
    await tx.tuitionFeeCatalog.updateMany({
      where: { classId },
      data: { classId: null },
    });
    await tx.extracurricularOffering.updateMany({
      where: { classId },
      data: { classId: null },
    });
    await tx.academicChangeRequest.updateMany({
      where: { classId },
      data: { classId: null },
    });
    await tx.studentSchoolHistory.updateMany({
      where: { classId },
      data: { classId: null },
    });

    await tx.class.delete({ where: { id: classId } });
  });
}
