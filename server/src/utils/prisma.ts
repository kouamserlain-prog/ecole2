import { PrismaClient } from '@prisma/client';

// Singleton pattern pour éviter plusieurs instances de PrismaClient
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prismaLogQueries =
  process.env.PRISMA_LOG_QUERIES === 'true' || process.env.PRISMA_LOG_QUERIES === '1';

const prismaLogLevel =
  process.env.NODE_ENV === 'development'
    ? prismaLogQueries
      ? (['query', 'error', 'warn'] as const)
      : (['error', 'warn'] as const)
    : (['error'] as const);

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: [...prismaLogLevel],
  });
}

/** En dev, tsx garde un singleton sans les nouveaux modèles après prisma generate — on le recrée. */
function prismaClient(): PrismaClient {
  const stale =
    global.prisma &&
    typeof (global.prisma as unknown as { school?: unknown }).school === 'undefined';
  if (stale) {
    void global.prisma?.$disconnect().catch(() => {});
    global.prisma = undefined;
  }
  if (!global.prisma) {
    global.prisma = createPrismaClient();
  }
  return global.prisma;
}

export const prisma =
  process.env.NODE_ENV === 'production'
    ? global.prisma || createPrismaClient()
    : prismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma;

