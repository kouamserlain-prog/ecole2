/**
 * Complète l'espace Directeur des Etudes avec les modules encore absents de l'union.
 * Usage: npx tsx scripts/expand-directeur-workspace-modules.ts
 */
import prisma from '../src/utils/prisma';
import {
  ADMIN_MODULE_IDS,
  type AdminModuleId,
} from '../src/utils/admin-visible-modules.util';

const EXTRA_FOR_DIRECTEUR: AdminModuleId[] = [
  'academic',
  'grading',
  'roles',
  'orientation',
  'elearning',
  'security',
  'performance',
  'settings',
];

async function main() {
  const ws = await prisma.adminWorkspace.findUnique({
    where: { slug: 'directeur-des-etudes' },
  });
  if (!ws) {
    console.error('Espace directeur-des-etudes introuvable.');
    process.exit(1);
  }

  const merged = new Set<string>(ws.enabledModules);
  for (const id of EXTRA_FOR_DIRECTEUR) {
    if (ADMIN_MODULE_IDS.includes(id)) merged.add(id);
  }
  merged.add('dashboard');

  const enabledModules = [...merged] as string[];

  await prisma.adminWorkspace.update({
    where: { id: ws.id },
    data: { enabledModules },
  });

  console.log(
    `« ${ws.name} » : ${ws.enabledModules.length} → ${enabledModules.length} modules.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
