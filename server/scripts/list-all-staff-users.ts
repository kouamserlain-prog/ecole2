import prisma from '../src/utils/prisma';
import { resolveVisibleStaffModules } from '../src/utils/staff-visible-modules.util';

async function main() {
  const users = await prisma.user.findMany({
    where: { role: 'STAFF' },
    select: {
      email: true,
      isActive: true,
      staffProfile: {
        select: { staffCategory: true, supportKind: true, visibleStaffModules: true },
      },
    },
    orderBy: { email: 'asc' },
  });
  for (const u of users) {
    const sp = u.staffProfile;
    if (!sp) {
      console.log(`${u.email} active=${u.isActive} | NO staffProfile → 403`);
      continue;
    }
    const mods = resolveVisibleStaffModules(sp.staffCategory, sp.supportKind, sp.visibleStaffModules);
    console.log(
      `${u.email} active=${u.isActive} | ${sp.staffCategory}/${sp.supportKind ?? 'null'} | admissions=${mods.includes('admissions')} | pedagogy=${mods.some((m) => ['students_mgmt', 'classes_mgmt'].includes(m))}`,
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
