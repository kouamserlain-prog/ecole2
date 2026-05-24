import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { teacherApi } from '../../services/api';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import { FiBook, FiUsers, FiClipboard, FiCalendar, FiTrendingUp, FiClock, FiFileText, FiAlertCircle } from 'react-icons/fi';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  CHART_GRID,
  CHART_MARGIN_COMPACT,
  CHART_ANIMATION_MS,
  CHART_AXIS_TICK,
  RechartsViewport,
  PremiumChartCard,
} from '../charts';
import {
  PremiumOverviewHero,
  PremiumStatGrid,
  PremiumGlassCard,
} from '../dashboard/premium';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';

const TeacherOverview = () => {
  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ['teacher-courses'],
    queryFn: teacherApi.getCourses,
  });

  // Fetch assignments for upcoming tasks
  const { data: allAssignments } = useQuery({
    queryKey: ['teacher-all-assignments'],
    queryFn: async () => {
      if (!courses) return [];
      const assignments = await Promise.all(
        courses.map((course: any) => 
          teacherApi.getCourseAssignments(course.id).catch(() => [])
        )
      );
      return assignments.flat();
    },
    enabled: !!courses && courses.length > 0,
  });

  const { data: teachKpi } = useQuery({
    queryKey: ['teacher-dashboard-kpis'],
    queryFn: () => teacherApi.getDashboardKpis(),
    staleTime: 60_000,
  });

  // Calculate unique students across all courses
  const uniqueStudents = useMemo(() => {
    if (!courses) return new Set();
    const students = new Set();
    courses.forEach((course: any) => {
      course.class?.students?.forEach((student: any) => {
        students.add(student.id);
      });
    });
    return students;
  }, [courses]);

  const totalStudents = uniqueStudents.size;
  const totalGrades = courses?.reduce((sum: number, course: any) => {
    return sum + (course._count?.grades || 0);
  }, 0) || 0;

  const totalAbsences = courses?.reduce((sum: number, course: any) => {
    return sum + (course._count?.absences || 0);
  }, 0) || 0;

  const totalAssignments = allAssignments?.length || 0;
  const upcomingAssignments = useMemo(() => {
    if (!allAssignments) return [];
    const now = new Date();
    return allAssignments
      .filter((a: any) => new Date(a.dueDate) >= now)
      .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 3);
  }, [allAssignments]);

  if (coursesLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <div className="h-24 bg-gray-200 rounded"></div>
          </Card>
        ))}
      </div>
    );
  }

  const stats = [
    { label: 'Mes cours', value: courses?.length || 0, subtitle: 'Cours actifs', icon: FiBook, accent: 'indigo' as const },
    { label: 'Élèves', value: totalStudents, subtitle: 'Total élèves', icon: FiUsers, accent: 'emerald' as const },
    { label: 'Notes', value: totalGrades, subtitle: 'Notes saisies', icon: FiClipboard, accent: 'violet' as const },
    { label: 'Devoirs', value: totalAssignments, subtitle: 'Devoirs créés', icon: FiFileText, accent: 'amber' as const },
  ];

  return (
    <div className="space-y-6">
      <PremiumOverviewHero
        eyebrow="Pilotage pédagogique"
        title={format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
        gradient="from-emerald-600 via-teal-600 to-cyan-700"
        description="Agrégation de vos cours, effectifs suivis et charge documentaire."
      />

      <PremiumStatGrid items={stats} columns={4} />

      {teachKpi?.charts?.gradesByMonth && teachKpi.charts.gradesByMonth.length > 0 && (
        <PremiumChartCard
          title="KPI & tendance des notes (90 j.)"
          subtitle={`Moyenne sur 20 · ${teachKpi.cards?.gradesRecorded90d ?? 0} note(s) · RDV parents : ${teachKpi.cards?.pendingParentAppointments ?? 0}`}
          icon={FiTrendingUp}
          accent="emerald"
          height={224}
          badge={
            teachKpi.cards?.averageGradeOn20Last90d != null ? (
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase text-stone-500">Moyenne période</p>
                <p className="text-xl font-bold text-teal-800">{teachKpi.cards.averageGradeOn20Last90d} / 20</p>
              </div>
            ) : undefined
          }
        >
          <RechartsViewport height={200} className="w-full">
            <LineChart data={teachKpi.charts.gradesByMonth} margin={{ ...CHART_MARGIN_COMPACT, top: 8 }}>
              <CartesianGrid {...CHART_GRID} />
              <XAxis dataKey="label" tick={CHART_AXIS_TICK} />
              <YAxis domain={[0, 20]} width={28} tick={CHART_AXIS_TICK} />
              <Tooltip formatter={(v: number) => [`${v} / 20`, 'Moyenne']} />
              <Line type="monotone" dataKey="average20" stroke="#0d9488" strokeWidth={2.5} dot={{ r: 4 }} connectNulls isAnimationActive animationDuration={CHART_ANIMATION_MS} />
            </LineChart>
          </RechartsViewport>
        </PremiumChartCard>
      )}

      {/* Prochaines actions */}
      {upcomingAssignments.length > 0 && (
        <Card variant="premium" className="ring-1 ring-slate-900/5">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Devoirs à venir</h3>
          <div className="space-y-3">
            {upcomingAssignments.map((assignment: any) => {
              const dueDate = new Date(assignment.dueDate);
              const now = new Date();
              const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              const isToday = daysUntilDue === 0;
              const isTomorrow = daysUntilDue === 1;
              
              return (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200"
                >
                  <div className="flex items-center space-x-3">
                    <FiFileText className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-gray-900">{assignment.title}</p>
                      <p className="text-sm text-gray-600">
                        {assignment.course?.name} - {assignment.course?.class?.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge
                      variant={isToday ? 'danger' : isTomorrow ? 'warning' : 'secondary'}
                      size="sm"
                    >
                      {isToday ? 'Aujourd\'hui' : isTomorrow ? 'Demain' : `Dans ${daysUntilDue} jours`}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {format(dueDate, 'dd MMM', { locale: fr })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Alertes */}
      {totalAbsences > 0 && (
        <Card className="border-l-4 border-orange-500">
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
              <FiAlertCircle className="w-6 h-6 text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">Absences enregistrées</h3>
              <p className="text-sm text-gray-700">
                Vous avez enregistré {totalAbsences} absence(s) au total. 
                Pensez à vérifier les justifications des élèves.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default TeacherOverview;




