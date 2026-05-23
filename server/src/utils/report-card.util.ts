import prisma from './prisma';

export type CourseAverageEntry = { total: number; count: number; average: number };

export type TermHistoryEntry = {
  average: number;
  rank: number;
  byCourse: Record<string, { average: number; rank: number }>;
};

export type ReportCardTermHistory = {
  trim1?: TermHistoryEntry;
  trim2?: TermHistoryEntry;
  trim3?: TermHistoryEntry;
};

export type ReportCardClassStats = {
  periodAverage: number;
  periodMin: number;
  periodMax: number;
  annualAverage?: number;
  annualMin?: number;
  annualMax?: number;
};

export function getPeriodDates(period: string, academicYear: string): { start: Date; end: Date } {
  const parts = academicYear.split('-').map(Number);
  const yearStart = parts[0];
  const yearEnd = parts[1] ?? yearStart + 1;
  let start: Date;
  let end: Date;

  switch (period) {
    case 'trim1':
      start = new Date(yearStart, 8, 1);
      end = new Date(yearStart, 10, 30);
      break;
    case 'trim2':
      start = new Date(yearStart, 11, 1);
      end = new Date(yearEnd, 1, 28);
      break;
    case 'trim3':
      start = new Date(yearEnd, 2, 1);
      end = new Date(yearEnd, 6, 30);
      break;
    case 'sem1':
      start = new Date(yearStart, 8, 1);
      end = new Date(yearEnd, 1, 28);
      break;
    case 'sem2':
      start = new Date(yearEnd, 2, 1);
      end = new Date(yearEnd, 6, 30);
      break;
    default:
      start = new Date(yearStart, 8, 1);
      end = new Date(yearEnd, 6, 30);
  }

  return { start, end };
}

export function getPeriodLabel(period: string): string {
  const labels: Record<string, string> = {
    trim1: 'Trimestre 1',
    trim2: 'Trimestre 2',
    trim3: 'Trimestre 3',
    sem1: 'Semestre 1',
    sem2: 'Semestre 2',
  };
  return labels[period] || period;
}

/**
 * Moyenne générale période (même logique que la génération PDF / preview).
 */
export async function computeStudentBulletinAverage(
  studentId: string,
  classId: string,
  periodDates: { start: Date; end: Date }
): Promise<number> {
  const [grades, classCourses] = await Promise.all([
    prisma.grade.findMany({
      where: {
        studentId,
        date: {
          gte: periodDates.start,
          lte: periodDates.end,
        },
      },
    }),
    prisma.course.findMany({
      where: { classId },
      select: { id: true },
    }),
  ]);

  const courseAverages: Record<string, { total: number; count: number; average: number }> = {};

  grades.forEach((grade) => {
    const courseId = grade.courseId;
    if (!courseAverages[courseId]) {
      courseAverages[courseId] = { total: 0, count: 0, average: 0 };
    }
    const gradeOn20 = (grade.score / grade.maxScore) * 20;
    courseAverages[courseId].total += gradeOn20 * grade.coefficient;
    courseAverages[courseId].count += grade.coefficient;
  });

  Object.keys(courseAverages).forEach((courseId) => {
    const c = courseAverages[courseId];
    c.average = c.count > 0 ? c.total / c.count : 0;
  });

  classCourses.forEach((course) => {
    if (!courseAverages[course.id]) {
      courseAverages[course.id] = { total: 0, count: 0, average: 0 };
    }
  });

  let totalWeightedAverage = 0;
  let totalCoefficient = 0;
  Object.entries(courseAverages).forEach(([courseId, course]) => {
    const hasGrades = grades.some((g) => g.courseId === courseId);
    if (hasGrades && course.count > 0) {
      totalWeightedAverage += course.average * course.count;
      totalCoefficient += course.count;
    }
  });

  return totalCoefficient > 0 ? totalWeightedAverage / totalCoefficient : 0;
}

export type ClassRankRow = { studentId: string; average: number; rank: number };

export async function computeClassBulletinRanks(
  classId: string,
  periodKey: string,
  academicYear: string
): Promise<{ periodLabel: string; periodDates: { start: Date; end: Date }; rows: ClassRankRow[] }> {
  const periodDates = getPeriodDates(periodKey, academicYear);
  const periodLabel = getPeriodLabel(periodKey);

  const students = await prisma.student.findMany({
    where: { classId },
    select: { id: true },
  });

  const withAvg = await Promise.all(
    students.map(async (s) => ({
      studentId: s.id,
      average: await computeStudentBulletinAverage(s.id, classId, periodDates),
    }))
  );

  withAvg.sort((a, b) => b.average - a.average);
  const rows: ClassRankRow[] = withAvg.map((r, i) => ({
    studentId: r.studentId,
    average: r.average,
    rank: i + 1,
  }));

  return { periodLabel, periodDates, rows };
}

