'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { adminApi } from '../../services/api';
import PortalModulesHub from '../../components/dashboard/PortalModulesHub';
import { DIRECTOR_MODULE_CATEGORIES } from '@/lib/portalModuleCategories';
import { buildAdminModuleTabs } from '@/lib/adminModuleTabMeta';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, Cell } from 'recharts';
import {
  CHART_GRID_SOFT,
  CHART_MARGIN_COMPACT,
  CHART_AXIS_TICK,
  chartBlueRed,
  CHART_ANIMATION_MS,
  RechartsViewport,
  PremiumChartCard,
} from '../../components/charts';
import {
  PremiumPortalShell,
  PremiumDashboardHero,
  PremiumStatGrid,
  PremiumSectionTitle,
} from '../../components/dashboard/premium';
import { FiArrowLeft, FiTrendingUp, FiUsers, FiBookOpen, FiDollarSign, FiAlertCircle, FiBarChart2 } from 'react-icons/fi';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);

export default function DirectorDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const adminTabs = useMemo(() => buildAdminModuleTabs(), []);
  const { data: dash } = useQuery({ queryKey: ['admin-dashboard'], queryFn: adminApi.getDashboard });
  const { data: kpis } = useQuery({ queryKey: ['admin-dashboard-kpis'], queryFn: adminApi.getDashboardKpis, staleTime: 60_000 });
  const { data: summary } = useQuery({ queryKey: ['admin-reports-summary'], queryFn: adminApi.getReportsSummary, staleTime: 60_000 });

  const payChart = kpis?.charts?.paymentsByMonth?.map((x: { label: string; amount: number }) => ({ label: x.label, k: Math.round(x.amount / 1000), amount: x.amount })) ?? [];
  const perf = summary?.performance;
  const fin = summary?.financial;
  const ac = summary?.academic;

  const primaryKpis = [
    { label: 'Élèves actifs', value: dash?.activeStudents ?? '—', subtitle: `sur ${dash?.totalStudents ?? '—'} dossiers`, icon: FiUsers, accent: 'indigo' as const },
    { label: 'Corps enseignant', value: dash?.totalTeachers ?? '—', subtitle: `${dash?.totalClasses ?? '—'} classes`, icon: FiBookOpen, accent: 'emerald' as const },
    { label: 'Impayés scolarité', value: fin ? `${fmt(fin.tuitionOutstandingAmount)} FCFA` : '—', subtitle: `${fin?.tuitionOutstandingCount ?? '—'} échéance(s)`, icon: FiDollarSign, accent: 'rose' as const },
    { label: 'Risque pédagogique', value: perf ? `${perf.atRiskHigh} / ${perf.atRiskMedium}` : '—', subtitle: 'Élevé / modéré', icon: FiAlertCircle, accent: 'amber' as const },
  ];

  const secondaryKpis = kpis?.cards
    ? [
        { label: 'Dossiers admission', value: (kpis.cards.admissionsPending ?? 0) + (kpis.cards.admissionsUnderReview ?? 0), subtitle: `${kpis.cards.admissionsPending} attente`, icon: FiUsers, accent: 'violet' as const },
        { label: 'Encaissements (30 j.)', value: `${fmt(kpis.cards.paymentsCompleted30dAmount ?? 0)} FCFA`, subtitle: `${kpis.cards.paymentsCompleted30dCount} paiement(s)`, icon: FiTrendingUp, accent: 'emerald' as const },
        { label: 'Moyenne générale', value: ac?.gradeAverage != null ? `${ac.gradeAverage} / 20` : '—', subtitle: `${ac?.gradesCount ?? 0} notes`, icon: FiBarChart2, accent: 'indigo' as const },
        { label: 'Rendus devoirs', value: kpis.cards.studentAssignmentsSubmissionRate != null ? `${kpis.cards.studentAssignmentsSubmissionRate} %` : '—', subtitle: 'Taux global', icon: FiBookOpen, accent: 'slate' as const },
      ]
    : [];

  return (
    <Layout user={user} onLogout={logout} role="ADMIN">
      <PremiumPortalShell variant="director">
        <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
          <PremiumDashboardHero
            eyebrow="Pilotage direction"
            title="Tableau de bord direction"
            icon={FiTrendingUp}
            badge="Vue synthétique"
            description="KPI, finances, risques pédagogiques et tendances d'encaissement."
            actions={
              <Link href="/admin" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20">
                <FiArrowLeft className="h-4 w-4" /> Administration complète
              </Link>
            }
          />
          <PremiumStatGrid items={primaryKpis} columns={4} />
          {secondaryKpis.length > 0 && <PremiumStatGrid items={secondaryKpis} columns={4} />}
          <PremiumSectionTitle title="Graphiques & tendances" icon={FiBarChart2} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {payChart.length > 0 && (
              <PremiumChartCard title="Tendance des encaissements" subtitle="Paiements complétés (6 mois, milliers FCFA)" accent="indigo" height={256}>
                <RechartsViewport height={240} className="w-full">
                  <BarChart data={payChart} margin={CHART_MARGIN_COMPACT}>
                    <CartesianGrid {...CHART_GRID_SOFT} />
                    <XAxis dataKey="label" tick={CHART_AXIS_TICK} />
                    <YAxis tick={CHART_AXIS_TICK} tickFormatter={(v) => `${v}k`} width={32} />
                    <Tooltip formatter={(v: number, _n, p) => [`${fmt((p as { payload?: { amount?: number } })?.payload?.amount ?? v * 1000)} FCFA`, 'Montant']} />
                    <Bar dataKey="k" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={CHART_ANIMATION_MS}>
                      {payChart.map((_, i) => (<Cell key={i} fill={chartBlueRed(i)} />))}
                    </Bar>
                  </BarChart>
                </RechartsViewport>
              </PremiumChartCard>
            )}
            {summary?.financial?.paymentsByMonth && summary.financial.paymentsByMonth.length > 0 && (
              <PremiumChartCard title="Historique récent (6 mois)" subtitle="Série agrégée rapport financier" accent="violet" height={256}>
                <RechartsViewport height={240} className="w-full">
                  <LineChart data={summary.financial.paymentsByMonth.map((x: { label: string; amount: number }) => ({ ...x, k: Math.round(x.amount / 1000) }))} margin={{ ...CHART_MARGIN_COMPACT, top: 8 }}>
                    <CartesianGrid {...CHART_GRID_SOFT} />
                    <XAxis dataKey="label" tick={CHART_AXIS_TICK} />
                    <YAxis tick={CHART_AXIS_TICK} tickFormatter={(v) => `${v}k`} width={32} />
                    <Tooltip formatter={(v: number) => [`${fmt(v * 1000)} FCFA`, '']} />
                    <Line type="monotone" dataKey="k" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} isAnimationActive animationDuration={CHART_ANIMATION_MS} />
                  </LineChart>
                </RechartsViewport>
              </PremiumChartCard>
            )}
          </div>
          <PremiumSectionTitle title="Modules de pilotage" icon={FiBarChart2} />
          <PortalModulesHub
            allTabs={adminTabs}
            categories={DIRECTOR_MODULE_CATEGORIES}
            excludeIds={['dashboard', 'schools', 'workspaces', 'settings', 'performance', 'security']}
            title="Accès aux modules d’administration"
            subtitle="Ouvrez directement un module métier dans l’espace administration complète."
            onNavigate={(tabId) => router.push(`/admin?tab=${encodeURIComponent(tabId)}`)}
          />
        </div>
      </PremiumPortalShell>
    </Layout>
  );
}
