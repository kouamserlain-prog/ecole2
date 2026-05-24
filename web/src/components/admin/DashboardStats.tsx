import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import Card from '../ui/Card';
import {
  PieChart,
  Pie,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import {
  PremiumTooltip,
  CHART_GRID_SOFT,
  CHART_AXIS_TICK,
  CHART_MARGIN_COMPACT,
  CHART_MARGIN_COMPOSED,
  RechartsViewport,
  PremiumPieActiveShape,
  PremiumChartMeshBackground,
  chartBlueRed,
  CHART_RED,
  CHART_ANIMATION_MS,
} from '../charts';
import {
  FiUsers,
  FiBook,
  FiUserCheck,
  FiBookOpen,
  FiActivity,
  FiShield,
  FiTrendingUp,
  FiPieChart,
  FiLayers,
  FiDollarSign,
  FiAlertCircle,
  FiInbox,
  FiZap,
  FiBell,
} from 'react-icons/fi';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import RecentActivity from './RecentActivity';
import QuickActions from './QuickActions';
import NotificationsWidget from './NotificationsWidget';
import { useSchool } from '../../contexts/SchoolContext';
import { useSchoolReady, schoolQueryKey } from '../../hooks/useSchoolReady';
import {
  PremiumDashboardHero,
  PremiumDashboardShell,
  PremiumKpiCard,
  PremiumSectionTitle,
} from '../dashboard/premium';
import { PremiumChartCard } from '../charts';

interface DashboardStatsProps {
  onAddStudent?: () => void;
  onCreateClass?: () => void;
  onAddTeacher?: () => void;
  onAddEducator?: () => void;
  onGenerateReport?: () => void;
  onExportData?: () => void;
  onSettings?: () => void;
}

const DashboardStats: React.FC<DashboardStatsProps> = ({
  onAddStudent,
  onCreateClass,
  onAddTeacher,
  onAddEducator,
  onGenerateReport,
  onExportData,
  onSettings,
}) => {
  const [pieActiveIndex, setPieActiveIndex] = useState<number | undefined>(undefined);

  const { data: stats, isLoading, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: adminApi.getDashboard,
  });

  const { data: kpis } = useQuery({
    queryKey: ['admin-dashboard-kpis'],
    queryFn: adminApi.getDashboardKpis,
    staleTime: 60_000,
  });

  const { data: students, isError: studentsError } = useQuery({
    queryKey: ['students'],
    queryFn: adminApi.getStudents,
    retry: 1,
  });

  const classDistribution =
    students?.reduce((acc: Record<string, number>, student: any) => {
      const name = student.class?.name || 'Non assigné';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {}) || {};

  const chartData = Object.entries(classDistribution).map(([name, value]) => ({
    name: name.length > 10 ? name.slice(0, 8) + '…' : name,
    value: Number(value),
    fullName: name,
  }));

  const enrollmentTotal = useMemo(
    () => chartData.reduce((s, d) => s + Number(d.value), 0),
    [chartData]
  );

  const composedProfileData = useMemo(() => {
    const sorted = [...chartData].sort((a, b) => Number(b.value) - Number(a.value));
    let run = 0;
    return sorted.map((d) => {
      run += Number(d.value);
      return {
        ...d,
        cumulativePct: enrollmentTotal > 0 ? Math.round((run / enrollmentTotal) * 1000) / 10 : 0,
      };
    });
  }, [chartData, enrollmentTotal]);

  const avgStudentsPerClass =
    chartData.length > 0 ? Math.round((enrollmentTotal / chartData.length) * 10) / 10 : 0;

  const totalStudents = stats?.totalStudents ?? 0;
  const totalStaff = (stats?.totalTeachers ?? 0) + (stats?.totalEducators ?? 0);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-16 bg-gray-100 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="p-3">
              <div className="h-3 w-16 bg-gray-200 rounded mb-2 animate-pulse" />
              <div className="h-6 w-10 bg-gray-200 rounded animate-pulse" />
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-4">
              <div className="h-52 bg-gray-100 rounded-lg animate-pulse" />
            </Card>
            <div className="h-52 bg-gray-100 rounded-lg animate-pulse" />
          </div>
          <div className="space-y-4">
            <div className="h-40 bg-gray-100 rounded-lg animate-pulse" />
            <div className="h-52 bg-gray-100 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const indicators = [
    {
      title: 'Élèves',
      value: stats?.totalStudents ?? 0,
      subtitle: `${stats?.activeStudents ?? 0} actifs`,
      icon: FiUsers,
      accent: 'blue' as const,
    },
    {
      title: 'Enseignants',
      value: stats?.totalTeachers ?? 0,
      subtitle: 'En poste',
      icon: FiBookOpen,
      accent: 'emerald' as const,
    },
    {
      title: 'Éducateurs',
      value: stats?.totalEducators ?? 0,
      subtitle: 'En poste',
      icon: FiShield,
      accent: 'violet' as const,
    },
    {
      title: 'Classes',
      value: stats?.totalClasses ?? 0,
      subtitle: 'Niveaux',
      icon: FiBook,
      accent: 'indigo' as const,
    },
    {
      title: 'Parents',
      value: stats?.totalParents ?? 0,
      subtitle: 'Inscrits',
      icon: FiUserCheck,
      accent: 'amber' as const,
    },
  ];

  const fmtFcfa = (n: number) =>
    new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n ?? 0);

  const lastSync =
    dataUpdatedAt > 0 ? format(new Date(dataUpdatedAt), "HH:mm:ss", { locale: fr }) : null;

  return (
    <PremiumDashboardShell>
    <div className="space-y-5">
      <PremiumDashboardHero
        eyebrow="Pilotage établissement"
        title="Vue d'ensemble opérationnelle"
        description={
          <>
            Résumé au {format(new Date(), 'd MMMM yyyy', { locale: fr })}
            {totalStudents > 0 && (
              <>
                {' — '}
                <strong className="text-white/95">{totalStudents}</strong> élève{totalStudents > 1 ? 's' : ''},{' '}
                <strong className="text-white/95">{totalStaff}</strong> personnel.
              </>
            )}
          </>
        }
        badge="Données consolidées"
        lastSync={lastSync}
        isFetching={isFetching}
      />

      <section>
        <PremiumSectionTitle
          title="Indicateurs clés — effectifs"
          subtitle="Population scolaire et personnel"
          icon={FiUsers}
        />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {indicators.map((ind) => (
            <PremiumKpiCard
              key={ind.title}
              label={ind.title}
              value={ind.value}
              subtitle={ind.subtitle}
              icon={ind.icon}
              accent={ind.accent}
            />
          ))}
        </div>
      </section>

      {kpis?.cards && (
        <section>
          <PremiumSectionTitle title="KPI — inscriptions, finances & pédagogie" subtitle="Suivi opérationnel et trésorerie" icon={FiDollarSign} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <PremiumKpiCard label="Dossiers admission" value={(kpis.cards.admissionsPending ?? 0) + (kpis.cards.admissionsUnderReview ?? 0)} subtitle={`${kpis.cards.admissionsPending} attente · ${kpis.cards.admissionsUnderReview} examen`} icon={FiInbox} accent="indigo" />
            <PremiumKpiCard label="Impayés scolarité" value={`${fmtFcfa(kpis.cards.tuitionUnpaidAmount)} FCFA`} subtitle={`${kpis.cards.tuitionUnpaidCount} ligne(s)`} icon={FiAlertCircle} accent="rose" />
            <PremiumKpiCard label="Encaissements (30 j.)" value={`${fmtFcfa(kpis.cards.paymentsCompleted30dAmount)} FCFA`} subtitle={`${kpis.cards.paymentsCompleted30dCount} paiement(s)`} icon={FiTrendingUp} accent="emerald" />
            <PremiumKpiCard label="Risque & devoirs" value={`${kpis.cards.atRiskHigh ?? 0} / ${kpis.cards.atRiskMedium ?? 0}`} subtitle={kpis.cards.studentAssignmentsSubmissionRate != null ? `Rendus : ${kpis.cards.studentAssignmentsSubmissionRate} %` : 'Élèves à risque'} icon={FiShield} accent="amber" />
          </div>
        </section>
      )}

      <section>
        <PremiumSectionTitle title="Actions rapides" subtitle="Raccourcis vers les tâches fréquentes" icon={FiZap} />
        <QuickActions
          onAddStudent={onAddStudent}
          onCreateClass={onCreateClass}
          onAddTeacher={onAddTeacher}
          onAddEducator={onAddEducator}
          onGenerateReport={onGenerateReport}
          onExportData={onExportData}
          onSettings={onSettings}
        />
      </section>

      <section>
        <PremiumSectionTitle title="Notifications" subtitle="Alertes et messages récents" icon={FiBell} />
        <NotificationsWidget />
      </section>

      {/* Graphiques + activité */}
      <div className="space-y-4">
          <section>
            <PremiumSectionTitle
              title="Répartition des effectifs"
              subtitle="Visualisation par classe"
              icon={FiPieChart}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <Card
                variant="premium"
                hover={false}
                className="relative overflow-hidden !p-0 border border-white/80 bg-gradient-to-br from-white via-slate-50/50 to-indigo-50/40 shadow-sm ring-1 ring-slate-900/5"
              >
                <PremiumChartMeshBackground />
                <div className="relative p-3 sm:p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
                        <FiPieChart className="h-4 w-4" aria-hidden />
                      </div>
                      <div>
                        <span className="font-display text-sm font-bold text-slate-900">Donut effectifs</span>
                        <p className="text-[9px] text-slate-500">Part par classe</p>
                      </div>
                    </div>
                    {enrollmentTotal > 0 && (
                      <span className="hidden sm:inline-flex rounded-full bg-slate-900/5 px-2 py-0.5 text-[9px] font-bold tabular-nums text-slate-600">
                        Σ {enrollmentTotal}
                      </span>
                    )}
                  </div>
                  {studentsError ? (
                    <div className="flex h-[220px] flex-col items-center justify-center gap-2 px-3 text-center text-xs text-amber-700">
                      <p className="font-medium">Impossible de charger les élèves</p>
                      <p className="text-xs text-amber-600/90">
                        Vérifiez que le serveur API tourne et que vous êtes connecté (NEXT_PUBLIC_API_URL).
                      </p>
                    </div>
                  ) : chartData.length > 0 ? (
                    <>
                      <RechartsViewport height={220} className="relative z-[1]">
                        <PieChart key={chartData.map((d) => `${d.fullName}:${d.value}`).join('|')}>
                          <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={52}
                            outerRadius={78}
                            paddingAngle={chartData.length > 1 ? 4 : 0}
                            cornerRadius={chartData.length > 1 ? 8 : 0}
                            stroke="#ffffff"
                            strokeWidth={3}
                            label={false}
                            labelLine={false}
                            animationDuration={CHART_ANIMATION_MS}
                            animationEasing="ease-out"
                            activeIndex={pieActiveIndex}
                            activeShape={PremiumPieActiveShape}
                            onMouseEnter={(_, i) => setPieActiveIndex(i)}
                            onMouseLeave={() => setPieActiveIndex(undefined)}
                          >
                            {chartData.map((_, i) => (
                              <Cell
                                key={i}
                                fill={chartBlueRed(i)}
                                stroke="#fff"
                                strokeWidth={2}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            content={(props) => (
                              <PremiumTooltip
                                {...props}
                                label={
                                  (props.payload?.[0]?.payload as { fullName?: string })
                                    ?.fullName ?? props.label
                                }
                                valueLabel="élève(s)"
                              />
                            )}
                          />
                        </PieChart>
                      </RechartsViewport>
                      <div className="relative z-[1] mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-200/80 pt-2">
                        {chartData.map((d, i) => (
                          <span
                            key={d.fullName}
                            className="inline-flex items-center gap-1.5 text-[9px] font-semibold text-slate-600"
                          >
                            <span
                              className="h-2 w-2 shrink-0 rounded-full shadow-sm ring-1 ring-white"
                              style={{
                                background: chartBlueRed(i),
                              }}
                            />
                            <span className="max-w-[140px] truncate">{d.fullName}</span>
                            <span className="tabular-nums text-slate-900">{d.value}</span>
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="relative z-[1] flex h-[220px] items-center justify-center text-xs font-medium text-slate-400">
                      Aucune donnée
                    </div>
                  )}
                </div>
              </Card>

              <Card
                variant="premium"
                hover={false}
                className="relative overflow-hidden !p-0 border border-white/80 bg-gradient-to-br from-white via-indigo-50/25 to-violet-50/35 shadow-sm ring-1 ring-slate-900/5"
              >
                <PremiumChartMeshBackground />
                <div className="relative p-3 sm:p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-sm">
                      <FiActivity className="h-4 w-4" aria-hidden />
                    </div>
                    <div>
                      <h3 className="font-display text-sm font-bold text-slate-900">Histogramme</h3>
                      <p className="text-[9px] text-slate-500">Volume par groupe</p>
                    </div>
                  </div>
                  {studentsError ? (
                    <div className="flex h-[220px] items-center justify-center px-3 text-center text-xs text-amber-700">
                      Données élèves indisponibles
                    </div>
                  ) : chartData.length > 0 ? (
                    <RechartsViewport height={220} className="relative z-[1]">
                      <BarChart data={chartData} margin={CHART_MARGIN_COMPACT}>
                        <CartesianGrid {...CHART_GRID_SOFT} />
                        <XAxis
                          dataKey="name"
                          tick={CHART_AXIS_TICK}
                          axisLine={{ stroke: "#e2e8f0" }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={CHART_AXIS_TICK}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip
                          content={(props) => (
                            <PremiumTooltip
                              {...props}
                              label={
                                (props.payload?.[0]?.payload as { fullName?: string })
                                  ?.fullName ?? props.label
                              }
                              valueLabel="élève(s)"
                            />
                          )}
                        />
                        {avgStudentsPerClass > 0 && (
                          <ReferenceLine
                            y={avgStudentsPerClass}
                            stroke="#94a3b8"
                            strokeDasharray="6 6"
                            label={{
                              value: `Moy. ${avgStudentsPerClass}`,
                              position: "insideTopRight",
                              fill: "#64748b",
                              fontSize: 10,
                              fontWeight: 600,
                            }}
                          />
                        )}
                        <Bar
                          dataKey="value"
                          radius={[10, 10, 3, 3]}
                          maxBarSize={40}
                          animationDuration={CHART_ANIMATION_MS}
                          animationEasing="ease-out"
                        >
                          {chartData.map((_, i) => (
                            <Cell key={i} fill={chartBlueRed(i)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </RechartsViewport>
                  ) : (
                    <div className="relative z-[1] flex h-[220px] items-center justify-center text-xs font-medium text-slate-400">
                      Aucune donnée
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {chartData.length > 0 && !studentsError && (
              <Card
                variant="premium"
                hover={false}
                className="relative mt-4 overflow-hidden !p-0 border border-white/80 bg-gradient-to-br from-white via-sky-50/20 to-indigo-50/30 shadow-sm ring-1 ring-slate-900/5"
              >
                <PremiumChartMeshBackground />
                <div className="relative p-3 sm:p-4">
                  <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-sm">
                        <FiLayers className="h-4 w-4" aria-hidden />
                      </div>
                      <div>
                        <h3 className="font-display text-sm font-bold text-slate-900">Profil cumulatif</h3>
                        <p className="text-[9px] text-slate-500">
                          Effectifs et % cumulé
                        </p>
                      </div>
                    </div>
                  </div>
                  <RechartsViewport height={240} className="relative z-[1]">
                    <ComposedChart data={composedProfileData} margin={CHART_MARGIN_COMPOSED}>
                      <CartesianGrid {...CHART_GRID_SOFT} />
                      <XAxis
                        dataKey="name"
                        tick={CHART_AXIS_TICK}
                        axisLine={{ stroke: "#e2e8f0" }}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={CHART_AXIS_TICK}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                        tick={CHART_AXIS_TICK}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={(props) => (
                          <PremiumTooltip
                            {...props}
                            label={
                              (props.payload?.[0]?.payload as { fullName?: string })?.fullName ??
                              props.label
                            }
                          />
                        )}
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="value"
                        radius={[14, 14, 4, 4]}
                        maxBarSize={44}
                        animationDuration={CHART_ANIMATION_MS}
                        animationEasing="ease-out"
                      >
                        {composedProfileData.map((_, i) => (
                          <Cell key={i} fill={chartBlueRed(i)} />
                        ))}
                      </Bar>
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="cumulativePct"
                        stroke={CHART_RED}
                        strokeWidth={3.5}
                        animationDuration={CHART_ANIMATION_MS}
                        animationEasing="ease-out"
                        dot={{ r: 5, fill: CHART_RED, stroke: "#fff", strokeWidth: 2 }}
                        activeDot={{ r: 7, strokeWidth: 2, stroke: "#fff", fill: CHART_RED }}
                      />
                    </ComposedChart>
                  </RechartsViewport>
                </div>
              </Card>
            )}
          </section>

          <section>
            <PremiumSectionTitle title="Activité récente" subtitle="Dernières actions sur la plateforme" icon={FiActivity} />
            <RecentActivity />
          </section>
      </div>
    </div>
    </PremiumDashboardShell>
  );
};

export default DashboardStats;
