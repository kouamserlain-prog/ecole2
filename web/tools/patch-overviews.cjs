const fs = require('fs');
const path = require('path');

// --- StudentOverview ---
{
  const filePath = path.join(__dirname, '../src/components/student/StudentOverview.tsx');
  let s = fs.readFileSync(filePath, 'utf8');

  const heroStart = s.indexOf('          <motion.div className="rounded-2xl bg-gradient-to-r from-violet-500');
  const heroStartAlt = s.indexOf('          <div className="rounded-2xl bg-gradient-to-r from-violet-500');
  const start = heroStart >= 0 ? heroStart : heroStartAlt;
  const heroEnd = s.indexOf('          <PortalSchoolFeed role="student"', start);

  if (start >= 0 && heroEnd > start && !s.includes('PremiumOverviewHero')) {
    const hero = `          <PremiumOverviewHero
            eyebrow="Synthèse personnelle"
            title={format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
            gradient="from-violet-600 via-fuchsia-600 to-pink-600"
            description="Indicateurs consolidés à partir de vos notes, absences et devoirs."
          />
          {(overdueAssignments > 0 || unexcusedAbsences > 0) && (
            <div className="flex flex-wrap gap-2">
              {overdueAssignments > 0 && (
                <span className="inline-flex items-center rounded-full border border-red-200/80 bg-red-50 px-3 py-1 text-xs font-semibold text-red-800">
                  {overdueAssignments} devoir(s) en retard
                </span>
              )}
              {unexcusedAbsences > 0 && (
                <span className="inline-flex items-center rounded-full border border-amber-200/80 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                  {unexcusedAbsences} absence(s) non justifiée(s)
                </span>
              )}
            </div>
          )}
          `;
    s = s.slice(0, start) + hero + s.slice(heroEnd);
  }

  const gridStart = s.indexOf('          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">');
  const gridEnd = s.indexOf('      {/* Alertes importantes */}');
  if (gridStart >= 0 && gridEnd > gridStart) {
    s = s.slice(0, gridStart) + '          <PremiumStatGrid items={stats} columns={4} />\n\n' + s.slice(gridEnd);
  }

  fs.writeFileSync(filePath, s);
  console.log('StudentOverview OK');
}

// --- ParentOverview hero + imports ---
{
  const filePath = path.join(__dirname, '../src/components/parent/ParentOverview.tsx');
  let s = fs.readFileSync(filePath, 'utf8');

  if (!s.includes('PremiumOverviewHero')) {
    s = s.replace(
      "import { CHART_GRID, CHART_MARGIN_COMPACT, chartBlueRed, CHART_ANIMATION_MS } from '../charts';",
      "import { CHART_GRID, CHART_MARGIN_COMPACT, CHART_AXIS_TICK, chartBlueRed, CHART_ANIMATION_MS, RechartsViewport, PremiumChartCard } from '../charts';\nimport { PremiumOverviewHero, PremiumStatGrid, PremiumKpiCard } from '../dashboard/premium';"
    );
    s = s.replace(/\s*ResponsiveContainer,\n/, '\n');
  }

  const heroStart = s.indexOf('      <div className="rounded-2xl bg-gradient-to-r from-orange-500');
  const heroEnd = s.indexOf('      <PortalSchoolFeed role="parent"');
  if (heroStart >= 0 && heroEnd > heroStart) {
    const hero = `      <PremiumOverviewHero
        eyebrow="Espace familles"
        title={format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
        gradient="from-orange-600 via-amber-600 to-yellow-600"
        description="Vue consolidée par enfant : résultats, assiduité et messages."
      />

      `;
    s = s.slice(0, heroStart) + hero + s.slice(heroEnd);
  }

  fs.writeFileSync(filePath, s);
  console.log('ParentOverview hero OK');
}

// --- EducatorOverview hero + primary stats ---
{
  const filePath = path.join(__dirname, '../src/components/educator/EducatorOverview.tsx');
  let s = fs.readFileSync(filePath, 'utf8');

  if (!s.includes('PremiumOverviewHero')) {
    s = s.replace(
      "import GdprUserRightsPanel from '../gdpr/GdprUserRightsPanel';",
      "import GdprUserRightsPanel from '../gdpr/GdprUserRightsPanel';\nimport { PremiumOverviewHero, PremiumStatGrid } from '../dashboard/premium';"
    );

    const heroStart = s.indexOf('      <div className="rounded-2xl bg-gradient-to-r from-violet-500');
    const heroEnd = s.indexOf('      {/* Stats Cards - Principales */}');
    if (heroStart >= 0 && heroEnd > heroStart) {
      const hero = `      <PremiumOverviewHero
        eyebrow="Vie scolaire & conduite"
        title={format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
        gradient="from-violet-600 via-indigo-600 to-purple-700"
        description="Tableau de bord disciplinaire : répartition des évaluations et élèves à accompagner."
      />

      `;
      s = s.slice(0, heroStart) + hero + s.slice(heroEnd);
    }

    // Insert primary stat grid before secondary stats
    const primaryStatsEnd = s.indexOf('      {/* Stats Cards - Secondaires */}');
    const primaryStart = s.indexOf('      {/* Stats Cards - Principales */}');
    if (primaryStart >= 0 && primaryStatsEnd > primaryStart) {
      const statGrid = `      <PremiumStatGrid
        columns={4}
        items={[
          { label: 'Total élèves', value: detailedStats?.totalStudents || stats?.totalStudents || 0, subtitle: \`\${detailedStats?.evaluatedStudents || 0} évalués\`, icon: FiUsers, accent: 'violet' },
          { label: 'Évaluations', value: detailedStats?.totalConducts || stats?.totalConducts || 0, subtitle: \`Moy. \${detailedStats?.averageConduct ? detailedStats.averageConduct.toFixed(1) : '0'}/20\`, icon: FiShield, accent: 'indigo' },
          { label: 'Excellentes', value: detailedStats?.excellentConducts || 0, subtitle: '≥ 15/20', icon: FiCheckCircle, accent: 'emerald' },
          { label: 'À surveiller', value: detailedStats?.studentsWithIssues || 0, subtitle: 'Moyenne < 10/20', icon: FiAlertCircle, accent: 'rose' },
        ]}
      />

      <PremiumStatGrid
        columns={3}
        items={[
          { label: 'Ce mois', value: detailedStats?.thisMonthConducts || stats?.recentConducts || 0, subtitle: 'Évaluations créées', icon: FiTrendingUp, accent: 'blue' },
          { label: 'Bonnes', value: detailedStats?.goodConducts || 0, subtitle: '10-15/20', icon: FiBarChart, accent: 'amber' },
          { label: 'Faibles', value: detailedStats?.poorConducts || 0, subtitle: '< 10/20', icon: FiXCircle, accent: 'rose' },
        ]}
      />

`;
      s = s.slice(0, primaryStart) + statGrid + s.slice(primaryStatsEnd);
      // Remove old card grids - from first grid after statGrid insertion to GdprUserRights or Profile
      const oldGridStart = s.indexOf('      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">', primaryStart + statGrid.length);
      const oldGridEnd = s.indexOf('      {/* Profile Info */}');
      if (oldGridStart >= 0 && oldGridEnd > oldGridStart) {
        s = s.slice(0, oldGridStart) + s.slice(oldGridEnd);
      }
    }
  }

  fs.writeFileSync(filePath, s);
  console.log('EducatorOverview OK');
}
