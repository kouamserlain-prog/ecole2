import type { AbsenceStatus } from '@prisma/client';
import prisma from './prisma';
import { notifyParentsOfStudentPunch } from './attendance-parent-notify.util';
import { parseTimeOnDate, toAttendanceDateKey, findActiveScheduleSlotForCourse, findActiveScheduleSlotForTeacher, resolveLateStatus, durationMinutesFromHHMM, scheduledCheckOutAt, computeTeacherTeachingMinutes } from './schedule-slot.util';

export type PunchPhase = 'CHECK_IN' | 'CHECK_OUT' | 'ALREADY_COMPLETE';

export type PunchSource = 'NFC' | 'BIOMETRIC' | 'FACE' | 'MANUAL' | 'ADMIN';

function dayBounds(at: Date): { startOfDay: Date; endOfDay: Date } {
  const startOfDay = new Date(at);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  return { startOfDay, endOfDay };
}

function lateGraceMinutes(): number {
  const n = parseInt(process.env.ATTENDANCE_LATE_GRACE_MINUTES || '10', 10);
  return Number.isFinite(n) ? Math.max(0, n) : 10;
}

function earlyCheckInMinutes(): number {
  const n = parseInt(process.env.ATTENDANCE_EARLY_CHECKIN_MINUTES || '20', 10);
  return Number.isFinite(n) ? Math.max(0, n) : 20;
}

export async function punchStudentCourseAttendance(params: {
  studentId: string;
  courseId: string;
  teacherId: string;
  at: Date;
  source: PunchSource;
  forceStatus?: AbsenceStatus;
  minutesLate?: number | null;
  /** false = ne pas alerter les parents (défaut true) */
  notifyParents?: boolean;
}) {
  const { studentId, courseId, teacherId, at, source } = params;
  const notifyParents = params.notifyParents !== false;
  const { startOfDay, endOfDay } = dayBounds(at);

  const slot = await findActiveScheduleSlotForCourse(courseId, at, earlyCheckInMinutes());
  const grace = lateGraceMinutes();

  let existing = await prisma.absence.findFirst({
    where: { studentId, courseId, date: { gte: startOfDay, lt: endOfDay } },
  });

  if (!existing) {
    const status =
      params.forceStatus ??
      (slot ? resolveLateStatus(at, slot.startTime, grace) : ('PRESENT' as AbsenceStatus));
    const lateMins =
      status === 'LATE' && slot
        ? (params.minutesLate ??
          Math.max(
            0,
            Math.round(
              (at.getTime() - parseTimeOnDate(slot.startTime, at).getTime()) / 60_000,
            ),
          ))
        : params.minutesLate ?? undefined;

    const created = await prisma.absence.create({
      data: {
        studentId,
        courseId,
        teacherId,
        date: at,
        status,
        excused: false,
        justificationDocuments: [],
        attendanceSource: source,
        minutesLate: lateMins ?? undefined,
        checkInAt: at,
        scheduleId: slot?.id,
      },
    });
    if (notifyParents) {
      void notifyParentsOfStudentPunch({
        studentId,
        courseId,
        absenceId: created.id,
        punchPhase: 'CHECK_IN',
        at,
        status: created.status,
        minutesLate: created.minutesLate,
      });
    }
    return { absence: created, punchPhase: 'CHECK_IN' as PunchPhase };
  }

  if (!existing.checkInAt) {
    const status =
      params.forceStatus ??
      (slot ? resolveLateStatus(at, slot.startTime, grace) : existing.status);
    const updated = await prisma.absence.update({
      where: { id: existing.id },
      data: {
        checkInAt: at,
        status,
        attendanceSource: source,
        scheduleId: slot?.id ?? existing.scheduleId,
        updatedAt: new Date(),
      },
    });
    if (notifyParents) {
      void notifyParentsOfStudentPunch({
        studentId,
        courseId,
        absenceId: updated.id,
        punchPhase: 'CHECK_IN',
        at,
        status: updated.status,
        minutesLate: updated.minutesLate,
      });
    }
    return { absence: updated, punchPhase: 'CHECK_IN' as PunchPhase };
  }

  if (!existing.checkOutAt) {
    const updated = await prisma.absence.update({
      where: { id: existing.id },
      data: {
        checkOutAt: at,
        attendanceSource: source,
        updatedAt: new Date(),
      },
    });
    if (notifyParents) {
      void notifyParentsOfStudentPunch({
        studentId,
        courseId,
        absenceId: updated.id,
        punchPhase: 'CHECK_OUT',
        at,
        status: updated.status,
        minutesLate: updated.minutesLate,
      });
    }
    return { absence: updated, punchPhase: 'CHECK_OUT' as PunchPhase };
  }

  return { absence: existing, punchPhase: 'ALREADY_COMPLETE' as PunchPhase };
}

