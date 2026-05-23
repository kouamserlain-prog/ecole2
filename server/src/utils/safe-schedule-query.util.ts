import type { Prisma } from '@prisma/client';
import prisma from './prisma';

const userBriefSelect = { firstName: true, lastName: true, email: true } as const;

type TeacherBrief = {
  id: string;
  user: { firstName: string; lastName: string; email: string };
};

export type ScheduleWithRelations = {
  id: string;
  classId: string;
  courseId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  substituteTeacherId: string | null;
  replacementNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  class: { id: string; name: string; level: string };
  course: {
    id: string;
    name: string;
    code: string;
    teacher: TeacherBrief | null;
  };
  substituteTeacher: TeacherBrief | null;
};

async function enrichSchedules(
  rows: Awaited<ReturnType<typeof prisma.schedule.findMany>>,
): Promise<ScheduleWithRelations[]> {
  if (rows.length === 0) return [];

  const classIds = [...new Set(rows.map((r) => r.classId))];
  const courseIds = [...new Set(rows.map((r) => r.courseId))];
  const substituteIds = [
    ...new Set(rows.map((r) => r.substituteTeacherId).filter((id): id is string => Boolean(id))),
  ];

  const [classes, courses, substitutes] = await Promise.all([
    prisma.class.findMany({
      where: { id: { in: classIds } },
      select: { id: true, name: true, level: true },
    }),
    prisma.course.findMany({
      where: { id: { in: courseIds } },
      select: { id: true, name: true, code: true, teacherId: true },
    }),
    substituteIds.length > 0
      ? prisma.teacher.findMany({
          where: { id: { in: substituteIds } },
          select: { id: true, user: { select: userBriefSelect } },
        })
      : ([] as TeacherBrief[]),
  ]);

  const teacherIds = [...new Set(courses.map((c) => c.teacherId))];
  const teachers =
    teacherIds.length > 0
      ? await prisma.teacher.findMany({
          where: { id: { in: teacherIds } },
          select: { id: true, user: { select: userBriefSelect } },
        })
      : ([] as TeacherBrief[]);

  const classMap = new Map(classes.map((c) => [c.id, c] as const));
  const courseMap = new Map(courses.map((c) => [c.id, c] as const));
  const teacherMap = new Map(teachers.map((t) => [t.id, t] as const));
  const substituteMap = new Map(substitutes.map((t) => [t.id, t] as const));

  const enriched: ScheduleWithRelations[] = [];
  for (const row of rows) {
    const cls = classMap.get(row.classId);
    const courseRow = courseMap.get(row.courseId);
    if (!cls || !courseRow) continue;

    const courseTeacher = teacherMap.get(courseRow.teacherId) ?? null;
    enriched.push({
      ...row,
      class: cls,
      course: {
        id: courseRow.id,
        name: courseRow.name,
        code: courseRow.code,
        teacher: courseTeacher,
      },
      substituteTeacher: row.substituteTeacherId
        ? substituteMap.get(row.substituteTeacherId) ?? null
        : null,
    });
  }

  return enriched;
}

/** Charge les créneaux EDT sans échouer si une relation MongoDB est orpheline. */
export async function findSchedulesWithRelations(
  where: Prisma.ScheduleWhereInput = {},
  orderBy: Prisma.ScheduleOrderByWithRelationInput[] = [
    { dayOfWeek: 'asc' },
    { startTime: 'asc' },
  ],
): Promise<ScheduleWithRelations[]> {
  const rows = await prisma.schedule.findMany({ where, orderBy });
  return enrichSchedules(rows);
}

export async function findScheduleByIdWithRelations(
  id: string,
): Promise<ScheduleWithRelations | null> {
  const row = await prisma.schedule.findUnique({ where: { id } });
  if (!row) return null;
  const [enriched] = await enrichSchedules([row]);
  return enriched ?? null;
}
