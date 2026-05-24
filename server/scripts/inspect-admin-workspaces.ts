/**
 * Diagnostic espaces admin et modules visibles par compte.
 * Usage: npx tsx scripts/inspect-admin-workspaces.ts
 */
import prisma from '../src/utils/prisma';
import {
  ADMIN_MODULE_IDS,
  ADMIN_MODULE_LABELS,
  resolveAdminVisibleModules,
} from '../src/utils/admin-visible-modules.util';

async function main() {
  const activeCount = await prisma.adminWorkspace.count({ where: { isActive: true } });
  const workspaces = await prisma.adminWorkspace.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isActive: true },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
    orderBy: { email: 'asc' },
  });

  console.log('=== ESPACES ADMIN ===');
  console.log(`Espaces actifs: ${activeCount}`);
  console.log(`Total espaces (tous statuts): ${workspaces.length}\n`);

  if (workspaces.length === 0) {
    console.log('(Aucun espace en base — tous les admins voient tous les modules.)\n');
  }

  for (const w of workspaces) {
    console.log(`--- ${w.name} (${w.slug}) ---`);
    console.log(`  id: ${w.id}`);
    console.log(`  actif: ${w.isActive} | défaut: ${w.isDefault}`);
    console.log(
      `  modules (${w.enabledModules.length}): ${w.enabledModules.join(', ') || '(aucun — seulement dashboard/admissions)'}`,
    );
    console.log(`  membres (${w.members.length}):`);
    for (const m of w.members) {
      const u = m.user;
      console.log(
        `    - ${u.email} (${u.role}) ${u.firstName} ${u.lastName}${u.isActive ? '' : ' [inactif]'}`,
      );
    }
    console.log('');
  }

  console.log('=== CONTEXTE MODULES PAR ADMIN ACTIF ===');
  for (const u of admins) {
    const ctx = await resolveAdminVisibleModules(u.id, u.role);
    const membershipCount = await prisma.adminWorkspaceMember.count({
      where: { userId: u.id, workspace: { isActive: true } },
    });

    console.log(`--- ${u.email} (${u.role}) ---`);
    console.log(`  unrestricted: ${ctx.unrestricted}`);
    console.log(
      `  membres d'espaces actifs: ${membershipCount}`,
    );
    console.log(
      `  espaces assignés: ${ctx.workspaces.map((w) => w.name).join(', ') || '(aucun)'}`,
    );
    console.log(
      `  modules visibles: ${ctx.visibleModules.length} / ${ADMIN_MODULE_IDS.length}`,
    );

    if (!ctx.unrestricted) {
      const missing = ADMIN_MODULE_IDS.filter((id) => !ctx.visibleModules.includes(id));
      console.log(`  modules MASQUÉS (${missing.length}):`);
      for (const id of missing) {
        console.log(`    · ${ADMIN_MODULE_LABELS[id] ?? id} (${id})`);
      }
      if (membershipCount === 0 && activeCount > 0) {
        console.log(
          '  ⚠ Compte sans espace assigné : seulement dashboard + espaces & modules + admissions.',
        );
      }
    }
    console.log('');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
