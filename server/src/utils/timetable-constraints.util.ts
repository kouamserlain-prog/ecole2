import type { PrismaClient } from '@prisma/client';

type SlotLike = { dayOfWeek: number; startTime: string; endTime: string };

export const normalizeRoomKey = (room?: string | null): string | null => {
  if (!room || !room.trim()) return null;
  return room.trim().toUpperCase().replace(/\s+/g, ' ');
};

const toMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
};

export const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string): boolean => {
  const as = toMinutes(aStart);
  const ae = toMinutes(aEnd);
  const bs = toMinutes(bStart);
  const be = toMinutes(bEnd);
  return as < be && bs < ae;
};

const isInsideAtLeastOneWindow = (target: SlotLike, windows: SlotLike[]): boolean => {
  if (windows.length === 0) return true;
  const tStart = toMinutes(target.startTime);
  const tEnd = toMinutes(target.endTime);
  return windows
    .filter((w) => w.dayOfWeek === target.dayOfWeek)
    .some((w) => toMinutes(w.startTime) <= tStart && toMinutes(w.endTime) >= tEnd);
};

export async function assertScheduleConstraints(
  prisma: PrismaClient,
  input: {
    classId: string;
    courseId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room?: string | null;
    substituteTeacherId?: string | null;
  },
  excludeScheduleId?: string
): Promise<void> {
  const start = toMinutes(input.startTime);
  const end = toMinutes(input.endTime);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    throw new Error('Créneau horaire invalide');
  }

  const course = await prisma.course.findUnique({
    where: { id: input.courseId },
    select: { id: true, classId: true, teacherId: true },
  });
  if (!course) throw new Error('Cours introuvable');
  if (course.classId !== input.classId) {
    throw new Error('Le cours sélectionné ne correspond pas à la classe');
  }

  const effectiveTeacherId = input.substituteTeacherId?.trim() || course.teacherId;
  if (effectiveTeacherId === course.teacherId && input.substituteTeacherId?.trim()) {
    throw new Error('Le remplaçant doit être différent de l’enseignant titulaire');
  }

  const daySchedules = await prisma.schedule.findMany({
    where: {
      dayOfWeek: input.dayOfWeek,
      ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}),
    },
    include: {
      course: { select: { classId: true, teacherId: true } },
    },
  });

  for (const row of daySchedules) {
    if (!overlaps(input.startTime, input.endTime, row.startTime, row.endTime)) continue;

    if (row.course.classId === input.classId) {
      throw new Error('Conflit : la classe a déjà un cours sur ce créneau');
    }

    const rowEffectiveTeacher = row.substituteTeacherId || row.course.teacherId;
    if (rowEffectiveTeacher === effectiveTeacherId) {
      throw new Error('Conflit : enseignant déjà occupé sur ce créneau');
    }

    const roomA = normalizeRoomKey(input.room);
    const roomB = normalizeRoomKey(row.room);
    if (roomA && roomB && roomA === roomB) {
      throw new Error('Conflit : salle déjà occupée sur ce créneau');
    }
  }

  const availability = await prisma.teacherScheduleAvailabilitySlot.findMany({
    where: { teacherId: effectiveTeacherId, dayOfWeek: input.dayOfWeek },
  });
  if (!isInsideAtLeastOneWindow(input, availability)) {
    throw new Error("Le créneau est hors disponibilité de l'enseignant");
  }

  const roomKey = normalizeRoomKey(input.room);
  if (roomKey) {
    const roomBlocks = await prisma.roomScheduleUnavailableSlot.findMany({
      where: { roomKey, dayOfWeek: input.dayOfWeek },
    });
    const blocked = roomBlocks.some((b) =>
      overlaps(input.startTime, input.endTime, b.startTime, b.endTime)
    );
    if (blocked) throw new Error('La salle est indisponible sur ce créneau');
  }
}

const addMinutes = (time: string, delta: number): string => {
  const value = toMinutes(time);
  const m = value + delta;
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${hh}:${mm}`;
};

export async function autoGenerateTimetableForClass(
  prisma: PrismaClient,
  opts: {
    classId: string;
    clearExisting?: boolean;
    days?: number[];
    slotDurationMinutes?: number;
    morningStart?: string;
    morningEnd?: string;
    afternoonStart?: string;
    afternoonEnd?: string;
  }
): Promise<{ created: number; errors: string[]; skippedCourses: string[] }> {
  const days = opts.days?.length ? opts.days : [1, 2, 3, 4, 5];
  const slotDuration = Math.max(30, Math.min(180, opts.slotDurationMinutes ?? 60));
  const morningStart = opts.morningStart ?? '07:00';
  const morningEnd = opts.morningEnd ?? '12:00';
  const afternoonStart = opts.afternoonStart ?? '14:00';
  const afternoonEnd = opts.afternoonEnd ?? '18:00';

  if (opts.clearExisting) {
    await prisma.schedule.deleteMany({ where: { classId: opts.classId } });
  }

  const courses = await prisma.course.findMany({
    where: { classId: opts.classId },
    select: { id: true, name: true, weeklyHours: true },
    orderBy: { name: 'asc' },
  });

  const slots: Array<{ dayOfWeek: number; startTime: string; endTime: string }> = [];
  for (const day of days) {
    let cursor = morningStart;
    while (toMinutes(cursor) + slotDuration <= toMinutes(morningEnd)) {
      const end = addMinutes(cursor, slotDuration);
      slots.push({ dayOfWeek: day, startTime: cursor, endTime: end });
      cursor = end;
    }
    cursor = afternoonStart;
    while (toMinutes(cursor) + slotDuration <= toMinutes(afternoonEnd)) {
      const end = addMinutes(cursor, slotDuration);
      slots.push({ dayOfWeek: day, startTime: cursor, endTime: end });
      cursor = end;
    }
  }

  let created = 0;
  const errors: string[] = [];
  const skippedCourses: string[] = [];

  for (const course of courses) {
    let toPlace = Math.max(1, Math.ceil(course.weeklyHours ?? 1));
    let placedForCourse = 0;

    for (const slot of slots) {
      if (toPlace <= 0) break;
      try {
        await assertScheduleConstraints(prisma, {
          classId: opts.classId,
          courseId: course.id,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          room: null,
          substituteTeacherId: null,
        });
        await prisma.schedule.create({
          data: {
            classId: opts.classId,
            courseId: course.id,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            room: null,
          },
        });
        created += 1;
        placedForCourse += 1;
        toPlace -= 1;
      } catch {
        // créneau non compatible, on continue
      }
    }

    if (placedForCourse === 0) skippedCourses.push(course.name);
    if (toPlace > 0) errors.push(`Placement partiel pour ${course.name} (${placedForCourse}/${placedForCourse + toPlace})`);
  }

  return { created, errors, skippedCourses };
}

