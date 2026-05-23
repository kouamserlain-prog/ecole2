import prisma from './prisma';

export const SCHOOL_PRISMA_HINT =
  'Client Prisma obsolète : arrêtez npm run dev, puis dans server exécutez npx prisma generate et relancez.';

type SchoolDelegate = {
  findFirst: (args: unknown) => Promise<{ id: string } | null>;
  findUnique: (args: unknown) => Promise<unknown>;
  findMany: (args: unknown) => Promise<unknown[]>;
  create: (args: unknown) => Promise<{ id: string }>;
  update: (args: unknown) => Promise<unknown>;
  updateMany: (args: unknown) => Promise<unknown>;
};

type SchoolMemberDelegate = {
  findFirst: (args: unknown) => Promise<unknown>;
  findUnique: (args: unknown) => Promise<unknown>;
  findMany: (args: unknown) => Promise<unknown[]>;
  create: (args: unknown) => Promise<unknown>;
  upsert: (args: unknown) => Promise<unknown>;
  updateMany: (args: unknown) => Promise<unknown>;
};

export function getSchoolDelegate(): SchoolDelegate | null {
  const delegate = (prisma as unknown as { school?: SchoolDelegate }).school;
  return delegate ?? null;
}

export function getSchoolMemberDelegate(): SchoolMemberDelegate | null {
  const delegate = (prisma as unknown as { schoolMember?: SchoolMemberDelegate }).schoolMember;
  return delegate ?? null;
}

export function isSchoolPrismaReady(): boolean {
  return getSchoolDelegate() != null && getSchoolMemberDelegate() != null;
}