function computeCourseAveragesFromGrades(
  grades: Array<{ courseId: string; score: number; maxScore: number; coefficient: number }>,
  classCourseIds: string[],
): Record<string, CourseAverageEntry> {
  const courseAverages: Record<string, CourseAverageEntry> = {};

  grades.forEach((grade) => {
    const courseId = grade.courseId;
    if (!courseAverages[courseId]) {
      courseAverages[courseId] = { total: 0, count: 0, average: 0 };
    }
    const gradeOn20 = (grade.score / grade.maxScore) * 20;
    courseAverages[courseId].total += gradeOn20 * grade.coefficient;
    courseAverages[courseId].count += grade.coefficient;
  });

  Object.keys(courseAverages).forEach((courseId) => {
    const course = courseAverages[courseId];
    course.average = course.count > 0 ? course.total / course.count : 0;
  });

  classCourseIds.forEach((courseId) => {
    if (!courseAverages[courseId]) {
      courseAverages[courseId] = { total: 0, count: 0, average: 0 };
    }
  });

  return courseAverages;
}

function computeOverallFromCourseAverages(
  courseAverages: Record<string, CourseAverageEntry>,
  grades: Array<{ courseId: string }>,
): number {
  let totalWeightedAverage = 0;
  let totalCoefficient = 0;
  Object.entries(courseAverages).forEach(([courseId, course]) => {
    const hasGrades = grades.some((g) => g.courseId === courseId);
    if (hasGrades && course.count > 0) {
      totalWeightedAverage += course.average * course.count;
      totalCoefficient += course.count;
    }
  });
  return totalCoefficient > 0 ? totalWeightedAverage / totalCoefficient : 0;
}

function rankByAverage(values: Array<{ id: string; average: number }>): Map<string, number> {
  const sorted = [...values].sort((a, b) => b.average - a.average);
  const ranks = new Map<string, number>();
  sorted.forEach((row, index) => ranks.set(row.id, index + 1));
  return ranks;
}

function rankCourseAverages(
  snapshots: Array<{ studentId: string; courseAverages: Record<string, CourseAverageEntry> }>,
  courseIds: string[],
): Map<string, Record<string, number>> {
  const result = new Map<string, Record<string, number>>();
  snapshots.forEach((s) => result.set(s.studentId, {}));

  courseIds.forEach((courseId) => {
    const rows = snapshots
      .map((s) => ({
        id: s.studentId,
        average: s.courseAverages[courseId]?.average ?? 0,
      }))
      .filter((r) => r.average > 0);
    const ranks = rankByAverage(rows);
    snapshots.forEach((s) => {
      const rank = ranks.get(s.studentId);
      if (rank !== undefined) {
        result.get(s.studentId)![courseId] = rank;
      }
    });
  });

  return result;
}

const TRIMESTER_PERIODS = ['trim1', 'trim2', 'trim3'] as const;

function conductPeriodLabel(period: (typeof TRIMESTER_PERIODS)[number]): string {
  const map: Record<(typeof TRIMESTER_PERIODS)[number], string> = {
    trim1: 'Trimestre 1',
    trim2: 'Trimestre 2',
    trim3: 'Trimestre 3',
  };
  return map[period];
}

/**
 * Enrichit les données bulletin avec historique trimestriel (T1/T2/T3), stats de classe et conduite.
 */
