import express from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import type { AuthRequest } from '../middleware/auth.middleware';
import { computeClassBulletinRanks } from '../utils/report-card.util';
import disciplineAdminRoutes from './admin-discipline.routes';
import orientationAdminRoutes from './admin-orientation.routes';
import extracurricularAdminRoutes from './admin-extracurricular.routes';
import adminReportsRoutes from './admin-reports.routes';
import staffPedagogyExtraRoutes from './staff-pedagogy-extra.routes';
import tuitionCatalogRoutes from './admin-tuition-catalog.routes';
import { attachSchoolContext } from '../middleware/school-context.middleware';
import { getStaffMemberModuleContext } from '../utils/staff-visible-modules.util';
import {
  staffModuleAdminPathAllowed,
  staffTuitionRatesReadAllowed,
} from '../utils/staff-module-admin-access.util';
import {
  classScopeWhere,
  studentScopeWhere,
  type SchoolContextRequest,
} from '../utils/school-context.util';
import { scopedParentWhere } from '../utils/school-access-guard.util';
import {
  absenceWhereRelationsExist,
  gradeWhereRelationsExist,
} from '../utils/prisma-relation-exists.util';

const router = express.Router();

const userPublic = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatar: true,
  isActive: true,
} satisfies Prisma.UserSelect;

const staffListInclude = {
  user: { select: userPublic },
  jobDescription: {
    select: {
      id: true,
      title: true,
      code: true,
      summary: true,
      responsibilities: true,
      requirements: true,
      suggestedCategory: true,
      suggestedCategoryOther: true,
      isActive: true,
    },
  },
  manager: {
    select: {
      id: true,
      jobTitle: true,
      user: { select: { firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.StaffMemberInclude;

async function fetchSchedulesWithValidCourses(where: Prisma.ScheduleWhereInput) {
  const rows = await prisma.schedule.findMany({
    where,
    include: {
      class: { select: { id: true, name: true, level: true } },
    },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
  if (rows.length === 0) return [];
  const courses = await prisma.course.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.courseId))] } },
    include: {
      teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
  });
  const courseById = new Map(courses.map((c) => [c.id, c]));
  return rows.flatMap((row) => {
    const course = courseById.get(row.courseId);
    if (!course) return [];
    return [{ ...row, course }];
  });
}

function stripStaffSalary<T extends { salary?: unknown }>(row: T): Omit<T, 'salary'> {
  const { salary: _s, ...rest } = row;
  return rest;
}

function activeStudentScope(req: SchoolContextRequest): Prisma.StudentWhereInput {
  return studentScopeWhere(req.schoolId!, req.school?.isDefault ?? false);
}

function activeClassScope(req: SchoolContextRequest): Prisma.ClassWhereInput {
  return classScopeWhere(req.schoolId!, req.school?.isDefault ?? false);
}

function activeStaffScope(req: SchoolContextRequest): Prisma.StaffMemberWhereInput {
  if (req.school?.isDefault) {
    return { OR: [{ schoolId: req.schoolId! }, { schoolId: null }] };
  }
  return { schoolId: req.schoolId! };
}

function activeTeacherScope(req: SchoolContextRequest): Prisma.TeacherWhereInput {
  const classScope = activeClassScope(req);
  return {
    OR: [{ classes: { some: classScope } }, { courses: { some: { class: classScope } } }],
  };
}

function activeEducatorScope(req: SchoolContextRequest): Prisma.EducatorWhereInput {
  return { classAssignments: { some: { class: activeClassScope(req) } } };
}

function activeCourseScope(req: SchoolContextRequest): Prisma.CourseWhereInput {
  return { class: activeClassScope(req) };
}

function pedagogyPathToAdminPath(path: string): string {
  const raw = path.split('?')[0] || '/';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

async function requireStaffPedagogyPathAccess(
  req: AuthRequest,
  res: express.Response,
  next: express.NextFunction,
) {
  try {
    const ctx = await getStaffMemberModuleContext(req.user!.id);
    if (!ctx) {
      return res.status(403).json({ error: 'Profil personnel introuvable.' });
    }
    const adminPath = pedagogyPathToAdminPath(req.path || '/');
    if (!staffModuleAdminPathAllowed(ctx.visibleModules, adminPath, req.method)) {
      return res.status(403).json({
        error: 'Ces données ne sont pas activées pour votre métier. Contactez l’administration.',
      });
    }
    next();
  } catch (e) {
    next(e);
  }
}

function isTuitionRatesPedagogyPath(path: string): boolean {
  const raw = path.split('?')[0] || '/';
  return (
    raw === '/tuition-level-rates' ||
    raw.startsWith('/tuition-level-rates/') ||
    raw === '/tuition-class-rates' ||
    raw.startsWith('/tuition-class-rates/')
  );
}

async function requireStaffTuitionRatesRead(
  req: AuthRequest,
  res: express.Response,
  next: express.NextFunction,
) {
  try {
    if (!isTuitionRatesPedagogyPath(req.path || '/')) {
      return next();
    }
    const ctx = await getStaffMemberModuleContext(req.user!.id);
    if (!ctx) {
      return res.status(403).json({ error: 'Profil personnel introuvable.' });
    }
    if (!staffTuitionRatesReadAllowed(ctx.visibleModules)) {
      return res.status(403).json({
        error: 'Consultation des barèmes de scolarité non autorisée pour votre compte.',
      });
    }
    next();
  } catch (e) {
    next(e);
  }
}

/** Secours si le client appelle encore /staff/pedagogy/tuition-level-rates/… (lecture seule). */
function tuitionCatalogReadOnlyRouter() {
  const sub = express.Router();
  sub.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return res.status(403).json({ error: 'Modification réservée aux administrateurs (/admin).' });
    }
    next();
  });
  sub.use(tuitionCatalogRoutes);
  return sub;
}

