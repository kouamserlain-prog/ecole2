import express from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import type { AuthRequest } from '../middleware/auth.middleware';
import {
  classScopeWhere,
  studentScopeWhere,
  type SchoolContextRequest,
} from '../utils/school-context.util';
import { schoolMessagingRecipientUsersWhere } from '../utils/school-messaging-recipients.util';

const router = express.Router();

const userPublic = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  avatar: true,
  isActive: true,
  role: true,
} satisfies Prisma.UserSelect;

function activeStudentScope(req: SchoolContextRequest): Prisma.StudentWhereInput {
  return studentScopeWhere(req.schoolId!, req.school?.isDefault ?? false);
}

function activeClassScope(req: SchoolContextRequest): Prisma.ClassWhereInput {
  return classScopeWhere(req.schoolId!, req.school?.isDefault ?? false);
}

function activeCourseScope(req: SchoolContextRequest): Prisma.CourseWhereInput {
  return { class: activeClassScope(req) };
}

function activeTeacherScope(req: SchoolContextRequest): Prisma.TeacherWhereInput {
  const classScope = activeClassScope(req);
  return {
    OR: [{ classes: { some: classScope } }, { courses: { some: { class: classScope } } }],
  };
}

router.get('/messages', async (req: AuthRequest, res) => {
  try {
    const { unread } = req.query;
    const userId = req.user!.id;
    const rows = await prisma.message.findMany({
      where: {
        OR: [{ receiverId: userId }, { senderId: userId }],
        ...(unread === 'true' ? { read: false } : {}),
      },
      include: {
        sender: { select: userPublic },
        receiver: { select: userPublic },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/announcements', async (req: SchoolContextRequest, res) => {
  try {
    const { published, targetRole, targetClass } = req.query;
    if (targetClass && typeof targetClass === 'string') {
      const cls = await prisma.class.findFirst({
        where: { id: targetClass, ...activeClassScope(req) },
        select: { id: true },
      });
      if (!cls) return res.json([]);
    }
    const rows = await prisma.announcement.findMany({
      where: {
        ...(published !== undefined ? { published: published === 'true' } : {}),
        ...(targetRole && typeof targetRole === 'string' ? { targetRole: targetRole as never } : {}),
        ...(targetClass && typeof targetClass === 'string' ? { targetClassId: targetClass } : {}),
      },
      include: {
        author: { select: userPublic },
        targetClass: { select: { id: true, name: true, level: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/notifications', async (req: AuthRequest, res) => {
  try {
    const { unread } = req.query;
    const rows = await prisma.notification.findMany({
      where: {
        userId: req.user!.id,
        ...(unread === 'true' ? { read: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/users', async (req: SchoolContextRequest, res) => {
  try {
    const { role, isActive } = req.query;
    const schoolId = req.schoolId!;
    const isDefaultSchool = req.school?.isDefault ?? false;
    const rows = await prisma.user.findMany({
      where: {
        ...schoolMessagingRecipientUsersWhere(schoolId, isDefaultSchool),
        ...(role && typeof role === 'string' ? { role: role as never } : {}),
        ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
        teacherProfile: {
          select: {
            id: true,
            employeeId: true,
            specialization: true,
          },
        },
        studentProfile: {
          select: {
            id: true,
            studentId: true,
            class: {
              select: {
                id: true,
                name: true,
                level: true,
              },
            },
          },
        },
        parentProfile: {
          select: {
            id: true,
            profession: true,
          },
        },
        educatorProfile: {
          select: { id: true, employeeId: true, specialization: true },
        },
        staffProfile: {
          select: {
            id: true,
            employeeId: true,
            staffCategory: true,
            supportKind: true,
            jobTitle: true,
          },
        },
      },
      orderBy: { lastName: 'asc' },
      take: 2000,
    });
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/library/books', async (req, res) => {
  try {
    const { search, category, isActive } = req.query;
    const where: Prisma.LibraryBookWhereInput = {};
    if (isActive === 'false') where.isActive = false;
    else if (isActive !== 'all') where.isActive = true;
    if (category && typeof category === 'string' && category.length > 0) {
      where.category = category;
    }
    if (search && typeof search === 'string' && search.trim()) {
      const s = search.trim();
      where.OR = [
        { title: { contains: s } },
        { author: { contains: s } },
        { isbn: { contains: s } },
      ];
    }
    const rows = await prisma.libraryBook.findMany({ where, orderBy: { title: 'asc' } });
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/library/loans', async (req, res) => {
  try {
    const { status } = req.query;
    const where: Prisma.LibraryLoanWhereInput = {};
    if (status === 'ACTIVE' || status === 'RETURNED') where.status = status;
    const loans = await prisma.libraryLoan.findMany({
      where,
      include: {
        book: true,
        borrower: { select: userPublic },
      },
      orderBy: { loanedAt: 'desc' },
    });
    const now = new Date();
    res.json(
      loans.map((l) => ({
        ...l,
        isOverdue:
          l.status === 'ACTIVE' && l.returnedAt == null && new Date(l.dueDate) < now,
      })),
    );
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/library/reservations', async (req, res) => {
  try {
    const rows = await prisma.libraryReservation.findMany({
      include: { book: true, user: { select: userPublic } },
      orderBy: { reservedAt: 'desc' },
    });
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/library/penalties', async (req, res) => {
  try {
    const { paid } = req.query;
    const where: Prisma.LibraryPenaltyWhereInput = {};
    if (paid === 'true') where.paid = true;
    if (paid === 'false') where.paid = false;
    const rows = await prisma.libraryPenalty.findMany({
      where,
      include: { user: { select: userPublic } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/material/rooms', async (req, res) => {
  try {
    const { search, isActive } = req.query;
    const rows = await prisma.materialRoom.findMany({
      where: {
        ...(search &&
          typeof search === 'string' &&
          search.trim() && {
            OR: [
              { name: { contains: search.trim() } },
              { code: { contains: search.trim() } },
              { building: { contains: search.trim() } },
            ],
          }),
        ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
      },
      orderBy: { name: 'asc' },
      include: { _count: { select: { equipmentStored: true, reservations: true } } },
    });
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/material/equipment', async (req, res) => {
  try {
    const { isActive } = req.query;
    const rows = await prisma.materialEquipment.findMany({
      where: isActive !== undefined ? { isActive: isActive === 'true' } : undefined,
      orderBy: { name: 'asc' },
      include: { room: { select: { id: true, name: true, code: true } } },
    });
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/material/maintenance', async (req, res) => {
  try {
    const { status } = req.query;
    const rows = await prisma.materialMaintenance.findMany({
      where: status && typeof status === 'string' ? { status: status as never } : undefined,
      orderBy: { openedAt: 'desc' },
      include: {
        equipment: { select: { id: true, name: true, category: true } },
        room: { select: { id: true, name: true, code: true } },
        reportedBy: { select: userPublic },
        assignee: { select: userPublic },
      },
    });
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/material/allocations', async (req, res) => {
  try {
    const { status } = req.query;
    const rows = await prisma.materialAllocation.findMany({
      where: status && typeof status === 'string' ? { status: status as never } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { equipment: true },
    });
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/material/stock-items', async (req, res) => {
  try {
    const { lowStockOnly, isActive } = req.query;
    const rows = await prisma.materialStockItem.findMany({
      where: isActive !== undefined ? { isActive: isActive === 'true' } : { isActive: true },
      orderBy: { name: 'asc' },
    });
    const filtered =
      lowStockOnly === 'true'
        ? rows.filter((r) => r.currentQty <= (r.safetyQty ?? 0))
        : rows;
    res.json(filtered);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/material/room-reservations', async (req, res) => {
  try {
    const { status, from, to } = req.query;
    const rows = await prisma.materialRoomReservation.findMany({
      where: {
        ...(status && typeof status === 'string' ? { status: status as never } : {}),
        ...(from && typeof from === 'string' ? { startAt: { gte: new Date(from) } } : {}),
        ...(to && typeof to === 'string' ? { endAt: { lte: new Date(to) } } : {}),
      },
      include: { room: true, requesterUser: { select: userPublic } },
      orderBy: { startAt: 'asc' },
    });
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/pedagogical/class-stats', async (req: SchoolContextRequest, res) => {
  try {
    const { classId } = req.query;
    if (!classId || typeof classId !== 'string') {
      return res.status(400).json({ error: 'classId requis' });
    }
    const cls = await prisma.class.findFirst({
      where: { id: classId, ...activeClassScope(req) },
      select: { id: true },
    });
    if (!cls) return res.status(404).json({ error: 'Classe introuvable dans cet établissement' });
    const students = await prisma.student.findMany({
      where: { classId, ...activeStudentScope(req) },
      include: {
        user: { select: { firstName: true, lastName: true } },
        grades: { include: { course: true } },
        absences: true,
      },
    });
    const classStats = students.map((student) => {
      const grades = student.grades || [];
      const totalScore = grades.reduce(
        (sum, g) => sum + (g.score / g.maxScore) * 20 * g.coefficient,
        0,
      );
      const totalCoefficient = grades.reduce((sum, g) => sum + g.coefficient, 0);
      const average = totalCoefficient > 0 ? totalScore / totalCoefficient : 0;
      const absences = student.absences?.filter((a) => !a.excused).length || 0;
      return {
        studentId: student.studentId,
        firstName: student.user?.firstName || '',
        lastName: student.user?.lastName || '',
        average,
        absences,
        totalGrades: grades.length,
      };
    });
    res.json(classStats);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/pedagogical/course-stats', async (req: SchoolContextRequest, res) => {
  try {
    const { courseId, classId } = req.query;
    const where: Prisma.GradeWhereInput = {
      student: {
        ...activeStudentScope(req),
        ...(classId && typeof classId === 'string' ? { classId } : {}),
      },
      course: activeCourseScope(req),
    };
    if (courseId && typeof courseId === 'string') where.courseId = courseId;
    const grades = await prisma.grade.findMany({
      where,
      include: {
        student: { include: { user: { select: { firstName: true, lastName: true } } } },
        course: true,
      },
    });
    res.json({
      totalGrades: grades.length,
      average:
        grades.length > 0
          ? grades.reduce((sum, g) => sum + (g.score / g.maxScore) * 20, 0) / grades.length
          : 0,
      distribution: {
        excellent: grades.filter((g) => (g.score / g.maxScore) * 20 >= 16).length,
        good: grades.filter((g) => {
          const n = (g.score / g.maxScore) * 20;
          return n >= 12 && n < 16;
        }).length,
        average: grades.filter((g) => {
          const n = (g.score / g.maxScore) * 20;
          return n >= 10 && n < 12;
        }).length,
        weak: grades.filter((g) => (g.score / g.maxScore) * 20 < 10).length,
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/pedagogical/students-at-risk', async (req: SchoolContextRequest, res) => {
  try {
    const { classId } = req.query;
    const students = await prisma.student.findMany({
      where: {
        ...activeStudentScope(req),
        ...(classId && typeof classId === 'string' ? { classId } : {}),
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        class: { select: { name: true, level: true } },
        grades: { include: { course: true } },
        absences: true,
      },
    });
    const atRiskStudents = students
      .map((student) => {
        const grades = student.grades || [];
        const totalScore = grades.reduce(
          (sum, g) => sum + (g.score / g.maxScore) * 20 * g.coefficient,
          0,
        );
        const totalCoefficient = grades.reduce((sum, g) => sum + g.coefficient, 0);
        const average = totalCoefficient > 0 ? totalScore / totalCoefficient : 0;
        const unexcusedAbsences = student.absences?.filter((a) => !a.excused).length || 0;
        const riskLevel =
          average < 10 || unexcusedAbsences > 5 ? 'high' : average < 12 ? 'medium' : 'low';
        return {
          studentId: student.studentId,
          firstName: student.user?.firstName,
          lastName: student.user?.lastName,
          email: student.user?.email,
          class: student.class?.name || 'Non assigné',
          average,
          unexcusedAbsences,
          totalGrades: grades.length,
          riskLevel,
        };
      })
      .filter((s) => s.riskLevel !== 'low')
      .sort((a, b) => {
        if (a.riskLevel === 'high' && b.riskLevel !== 'high') return -1;
        if (a.riskLevel !== 'high' && b.riskLevel === 'high') return 1;
        return a.average - b.average;
      });
    res.json(atRiskStudents);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/reports/summary', async (req: SchoolContextRequest, res) => {
  try {
    const now = new Date();
    const studentScope = activeStudentScope(req);
    const classScope = activeClassScope(req);
    const teacherScope = activeTeacherScope(req);
    const courseScope = activeCourseScope(req);
    const [
      studentsTotal,
      studentsActive,
      teachersTotal,
      educatorsTotal,
      classesTotal,
      coursesTotal,
      assignmentsPublished,
      usersTotal,
      studentAssignmentStats,
      absenceTotals,
      allStudents,
    ] = await Promise.all([
      prisma.student.count({ where: studentScope }),
      prisma.student.count({ where: { isActive: true, enrollmentStatus: 'ACTIVE', ...studentScope } }),
      prisma.teacher.count({ where: teacherScope }),
      prisma.educator.count({ where: { classAssignments: { some: { class: classScope } } } }),
      prisma.class.count({ where: classScope }),
      prisma.course.count({ where: courseScope }),
      prisma.assignment.count({ where: { course: courseScope } }),
      prisma.user.count({ where: { schoolMemberships: { some: { schoolId: req.schoolId! } } } }),
      prisma.studentAssignment
        .findMany({ where: { student: studentScope }, select: { submitted: true } })
        .then((rows) => ({
          total: rows.length,
          submitted: rows.filter((r) => r.submitted).length,
        })),
      prisma.absence
        .findMany({ where: { student: studentScope }, select: { excused: true } })
        .then((rows) => ({
          total: rows.length,
          excused: rows.filter((a) => a.excused).length,
        })),
      prisma.student.findMany({
        where: studentScope,
        include: { grades: true, absences: true },
        take: 2000,
      }),
    ]);

    let atRiskHigh = 0;
    let atRiskMedium = 0;
    for (const student of allStudents) {
      const grades = student.grades || [];
      const totalScore = grades.reduce(
        (sum, g) => sum + (g.score / g.maxScore) * 20 * g.coefficient,
        0,
      );
      const totalCoefficient = grades.reduce((sum, g) => sum + g.coefficient, 0);
      const average = totalCoefficient > 0 ? totalScore / totalCoefficient : 0;
      const unexcusedAbsences = student.absences?.filter((a) => !a.excused).length || 0;
      const riskLevel =
        average < 10 || unexcusedAbsences > 5 ? 'high' : average < 12 ? 'medium' : 'low';
      if (riskLevel === 'high') atRiskHigh += 1;
      else if (riskLevel === 'medium') atRiskMedium += 1;
    }

    res.json({
      generatedAt: now.toISOString(),
      dashboard: {
        studentsTotal,
        studentsActive,
        teachersTotal,
        educatorsTotal,
        classesTotal,
        coursesTotal,
        assignmentsPublished,
        usersTotal,
      },
      performance: {
        atRiskHigh,
        atRiskMedium,
        atRiskTotal: atRiskHigh + atRiskMedium,
        submissionRate:
          studentAssignmentStats.total > 0
            ? Math.round(
                (studentAssignmentStats.submitted / studentAssignmentStats.total) * 1000,
              ) / 10
            : null,
        absenceExcusedRate:
          absenceTotals.total > 0
            ? Math.round((absenceTotals.excused / absenceTotals.total) * 1000) / 10
            : null,
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/courses/:courseId', async (req: SchoolContextRequest, res) => {
  try {
    const course = await prisma.course.findFirst({
      where: { id: req.params.courseId, ...activeCourseScope(req) },
      include: {
        class: {
          include: {
            students: {
              where: { isActive: true },
              include: { user: { select: { firstName: true, lastName: true } } },
            },
          },
        },
        teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!course) return res.status(404).json({ error: 'Cours non trouvé' });
    res.json(course);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/students/nfc/:nfcId', async (req: SchoolContextRequest, res) => {
  try {
    const student = await prisma.student.findFirst({
      where: { nfcId: req.params.nfcId, ...activeStudentScope(req) },
      include: {
        user: { select: userPublic },
        class: { select: { id: true, name: true, level: true } },
      },
    });
    if (!student) return res.status(404).json({ error: 'Élève non trouvé' });
    res.json(student);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/teachers/:id/schedule-availability', async (req: SchoolContextRequest, res) => {
  try {
    const teacher = await prisma.teacher.findFirst({
      where: { id: req.params.id, ...activeTeacherScope(req) },
      select: { id: true },
    });
    if (!teacher) return res.status(404).json({ error: 'Enseignant non trouvé' });
    const slots = await prisma.teacherScheduleAvailabilitySlot.findMany({
      where: { teacherId: teacher.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    res.json(slots);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/schedule-room-blocks', async (_req, res) => {
  try {
    const blocks = await prisma.roomScheduleUnavailableSlot.findMany({
      orderBy: [{ roomKey: 'asc' }, { dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    res.json(blocks);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/hr/teacher-leaves', async (req: SchoolContextRequest, res) => {
  try {
    const { status } = req.query;
    const where: Prisma.TeacherLeaveWhereInput = {};
    if (
      typeof status === 'string' &&
      ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(status)
    ) {
      where.status = status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
    }
    const rows = await prisma.teacherLeave.findMany({
      where: { ...where, teacher: activeTeacherScope(req) },
      orderBy: { startDate: 'desc' },
      include: {
        teacher: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
    });
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

router.get('/hr/teacher-performance-reviews', async (req: SchoolContextRequest, res) => {
  try {
    const rows = await prisma.teacherPerformanceReview.findMany({
      where: { teacher: activeTeacherScope(req) },
      orderBy: { createdAt: 'desc' },
      include: {
        teacher: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    });
    res.json(rows);
  } catch (error: unknown) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
});

export default router;