export async function enrichReportCardsWithTermHistory(
  classId: string,
  academicYear: string,
  activePeriod: string,
  reportCards: Array<{
    studentId: string;
    average?: number;
    rank?: number;
    termHistory?: ReportCardTermHistory;
    annualSummary?: { average: number; rank: number };
    classStats?: ReportCardClassStats;
    conduct?: { average: number; byTerm?: Record<string, number> };
  }>,
): Promise<void> {
  if (!TRIMESTER_PERIODS.includes(activePeriod as (typeof TRIMESTER_PERIODS)[number])) {
    return;
  }

  const classCourses = await prisma.course.findMany({
    where: { classId },
    select: { id: true },
  });
  const courseIds = classCourses.map((c) => c.id);
  const studentIds = reportCards.map((r) => r.studentId);

  type Snapshot = {
    studentId: string;
    courseAverages: Record<string, CourseAverageEntry>;
    overallAverage: number;
  };

  const termSnapshots: Record<(typeof TRIMESTER_PERIODS)[number], Snapshot[]> = {
    trim1: [],
    trim2: [],
    trim3: [],
  };

  for (const term of TRIMESTER_PERIODS) {
    const periodDates = getPeriodDates(term, academicYear);
    const snapshots: Snapshot[] = [];

    for (const studentId of studentIds) {
      const grades = await prisma.grade.findMany({
        where: {
          studentId,
          date: { gte: periodDates.start, lte: periodDates.end },
        },
        select: {
          courseId: true,
          score: true,
          maxScore: true,
          coefficient: true,
        },
      });
      const courseAverages = computeCourseAveragesFromGrades(grades, courseIds);
      snapshots.push({
        studentId,
        courseAverages,
        overallAverage: computeOverallFromCourseAverages(courseAverages, grades),
      });
    }

    termSnapshots[term] = snapshots;
  }

  const annualAverages = reportCards.map((card) => {
    const t1 = termSnapshots.trim1.find((s) => s.studentId === card.studentId)?.overallAverage ?? 0;
    const t2 = termSnapshots.trim2.find((s) => s.studentId === card.studentId)?.overallAverage ?? 0;
    const t3 = termSnapshots.trim3.find((s) => s.studentId === card.studentId)?.overallAverage ?? 0;
    const parts = [t1, t2, t3].filter((v) => v > 0);
    const average = parts.length > 0 ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
    return { studentId: card.studentId, average };
  });
  const annualRanks = rankByAverage(annualAverages.map((a) => ({ id: a.studentId, average: a.average })));

  const activeSnapshots = termSnapshots[activePeriod as (typeof TRIMESTER_PERIODS)[number]];
  const activeAverages = activeSnapshots.map((s) => ({ id: s.studentId, average: s.overallAverage }));
  const periodAverage =
    activeAverages.length > 0
      ? activeAverages.reduce((sum, row) => sum + row.average, 0) / activeAverages.length
      : 0;
  const periodMin = activeAverages.length > 0 ? Math.min(...activeAverages.map((r) => r.average)) : 0;
  const periodMax = activeAverages.length > 0 ? Math.max(...activeAverages.map((r) => r.average)) : 0;

  const annualValues = annualAverages.map((a) => a.average).filter((v) => v > 0);
  const annualClassAverage =
    annualValues.length > 0 ? annualValues.reduce((a, b) => a + b, 0) / annualValues.length : 0;
  const annualMin = annualValues.length > 0 ? Math.min(...annualValues) : 0;
  const annualMax = annualValues.length > 0 ? Math.max(...annualValues) : 0;

  const conducts = await prisma.conduct.findMany({
    where: {
      studentId: { in: studentIds },
      academicYear,
      period: { in: TRIMESTER_PERIODS.map(conductPeriodLabel) },
    },
    select: { studentId: true, period: true, average: true },
  });

  for (const card of reportCards) {
    const termHistory: ReportCardTermHistory = {};

    for (const term of TRIMESTER_PERIODS) {
      const snapshots = termSnapshots[term];
      const courseRanks = rankCourseAverages(snapshots, courseIds);
      const overallRanks = rankByAverage(
        snapshots.map((s) => ({ id: s.studentId, average: s.overallAverage })),
      );
      const snap = snapshots.find((s) => s.studentId === card.studentId);
      if (!snap) continue;

      const byCourse: Record<string, { average: number; rank: number }> = {};
      courseIds.forEach((courseId) => {
        const avg = snap.courseAverages[courseId]?.average ?? 0;
        const rank = courseRanks.get(card.studentId)?.[courseId];
        if (avg > 0 && rank !== undefined) {
          byCourse[courseId] = { average: avg, rank };
        }
      });

      termHistory[term] = {
        average: snap.overallAverage,
        rank: overallRanks.get(card.studentId) ?? 0,
        byCourse,
      };
    }

    card.termHistory = termHistory;
    const annualAvg = annualAverages.find((a) => a.studentId === card.studentId)?.average ?? 0;
    card.annualSummary = {
      average: annualAvg,
      rank: annualRanks.get(card.studentId) ?? 0,
    };
    card.classStats = {
      periodAverage,
      periodMin,
      periodMax,
      annualAverage: annualClassAverage,
      annualMin,
      annualMax,
    };

    const studentConducts = conducts.filter((c) => c.studentId === card.studentId);
    if (studentConducts.length > 0) {
      const byTerm: Record<string, number> = {};
      studentConducts.forEach((c) => {
        if (c.period.includes('1')) byTerm['trim1'] = c.average;
        else if (c.period.includes('2')) byTerm['trim2'] = c.average;
        else if (c.period.includes('3')) byTerm['trim3'] = c.average;
      });
      const activeConduct = studentConducts.find(
        (c) => c.period === conductPeriodLabel(activePeriod as (typeof TRIMESTER_PERIODS)[number]),
      );
      card.conduct = {
        average: activeConduct?.average ?? studentConducts[studentConducts.length - 1]?.average ?? 0,
        byTerm,
      };
    }
  }
}
