import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();
const prisma = new PrismaClient();
try {
  await prisma.$connect();
  const count = await prisma.school.count();
  console.log('OK — schools:', count);
} catch (e) {
  console.error('FAIL', e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
