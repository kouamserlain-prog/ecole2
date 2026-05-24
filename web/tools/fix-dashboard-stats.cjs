const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/admin/DashboardStats.tsx');
let s = fs.readFileSync(filePath, 'utf8');

if (!s.includes('<PremiumDashboardShell>')) {
  s = s.replace(
    '  return (\n    <div className="space-y-5">',
    '  return (\n    <PremiumDashboardShell>\n    <motion.div className="space-y-5">'
  );
}

const heroOldStart = s.indexOf('      <div className="rounded-xl bg-gradient-to-r from-indigo-500');
const heroOldEnd = s.indexOf('      {/* Indicateurs clés */}');
if (heroOldStart >= 0 && heroOldEnd > heroOldStart) {
  const hero = `      <PremiumDashboardHero
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

`;
  s = s.slice(0, heroOldStart) + hero + s.slice(heroOldEnd);
}

const kpiStart = s.indexOf('      {/* Indicateurs clés */}');
const kpiEnd = s.indexOf('      {kpis?.cards && (');
if (kpiStart >= 0 && kpiEnd > kpiStart) {
  const kpi = `      <section>
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

`;
  s = s.slice(0, kpiStart) + kpi + s.slice(kpiEnd);
}

// Close chart section properly before activity
s = s.replace(
  /\)\}\n          <\/div>\n\n          <section>\n            <PremiumSectionTitle title="Activité récente"/,
  ')}\n          </section>\n\n          <section>\n            <PremiumSectionTitle title="Activité récente"'
);

fs.writeFileSync(filePath, s);
console.log('DashboardStats patched');
