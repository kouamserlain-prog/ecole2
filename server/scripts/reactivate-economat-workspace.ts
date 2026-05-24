/**
 * Réactive l'espace ECONOMAT pour restaurer les modules finance.
 * Usage: npx tsx scripts/reactivate-economat-workspace.ts
 */
import prisma from '../src/utils/prisma';

async function main() {
  const w = await prisma.adminWorkspace.update({
    where: { slug: 'economat' },
    data: { isActive: true },
  });
  console.log(`Espace « ${w.name} » réactivé (isActive=true).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