export async function punchStaffAttendance(params: {
  staffId: string;
  at: Date;
  source: PunchSource;
  recordedByUserId?: string | null;
}) {
  const dateKey = toAttendanceDateKey(params.at);

  let row = await prisma.staffAttendance.findUnique({
    where: {
      staffId_attendanceDate: { staffId: params.staffId, attendanceDate: dateKey },
    },
  });

  if (!row) {
    row = await prisma.staffAttendance.create({
      data: {
        staffId: params.staffId,
        attendanceDate: dateKey,
        status: 'PRESENT',
        source: params.source,
        checkInAt: params.at,
        recordedByUserId: params.recordedByUserId ?? undefined,
      },
    });
    return { attendance: row, punchPhase: 'CHECK_IN' as PunchPhase };
  }

  if (!row.checkInAt) {
    row = await prisma.staffAttendance.update({
      where: { id: row.id },
      data: {
        checkInAt: params.at,
        status: 'PRESENT',
        source: params.source,
        recordedByUserId: params.recordedByUserId ?? undefined,
      },
    });
    return { attendance: row, punchPhase: 'CHECK_IN' as PunchPhase };
  }

  if (!row.checkOutAt) {
    row = await prisma.staffAttendance.update({
      where: { id: row.id },
      data: {
        checkOutAt: params.at,
        source: params.source,
        recordedByUserId: params.recordedByUserId ?? undefined,
      },
    });
    return { attendance: row, punchPhase: 'CHECK_OUT' as PunchPhase };
  }

  return { attendance: row, punchPhase: 'ALREADY_COMPLETE' as PunchPhase };
}

export async function punchTeacherCourseAttendance(params: {
  teacherId: string;
  at: Date;
  source: 'NFC' | 'BIOMETRIC' | 'FACE' | 'ADMIN' | 'SELF';
  courseId?: string;
  recordedByUserId?: string | null;
}) {
  const slot = await findActiveScheduleSlotForTeacher(
    params.teacherId,
    params.at,
    params.courseId,
    earlyCheckInMinutes(),
  );

  const courseId = params.courseId ?? slot?.courseId;
  if (!courseId) {
    const err = new Error(
      'Aucun cours en cours : précisez courseId ou vérifiez l’emploi du temps de l’enseignant.',
    );
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }

  const dateKey = toAttendanceDateKey(params.at);
  const sessionKey = `${dateKey}:${courseId}`;

  const checkInAt = params.at;
  const plannedMinutes = slot
    ? durationMinutesFromHHMM(slot.startTime, slot.endTime)
    : 55;
  const checkOutAt = slot
    ? scheduledCheckOutAt(checkInAt, slot.endTime)
    : new Date(checkInAt.getTime() + plannedMinutes * 60_000);
  const teachingMinutes = computeTeacherTeachingMinutes(checkInAt, checkOutAt);
  const status: AbsenceStatus = slot
    ? resolveLateStatus(checkInAt, slot.startTime, lateGraceMinutes())
    : 'PRESENT';

  const existing = await prisma.teacherAttendance.findUnique({
    where: {
      teacherId_sessionKey: { teacherId: params.teacherId, sessionKey },
    },
  });

  if (existing?.checkInAt) {
    return {
      attendance: existing,
      punchPhase: 'ALREADY_COMPLETE' as PunchPhase,
      slot,
      courseId,
    };
  }

  const saved = await prisma.teacherAttendance.upsert({
    where: {
      teacherId_sessionKey: { teacherId: params.teacherId, sessionKey },
    },
    create: {
      teacherId: params.teacherId,
      sessionKey,
      attendanceDate: dateKey,
      courseId,
      scheduleId: slot?.id,
      status,
      source: params.source,
      recordedByUserId: params.recordedByUserId ?? undefined,
      checkInAt,
      checkOutAt,
      plannedMinutes,
      teachingMinutes,
    },
    update: {
      status,
      source: params.source,
      checkInAt,
      checkOutAt,
      plannedMinutes,
      teachingMinutes,
      scheduleId: slot?.id,
      recordedByUserId: params.recordedByUserId ?? undefined,
    },
    include: {
      teacher: {
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  return {
    attendance: saved,
    punchPhase: 'CHECK_IN' as PunchPhase,
    slot,
    courseId,
  };
}
