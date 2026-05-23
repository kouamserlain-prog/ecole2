import prisma from './prisma';
import {
  resolveVisibleStaffModules,
  type StaffModuleId,
} from './staff-visible-modules.util';

/** Utilisateurs STAFF actifs ayant au moins un des modules indiqués. */
export async function resolveStaffUserIdsWithAnyModule(
  moduleIds: StaffModuleId[],
): Promise<string[]> {
  if (moduleIds.length === 0) return [];

  const staffRows = await prisma.staffMember.findMany({
    where: {
      staffCategory: 'SUPPORT',
      user: { role: 'STAFF', isActive: true },
    },
    select: {
      userId: true,
      staffCategory: true,
      supportKind: true,
      visibleStaffModules: true,
    },
  });

  const ids: string[] = [];
  for (const staff of staffRows) {
    const modules = resolveVisibleStaffModules(
      staff.staffCategory,
      staff.supportKind,
      staff.visibleStaffModules,
    );
    if (moduleIds.some((m) => modules.includes(m))) {
      ids.push(staff.userId);
    }
  }
  return [...new Set(ids)];
}

/** Comptes admin actifs (alertes opérationnelles). */
export async function resolveActiveAdminUserIds(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isActive: true },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
