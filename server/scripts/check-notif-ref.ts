import dotenv from 'dotenv';
dotenv.config();
import prisma from '../src/utils/prisma';

async function main() {
  const ref = process.argv[2] || 'ADM-2026-BYW7NC';
  const admission = await prisma.admission.findUnique({
    where: { reference: ref },
    select: { createdAt: true, firstName: true, lastName: true, status: true },
  });
  if (!admission) {
    console.log(`Dossier ${ref} introuvable en base.`);
    return;
  }
  console.log(
    `Dossier: ${admission.firstName} ${admission.lastName} (${admission.status}) — créé le ${admission.createdAt.toISOString()}`,
  );

  const n = await prisma.notification.findMany({
    where: { type: 'admission', content: { contains: ref } },
    include: { user: { select: { email: true, role: true } } },
  });
  console.log(`Notifs cloche pour ${ref}: ${n.length}`);
  for (const x of n) console.log(` - ${x.user.email} (${x.user.role})`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
