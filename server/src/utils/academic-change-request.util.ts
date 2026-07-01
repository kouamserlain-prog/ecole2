import type {
  AcademicChangeKind,
  AcademicChangeTarget,
  AcademicChangeWorkflowStatus,
  Prisma,
  Role,
} from '@prisma/client';
import prisma from './prisma';
import { getStaffMemberModuleContext } from './staff-visible-modules.util';
import { notifyParentsNewGrade } from './parent-notify.util';

export type GradePayload = {
  studentId: string;
  courseId: string;
  teacherId: string;
  evaluationType: string;
  title: string;
  score: number;
  maxScore: number;
  coefficient: number;
  date: string | Date;
  comments?: string | null;
};

export type ReportCardPayload = {
  studentId: string;
  period: string;
  academicYear: string;
  average: number;
  rank?: number | null;
  comments?: string | null;
  published?: boolean;
};

const ACTIVE_STATUSES: AcademicChangeWorkflowStatus[] = [
  'PENDING_MAIN_TEACHER',
  'PENDING_EDUCATOR',
  'PENDING_STUDIES_DIRECTOR',
];

export async function resolveStudentClassId(studentId: string): Promise<string | null> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { classId: true },
  });
  return student?.classId ?? null;
}

const DUPLICATE_PENDING_MESSAGE =
  'Une demande de modification est déjà en cours pour cet élément.';

function throwDuplicatePending(): never {
  throw Object.assign(new Error(DUPLICATE_PENDING_MESSAGE), { statusCode: 409 });
}

async function assertNoDuplicatePending(params: {
  target: AcademicChangeTarget;
  kind: AcademicChangeKind;
  gradeId?: string | null;
  reportCardId?: string | null;
  studentId?: string;
}) {
  const where: Prisma.AcademicChangeRequestWhereInput = {
    status: { in: ACTIVE_STATUSES },
    target: params.target,
    kind: params.kind,
  };
  if (params.gradeId) {
    where.gradeId = params.gradeId;
  } else if (params.reportCardId) {
    where.reportCardId = params.reportCardId;
  } else if (params.studentId) {
    where.studentId = params.studentId;
  }

  const existing = await prisma.academicChangeRequest.findFirst({ where });
  if (existing) {
    throwDuplicatePending();
  }
}

async function assertNoDuplicateReportCardPending(params: {
  kind: AcademicChangeKind;
  reportCardId?: string | null;
  studentId: string;
  payload: ReportCardPayload;
}) {
  if (params.reportCardId) {
    await assertNoDuplicatePending({
      target: 'REPORT_CARD',
      kind: params.kind,
      reportCardId: params.reportCardId,
    });
    return;
  }

  const pending = await prisma.academicChangeRequest.findMany({
    where: {
      status: { in: ACTIVE_STATUSES },
      target: 'REPORT_CARD',
      kind: params.kind,
      studentId: params.studentId,
      reportCardId: null,
    },
  });

  const duplicateForSamePeriod = pending.some((row) => {
    const p = row.payload as ReportCardPayload;
    return p.period === params.payload.period && p.academicYear === params.payload.academicYear;
  });

  if (duplicateForSamePeriod) {
    throwDuplicatePending();
  }
}

export function gradeToPayload(grade: {
  studentId: string;
  courseId: string;
  teacherId: string;
  evaluationType: string;
  title: string;
  score: number;
  maxScore: number;
  coefficient: number;
  date: Date;
  comments: string | null;
}): GradePayload {
  return {
    studentId: grade.studentId,
    courseId: grade.courseId,
    teacherId: grade.teacherId,
    evaluationType: grade.evaluationType,
    title: grade.title,
    score: grade.score,
    maxScore: grade.maxScore,
    coefficient: grade.coefficient,
    date: grade.date.toISOString(),
    comments: grade.comments,
  };
}

export async function createGradeChangeRequest(params: {
  kind: AcademicChangeKind;
  requestedByUserId: string;
  gradeId?: string | null;
  studentId: string;
  payload: GradePayload;
  previousPayload?: GradePayload | null;
}) {
  await assertNoDuplicatePending({
    target: 'GRADE',
    kind: params.kind,
    gradeId: params.gradeId,
    studentId: params.gradeId ? undefined : params.studentId,
  });

  const classId = await resolveStudentClassId(params.studentId);

  return prisma.academicChangeRequest.create({
    data: {
      target: 'GRADE',
      kind: params.kind,
      status: 'PENDING_MAIN_TEACHER',
      studentId: params.studentId,
      classId,
      gradeId: params.gradeId ?? null,
      payload: params.payload as unknown as Prisma.InputJsonValue,
      previousPayload: params.previousPayload
        ? (params.previousPayload as unknown as Prisma.InputJsonValue)
        : undefined,
      requestedByUserId: params.requestedByUserId,
    },
  });
}

