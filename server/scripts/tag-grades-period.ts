/**
 * Rattache les notes existantes à un trimestre bulletin (reportingPeriod).
 * Usage : npx tsx scripts/tag-grades-period.ts --period trim1 --confirm
 */
import dotenv from 'dotenv';
import prisma from '../src/utils/prisma';
import { inferReportingPeriod, getCurrentAcademicYear } from '../src/utils/report-card.util';

dotenv.config();

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes('--confirm');
  const periodIdx = args.indexOf('--period');
  const forcedPeriod = periodIdx >= 0 ? args[periodIdx + 1] : null;

  if (!confirm) {
    console.error('Ajoutez --confirm pour exécuter.');
    process.exit(1);
  }

  const grades = await prisma.grade.findMany({
    select: { id: true, date: true, reportingPeriod: true, title: true },
  });

  let updated = 0;
  for (const grade of grades) {
    const period =
      forcedPeriod ||
      grade.reportingPeriod ||
      inferReportingPeriod(grade.date, getCurrentAcademicYear(grade.date));
    if (!period) continue;
    if (grade.reportingPeriod === period) continue;
    await prisma.grade.update({
      where: { id: grade.id },
      data: { reportingPeriod: period },
    });
    updated += 1;
  }

  console.log(`Notes mises à jour : ${updated} / ${grades.length}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
