import prisma from './prisma';
import { APP_BRANDING_ID, getAppBrandingDelegate } from './app-branding-prisma.util';
import { getSchoolDelegate, SCHOOL_PRISMA_HINT } from './school-prisma.util';

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'etablissement';
}

export class SchoolPrismaNotReadyError extends Error {
  constructor() {
    super(SCHOOL_PRISMA_HINT);
    this.name = 'SchoolPrismaNotReadyError';
  }
}

/**
 * Garantit au moins un établissement actif et rattache les données existantes sans schoolId.
 */
export async function ensureDefaultSchool(): Promise<string> {
  const schools = getSchoolDelegate();
  if (!schools) {
    throw new SchoolPrismaNotReadyError();
  }

  const existingDefault = await schools.findFirst({
    where: { isDefault: true, isActive: true },
    select: { id: true },
  });
  if (existingDefault) {
    await backfillOrphanRecords(existingDefault.id);
    return existingDefault.id;
  }

  const any = await schools.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (any) {
    await schools.update({
      where: { id: any.id },
      data: { isDefault: true },
    });
    await backfillOrphanRecords(any.id);
    return any.id;
  }

  const brandingDelegate = getAppBrandingDelegate();
  const legacyBranding = brandingDelegate
    ? await brandingDelegate.findUnique({ where: { id: APP_BRANDING_ID } })
    : null;

  const displayName =
    legacyBranding?.schoolDisplayName?.trim() ||
    legacyBranding?.appTitle?.trim() ||
    'Établissement principal';

  let slug = slugify(displayName);
  const slugTaken = await schools.findUnique({ where: { slug } });
  if (slugTaken) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const school = (await schools.create({
    data: {
      name: displayName,
      slug,
      shortName: legacyBranding?.appTitle?.trim() || null,
      address: legacyBranding?.schoolAddress?.trim() || null,
      phone: legacyBranding?.schoolPhone?.trim() || null,
      email: legacyBranding?.schoolEmail?.trim() || null,
      website: legacyBranding?.schoolWebsite?.trim() || null,
      principalName: legacyBranding?.schoolPrincipal?.trim() || null,
      isDefault: true,
      isActive: true,
    },
  })) as { id: string };

  if (brandingDelegate && legacyBranding) {
    await brandingDelegate.upsert({
      where: { id: school.id },
      create: {
        id: school.id,
        schoolId: school.id,
        navigationLogoUrl: legacyBranding.navigationLogoUrl,
        loginLogoUrl: legacyBranding.loginLogoUrl,
        faviconUrl: legacyBranding.faviconUrl,
        appTitle: legacyBranding.appTitle,
        appTagline: legacyBranding.appTagline,
        schoolDisplayName: legacyBranding.schoolDisplayName ?? displayName,
        schoolAddress: legacyBranding.schoolAddress,
        schoolPhone: legacyBranding.schoolPhone,
        schoolEmail: legacyBranding.schoolEmail,
        schoolWebsite: legacyBranding.schoolWebsite,
        schoolPrincipal: legacyBranding.schoolPrincipal,
      },
      update: {
        schoolId: school.id,
        schoolDisplayName: legacyBranding.schoolDisplayName ?? displayName,
      },
    });
  }

  await backfillOrphanRecords(school.id);
  return school.id;
}

async function backfillOrphanRecords(schoolId: string): Promise<void> {
  await prisma.class.updateMany({
    where: { schoolId: null },
    data: { schoolId },
  });

  await prisma.student.updateMany({
    where: { schoolId: null },
    data: { schoolId },
  });

  // MongoDB : le champ peut être absent (pas seulement null) — updateMany({ schoolId: null }) ne les voit pas.
  const orphanAdmissions = await prisma.admission.findMany({
    select: { id: true, schoolId: true },
  });
  const orphanAdmissionIds = orphanAdmissions.filter((a) => !a.schoolId).map((a) => a.id);
  if (orphanAdmissionIds.length > 0) {
    await prisma.admission.updateMany({
      where: { id: { in: orphanAdmissionIds } },
      data: { schoolId },
    });
  }

  await prisma.staffMember.updateMany({
    where: { schoolId: null },
    data: { schoolId },
  });

  const studentsWithoutSchool = await prisma.student.findMany({
    where: { schoolId: null, classId: { not: null } },
    select: { id: true, classId: true },
    take: 500,
  });
  for (const s of studentsWithoutSchool) {
    if (!s.classId) continue;
    const cls = await prisma.class.findUnique({
      where: { id: s.classId },
      select: { schoolId: true },
    });
    if (cls?.schoolId) {
      await prisma.student.update({
        where: { id: s.id },
        data: { schoolId: cls.schoolId },
      });
    }
  }
}