export async function createReportCardChangeRequest(params: {
  kind: AcademicChangeKind;
  requestedByUserId: string;
  reportCardId?: string | null;
  studentId: string;
  payload: ReportCardPayload;
  previousPayload?: ReportCardPayload | null;
}) {
  await assertNoDuplicateReportCardPending({
    kind: params.kind,
    reportCardId: params.reportCardId,
    studentId: params.studentId,
    payload: params.payload,
  });

  const classId = await resolveStudentClassId(params.studentId);

  return prisma.academicChangeRequest.create({
    data: {
      target: 'REPORT_CARD',
      kind: params.kind,
      status: 'PENDING_MAIN_TEACHER',
      studentId: params.studentId,
      classId,
      reportCardId: params.reportCardId ?? null,
      payload: params.payload as unknown as Prisma.InputJsonValue,
      previousPayload: params.previousPayload
        ? (params.previousPayload as unknown as Prisma.InputJsonValue)
        : undefined,
      requestedByUserId: params.requestedByUserId,
    },
  });
}

async function isMainTeacherForClass(userId: string, classId: string | null | undefined): Promise<boolean> {
  if (!classId) return false;
  const teacher = await prisma.teacher.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!teacher) return false;
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { teacherId: true },
  });
  return cls?.teacherId === teacher.id;
}

async function isStudiesDirector(userId: string, role: Role): Promise<boolean> {
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return true;
  if (role !== 'STAFF') return false;
  const ctx = await getStaffMemberModuleContext(userId);
  if (!ctx || ctx.staff.supportKind !== 'STUDIES_DIRECTOR') return false;
  return ctx.visibleModules.includes('validations');
}

export async function canUserApproveRequest(
  userId: string,
  role: Role,
  request: { status: AcademicChangeWorkflowStatus; classId: string | null }
): Promise<boolean> {
  switch (request.status) {
    case 'PENDING_MAIN_TEACHER':
      return isMainTeacherForClass(userId, request.classId);
    case 'PENDING_EDUCATOR':
      return role === 'EDUCATOR';
    case 'PENDING_STUDIES_DIRECTOR':
      return isStudiesDirector(userId, role);
    default:
      return false;
  }
}

export async function listPendingForUser(userId: string, role: Role) {
  const all = await prisma.academicChangeRequest.findMany({
    where: { status: { in: ACTIVE_STATUSES } },
    orderBy: { requestedAt: 'asc' },
    take: 200,
  });

  const filtered: typeof all = [];
  for (const req of all) {
    if (await canUserApproveRequest(userId, role, req)) {
      filtered.push(req);
    }
  }
  return enrichRequests(filtered);
}

export async function listRequestsByRequester(userId: string) {
  const rows = await prisma.academicChangeRequest.findMany({
    where: { requestedByUserId: userId },
    orderBy: { requestedAt: 'desc' },
    take: 100,
  });
  return enrichRequests(rows);
}

async function enrichRequests(requests: Awaited<ReturnType<typeof prisma.academicChangeRequest.findMany>>) {
  if (requests.length === 0) return [];

  const studentIds = [...new Set(requests.map((r) => r.studentId))];
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    include: {
      user: { select: { firstName: true, lastName: true } },
      class: { select: { id: true, name: true, level: true } },
    },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  return requests.map((r) => ({
    ...r,
    student: studentMap.get(r.studentId) ?? null,
  }));
}

async function applyGradeRequest(
  tx: Prisma.TransactionClient,
  kind: AcademicChangeKind,
  gradeId: string | null | undefined,
  payload: GradePayload,
  previousPayload: GradePayload | null | undefined
) {
  if (kind === 'CREATE') {
    await tx.grade.create({
      data: {
        studentId: payload.studentId,
        courseId: payload.courseId,
        teacherId: payload.teacherId,
        evaluationType: payload.evaluationType as never,
        title: payload.title,
        score: payload.score,
        maxScore: payload.maxScore,
        coefficient: payload.coefficient,
        date: new Date(payload.date),
        comments: payload.comments ?? null,
      },
    });
    return;
  }

  if (!gradeId) {
    throw new Error('gradeId requis pour appliquer la modification');
  }

  if (kind === 'UPDATE') {
    await tx.grade.update({
      where: { id: gradeId },
      data: {
        title: payload.title,
        score: payload.score,
        maxScore: payload.maxScore,
        coefficient: payload.coefficient,
        date: new Date(payload.date),
        comments: payload.comments ?? null,
        evaluationType: payload.evaluationType as never,
      },
    });
    return;
  }

  if (kind === 'DELETE') {
    await tx.grade.delete({ where: { id: gradeId } });
    void previousPayload;
  }
}

async function applyReportCardRequest(
  tx: Prisma.TransactionClient,
  kind: AcademicChangeKind,
  reportCardId: string | null | undefined,
  payload: ReportCardPayload
) {
  if (kind === 'CREATE') {
    await tx.reportCard.create({
      data: {
        studentId: payload.studentId,
        period: payload.period,
        academicYear: payload.academicYear,
        average: payload.average,
        rank: payload.rank ?? null,
        comments: payload.comments ?? null,
        published: payload.published ?? false,
      },
    });
    return;
  }

  if (!reportCardId) {
    throw new Error('reportCardId requis pour appliquer la modification');
  }

  await tx.reportCard.update({
    where: { id: reportCardId },
    data: {
      average: payload.average,
      rank: payload.rank ?? null,
      comments: payload.comments ?? null,
    },
  });
}

