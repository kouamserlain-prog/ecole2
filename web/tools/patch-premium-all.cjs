const fs = require('fs');
const path = require('path');

// TeacherOverview premium stats + hero + chart
const teacherFp = 'f:/management ecole/web/src/components/teacher/TeacherOverview.tsx';
let t = fs.readFileSync(teacherFp, 'utf8');

const statsStart = t.indexOf('  const stats = [');
const statsEnd = t.indexOf('  return (', statsStart);
const newStats = `  const stats = [
    { label: 'Mes cours', value: courses?.length || 0, subtitle: 'Cours actifs', icon: FiBook, accent: 'indigo' as const },
    { label: 'Élèves', value: totalStudents, subtitle: 'Total élèves', icon: FiUsers, accent: 'emerald' as const },
    { label: 'Notes', value: totalGrades, subtitle: 'Notes saisies', icon: FiClipboard, accent: 'violet' as const },
    { label: 'Devoirs', value: totalAssignments, subtitle: 'Devoirs créés', icon: FiFileText, accent: 'amber' as const },
  ];

`;
t = t.slice(0, statsStart) + newStats + t.slice(statsEnd);

// Replace hero + grid until chart section
const heroStart = t.indexOf('      <div className="rounded-2xl bg-gradient-to-r from-emerald-500');
const chartStart = t.indexOf('      {teachKpi?.charts?.gradesByMonth', heroStart);
if (heroStart >= 0 && chartStart > heroStart) {
  t =
    t.slice(0, heroStart) +
    `      <PremiumOverviewHero
        eyebrow="Pilotage pédagogique"
        title={format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
        gradient="from-emerald-600 via-teal-600 to-cyan-700"
        description="Agrégation de vos cours, effectifs suivis et charge documentaire."
      />

      <PremiumStatGrid items={stats} columns={4} />

` +
    t.slice(chartStart);
}

// Replace chart card
t = t.replace(
  /\{teachKpi\?\.charts\?\.gradesByMonth[\s\S]*?<\/Card>\s*\)\}/,
  `{teachKpi?.charts?.gradesByMonth && teachKpi.charts.gradesByMonth.length > 0 && (
        <PremiumChartCard
          title="KPI & tendance des notes (90 j.)"
          subtitle={\`Moyenne sur 20 · \${teachKpi.cards?.gradesRecorded90d ?? 0} note(s) · RDV parents : \${teachKpi.cards?.pendingParentAppointments ?? 0}\`}
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
          <RechartsViewport height="100%" className="h-full w-full">
            <LineChart data={teachKpi.charts.gradesByMonth} margin={{ ...CHART_MARGIN_COMPACT, top: 8 }}>
              <CartesianGrid {...CHART_GRID} />
              <XAxis dataKey="label" tick={CHART_AXIS_TICK} />
              <YAxis domain={[0, 20]} width={28} tick={CHART_AXIS_TICK} />
              <Tooltip formatter={(v: number) => [\`\${v} / 20\`, 'Moyenne']} />
              <Line type="monotone" dataKey="average20" stroke="#0d9488" strokeWidth={2.5} dot={{ r: 4 }} connectNulls isAnimationActive animationDuration={CHART_ANIMATION_MS} />
            </LineChart>
          </RechartsViewport>
        </PremiumChartCard>
      )}`
);

t = t.replace(/ResponsiveContainer/g, 'RechartsViewport');
t = t.replace(/<RechartsViewport width="100%" height="100%">/g, '<RechartsViewport height="100%" className="h-full w-full">');

fs.writeFileSync(teacherFp, t);
console.log('TeacherOverview done');

