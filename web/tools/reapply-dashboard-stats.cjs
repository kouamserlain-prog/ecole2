const fs = require('fs');
const path = 'f:/management ecole/web/src/components/admin/DashboardStats.tsx';
let s = fs.readFileSync(path, 'utf8');

if (s.includes('PremiumDashboardShell')) {
  console.log('already premium');
  process.exit(0);
}

// imports
s = s.replace(
  "import { useSchoolReady, schoolQueryKey } from '../../hooks/useSchoolReady';",
  `import { useSchoolReady, schoolQueryKey } from '../../hooks/useSchoolReady';
import {
  PremiumDashboardHero,
  PremiumDashboardShell,
  PremiumKpiCard,
  PremiumSectionTitle,
  PremiumGlassCard,
} from '../dashboard/premium';`
);

s = s.replace(
  '  FiLayers,\n} from',
  `  FiLayers,
  FiDollarSign,
  FiAlertCircle,
  FiInbox,
  FiBarChart2,
  FiZap,
  FiBell,
} from`
);

// loading
s = s.replace(
  `  if (isLoading) {
    return (
      <div className="space-y-4">`,
  `  if (isLoading) {
    return (
      <PremiumDashboardShell variant="admin">
      <div className="space-y-6 animate-pulse">`
);
s = s.replace(
  `        </motion.div>
      </p>
    );
  }

  const indicators`,
  `        </div>
      </PremiumDashboardShell>
    );
  }

  const indicators`
);
// fix loading end - find closing of loading block
const loadIdx = s.indexOf('if (isLoading)');
const loadEnd = s.indexOf('const indicators = [');
if (loadIdx >= 0 && !s.slice(loadIdx, loadEnd).includes('PremiumDashboardShell')) {
  const block = s.slice(loadIdx, loadEnd);
  const fixed = block.replace(
    /return \(\s*<div className="space-y-4">[\s\S]*?<\/motion.div>\s*\);/,
    `return (
      <PremiumDashboardShell variant="admin">
        <div className="space-y-6 animate-pulse">
          <div className="h-36 rounded-3xl bg-gradient-to-br from-slate-200 to-indigo-100/80" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[1,2,3,4,5].map((i) => <div key={i} className="h-28 rounded-2xl bg-white/80 ring-1 ring-stone-200/80" />)}
          </div>
        </div>
      </PremiumDashboardShell>
    );`
  ).replace(/motion\.motion\.div/g,'motion.div').replace(/motion\.motion\.motion\.div/g,'motion.div').replace(/motion\.div/g,'div');
  s = s.slice(0, loadIdx) + fixed.replace(/motion\.div/g,'motion.div').replace(/motion\.div/g,'div') + s.slice(loadEnd);
}

// indicators accent
['blue','emerald','violet','indigo','amber'].forEach((a,i) => {
  const colors = [
    ["color: 'text-blue-600',\n      bg: 'bg-blue-50',", "accent: 'blue' as const,"],
    ["color: 'text-emerald-600',\n      bg: 'bg-emerald-50',", "accent: 'emerald' as const,"],
    ["color: 'text-violet-600',\n      bg: 'bg-violet-50',", "accent: 'violet' as const,"],
    ["color: 'text-indigo-600',\n      bg: 'bg-indigo-50',", "accent: 'indigo' as const,"],
    ["color: 'text-amber-600',\n      bg: 'bg-amber-50',", "accent: 'amber' as const,"],
  ];
  s = s.replace(colors[i][0], colors[i][1]);
});

s = s.replace(
  '  const lastSync =',
  `  const fmtFcfa = (n: number) =>
    new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n ?? 0);

  const lastSync =`
);

