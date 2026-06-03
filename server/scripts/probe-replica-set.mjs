import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();
const uri =
  'mongodb://digitalprosolutions27_db_user:D1g1t%40lpr0Solu@ac-7argox9-shard-00-00.hdvrssw.mongodb.net:27017/school_manager?ssl=true&directConnection=true&authSource=admin';

const prisma = new PrismaClient({ datasources: { db: { url: uri } } });
try {
  await prisma.$connect();
  const hello = await prisma.$runCommandRaw({ hello: 1 });
  console.log(JSON.stringify(hello, null, 2));
} catch (e) {
  console.error('FAIL', e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
