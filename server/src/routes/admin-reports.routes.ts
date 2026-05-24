import express from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import type { SchoolContextRequest } from '../utils/school-context.util';
import {
  admissionScopeWhere,
  classScopeWhere,
  accountingScopeWhere,
  studentScopeWhere,
} from '../utils/school-context.util';

const router = express.Router();

function reportSchoolCtx(req: SchoolContextRequest) {
  const schoolId = req.schoolId!;
  const isDefault = req.school?.isDefault ?? false;
  return {
    schoolId,
    isDefault,
    studentWhere: studentScopeWhere(schoolId, isDefault),
    classWhere: classScopeWhere(schoolId, isDefault),
    admissionWhere: admissionScopeWhere(schoolId, isDefault),
    accountingWhere: accountingScopeWhere(schoolId, isDefault),
  };
}

function norm20(score: number, maxScore: number): number {
  const max = maxScore > 0 ? maxScore : 20;
  return (score / max) * 20;
}

/** Période scolaire (trimestres / semestres / année complète). */
function getPeriodDateRange(
  period: string,
  academicYear: string
): { start: Date; end: Date; label: string } | null {
  const parts = academicYear.split('-').map((x) => parseInt(x.trim(), 10));
  if (parts.length < 2 || parts.some((n) => !Number.isFinite(n))) return null;
  const yearStart = parts[0];
  const yearEnd = parts[1];
  let start: Date;
  let end: Date;
  let label: string;
  switch (period) {
    case 'trim1':
      start = new Date(yearStart, 8, 1);
      end = new Date(yearStart, 10, 30);
      label = 'Trimestre 1';
      break;
    case 'trim2':
      start = new Date(yearStart, 11, 1);
      end = new Date(yearEnd, 1, 28);
      label = 'Trimestre 2';
      break;
    case 'trim3':
      start = new Date(yearEnd, 2, 1);
      end = new Date(yearEnd, 6, 30);
      label = 'Trimestre 3';
      break;
    case 'sem1':
      start = new Date(yearStart, 8, 1);
      end = new Date(yearEnd, 1, 28);
      label = 'Semestre 1';
      break;
    case 'sem2':
      start = new Date(yearEnd, 2, 1);
      end = new Date(yearEnd, 6, 30);
      label = 'Semestre 2';
      break;
    case 'full':
    default:
      start = new Date(yearStart, 8, 1);
      end = new Date(yearEnd, 6, 30);
      label = 'Année scolaire complète';
  }
  return { start, end, label };
}

/**
 * Rapports académiques 11.1 : résultats par classe/matière, taux de réussite, moyennes,
 * comparaisons inter-classes, évolution des performances, synthèse de fin de période.
 */
