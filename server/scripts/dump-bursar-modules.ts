import prisma from '../src/utils/prisma';
import { resolveVisibleStaffModules } from '../src/utils/staff-visible-modules.util';

async function main() {
  const s = await prisma.staffMember.findFirst({
    where: { user: { email: 'bursar@school.com' } },
  });
  if (!s) {
    console.log('not found');
    return;
  }
  const resolved = resolveVisibleStaffModules(
    s.staffCategory,
    s.supportKind,
    s.visibleStaffModules,
  );
  console.log('stored:', s.visibleStaffModules);
  console.log('resolved:', resolved);
  console.log('payments_mgmt:', resolved.includes('payments_mgmt'));
  console.log('accounting_mgmt:', resolved.includes('accounting_mgmt'));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
