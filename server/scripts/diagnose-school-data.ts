/**
 * Diagnostic données vs établissements.
 * Usage: npx tsx scripts/diagnose-school-data.ts
 */
import prisma from '../src/utils/prisma';
import { studentScopeWhere, classScopeWhere } from '../src/utils/school-context.util';

async function main() {
  const schools = await prisma.school.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });

  console.log('=== ÉTABLISSEMENTS ACTIFS ===\n');
  for (const s of schools) {
    console.log(`${s.isDefault ? '[DÉFAUT] ' : ''}${s.name} (${s.slug}) id=${s.id}`);
  }
  console.log('');

  const totalStudents = await prisma.student.count();
  const studentsNoSchool = await prisma.student.count({
    where: { schoolId: null, OR: [{ classId: null }, { class: { schoolId: null } }] },
  });
  const studentsNullSchoolId = await prisma.student.count({ where: { schoolId: null } });
  const classesNoSchool = await prisma.class.count({ where: { schoolId: null } });

  console.log('=== DONNÉES GLOBALES ===');
  console.log(`Élèves total: ${totalStudents}`);
  console.log(`Élèves sans schoolId: ${studentsNullSchoolId}`);
  console.log(`Élèves sans schoolId ET (sans classe ou classe sans schoolId): ${studentsNoSchool}`);
  console.log(`Classes sans schoolId: ${classesNoSchool}`);
  console.log('');

  for (const s of schools) {
    const sw = studentScopeWhere(s.id);
    const cw = classScopeWhere(s.id);
    const [students, classes, teachers] = await Promise.all([
      prisma.student.count({ where: sw }),
      prisma.class.count({ where: cw }),
      prisma.teacher.count({
        where: {
          OR: [
            { classes: { some: { schoolId: s.id } } },
            { courses: { some: { class: { schoolId: s.id } } } },
          ],
        },
      }),
    ]);
    console.log(`--- ${s.name} (filtre actuel) ---`);
    console.log(`  élèves: ${students} | classes: ${classes} | enseignants liés: ${teachers}`);
  }

  const allSchools = await prisma.school.findMany({
    select: { id: true, name: true, isActive: true, isDefault: true },
  });
  console.log('=== TOUS LES ÉTABLISSEMENTS (y compris inactifs) ===');
  for (const s of allSchools) {
    console.log(`  ${s.name} active=${s.isActive} default=${s.isDefault} id=${s.id}`);
  }

  const bySchool = await prisma.student.groupBy({ by: ['schoolId'], _count: { _all: true } });
  console.log('\n=== RÉPARTITION ÉLÈVES PAR schoolId ===');
  for (const row of bySchool) {
    const school = allSchools.find((s) => s.id === row.schoolId);
    console.log(
      `  ${row.schoolId ?? '(null)'}: ${row._count._all} élèves${school ? ` → ${school.name}` : ' → ID inconnu / autre établissement'}`,
    );
  }

  const outside = await prisma.student.findMany({
    where: {
      NOT: {
        OR: schools.flatMap((s) => [
          { schoolId: s.id },
          { class: { schoolId: s.id } },
        ]),
      },
    },
    select: {
      id: true,
      schoolId: true,
      class: { select: { name: true, schoolId: true } },
    },
    take: 10,
  });
  if (outside.length > 0) {
    console.log(`\nÉlèves hors établissements actifs: ${outside.length}+`);
    for (const s of outside) {
      console.log(`  id=${s.id} schoolId=${s.schoolId} class=${s.class?.name} classSchool=${s.class?.schoolId}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