router.get('/reports/academic', async (req: SchoolContextRequest, res) => {
  try {
    const { classWhere } = reportSchoolCtx(req);
    const academicYear = typeof req.query.academicYear === 'string' ? req.query.academicYear.trim() : '';
    const classId = typeof req.query.classId === 'string' ? req.query.classId.trim() : '';
    const period = typeof req.query.period === 'string' ? req.query.period.trim() : 'full';

    const courseWhere: Prisma.CourseWhereInput = {
      class: {
        ...classWhere,
        ...(classId ? { id: classId } : {}),
        ...(academicYear ? { academicYear } : {}),
      },
    };

    const gradeWhere: Prisma.GradeWhereInput = {
      course: courseWhere,
    };

    let dateFrom: Date | null = null;
    let dateTo: Date | null = null;
    let periodLabel = 'Toutes périodes';
    if (academicYear) {
      const range = getPeriodDateRange(period, academicYear);
      if (range) {
        dateFrom = range.start;
        dateTo = range.end;
        periodLabel = range.label;
        gradeWhere.date = { gte: range.start, lte: range.end };
      }
    }

    const grades = await prisma.grade.findMany({
      where: gradeWhere,
      select: {
        id: true,
        score: true,
        maxScore: true,
        coefficient: true,
        date: true,
        studentId: true,
        course: {
          select: {
            id: true,
            name: true,
            code: true,
            classId: true,
            class: { select: { id: true, name: true, level: true, academicYear: true } },
          },
        },
        student: {
          select: {
            id: true,
            classId: true,
            class: { select: { id: true, name: true, level: true } },
          },
        },
      },
    });

    let globalNum = 0;
    let globalDen = 0;
    for (const g of grades) {
      const n20 = norm20(g.score, g.maxScore);
      globalNum += n20 * g.coefficient;
      globalDen += g.coefficient;
    }
    const globalAverage20 = globalDen > 0 ? Math.round((globalNum / globalDen) * 100) / 100 : null;

    type ClassSubjectKey = string;
    const byClassSubject = new Map<
      ClassSubjectKey,
      {
        classId: string;
        className: string;
        level: string;
        academicYear: string | null;
        courseId: string;
        courseName: string;
        courseCode: string;
        sum: number;
        coef: number;
        gradeCount: number;
      }
    >();

    for (const g of grades) {
      const c = g.course;
      if (!c?.class) continue;
      const key = `${c.classId}::${c.id}`;
      if (!byClassSubject.has(key)) {
        byClassSubject.set(key, {
          classId: c.classId,
          className: c.class.name,
          level: c.class.level,
          academicYear: c.class.academicYear,
          courseId: c.id,
          courseName: c.name,
          courseCode: c.code,
          sum: 0,
          coef: 0,
          gradeCount: 0,
        });
      }
      const b = byClassSubject.get(key)!;
      const n20 = norm20(g.score, g.maxScore);
      b.sum += n20 * g.coefficient;
      b.coef += g.coefficient;
      b.gradeCount += 1;
    }

    const byClassSubjectRows = [...byClassSubject.values()]
      .map((b) => ({
        classId: b.classId,
        className: b.className,
        level: b.level,
        academicYear: b.academicYear,
        courseId: b.courseId,
        courseName: b.courseName,
        courseCode: b.courseCode,
        average20: b.coef > 0 ? Math.round((b.sum / b.coef) * 100) / 100 : null,
        gradesCount: b.gradeCount,
      }))
      .sort((a, b) => (b.average20 ?? 0) - (a.average20 ?? 0));

    /** Moyenne pondérée /20 par élève (notes dans le filtre). */
    const studentAgg = new Map<string, { sum: number; coef: number; classId: string | null; className: string | null }>();
    for (const g of grades) {
      const sid = g.studentId;
      const stClassId = g.student?.classId ?? g.course.classId;
      const stClassName = g.student?.class?.name ?? g.course.class.name;
      if (!studentAgg.has(sid)) {
        studentAgg.set(sid, { sum: 0, coef: 0, classId: stClassId, className: stClassName });
      }
      const sa = studentAgg.get(sid)!;
      const n20 = norm20(g.score, g.maxScore);
      sa.sum += n20 * g.coefficient;
      sa.coef += g.coefficient;
      if (!sa.classId && stClassId) {
        sa.classId = stClassId;
        sa.className = stClassName;
      }
    }

    const PASS_THRESHOLD = 10;
    const studentAverages: { studentId: string; average20: number | null; classId: string | null; className: string | null }[] = [];
    for (const [studentId, v] of studentAgg) {
      const avg = v.coef > 0 ? Math.round((v.sum / v.coef) * 100) / 100 : null;
      studentAverages.push({
        studentId,
        average20: avg,
        classId: v.classId,
        className: v.className,
      });
    }

    const classSuccess = new Map<
      string,
      { className: string; level: string | null; evaluated: number; passed: number; pooledSum: number; pooledCoef: number }
    >();

    for (const g of grades) {
      const cid = g.course.classId;
      const name = g.course.class.name;
      const level = g.course.class.level;
      if (!classSuccess.has(cid)) {
        classSuccess.set(cid, { className: name, level, evaluated: 0, passed: 0, pooledSum: 0, pooledCoef: 0 });
      }
      const cs = classSuccess.get(cid)!;
      const n20 = norm20(g.score, g.maxScore);
      cs.pooledSum += n20 * g.coefficient;
      cs.pooledCoef += g.coefficient;
    }

    for (const sa of studentAverages) {
      if (!sa.classId || sa.average20 == null) continue;
      const cs = classSuccess.get(sa.classId);
      if (!cs) continue;
      cs.evaluated += 1;
      if (sa.average20 >= PASS_THRESHOLD) cs.passed += 1;
    }

    let globalEvaluated = 0;
    let globalPassed = 0;
    for (const sa of studentAverages) {
      if (sa.average20 == null) continue;
      globalEvaluated += 1;
      if (sa.average20 >= PASS_THRESHOLD) globalPassed += 1;
    }
    const globalSuccessRate =
      globalEvaluated > 0 ? Math.round((globalPassed / globalEvaluated) * 1000) / 10 : null;

    const classComparison = [...classSuccess.entries()]
      .map(([cid, v]) => ({
        classId: cid,
        className: v.className,
        level: v.level,
        average20:
          v.pooledCoef > 0 ? Math.round((v.pooledSum / v.pooledCoef) * 100) / 100 : null,
        successRate: v.evaluated > 0 ? Math.round((v.passed / v.evaluated) * 1000) / 10 : null,
        studentsEvaluated: v.evaluated,
        studentsPassed: v.passed,
      }))
      .filter((x) => x.studentsEvaluated > 0 || x.average20 != null)
      .sort((a, b) => (b.average20 ?? 0) - (a.average20 ?? 0))
      .map((row, i) => ({ ...row, rank: i + 1 }));

    const monthMap = new Map<string, { sum: number; coef: number; count: number }>();
    for (const g of grades) {
      const d = new Date(g.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap.has(key)) monthMap.set(key, { sum: 0, coef: 0, count: 0 });
      const m = monthMap.get(key)!;
      const n20 = norm20(g.score, g.maxScore);
      m.sum += n20 * g.coefficient;
      m.coef += g.coefficient;
      m.count += 1;
    }
    const evolutionByMonth = [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => {
        const [y, mo] = month.split('-');
        return {
          month,
          label: `${mo}/${y}`,
          average20: v.coef > 0 ? Math.round((v.sum / v.coef) * 100) / 100 : null,
          gradesCount: v.count,
        };
      });

    const bullets: string[] = [];
    bullets.push(
      `${grades.length} note(s) prise(s) en compte sur la période « ${periodLabel} »` +
        (academicYear ? ` (${academicYear})` : '') +
        '.'
    );
    if (globalAverage20 != null) {
      bullets.push(`Moyenne générale pondérée : ${globalAverage20} / 20.`);
    }
    if (globalSuccessRate != null) {
      bullets.push(
        `Taux de réussite (moyenne individuelle ≥ ${PASS_THRESHOLD}/20) : ${globalSuccessRate} % (${globalPassed} / ${globalEvaluated} élèves évalués).`
      );
    }
    if (classComparison.length > 0) {
      const top = classComparison[0];
      bullets.push(
        `Classe la plus haute moyenne pondérée : ${top.className}${top.average20 != null ? ` (${top.average20}/20)` : ''}.`
      );
    }

    res.json({
      filters: {
        academicYear: academicYear || null,
        classId: classId || null,
        period,
        periodLabel,
        dateFrom: dateFrom?.toISOString() ?? null,
        dateTo: dateTo?.toISOString() ?? null,
      },
      summary: {
        gradesCount: grades.length,
        globalAverage20,
        studentsEvaluated: globalEvaluated,
        studentsPassed: globalPassed,
        globalSuccessRate,
        uniqueClasses: classComparison.length,
        uniqueCourses: byClassSubject.size,
      },
      byClassSubject: byClassSubjectRows,
      classComparison,
      evolutionByMonth,
      endOfPeriodReport: {
        title: `Synthèse — ${periodLabel}${academicYear ? ` · ${academicYear}` : ''}`,
        bullets,
      },
    });
  } catch (e) {
    console.error('GET /admin/reports/academic:', e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur serveur' });
  }
});

function academicYearToSchoolRange(academicYear: string): { start: Date; end: Date } | null {
  const parts = academicYear.split('-').map((x) => parseInt(x.trim(), 10));
  if (parts.length < 2 || parts.some((n) => !Number.isFinite(n))) return null;
  const yearStart = parts[0];
  const yearEnd = parts[1];
  return {
    start: new Date(yearStart, 8, 1),
    end: new Date(yearEnd, 6, 30, 23, 59, 59, 999),
  };
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function gbCount(row: { _count: number | { _all?: number } }): number {
  return typeof row._count === 'number' ? row._count : row._count?._all ?? 0;
}

/**
 * Rapports administratifs : effectifs, présences, inscriptions, mouvements élèves, ratios.
 */
router.get('/reports/administrative', async (req: SchoolContextRequest, res) => {
  try {
    const { studentWhere, classWhere, admissionWhere } = reportSchoolCtx(req);
    const academicYear = typeof req.query.academicYear === 'string' ? req.query.academicYear.trim() : '';
    const fromQ = typeof req.query.from === 'string' ? req.query.from.trim() : '';
    const toQ = typeof req.query.to === 'string' ? req.query.to.trim() : '';

    const now = new Date();
    let rangeStart: Date;
    let rangeEnd: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (fromQ && toQ) {
      rangeStart = new Date(fromQ);
      rangeEnd = new Date(toQ);
      if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
        return res.status(400).json({ error: 'Paramètres from / to invalides (ISO date)' });
      }
    } else if (academicYear) {
      const r = academicYearToSchoolRange(academicYear);
      if (!r) {
        return res.status(400).json({ error: 'academicYear invalide (ex. 2024-2025)' });
      }
      rangeStart = r.start;
      rangeEnd = r.end;
    } else {
      rangeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      rangeStart = new Date(rangeEnd);
      rangeStart.setDate(rangeStart.getDate() - 89);
      rangeStart.setHours(0, 0, 0, 0);
    }

    const dateKeyFrom = toYMD(rangeStart);
    const dateKeyTo = toYMD(rangeEnd);

    const classYearFilter = academicYear ? { academicYear, ...classWhere } : classWhere;
    const studentClassYearWhere = academicYear ? { class: classYearFilter } : { ...studentWhere };

    const absenceDateWhere = { gte: rangeStart, lte: rangeEnd };
    const absenceWhere: Prisma.AbsenceWhereInput = {
      date: absenceDateWhere,
      student: studentWhere,
      ...(academicYear
        ? {
            course: {
              class: classYearFilter,
            },
          }
        : {}),
    };

    const [
      studentsTotalAll,
      studentsActiveAll,
      studentsTotalScoped,
      studentsActiveScoped,
      studentsWithoutClass,
      enrollmentGroups,
      teachersTotalAll,
      educatorsTotal,
      staffTotal,
      staffByCategory,
      classesTotalAll,
      classesScoped,
      coursesInYearTeachers,
      absenceStatusGroups,
      teacherAttGroups,
      staffAttGroups,
      admissionStatusGroups,
      admissionByYear,
      transfersInRange,
      newEnrollments,
      archivedStudents,
    ] = await Promise.all([
      prisma.student.count({ where: studentWhere }),
      prisma.student.count({ where: { ...studentWhere, isActive: true, enrollmentStatus: 'ACTIVE' } }),
      prisma.student.count({ where: studentClassYearWhere }),
      prisma.student.count({
        where: {
          ...studentClassYearWhere,
          isActive: true,
          enrollmentStatus: 'ACTIVE',
        },
      }),
      prisma.student.count({ where: { ...studentWhere, classId: null } }),
      prisma.student.groupBy({
        by: ['enrollmentStatus'],
        _count: true,
        where: academicYear ? studentClassYearWhere : studentWhere,
      }),
      prisma.teacher.count({
        where: {
          OR: [
            { classes: { some: classWhere } },
            { courses: { some: { class: classWhere } } },
          ],
        },
      }),
      prisma.educator.count(),
      prisma.staffMember.count({ where: { schoolId: req.schoolId! } }),
      prisma.staffMember.groupBy({
        by: ['staffCategory'],
        where: { schoolId: req.schoolId! },
        _count: true,
      }),
      prisma.class.count({ where: classWhere }),
      academicYear ? prisma.class.count({ where: classYearFilter }) : prisma.class.count({ where: classWhere }),
      academicYear
        ? prisma.course.findMany({
            where: { class: classYearFilter },
            select: { teacherId: true },
            distinct: ['teacherId'],
          })
        : Promise.resolve([] as { teacherId: string }[]),
      prisma.absence.groupBy({
        by: ['status'],
        where: absenceWhere,
        _count: true,
      }),
      prisma.teacherAttendance.groupBy({
        by: ['status'],
        where: {
          attendanceDate: { gte: dateKeyFrom, lte: dateKeyTo },
        },
        _count: true,
      }),
      prisma.staffAttendance.groupBy({
        by: ['status'],
        where: {
          attendanceDate: { gte: dateKeyFrom, lte: dateKeyTo },
        },
        _count: true,
      }),
      prisma.admission.groupBy({
        by: ['status'],
        where: academicYear ? { ...admissionWhere, academicYear } : admissionWhere,
        _count: true,
      }),
      prisma.admission.groupBy({
        by: ['academicYear'],
        where: admissionWhere,
        _count: true,
        orderBy: { academicYear: 'desc' },
        take: 12,
      }),
      prisma.studentTransfer.findMany({
        where: {
          effectiveDate: { gte: rangeStart, lte: rangeEnd },
          student: studentWhere,
        },
        select: {
          id: true,
          transferType: true,
          effectiveDate: true,
          studentId: true,
        },
      }),
      prisma.student.count({
        where: {
          enrollmentDate: { gte: rangeStart, lte: rangeEnd },
          ...studentWhere,
          ...(academicYear ? studentClassYearWhere : {}),
        },
      }),
      prisma.student.count({
        where: {
          archivedAt: { gte: rangeStart, lte: rangeEnd, not: null },
          ...studentWhere,
          ...(academicYear ? studentClassYearWhere : {}),
        },
      }),
    ]);

    const statusCounts = (rows: { status: string; _count: number | { _all?: number } }[]) => {
      const m: Record<string, number> = {};
      for (const r of rows) {
        m[r.status] = gbCount(r);
      }
      return m;
    };

    const stAbs = statusCounts(absenceStatusGroups as { status: string; _count: number | { _all?: number } }[]);
    const teAtt = statusCounts(teacherAttGroups as { status: string; _count: number | { _all?: number } }[]);
    const stfAtt = statusCounts(staffAttGroups as { status: string; _count: number | { _all?: number } }[]);

    const sumStatuses = (m: Record<string, number>, keys: string[]) =>
      keys.reduce((s, k) => s + (m[k] ?? 0), 0);

    const studentPresDenom = sumStatuses(stAbs, ['PRESENT', 'LATE', 'ABSENT']);
    const studentPresNum = sumStatuses(stAbs, ['PRESENT', 'LATE']);
    const studentPresenceRate =
      studentPresDenom > 0 ? Math.round((studentPresNum / studentPresDenom) * 1000) / 10 : null;

    const teacherDenom = sumStatuses(teAtt, ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED']);
    const teacherNum = sumStatuses(teAtt, ['PRESENT', 'LATE']);
    const teacherPresenceRate =
      teacherDenom > 0 ? Math.round((teacherNum / teacherDenom) * 1000) / 10 : null;

    const staffDenom = sumStatuses(stfAtt, ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED']);
    const staffNum = sumStatuses(stfAtt, ['PRESENT', 'LATE']);
    const staffPresenceRate =
      staffDenom > 0 ? Math.round((staffNum / staffDenom) * 1000) / 10 : null;

    const teachersInYear = coursesInYearTeachers.length;
    const studentsForRatio = academicYear ? studentsActiveScoped : studentsActiveAll;
    const classesForRatio = academicYear ? classesScoped : classesTotalAll;
    const teachersForRatio =
      academicYear && teachersInYear > 0 ? teachersInYear : teachersTotalAll;

    const studentsPerTeacher =
      teachersForRatio > 0 ? Math.round((studentsForRatio / teachersForRatio) * 100) / 100 : null;
    const studentsPerClass =
      classesForRatio > 0 ? Math.round((studentsForRatio / classesForRatio) * 100) / 100 : null;
    const teachersPerClass =
      classesForRatio > 0 ? Math.round((teachersForRatio / classesForRatio) * 100) / 100 : null;

    const transferByType: Record<string, number> = {};
    for (const t of transfersInRange) {
      transferByType[t.transferType] = (transferByType[t.transferType] ?? 0) + 1;
    }

    const monthMap = new Map<string, Record<string, number>>();
    for (const t of transfersInRange) {
      const d = new Date(t.effectiveDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap.has(key)) monthMap.set(key, {});
      const bucket = monthMap.get(key)!;
      bucket[t.transferType] = (bucket[t.transferType] ?? 0) + 1;
    }
    const movementsByMonth = [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, types]) => {
        const [y, mo] = month.split('-');
        return { month, label: `${mo}/${y}`, ...types, total: Object.values(types).reduce((a, b) => a + b, 0) };
      });

    const admissionMap = Object.fromEntries(
      (admissionStatusGroups as { status: string; _count: number | { _all?: number } }[]).map((r) => [
        r.status,
        gbCount(r),
      ])
    );

    res.json({
      filters: {
        academicYear: academicYear || null,
        dateFrom: rangeStart.toISOString(),
        dateTo: rangeEnd.toISOString(),
        dateKeyFrom,
        dateKeyTo,
        scopeNote: academicYear
          ? `Effectifs et mouvements filtrés sur les élèves rattachés à une classe en ${academicYear}.`
          : 'Période par défaut : 90 derniers jours (présences et mouvements). Filtrez par année scolaire pour un périmètre cohérent.',
      },
      effectifs: {
        studentsTotal: academicYear ? studentsTotalScoped : studentsTotalAll,
        studentsActive: academicYear ? studentsActiveScoped : studentsActiveAll,
        studentsWithoutClass: academicYear ? undefined : studentsWithoutClass,
        studentsByEnrollmentStatus: enrollmentGroups.map((r) => ({
          status: r.enrollmentStatus,
          count: gbCount(r),
        })),
        teachersTotal: teachersTotalAll,
        teachersActiveInAcademicYearScope: academicYear ? teachersInYear : null,
        educatorsTotal,
        staffTotal,
        staffByCategory: staffByCategory.map((r) => ({
          category: r.staffCategory,
          count: gbCount(r),
        })),
        classesTotal: academicYear ? classesScoped : classesTotalAll,
      },
      presence: {
        students: {
          periodLabel: 'Pointages / absences élèves (lignes Absence)',
          byStatus: stAbs,
          totalRecords: Object.values(stAbs).reduce((a, b) => a + b, 0),
          presenceRatePercent: studentPresenceRate,
          formula: '(PRESENT + LATE) / (PRESENT + LATE + ABSENT)',
        },
        teachers: {
          periodLabel: 'Pointages enseignants',
          byStatus: teAtt,
          totalRecords: Object.values(teAtt).reduce((a, b) => a + b, 0),
          presenceRatePercent: teacherPresenceRate,
          formula: '(PRESENT + LATE) / (PRESENT + LATE + ABSENT + EXCUSED)',
        },
        staff: {
          periodLabel: 'Pointages personnel',
          byStatus: stfAtt,
          totalRecords: Object.values(stfAtt).reduce((a, b) => a + b, 0),
          presenceRatePercent: staffPresenceRate,
          formula: '(PRESENT + LATE) / (PRESENT + LATE + ABSENT + EXCUSED)',
        },
      },
      admissions: {
        byStatus: admissionMap,
        total: Object.values(admissionMap).reduce((a, b) => a + b, 0),
        byAcademicYear: admissionByYear.map((a) => ({
          academicYear: a.academicYear,
          count: gbCount(a),
        })),
      },
      studentMovements: {
        transfersTotal: transfersInRange.length,
        transfersByType: Object.entries(transferByType).map(([transferType, count]) => ({
          transferType,
          count,
        })),
        newEnrollmentsInPeriod: newEnrollments,
        archivedExitsInPeriod: archivedStudents,
        byMonth: movementsByMonth,
      },
      ratios: {
        studentsPerTeacher,
        studentsPerClass,
        teachersPerClass,
        basis: academicYear
          ? 'Élèves actifs de l’année / enseignants distincts affectés à au moins un cours de cette année'
          : 'Élèves actifs (toutes classes) / tous les enseignants',
      },
    });
  } catch (e) {
    console.error('GET /admin/reports/administrative:', e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur serveur' });
  }
});

/**
 * Rapports financiers (3) : paiements, impayés, revenus par source, dépenses, budget vs réalisé, prévisions.
 */
router.get('/reports/financial', async (req: SchoolContextRequest, res) => {
  try {
    const { studentWhere, accountingWhere } = reportSchoolCtx(req);
    const academicYear = typeof req.query.academicYear === 'string' ? req.query.academicYear.trim() : '';
    const fromQ = typeof req.query.from === 'string' ? req.query.from.trim() : '';
    const toQ = typeof req.query.to === 'string' ? req.query.to.trim() : '';

    const now = new Date();
    let rangeStart: Date;
    let rangeEnd: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (fromQ && toQ) {
      rangeStart = new Date(fromQ);
      rangeEnd = new Date(toQ);
      if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
        return res.status(400).json({ error: 'Paramètres from / to invalides (ISO date)' });
      }
    } else if (academicYear) {
      const r = academicYearToSchoolRange(academicYear);
      if (!r) {
        return res.status(400).json({ error: 'academicYear invalide (ex. 2024-2025)' });
      }
      rangeStart = r.start;
      rangeEnd = r.end;
    } else {
      rangeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      rangeStart = new Date(rangeEnd);
      rangeStart.setDate(rangeStart.getDate() - 89);
      rangeStart.setHours(0, 0, 0, 0);
    }

    const tuitionYearFilter = academicYear
      ? { academicYear, student: studentWhere }
      : { student: studentWhere };

    const [
      paymentByStatus,
      unpaidTotals,
      unpaidByFeeType,
      overdueUnpaid,
      completedInPeriod,
      expenseByCategory,
      pettyByType,
      budgetYearRows,
    ] = await Promise.all([
      prisma.payment.groupBy({
        by: ['status'],
        where: { student: studentWhere },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.tuitionFee.aggregate({
        where: { isPaid: false, ...tuitionYearFilter },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.tuitionFee.groupBy({
        by: ['feeType'],
        where: { isPaid: false, ...tuitionYearFilter },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.tuitionFee.aggregate({
        where: {
          isPaid: false,
          dueDate: { lt: now },
          ...tuitionYearFilter,
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.findMany({
        where: {
          status: 'COMPLETED',
          paidAt: { gte: rangeStart, lte: rangeEnd },
          student: studentWhere,
          ...(academicYear ? { tuitionFee: { academicYear, student: studentWhere } } : {}),
        },
        select: {
          amount: true,
          paymentMethod: true,
          paidAt: true,
          tuitionFee: { select: { feeType: true, academicYear: true } },
        },
      }),
      prisma.schoolExpense.groupBy({
        by: ['category'],
        where: {
          ...accountingWhere,
          expenseDate: { gte: rangeStart, lte: rangeEnd },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.pettyCashMovement.groupBy({
        by: ['type'],
        where: {
          ...accountingWhere,
          movementDate: { gte: rangeStart, lte: rangeEnd },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.budgetLine.groupBy({
        by: ['academicYear'],
        where: accountingWhere,
        orderBy: { academicYear: 'desc' },
        take: 1,
        _count: true,
      }),
    ]);

    const budgetYearResolved =
      academicYear ||
      (budgetYearRows.length > 0 ? budgetYearRows[0].academicYear : null);

    const budgetLines = budgetYearResolved
      ? await prisma.budgetLine.findMany({
          where: { academicYear: budgetYearResolved, ...accountingWhere },
          orderBy: [{ category: 'asc' }, { label: 'asc' }],
        })
      : [];

    const budgetRange = budgetYearResolved ? academicYearToSchoolRange(budgetYearResolved) : null;
    const expenseActualGroups =
      budgetRange != null
        ? await prisma.schoolExpense.groupBy({
            by: ['category'],
            where: {
              ...accountingWhere,
              expenseDate: { gte: budgetRange.start, lte: budgetRange.end },
            },
            _sum: { amount: true },
            _count: true,
          })
        : [];

    const actualByCategory = new Map<string, number>();
    for (const row of expenseActualGroups) {
      actualByCategory.set(row.category, row._sum.amount ?? 0);
    }

    const budgetSumByCategory = new Map<string, number>();
    for (const bl of budgetLines) {
      budgetSumByCategory.set(
        bl.category,
        (budgetSumByCategory.get(bl.category) ?? 0) + bl.budgetedAmount
      );
    }

    const budgetVsActualLines = budgetLines.map((line) => {
      const catTotal = actualByCategory.get(line.category) ?? 0;
      const denom = budgetSumByCategory.get(line.category) ?? 0;
      const share = denom > 0 ? line.budgetedAmount / denom : 0;
      const realized = Math.round(catTotal * share * 100) / 100;
      const variance = Math.round((line.budgetedAmount - realized) * 100) / 100;
      const variancePercent =
        line.budgetedAmount > 0 ? Math.round((variance / line.budgetedAmount) * 1000) / 10 : null;
      return {
        id: line.id,
        label: line.label,
        category: line.category,
        budgeted: line.budgetedAmount,
        realized,
        variance,
        variancePercent,
      };
    });

    const budgetTotalsAgg = budgetVsActualLines.reduce(
      (acc, row) => ({
        budgeted: acc.budgeted + row.budgeted,
        realized: acc.realized + row.realized,
      }),
      { budgeted: 0, realized: 0 }
    );
    const budgetTotals = {
      ...budgetTotalsAgg,
      variance: Math.round((budgetTotalsAgg.budgeted - budgetTotalsAgg.realized) * 100) / 100,
    };

    const revenueByFeeType = new Map<string, { total: number; count: number }>();
    const revenueByMethod = new Map<string, { total: number; count: number }>();
    let completedInPeriodSum = 0;
    for (const p of completedInPeriod) {
      completedInPeriodSum += p.amount;
      const ft = p.tuitionFee.feeType;
      const cur = revenueByFeeType.get(ft) ?? { total: 0, count: 0 };
      cur.total += p.amount;
      cur.count += 1;
      revenueByFeeType.set(ft, cur);
      const pm = p.paymentMethod;
      const cm = revenueByMethod.get(pm) ?? { total: 0, count: 0 };
      cm.total += p.amount;
      cm.count += 1;
      revenueByMethod.set(pm, cm);
    }

    const threeMStart = new Date(now);
    threeMStart.setMonth(threeMStart.getMonth() - 3);
    threeMStart.setHours(0, 0, 0, 0);
    const ninetyStart = new Date(now);
    ninetyStart.setDate(ninetyStart.getDate() - 89);
    ninetyStart.setHours(0, 0, 0, 0);

    const [rev3m, exp90] = await Promise.all([
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          paidAt: { gte: threeMStart, lte: now },
          student: studentWhere,
          ...(academicYear ? { tuitionFee: { academicYear, student: studentWhere } } : {}),
        },
        _sum: { amount: true },
      }),
      prisma.schoolExpense.aggregate({
        where: {
          ...accountingWhere,
          expenseDate: { gte: ninetyStart, lte: now },
        },
        _sum: { amount: true },
      }),
    ]);

    const avgMonthlyCompletedRevenue =
      Math.round((((rev3m._sum.amount ?? 0) / 3) as number) * 100) / 100;
    const avgMonthlyExpenses = Math.round((((exp90._sum.amount ?? 0) / 3) as number) * 100) / 100;

    const horizonEnd = rangeEnd.getTime() > now.getTime() ? rangeEnd : now;
    const horizonStart = rangeStart.getTime() > now.getTime() ? rangeStart : now;
    const msLeft = Math.max(0, horizonEnd.getTime() - horizonStart.getTime());
    const monthsRemaining = Math.round((msLeft / (30.44 * 86400000)) * 100) / 100;

    const projectedRevenueTrend =
      monthsRemaining > 0 && avgMonthlyCompletedRevenue > 0
        ? Math.round(avgMonthlyCompletedRevenue * monthsRemaining * 100) / 100
        : null;
    const projectedExpensesTrend =
      monthsRemaining > 0 && avgMonthlyExpenses > 0
        ? Math.round(avgMonthlyExpenses * monthsRemaining * 100) / 100
        : null;

    const uncollected = unpaidTotals._sum.amount ?? 0;
    const prudentCollection = Math.round(uncollected * 0.35 * 100) / 100;

    const pettyIn =
      pettyByType.find((r) => r.type === 'IN')?._sum.amount ?? 0;
    const pettyOut =
      pettyByType.find((r) => r.type === 'OUT')?._sum.amount ?? 0;

    const paymentStatusRows = paymentByStatus.map((r) => ({
      status: r.status,
      count: gbCount(r),
      totalAmount: Math.round((r._sum.amount ?? 0) * 100) / 100,
    }));

    res.json({
      filters: {
        academicYear: academicYear || null,
        budgetYearUsed: budgetYearResolved,
        dateFrom: rangeStart.toISOString(),
        dateTo: rangeEnd.toISOString(),
        note: academicYear
          ? 'Période = année scolaire sélectionnée. Revenus « période » = paiements complétés sur cette fenêtre.'
          : 'Sans année : fenêtre 90 jours pour revenus/dépenses de période ; état des paiements et impayés globaux (filtre année optionnel sur les impayés via le paramètre).',
      },
      paymentStatus: {
        rows: paymentStatusRows,
        totalsCount: paymentStatusRows.reduce((s, r) => s + r.count, 0),
        totalsAmount: Math.round(paymentStatusRows.reduce((s, r) => s + r.totalAmount, 0) * 100) / 100,
      },
      unpaid: {
        totalAmount: Math.round(uncollected * 100) / 100,
        count: unpaidTotals._count,
        overdueAmount: Math.round((overdueUnpaid._sum.amount ?? 0) * 100) / 100,
        overdueCount: overdueUnpaid._count,
        byFeeType: unpaidByFeeType.map((r) => ({
          feeType: r.feeType,
          count: gbCount(r),
          amount: Math.round((r._sum.amount ?? 0) * 100) / 100,
        })),
      },
      revenueBySource: {
        periodCompletedTotal: Math.round(completedInPeriodSum * 100) / 100,
        byFeeType: [...revenueByFeeType.entries()].map(([feeType, v]) => ({
          feeType,
          total: Math.round(v.total * 100) / 100,
          count: v.count,
        })),
        byPaymentMethod: [...revenueByMethod.entries()].map(([paymentMethod, v]) => ({
          paymentMethod,
          total: Math.round(v.total * 100) / 100,
          count: v.count,
        })),
      },
      expensesByCategory: expenseByCategory.map((r) => ({
        category: r.category,
        count: gbCount(r),
        totalAmount: Math.round((r._sum.amount ?? 0) * 100) / 100,
      })),
      pettyCash: {
        periodIn: Math.round(pettyIn * 100) / 100,
        periodOut: Math.round(pettyOut * 100) / 100,
        net: Math.round((pettyIn - pettyOut) * 100) / 100,
      },
      budgetVsActual: {
        academicYear: budgetYearResolved,
        lines: budgetVsActualLines,
        totals: {
          budgeted: Math.round(budgetTotals.budgeted * 100) / 100,
          realized: Math.round(budgetTotals.realized * 100) / 100,
          variance: Math.round(budgetTotals.variance * 100) / 100,
        },
        expenseScopeNote:
          budgetRange != null
            ? `Réalisé = dépenses comptabilisées du ${toYMD(budgetRange.start)} au ${toYMD(budgetRange.end)}, réparties par catégorie (lignes budget ${budgetYearResolved}).`
            : 'Aucune ligne de budget — renseignez des lignes budgétaires pour l’année ciblée.',
      },
      forecasts: {
        avgMonthlyCompletedRevenueLast3m: avgMonthlyCompletedRevenue,
        avgMonthlyExpensesLast90d: avgMonthlyExpenses,
        monthsRemainingInSelectedHorizon: monthsRemaining,
        projectedCompletedRevenueIfTrendContinues: projectedRevenueTrend,
        projectedExpensesIfTrendContinues: projectedExpensesTrend,
        uncollectedTuitionOutstanding: Math.round(uncollected * 100) / 100,
        prudentScenarioCollectionOnOutstanding: prudentCollection,
        notes: [
          'Les prévisions sont indicatives : tendance sur 3 mois pour les encaissements complétés et sur 90 jours pour les dépenses.',
          'Scénario « prudent » sur impayés : 35 % du reliquat dû, sans calage sur historique de recouvrement.',
          'Croisez ces chiffres avec le rapport comptable et les échéances réelles (trimestres, impayés anciens).',
        ],
      },
    });
  } catch (e) {
    console.error('GET /admin/reports/financial:', e);
    res.status(500).json({ error: e instanceof Error ? e.message : 'Erreur serveur' });
  }
});

export default router;
