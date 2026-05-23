/**
 * Normalise visibleStaffModules pour tout le personnel SUPPORT
 * (ids admin → ids staff, dédoublonnage, overview).
 *
 * Usage: npx tsx scripts/normalize-all-staff-visible-modules.ts
 */
import prisma from '../src/utils/prisma';
import {
  getEligibleModulesForStaffMember,
  normalizeStaffModuleId,
  resolveVisibleStaffModules,
  type StaffModuleId,
} from '../src/utils/staff-visible-modules.util';

function sanitizeStored(
  staffCategory: 'SUPPORT' | 'ADMINISTRATION' | 'SECURITY',
  supportKind: Parameters<typeof getEligibleModulesForStaffMember>[1],
  stored: string[],
): StaffModuleId[] {
  if (staffCategory !== 'SUPPORT') return ['overview'];
  const set = new Set<StaffModuleId>(['overview']);
  for (const raw of stored) {
    const id = normalizeStaffModuleId(raw);
    if (id && id !== 'overview') set.add(id);
  }
  if (set.size === 1) {
    return getEligibleModulesForStaffMember(staffCategory, supportKind);
  }
  return [...set];
}

async function main() {
  const staffRows = await prisma.staffMember.findMany({
    where: { staffCategory: 'SUPPORT' },
    include: { user: { select: { email: true } } },
  });

  let updated = 0;
  for (const row of staffRows) {
    const before = row.visibleStaffModules ?? [];
    const after = sanitizeStored(row.staffCategory, row.supportKind, before);
    const beforeKey = [...before].sort().join(',');
    const afterKey = [...after].sort().join(',');
    if (beforeKey !== afterKey) {
      await prisma.staffMember.update({
        where: { id: row.id },
        data: { visibleStaffModules: after },
      });
      updated++;
      console.log(
        `${row.user.email} (${row.supportKind}): ${before.length} → ${after.length} modules`,
      );
    }
    const resolved = resolveVisibleStaffModules(
      row.staffCategory,
      row.supportKind,
      after,
    );
    const lost = before.filter(
      (id) => normalizeStaffModuleId(id) && !resolved.includes(normalizeStaffModuleId(id)!),
    );
    if (lost.length > 0) {
      console.warn(`  ⚠ ids non reconnus ignorés: ${lost.join(', ')}`);
    }
  }

  console.log(`\nTerminé : ${updated}/${staffRows.length} fiche(s) mise(s) à jour.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
