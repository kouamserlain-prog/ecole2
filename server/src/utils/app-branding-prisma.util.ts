import prisma from './prisma';

export type AppBrandingDelegate = {
  findUnique: (args: { where: { id: string } }) => Promise<AppBrandingRow | null>;
  upsert: (args: {
    where: { id: string };
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }) => Promise<AppBrandingRow>;
  create: (args: { data: Record<string, unknown> }) => Promise<AppBrandingRow>;
};

export type AppBrandingRow = {
  navigationLogoUrl: string | null;
  loginLogoUrl: string | null;
  faviconUrl: string | null;
  appTitle: string | null;
  appTagline: string | null;
  currentAcademicYear?: string | null;
  schoolDisplayName: string | null;
  schoolAddress: string | null;
  schoolPhone: string | null;
  schoolEmail: string | null;
  schoolWebsite: string | null;
  schoolPrincipal: string | null;
};

/** Après ajout du modèle AppBranding, un `npx prisma generate` est requis. */
export function getAppBrandingDelegate(): AppBrandingDelegate | null {
  const delegate = (prisma as unknown as { appBranding?: AppBrandingDelegate }).appBranding;
  return delegate ?? null;
}

export const APP_BRANDING_ID = 'default';

export const APP_BRANDING_PRISMA_HINT =
  'Exécutez dans le dossier server : npx prisma generate puis npx prisma db push (client Prisma ou base pas à jour).';