router.use((req, res, next) => attachSchoolContext(req as SchoolContextRequest, res, next));

router.use(requireStaffTuitionRatesRead, tuitionCatalogReadOnlyRouter());

router.use(requireStaffPedagogyPathAccess);

router.get('/students', async (req: SchoolContextRequest, res) => {
  try {
    const { classId, isActive, enrollmentStatus } = req.query;
    const students = await prisma.student.findMany({
      where: {
        ...activeStudentScope(req),
        ...(classId && { classId: classId as string }),
        ...(isActive !== undefined && { isActive: isActive === 'true' }),
        ...(enrollmentStatus &&
          typeof enrollmentStatus === 'string' && {
            enrollmentStatus: enrollmentStatus as
              | 'ACTIVE'
              | 'SUSPENDED'
              | 'GRADUATED'
              | 'ARCHIVED',
          }),
      },
      include: {
        user: { select: userPublic },
        class: { select: { id: true, name: true, level: true } },
        parents: {
          include: {
            parent: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    res.json(students);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/students/:id', async (req: SchoolContextRequest, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, ...activeStudentScope(req) },
      include: {
        user: { select: userPublic },
        class: true,
        parents: {
          include: {
            parent: { include: { user: { select: userPublic } } },
          },
        },
      },
    });
    if (!student) return res.status(404).json({ error: 'Élève introuvable' });
    res.json(student);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/classes', async (req: SchoolContextRequest, res) => {
  try {
    const classes = await prisma.class.findMany({
      where: activeClassScope(req),
      include: {
        track: { select: { id: true, name: true, code: true, academicYear: true } },
        teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        students: { include: { user: { select: { firstName: true, lastName: true } } } },
        _count: { select: { students: true } },
      },
    });
    res.json(classes);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/teachers', async (req: SchoolContextRequest, res) => {
  try {
    const teachers = await prisma.teacher.findMany({
      where: activeTeacherScope(req),
      include: {
        user: { select: userPublic },
        classes: { select: { id: true, name: true, level: true } },
        courses: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(teachers);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/teachers/:id', async (req: SchoolContextRequest, res) => {
  try {
    const teacher = await prisma.teacher.findFirst({
      where: { id: req.params.id, ...activeTeacherScope(req) },
      include: {
        user: { select: userPublic },
        classes: true,
        courses: true,
      },
    });
    if (!teacher) return res.status(404).json({ error: 'Enseignant introuvable' });
    res.json(teacher);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/educators', async (req: SchoolContextRequest, res) => {
  try {
    const educators = await prisma.educator.findMany({
      where: activeEducatorScope(req),
      include: {
        user: { select: userPublic },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(educators);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/educators/:id', async (req: SchoolContextRequest, res) => {
  try {
    const educator = await prisma.educator.findFirst({
      where: { id: req.params.id, ...activeEducatorScope(req) },
      include: {
        user: { select: userPublic },
      },
    });
    if (!educator) return res.status(404).json({ error: 'Éducateur introuvable' });
    res.json(educator);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/staff', async (req: SchoolContextRequest, res) => {
  try {
    const list = await prisma.staffMember.findMany({
      where: activeStaffScope(req),
      include: staffListInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json(list.map(stripStaffSalary));
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/staff/org-chart', async (req: SchoolContextRequest, res) => {
  try {
    const list = await prisma.staffMember.findMany({
      where: activeStaffScope(req),
      select: {
        id: true,
        employeeId: true,
        jobTitle: true,
        staffCategory: true,
        supportKind: true,
        managerId: true,
        user: { select: { firstName: true, lastName: true, isActive: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(list);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/staff/job-descriptions', async (_req, res) => {
  try {
    const rows = await prisma.jobDescription.findMany({
      orderBy: { title: 'asc' },
    });
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/staff/:id', async (req: SchoolContextRequest, res) => {
  try {
    const row = await prisma.staffMember.findFirst({
      where: { id: req.params.id, ...activeStaffScope(req) },
      include: staffListInclude,
    });
    if (!row) return res.status(404).json({ error: 'Personnel introuvable' });
    res.json(stripStaffSalary(row));
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/parents', async (req: SchoolContextRequest, res) => {
  try {
    const rows = await prisma.parent.findMany({
      where: scopedParentWhere(req.schoolId!),
      include: {
        user: { select: userPublic },
        _count: { select: { students: true, contacts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/parents/:id', async (req: SchoolContextRequest, res) => {
  try {
    const parent = await prisma.parent.findFirst({
      where: { id: req.params.id, ...scopedParentWhere(req.schoolId!) },
      include: {
        user: { select: userPublic },
        contacts: { orderBy: { sortOrder: 'asc' } },
        interactionLogs: { orderBy: { createdAt: 'desc' }, take: 250 },
        consents: { orderBy: { updatedAt: 'desc' }, take: 100 },
        students: {
          include: {
            student: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true } },
                class: { select: { id: true, name: true, level: true } },
                pickupAuthorizations: {
                  where: { isActive: true },
                  orderBy: { createdAt: 'desc' },
                },
              },
            },
          },
        },
      },
    });
    if (!parent) return res.status(404).json({ error: 'Parent introuvable' });
    res.json(parent);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/grades', async (req: SchoolContextRequest, res) => {
  try {
    const { studentId, courseId, classId } = req.query;
    const grades = await prisma.grade.findMany({
      where: {
        AND: [
          gradeWhereRelationsExist,
          { student: activeStudentScope(req) },
          ...(studentId && typeof studentId === 'string' ? [{ studentId }] : []),
          ...(courseId && typeof courseId === 'string' ? [{ courseId }] : []),
          ...(classId && typeof classId === 'string' ? [{ student: { classId } }] : []),
        ],
      },
      include: {
        student: { include: { user: { select: userPublic }, class: true } },
        course: true,
        teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    res.json(grades);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/grades/rankings', async (req: SchoolContextRequest, res) => {
  try {
    const { classId, period = 'trim1', academicYear } = req.query as {
      classId?: string;
      period?: string;
      academicYear?: string;
    };
    if (!classId || !academicYear) {
      return res.status(400).json({ error: 'classId et academicYear sont requis' });
    }
    const cls = await prisma.class.findFirst({
      where: { id: classId, ...activeClassScope(req) },
      select: { id: true },
    });
    if (!cls) return res.status(404).json({ error: 'Classe introuvable dans cet établissement' });
    const { rows, periodLabel, periodDates } = await computeClassBulletinRanks(
      classId,
      period,
      academicYear,
    );
    const students = await prisma.student.findMany({
      where: { classId, ...activeStudentScope(req) },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });
    const byId = new Map(students.map((s) => [s.id, s]));
    res.json({
      classId,
      period,
      periodLabel,
      periodDates,
      rows: rows.map((r) => ({
        ...r,
        student: byId.get(r.studentId) || null,
      })),
    });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/grades/history/:studentId', async (req: SchoolContextRequest, res) => {
  try {
    const grades = await prisma.grade.findMany({
      where: {
        AND: [
          gradeWhereRelationsExist,
          { studentId: req.params.studentId },
          { student: activeStudentScope(req) },
        ],
      },
      include: { course: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(grades);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/courses', async (req: SchoolContextRequest, res) => {
  try {
    const { classId } = req.query;
    const courses = await prisma.course.findMany({
      where: {
        ...activeCourseScope(req),
        ...(classId && typeof classId === 'string' ? { classId } : {}),
      },
      include: {
        class: { select: { id: true, name: true, level: true } },
        teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(courses);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/schedules', async (req: SchoolContextRequest, res) => {
  try {
    const { classId, courseId, teacherId } = req.query;
    const schedules = await fetchSchedulesWithValidCourses({
      class: activeClassScope(req),
      ...(classId && typeof classId === 'string' ? { classId } : {}),
      ...(courseId && typeof courseId === 'string' ? { courseId } : {}),
      ...(teacherId && typeof teacherId === 'string'
        ? {
            OR: [{ course: { teacherId } }, { substituteTeacherId: teacherId }],
          }
        : {}),
    });
    res.json(schedules);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/schedules/:id', async (req: SchoolContextRequest, res) => {
  try {
    const row = await prisma.schedule.findFirst({
      where: { id: req.params.id, class: activeClassScope(req) },
      include: { class: true },
    });
    if (!row) return res.status(404).json({ error: 'Créneau introuvable' });
    const course = await prisma.course.findUnique({
      where: { id: row.courseId },
      include: {
        teacher: { include: { user: { select: userPublic } } },
      },
    });
    if (!course) return res.status(404).json({ error: 'Cours associé introuvable' });
    res.json({ ...row, course });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/school-calendar-events', async (req, res) => {
  try {
    const { academicYear, type } = req.query;
    const events = await prisma.schoolCalendarEvent.findMany({
      where: {
        ...(academicYear && typeof academicYear === 'string' ? { academicYear } : {}),
        ...(type && typeof type === 'string' ? { type: type as never } : {}),
      },
      orderBy: { startDate: 'asc' },
    });
    res.json(events);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/school-tracks', async (req, res) => {
  try {
    const { academicYear } = req.query;
    const where: Prisma.SchoolTrackWhereInput = {};
    if (typeof academicYear === 'string' && academicYear.trim()) {
      where.academicYear = academicYear.trim();
    }
    const rows = await prisma.schoolTrack.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { classes: true, availableOptions: true } } },
    });
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/subject-options', async (_req, res) => {
  try {
    const rows = await prisma.subjectOption.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/school-tracks/:trackId/available-options', async (req, res) => {
  try {
    const rows = await prisma.schoolTrackAvailableOption.findMany({
      where: { trackId: req.params.trackId },
      include: { option: true },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/school-curricula', async (_req, res) => {
  res.json([]);
});

router.get('/school-curricula/:id', async (_req, res) => {
  res.status(404).json({ error: 'Programme introuvable' });
});

router.get('/absences', async (req: SchoolContextRequest, res) => {
  try {
    const { studentId, courseId, classId, date } = req.query;
    const absences = await prisma.absence.findMany({
      where: {
        AND: [
          absenceWhereRelationsExist,
          { student: activeStudentScope(req) },
          ...(studentId && typeof studentId === 'string' ? [{ studentId }] : []),
          ...(courseId && typeof courseId === 'string' ? [{ courseId }] : []),
          ...(classId && typeof classId === 'string' ? [{ student: { classId } }] : []),
          ...(date && typeof date === 'string' ? [{ date: new Date(date) }] : []),
        ],
      },
      include: {
        student: { include: { user: { select: userPublic } } },
        course: true,
      },
      orderBy: { date: 'desc' },
      take: 3000,
    });
    res.json(absences);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/assignments', async (req: SchoolContextRequest, res) => {
  try {
    const { courseId, classId } = req.query;
    const rows = await prisma.assignment.findMany({
      where: {
        ...(courseId && typeof courseId === 'string' ? { courseId } : {}),
        course: {
          ...activeCourseScope(req),
          ...(classId && typeof classId === 'string' ? { classId } : {}),
        },
      },
      include: {
        course: {
          select: {
            name: true,
            code: true,
            class: { select: { name: true, level: true } },
          },
        },
        teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        students: {
          include: {
            student: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
      orderBy: { dueDate: 'desc' },
    });
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/report-cards', async (req: SchoolContextRequest, res) => {
  try {
    const { classId, period, academicYear, limit } = req.query;
    const studentFilter: Prisma.StudentWhereInput = {
      ...activeStudentScope(req),
      ...(classId && typeof classId === 'string' ? { classId } : {}),
    };
    const students = await prisma.student.findMany({
      where: studentFilter,
      select: { id: true },
    });
    const where: Prisma.ReportCardWhereInput = { studentId: { in: students.map((s) => s.id) } };
    if (period && typeof period === 'string') where.period = period;
    if (academicYear && typeof academicYear === 'string') where.academicYear = academicYear;
    const rows = await prisma.reportCard.findMany({
      where,
      orderBy: [{ academicYear: 'desc' }, { period: 'desc' }, { average: 'desc' }],
      take: limit ? Math.min(parseInt(String(limit), 10) || 120, 500) : 120,
    });
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/report-cards/template/default', async (_req, res) => {
  try {
    const template = await prisma.reportCardTemplate.findFirst({
      where: { isDefault: true },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(template);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/class-councils', async (req: SchoolContextRequest, res) => {
  try {
    const { classId, period, academicYear } = req.query;
    const rows = await prisma.classCouncilSession.findMany({
      where: {
        class: activeClassScope(req),
        ...(classId && typeof classId === 'string' ? { classId } : {}),
        ...(period && typeof period === 'string' ? { period } : {}),
        ...(academicYear && typeof academicYear === 'string' ? { academicYear } : {}),
      },
      include: {
        class: { select: { id: true, name: true, level: true } },
      },
      orderBy: { meetingDate: 'desc' },
    });
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

function readOnlyAdminSubRouter() {
  const sub = express.Router();
  sub.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return res.status(403).json({ error: 'Action réservée aux administrateurs.' });
    }
    next();
  });
  sub.use(disciplineAdminRoutes);
  sub.use(orientationAdminRoutes);
  sub.use(extracurricularAdminRoutes);
  sub.use(adminReportsRoutes);
  sub.use(staffPedagogyExtraRoutes);
  return sub;
}

router.use(readOnlyAdminSubRouter());

export default router;