// Director dashboard full premium rewrite
const directorContent = `'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import Layout from '../../components/Layout';
import { adminApi } from '../../services/api';
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
  const { data: dash } = useQuery({ queryKey: ['admin-dashboard'], queryFn: adminApi.getDashboard });
  const { data: kpis } = useQuery({ queryKey: ['admin-dashboard-kpis'], queryFn: adminApi.getDashboardKpis, staleTime: 60_000 });
  const { data: summary } = useQuery({ queryKey: ['admin-reports-summary'], queryFn: adminApi.getReportsSummary, staleTime: 60_000 });

  const payChart = kpis?.charts?.paymentsByMonth?.map((x: { label: string; amount: number }) => ({ label: x.label, k: Math.round(x.amount / 1000), amount: x.amount })) ?? [];
  const perf = summary?.performance;
  const fin = summary?.financial;
  const ac = summary?.academic;

  const primaryKpis = [
    { label: 'Élèves actifs', value: dash?.activeStudents ?? '—', subtitle: \`sur \${dash?.totalStudents ?? '—'} dossiers\`, icon: FiUsers, accent: 'indigo' as const },
    { label: 'Corps enseignant', value: dash?.totalTeachers ?? '—', subtitle: \`\${dash?.totalClasses ?? '—'} classes\`, icon: FiBookOpen, accent: 'emerald' as const },
    { label: 'Impayés scolarité', value: fin ? \`\${fmt(fin.tuitionOutstandingAmount)} FCFA\` : '—', subtitle: \`\${fin?.tuitionOutstandingCount ?? '—'} échéance(s)\`, icon: FiDollarSign, accent: 'rose' as const },
    { label: 'Risque pédagogique', value: perf ? \`\${perf.atRiskHigh} / \${perf.atRiskMedium}\` : '—', subtitle: 'Élevé / modéré', icon: FiAlertCircle, accent: 'amber' as const },
  ];

  const secondaryKpis = kpis?.cards
    ? [
        { label: 'Dossiers admission', value: (kpis.cards.admissionsPending ?? 0) + (kpis.cards.admissionsUnderReview ?? 0), subtitle: \`\${kpis.cards.admissionsPending} attente\`, icon: FiUsers, accent: 'violet' as const },
        { label: 'Encaissements (30 j.)', value: \`\${fmt(kpis.cards.paymentsCompleted30dAmount ?? 0)} FCFA\`, subtitle: \`\${kpis.cards.paymentsCompleted30dCount} paiement(s)\`, icon: FiTrendingUp, accent: 'emerald' as const },
        { label: 'Moyenne générale', value: ac?.gradeAverage != null ? \`\${ac.gradeAverage} / 20\` : '—', subtitle: \`\${ac?.gradesCount ?? 0} notes\`, icon: FiBarChart2, accent: 'indigo' as const },
        { label: 'Rendus devoirs', value: kpis.cards.studentAssignmentsSubmissionRate != null ? \`\${kpis.cards.studentAssignmentsSubmissionRate} %\` : '—', subtitle: 'Taux global', icon: FiBookOpen, accent: 'slate' as const },
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
          <motion.div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {payChart.length > 0 && (
              <PremiumChartCard title="Tendance des encaissements" subtitle="Paiements complétés (6 mois, milliers FCFA)" accent="indigo" height={256}>
                <RechartsViewport height="100%" className="h-full w-full">
                  <BarChart data={payChart} margin={CHART_MARGIN_COMPACT}>
                    <CartesianGrid {...CHART_GRID_SOFT} />
                    <XAxis dataKey="label" tick={CHART_AXIS_TICK} />
                    <YAxis tick={CHART_AXIS_TICK} tickFormatter={(v) => \`\${v}k\`} width={32} />
                    <Tooltip formatter={(v: number, _n, p) => [\`\${fmt((p as { payload?: { amount?: number } })?.payload?.amount ?? v * 1000)} FCFA\`, 'Montant']} />
                    <Bar dataKey="k" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={CHART_ANIMATION_MS}>
                      {payChart.map((_, i) => (<Cell key={i} fill={chartBlueRed(i)} />))}
                    </Bar>
                  </BarChart>
                </RechartsViewport>
              </PremiumChartCard>
            )}
            {summary?.financial?.paymentsByMonth && summary.financial.paymentsByMonth.length > 0 && (
              <PremiumChartCard title="Historique récent (6 mois)" subtitle="Série agrégée rapport financier" accent="violet" height={256}>
                <RechartsViewport height="100%" className="h-full w-full">
                  <LineChart data={summary.financial.paymentsByMonth.map((x: { label: string; amount: number }) => ({ ...x, k: Math.round(x.amount / 1000) }))} margin={{ ...CHART_MARGIN_COMPACT, top: 8 }}>
                    <CartesianGrid {...CHART_GRID_SOFT} />
                    <XAxis dataKey="label" tick={CHART_AXIS_TICK} />
                    <YAxis tick={CHART_AXIS_TICK} tickFormatter={(v) => \`\${v}k\`} width={32} />
                    <Tooltip formatter={(v: number) => [\`\${fmt(v * 1000)} FCFA\`, '']} />
                    <Line type="monotone" dataKey="k" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} isAnimationActive animationDuration={CHART_ANIMATION_MS} />
                  </LineChart>
                </RechartsViewport>
              </PremiumChartCard>
            )}
          </motion.div>
        </div>
      </PremiumPortalShell>
    </Layout>
  );
}
`.replace(/motion\.div/g, 'motion.div');

