import { sanitizeBrandingAssetUrl } from './branding-assets.util';

/** Clés des visuels de la page d’accueil publique (stockées dans AppBranding.homePageImages). */
export const HOME_PAGE_IMAGE_SLOTS = [
  'homeHeroPlatform',
  'homePillarPedagogy',
  'homePillarPortals',
  'homePillarSecurity',
  'homePillarAdministration',
  'homeRoleAdmin',
  'homeRoleTeacher',
  'homeRoleStudent',
  'homeRoleParent',
  'homeSplitCampus',
] as const;

export type HomePageImageSlot = (typeof HOME_PAGE_IMAGE_SLOTS)[number];

export type HomePageImagesRecord = Partial<Record<HomePageImageSlot, string | null>>;

export function isHomePageImageSlot(value: string): value is HomePageImageSlot {
  return (HOME_PAGE_IMAGE_SLOTS as readonly string[]).includes(value);
}

export function parseHomePageImages(raw: unknown): HomePageImagesRecord {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: HomePageImagesRecord = {};
  for (const key of HOME_PAGE_IMAGE_SLOTS) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v === 'string' && v.trim()) out[key] = v.trim();
    else if (v === null) out[key] = null;
  }
  return out;
}

export function sanitizeHomePageImages(raw: unknown): HomePageImagesRecord {
  const parsed = parseHomePageImages(raw);
  const out: HomePageImagesRecord = {};
  for (const key of HOME_PAGE_IMAGE_SLOTS) {
    const url = parsed[key];
    if (url === null) {
      out[key] = null;
      continue;
    }
    const clean = sanitizeBrandingAssetUrl(url);
    if (clean) out[key] = clean;
  }
  return out;
}

export function mergeHomePageImageUpdate(
  prev: HomePageImagesRecord,
  slot: HomePageImageSlot,
  fileUrl: string,
): HomePageImagesRecord {
  return { ...prev, [slot]: fileUrl };
}

export function clearHomePageImageSlot(
  prev: HomePageImagesRecord,
  slot: HomePageImageSlot,
): HomePageImagesRecord {
  return { ...prev, [slot]: null };
}