// hero + kpi replace
const ret = s.indexOf('  return (\n    <div className="space-y-5">');
const kpiFin = s.indexOf('      {kpis?.cards && (');
if (ret >= 0 && kpiFin > ret) {
  const head = `  return (
    <PremiumDashboardShell variant="admin">
    <motion.div className="space-y-8">
      <PremiumDashboardHero
        eyebrow="Pilotage établissement"
        title="Vue d'ensemble opérationnelle"
        icon={FiActivity}
        badge="Données consolidées"
        lastSync={lastSync}
        isFetching={isFetching}
        description={<>Résumé au {format(new Date(), 'd MMMM yyyy', { locale: fr })}{totalStudents > 0 && <> — <strong className="text-white/95">{totalStudents}</strong> élève{totalStudents > 1 ? 's' : ''}, <strong className="text-white/95">{totalStaff}</strong> personnel.</>}</>}
      />
      <section>
        <PremiumSectionTitle title="Indicateurs clés — effectifs" subtitle="Population scolaire et encadrement" icon={FiUsers} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {indicators.map((ind) => (
            <PremiumKpiCard key={ind.title} label={ind.title} value={ind.value} subtitle={ind.subtitle} icon={ind.icon} accent={ind.accent} />
          ))}
        </div>
      </section>

`;
  s = s.slice(0, ret) + head.replace(/motion\.div/g,'div') + s.slice(kpiFin);
}

// finance block
const finStart = s.indexOf('      {kpis?.cards && (');
const quick = s.indexOf('Actions rapides');
if (finStart >= 0 && quick > finStart) {
  const finBlock = `      {kpis?.cards && (
        <section>
          <PremiumSectionTitle title="KPI — inscriptions, finances & pédagogie" subtitle="Suivi opérationnel et trésorerie" icon={FiDollarSign} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <PremiumKpiCard label="Dossiers admission" value={(kpis.cards.admissionsPending ?? 0) + (kpis.cards.admissionsUnderReview ?? 0)} subtitle={\`\${kpis.cards.admissionsPending} attente · \${kpis.cards.admissionsUnderReview} examen\`} icon={FiInbox} accent="indigo" />
            <PremiumKpiCard label="Impayés scolarité" value={\`\${fmtFcfa(kpis.cards.tuitionUnpaidAmount)} FCFA\`} subtitle={\`\${kpis.cards.tuitionUnpaidCount} ligne(s)\`} icon={FiAlertCircle} accent="rose" />
            <PremiumKpiCard label="Encaissements (30 j.)" value={\`\${fmtFcfa(kpis.cards.paymentsCompleted30dAmount)} FCFA\`} subtitle={\`\${kpis.cards.paymentsCompleted30dCount} paiement(s)\`} icon={FiTrendingUp} accent="emerald" />
            <PremiumKpiCard label="Risque & devoirs" value={\`\${kpis.cards.atRiskHigh ?? 0} / \${kpis.cards.atRiskMedium ?? 0}\`} subtitle={kpis.cards.studentAssignmentsSubmissionRate != null ? \`Rendus : \${kpis.cards.studentAssignmentsSubmissionRate} %\` : 'Élèves à risque'} icon={FiShield} accent="amber" />
          </div>
        </section>
      )}

      <section>
        <PremiumSectionTitle title="Actions rapides" subtitle="Raccourcis vers les tâches fréquentes" icon={FiZap} />
        <QuickActions`;
  const quickLine = s.indexOf('<QuickActions', finStart);
  s = s.slice(0, finStart) + finBlock + s.slice(quickLine + '<QuickActions'.length);
}

s = s.replace(
  `      <motion.div>
        <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">
          Notifications`,
  `      <section>
        <PremiumSectionTitle title="Notifications" subtitle="Alertes et messages récents" icon={FiBell} />`
).replace(/motion\.div/g,'motion.div');

s = s.replace(
  `        <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">
          Notifications
        </h3>
        <NotificationsWidget />`,
  `<PremiumSectionTitle title="Notifications" subtitle="Alertes et messages récents" icon={FiBell} />
        <NotificationsWidget />`
);

s = s.replace(
  `            <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Répartition des effectifs
            </h3>`,
  `<PremiumSectionTitle title="Répartition des effectifs" subtitle="Visualisation par classe" icon={FiPieChart} />`
);

s = s.replace(
  `            <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Activité récente
            </h3>`,
  `<PremiumSectionTitle title="Activité récente" subtitle="Dernières opérations" icon={FiActivity} />`
);

if (!s.includes('</PremiumDashboardShell>')) {
  s = s.replace('    </div>\n  );\n};\n\nexport default DashboardStats;', '    </div>\n    </PremiumDashboardShell>\n  );\n};\n\nexport default DashboardStats;');
}

s = s.replace(/motion\.div/g, 'div');
fs.writeFileSync(path, s);
console.log('DashboardStats premium applied');
