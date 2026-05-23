import prisma from '../src/utils/prisma';
import { resolveVisibleStaffModules } from '../src/utils/staff-visible-modules.util';

async function main() {
  const users = await prisma.user.findMany({
    where: { role: 'STAFF', isActive: true },
    select: {
      email: true,
      staffProfile: {
        select: { staffCategory: true, supportKind: true, visibleStaffModules: true },
      },
    },
  });
  for (const u of users) {
    const sp = u.staffProfile;
    if (!sp) {
      console.log(`${u.email} | PAS DE PROFIL STAFF → 403 admissions`);
      continue;
    }
    const modules = resolveVisibleStaffModules(
      sp.staffCategory,
      sp.supportKind,
      sp.visibleStaffModules,
    );
    console.log(
      `${u.email} | ${sp.staffCategory} | ${sp.supportKind ?? 'null'} | admissions=${modules.includes('admissions')}`,
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