export async function applyApprovedRequest(requestId: string) {
  const request = await prisma.academicChangeRequest.findUnique({ where: { id: requestId } });
  if (!request || request.status !== 'APPROVED' || request.appliedAt) {
    return request;
  }

  const payload = request.payload as unknown as GradePayload & ReportCardPayload;
  const previousPayload = request.previousPayload as unknown as GradePayload | ReportCardPayload | null;

  await prisma.$transaction(async (tx) => {
    if (request.target === 'GRADE') {
      await applyGradeRequest(tx, request.kind, request.gradeId, payload as GradePayload, previousPayload as GradePayload);
    } else {
      await applyReportCardRequest(tx, request.kind, request.reportCardId, payload as ReportCardPayload);
    }
    await tx.academicChangeRequest.update({
      where: { id: requestId },
      data: { appliedAt: new Date() },
    });
  });

  if (
    request.target === 'GRADE' &&
    (request.kind === 'CREATE' || request.kind === 'UPDATE')
  ) {
    const gradePayload = payload as GradePayload;
    const course = await prisma.course.findUnique({
      where: { id: gradePayload.courseId },
      select: { name: true },
    });
    void notifyParentsNewGrade({
      studentId: gradePayload.studentId,
      courseName: course?.name ?? 'matière',
      score: gradePayload.score,
      maxScore: gradePayload.maxScore,
    }).catch((err) => console.error('notifyParentsNewGrade:', err));
  }

  return prisma.academicChangeRequest.findUnique({ where: { id: requestId } });
}

export async function approveAcademicChangeRequest(params: {
  requestId: string;
  userId: string;
  role: Role;
  note?: string;
}) {
  const request = await prisma.academicChangeRequest.findUnique({
    where: { id: params.requestId },
  });
  if (!request || !ACTIVE_STATUSES.includes(request.status)) {
    throw Object.assign(new Error('Demande introuvable ou déjà traitée.'), { statusCode: 404 });
  }

  const allowed = await canUserApproveRequest(params.userId, params.role, request);
  if (!allowed) {
    throw Object.assign(new Error('Vous n\'êtes pas autorisé à valider cette étape.'), { statusCode: 403 });
  }

  const now = new Date();
  let nextStatus: AcademicChangeWorkflowStatus = request.status;
  const data: Prisma.AcademicChangeRequestUpdateInput = {};

  switch (request.status) {
    case 'PENDING_MAIN_TEACHER':
      data.mainTeacherApprovedAt = now;
      data.mainTeacherApprovedByUserId = params.userId;
      data.mainTeacherNote = params.note ?? null;
      nextStatus = 'PENDING_EDUCATOR';
      break;
    case 'PENDING_EDUCATOR':
      data.educatorApprovedAt = now;
      data.educatorApprovedByUserId = params.userId;
      data.educatorNote = params.note ?? null;
      nextStatus = 'PENDING_STUDIES_DIRECTOR';
      break;
    case 'PENDING_STUDIES_DIRECTOR':
      data.studiesDirectorApprovedAt = now;
      data.studiesDirectorApprovedByUserId = params.userId;
      data.studiesDirectorNote = params.note ?? null;
      nextStatus = 'APPROVED';
      break;
    default:
      break;
  }

  data.status = nextStatus;

  const updated = await prisma.academicChangeRequest.update({
    where: { id: params.requestId },
    data,
  });

  if (nextStatus === 'APPROVED') {
    await applyApprovedRequest(updated.id);
  }

  return prisma.academicChangeRequest.findUnique({ where: { id: params.requestId } });
}

export async function rejectAcademicChangeRequest(params: {
  requestId: string;
  userId: string;
  role: Role;
  reason?: string;
}) {
  const request = await prisma.academicChangeRequest.findUnique({
    where: { id: params.requestId },
  });
  if (!request || !ACTIVE_STATUSES.includes(request.status)) {
    throw Object.assign(new Error('Demande introuvable ou déjà traitée.'), { statusCode: 404 });
  }

  const allowed = await canUserApproveRequest(params.userId, params.role, request);
  if (!allowed) {
    throw Object.assign(new Error('Vous n\'êtes pas autorisé à rejeter cette demande.'), { statusCode: 403 });
  }

  return prisma.academicChangeRequest.update({
    where: { id: params.requestId },
    data: {
      status: 'REJECTED',
      rejectedAt: new Date(),
      rejectedByUserId: params.userId,
      rejectionReason: params.reason ?? null,
    },
  });
}

export function workflowStatusLabel(status: AcademicChangeWorkflowStatus): string {
  const labels: Record<AcademicChangeWorkflowStatus, string> = {
    PENDING_MAIN_TEACHER: 'En attente — professeur principal',
    PENDING_EDUCATOR: 'En attente — éducateur',
    PENDING_STUDIES_DIRECTOR: 'En attente — directeur des études',
    APPROVED: 'Approuvée et appliquée',
    REJECTED: 'Rejetée',
  };
  return labels[status];
}
