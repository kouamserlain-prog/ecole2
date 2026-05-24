/**
 * Rattache élèves/classes sans schoolId à l'établissement par défaut.
 * Usage: npx tsx scripts/backfill-school-ids.ts
 */
import { ensureDefaultSchool } from '../src/utils/ensure-default-school.util';
import prisma from '../src/utils/prisma';

async function main() {
  const defaultId = await ensureDefaultSchool();
  const school = await prisma.school.findUnique({
    where: { id: defaultId },
    select: { name: true, isDefault: true },
  });

  const classResult = await prisma.class.updateMany({
    where: { OR: [{ schoolId: null }, { schoolId: { isSet: false } }] },
    data: { schoolId: defaultId },
  });

  const studentDirect = await prisma.student.updateMany({
    where: { OR: [{ schoolId: null }, { schoolId: { isSet: false } }] },
    data: { schoolId: defaultId },
  });

  const studentsWithClass = await prisma.student.findMany({
    where: {
      OR: [{ schoolId: null }, { schoolId: { isSet: false } }],
      classId: { not: null },
      class: { schoolId: defaultId },
    },
    select: { id: true },
  });

  let studentFromClass = 0;
  for (const s of studentsWithClass) {
    await prisma.student.update({
      where: { id: s.id },
      data: { schoolId: defaultId },
    });
    studentFromClass += 1;
  }

  console.log(`Établissement par défaut: ${school?.name ?? defaultId} (isDefault=${school?.isDefault})`);
  console.log(`Classes mises à jour: ${classResult.count}`);
  console.log(`Élèves schoolId direct: ${studentDirect.count}`);
  console.log(`Élèves via classe: ${studentFromClass}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
