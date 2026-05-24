/**
 * Assigne toutes les classes existantes aux éducateurs qui n'en ont aucune (migration douce).
 * Usage: npx tsx scripts/assign-educator-classes.ts
 */
import prisma from '../src/utils/prisma';
import { syncEducatorClassAssignments } from '../src/utils/educator-class-assignment.util';

async function main() {
  const classes = await prisma.class.findMany({ select: { id: true } });
  const classIds = classes.map((c) => c.id);
  if (classIds.length === 0) {
    console.log('Aucune classe en base.');
    return;
  }

  const educators = await prisma.educator.findMany({
    include: { classAssignments: { select: { id: true } } },
  });

  let updated = 0;
  for (const edu of educators) {
    if (edu.classAssignments.length > 0) continue;
    await syncEducatorClassAssignments(edu.id, classIds);
    updated += 1;
    console.log(`Éducateur ${edu.employeeId}: ${classIds.length} classe(s) assignée(s).`);
  }

  console.log(`Terminé. ${updated} éducateur(s) mis à jour.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
