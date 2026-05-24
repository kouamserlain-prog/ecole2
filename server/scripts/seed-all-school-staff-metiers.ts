/**
 * Initialise les métiers STAFF pour tous les établissements actifs.
 * Usage: npx tsx scripts/seed-all-school-staff-metiers.ts
 */
import { seedAllSchoolsStaffMetiers } from '../src/utils/school-staff-metiers.util';
import prisma from '../src/utils/prisma';

async function main() {
  await seedAllSchoolsStaffMetiers();
  const count = await prisma.schoolStaffMetier.count();
  console.log(`Métiers par établissement : ${count} enregistrement(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
