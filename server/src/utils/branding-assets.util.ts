import fs from 'fs';
import { localPathFromUploadUrl } from './upload-file-path.util';
import { sanitizeHomePageImages, type HomePageImagesRecord } from './home-page-images.util';

/** Vérifie qu’un fichier d’upload local existe encore sur le disque. */
export function uploadAssetExists(publicUrl: string | null | undefined): boolean {
  if (!publicUrl?.trim()) return false;
  if (publicUrl.startsWith('http://') || publicUrl.startsWith('https://')) return true;
  const local = localPathFromUploadUrl(publicUrl);
  if (!local) return false;
  try {
    return fs.existsSync(local);
  } catch {
    return false;
  }
}

export function sanitizeBrandingAssetUrl(publicUrl: string | null | undefined): string | null {
  if (!publicUrl?.trim()) return null;
  return uploadAssetExists(publicUrl) ? publicUrl : null;
}

export type BrandingPublicRow = {
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
  studiesDirectorPhotoUrl?: string | null;
  studiesDirectorName?: string | null;
  studiesDirectorOccasionBadge?: string | null;
  studiesDirectorMessageTitle?: string | null;
  studiesDirectorMessage?: string | null;
  studiesDirectorClosing?: string | null;
  studiesDirectorFooterLine?: string | null;
  homePageImages?: HomePageImagesRecord | null;
};

export function toPublicBrandingShape(row: BrandingPublicRow): BrandingPublicRow {
  return {
    navigationLogoUrl: sanitizeBrandingAssetUrl(row.navigationLogoUrl),
    loginLogoUrl: sanitizeBrandingAssetUrl(row.loginLogoUrl),
    faviconUrl: sanitizeBrandingAssetUrl(row.faviconUrl),
    studiesDirectorPhotoUrl: sanitizeBrandingAssetUrl(row.studiesDirectorPhotoUrl),
    studiesDirectorName: row.studiesDirectorName ?? null,
    studiesDirectorOccasionBadge: row.studiesDirectorOccasionBadge ?? null,
    studiesDirectorMessageTitle: row.studiesDirectorMessageTitle ?? null,
    studiesDirectorMessage: row.studiesDirectorMessage ?? null,
    studiesDirectorClosing: row.studiesDirectorClosing ?? null,
    studiesDirectorFooterLine: row.studiesDirectorFooterLine ?? null,
    homePageImages: sanitizeHomePageImages(row.homePageImages),
    appTitle: row.appTitle,
    appTagline: row.appTagline,
    currentAcademicYear: row.currentAcademicYear ?? null,
    schoolDisplayName: row.schoolDisplayName,
    schoolAddress: row.schoolAddress,
    schoolPhone: row.schoolPhone,
    schoolEmail: row.schoolEmail,
    schoolWebsite: row.schoolWebsite,
    schoolPrincipal: row.schoolPrincipal,
  };
}