fs.writeFileSync('f:/management ecole/web/src/views/director/Dashboard.tsx', directorContent.replace(/motion\.div/g, 'div'));
console.log('Director done');

// AdminModulesHub premium header
const hubFp = 'f:/management ecole/web/src/components/admin/AdminModulesHub.tsx';
let hub = fs.readFileSync(hubFp, 'utf8');
if (!hub.includes('PremiumSectionTitle')) {
  hub = hub.replace(
    "import Card from '../ui/Card';",
    "import Card from '../ui/Card';\nimport { PremiumSectionTitle, PremiumGlassCard } from '../dashboard/premium';"
  );
  hub = hub.replace(
    `    <section className="space-y-4" aria-labelledby="admin-modules-hub-title">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h3
            id="admin-modules-hub-title"
            className="text-base font-bold text-stone-900 tracking-tight"
          >
            Annuaire des modules
          </h3>
          <p className="text-sm text-stone-600 mt-1 max-w-xl leading-relaxed">
            Accès rapide à toutes les fonctions d'administration, groupées par domaine. Filtrez par
            nom ou mot-clé.
          </p>
        </div>`,
    `    <PremiumGlassCard accent="gold" padding="md" className="space-y-4">
      <PremiumSectionTitle
        title="Annuaire des modules"
        subtitle="Accès rapide à toutes les fonctions d'administration, groupées par domaine."
        icon={FiSearch}
        action={null}
      />
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="hidden" />`
  );
  hub = hub.replace(
    '                      className="text-left rounded-2xl border border-stone-200/90 bg-white/95 hover:bg-white hover:border-amber-300/60 hover:shadow-[0_16px_36px_-20px_rgba(12,10,9,0.2)] shadow-sm transition-all duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50"',
    '                      className="text-left rounded-2xl bg-gradient-to-br from-white via-stone-50/50 to-indigo-50/30 p-px shadow-md ring-1 ring-stone-200/80 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/45"'
  );
  hub = hub.replace('    </section>', '    </PremiumGlassCard>');
}
fs.writeFileSync(hubFp, hub);
console.log('AdminModulesHub done');

// Global ResponsiveContainer -> RechartsViewport
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (f !== 'node_modules') walk(p);
    } else if (f.endsWith('.tsx')) {
      let s = fs.readFileSync(p, 'utf8');
      if (!s.includes('ResponsiveContainer')) continue;
      const orig = s;
      if (!s.includes('RechartsViewport')) {
        s = s.replace(/from 'recharts';/, "from 'recharts';\nimport { RechartsViewport } from '@/components/charts';");
        s = s.replace(
          /import \{([^}]*)\} from ['"]([^'"]*charts)['"];/,
          (m, imp, mod) => (imp.includes('RechartsViewport') ? m : `import { ${imp.trim()}${imp.trim() ? ', ' : ''}RechartsViewport } from '${mod}';`)
        );
      }
      s = s.replace(/,?\s*ResponsiveContainer/g, '');
      s = s.replace(/{\s*,/g, '{ ');
      s = s.replace(/,\s*}/g, ' }');
      s = s.replace(/<ResponsiveContainer width="100%" height="100%">\s*/g, '<RechartsViewport height="100%" className="h-full w-full">');
      s = s.replace(/<ResponsiveContainer width="100%" height=\{(\d+)\}>\s*/g, '<RechartsViewport height={$1} className="w-full">');
      s = s.replace(/<\/ResponsiveContainer>/g, '</RechartsViewport>');
      if (s !== orig) {
        fs.writeFileSync(p, s);
        console.log('charts:', path.relative('f:/management ecole/web/src', p));
      }
    }
  }
}
walk('f:/management ecole/web/src');
console.log('all done');
