import express from 'express';
import type { Prisma } from '@prisma/client';
import { brandingUpload } from '../middleware/upload.middleware';
import { deleteStoredUploadUrl, persistUploadedFile } from '../utils/upload-persist.util';
import {
  getAppBrandingDelegate,
  APP_BRANDING_ID,
  APP_BRANDING_PRISMA_HINT,
} from '../utils/app-branding-prisma.util';
import type { SchoolContextRequest } from '../utils/school-context.util';
import { brandingIdForSchool } from '../utils/school-context.util';
import { toPublicBrandingShape } from '../utils/branding-assets.util';
import {
  clearHomePageImageSlot,
  isHomePageImageSlot,
  mergeHomePageImageUpdate,
  parseHomePageImages,
} from '../utils/home-page-images.util';

const router = express.Router();

const CORE_SLOTS = new Set(['navigation', 'login', 'favicon', 'studiesDirector']);

function isAllowedBrandingSlot(slot: string): boolean {
  return CORE_SLOTS.has(slot) || isHomePageImageSlot(slot);
}

function emptyBrandingResponse() {
  return {
    navigationLogoUrl: null,
    loginLogoUrl: null,
    faviconUrl: null,
    appTitle: null,
    appTagline: null,
    schoolDisplayName: null,
    schoolAddress: null,
    schoolPhone: null,
    schoolEmail: null,
    schoolWebsite: null,
    schoolPrincipal: null,
    studiesDirectorPhotoUrl: null,
    homePageImages: {},
  };
}

function trimText(v: unknown, max: number): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length === 0 ? null : t.slice(0, max);
}

function toPublicShape(row: Parameters<typeof toPublicBrandingShape>[0]) {
  return toPublicBrandingShape(row);
}

function delegateOr503(res: express.Response) {
  const appBranding = getAppBrandingDelegate();
  if (!appBranding) {
    console.error(
      '[app-branding] Client Prisma sans modèle AppBranding — cd server && npx prisma generate && npx prisma db push'
    );
    res.status(503).json({ error: APP_BRANDING_PRISMA_HINT });
    return null;
  }
  return appBranding;
}

/** Lecture (admin) — même contenu que l’endpoint public. */
router.get('/app-branding', async (req: SchoolContextRequest, res) => {
  try {
    const appBranding = delegateOr503(res);
    if (!appBranding) return;

    const brandingId = req.schoolId
      ? await brandingIdForSchool(req.schoolId)
      : APP_BRANDING_ID;
    const row = await appBranding.findUnique({ where: { id: brandingId } });
    if (!row) {
      return res.json(emptyBrandingResponse());
    }
    res.json(toPublicShape(row as Parameters<typeof toPublicBrandingShape>[0]));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('GET /admin/app-branding:', error);
    res.status(500).json({ error: message });
  }
});

router.put('/app-branding', async (req: SchoolContextRequest, res) => {
  try {
    const appBranding = delegateOr503(res);
    if (!appBranding) return;

    const brandingId = req.schoolId
      ? await brandingIdForSchool(req.schoolId)
      : APP_BRANDING_ID;

    const body = req.body as Record<string, unknown>;
    const data: Prisma.AppBrandingUncheckedUpdateInput = {};

    const title = trimText(body.appTitle, 120);
    const tagline = trimText(body.appTagline, 160);
    if (title !== undefined) data.appTitle = title;
    if (tagline !== undefined) data.appTagline = tagline;

    const schoolName = trimText(body.schoolDisplayName, 200);
    const schoolAddr = trimText(body.schoolAddress, 500);
    const schoolPh = trimText(body.schoolPhone, 80);
    const schoolEm = trimText(body.schoolEmail, 120);
    const schoolWeb = trimText(body.schoolWebsite, 200);
    const schoolPr = trimText(body.schoolPrincipal, 120);
    if (schoolName !== undefined) data.schoolDisplayName = schoolName;
    if (schoolAddr !== undefined) data.schoolAddress = schoolAddr;
    if (schoolPh !== undefined) data.schoolPhone = schoolPh;
    if (schoolEm !== undefined) data.schoolEmail = schoolEm;
    if (schoolWeb !== undefined) data.schoolWebsite = schoolWeb;
    if (schoolPr !== undefined) data.schoolPrincipal = schoolPr;

    const prev = await appBranding.findUnique({ where: { id: brandingId } });

    const applyUrlClear = async (
      key: 'navigationLogoUrl' | 'loginLogoUrl' | 'faviconUrl',
      bodyKey: string,
    ) => {
      if (!(bodyKey in body)) return;
      const v = body[bodyKey];
      if (v === null) {
        const old = prev?.[key];
        if (old) await deleteStoredUploadUrl(old);
        data[key] = null;
      }
    };

    await applyUrlClear('navigationLogoUrl', 'navigationLogoUrl');
    await applyUrlClear('loginLogoUrl', 'loginLogoUrl');
    await applyUrlClear('faviconUrl', 'faviconUrl');
    if ('studiesDirectorPhotoUrl' in body && body.studiesDirectorPhotoUrl === null) {
      const old = (prev as { studiesDirectorPhotoUrl?: string | null } | null)?.studiesDirectorPhotoUrl;
      if (old) await deleteStoredUploadUrl(old);
      data.studiesDirectorPhotoUrl = null;
    }

    if (body.homePageImages && typeof body.homePageImages === 'object' && !Array.isArray(body.homePageImages)) {
      const prevImages = parseHomePageImages(
        (prev as { homePageImages?: unknown } | null)?.homePageImages,
      );
      let nextImages = { ...prevImages };
      for (const [key, value] of Object.entries(body.homePageImages as Record<string, unknown>)) {
        if (!isHomePageImageSlot(key) || value !== null) continue;
        const oldUrl = prevImages[key];
        if (oldUrl) await deleteStoredUploadUrl(oldUrl);
        nextImages = clearHomePageImageSlot(nextImages, key);
      }
      data.homePageImages = nextImages as Prisma.InputJsonValue;
    }

    if (Object.keys(data).length === 0) {
      const row =
        prev ??
        (await appBranding.create({
          data: {
            id: brandingId,
            schoolId: req.schoolId ?? undefined,
          },
        }));
      return res.json(toPublicShape(row as Parameters<typeof toPublicBrandingShape>[0]));
    }

    const row = await appBranding.upsert({
      where: { id: brandingId },
      create: {
        id: brandingId,
        schoolId: req.schoolId ?? undefined,
        ...(data as Omit<Prisma.AppBrandingUncheckedCreateInput, 'id' | 'schoolId'>),
      },
      update: data,
    });

    res.json(toPublicShape(row as Parameters<typeof toPublicBrandingShape>[0]));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('PUT /admin/app-branding:', error);
    res.status(500).json({ error: message });
  }
});

router.post('/app-branding/upload', (req, res, next) => {
  brandingUpload.single('branding')(req, res, (err) => {
    if (err) {
      const message = err instanceof Error ? err.message : 'Upload invalide';
      return res.status(400).json({ error: message });
    }
    next();
  });
}, async (req: SchoolContextRequest, res) => {
  try {
    const appBranding = delegateOr503(res);
    if (!appBranding) return;

    const brandingId = req.schoolId
      ? await brandingIdForSchool(req.schoolId)
      : APP_BRANDING_ID;

    const slot = String(req.query.slot || '').trim();
    if (!isAllowedBrandingSlot(slot)) {
      return res.status(400).json({
        error:
          'Paramètre slot invalide (navigation, login, favicon, studiesDirector ou clé homePageImages)',
      });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Fichier manquant (champ branding)' });
    }

    const fileUrl = await persistUploadedFile(req.file, 'branding', { relative: true });
    const prev = await appBranding.findUnique({ where: { id: brandingId } });

    if (isHomePageImageSlot(slot)) {
      const prevImages = parseHomePageImages(
        (prev as { homePageImages?: unknown } | null)?.homePageImages,
      );
      const oldUrl = prevImages[slot];
      const nextImages = mergeHomePageImageUpdate(prevImages, slot, fileUrl);

      const row = await appBranding.upsert({
        where: { id: brandingId },
        create: {
          id: brandingId,
          schoolId: req.schoolId ?? undefined,
          homePageImages: nextImages as Prisma.InputJsonValue,
        },
        update: { homePageImages: nextImages as Prisma.InputJsonValue },
      });

      if (oldUrl && oldUrl !== fileUrl) {
        await deleteStoredUploadUrl(oldUrl);
      }

      return res.json(toPublicShape(row as Parameters<typeof toPublicBrandingShape>[0]));
    }

    let oldUrl: string | null | undefined;
    if (slot === 'navigation') oldUrl = prev?.navigationLogoUrl ?? undefined;
    else if (slot === 'login') oldUrl = prev?.loginLogoUrl ?? undefined;
    else if (slot === 'favicon') oldUrl = prev?.faviconUrl ?? undefined;
    else oldUrl = (prev as { studiesDirectorPhotoUrl?: string | null } | null)?.studiesDirectorPhotoUrl;

    const update: Prisma.AppBrandingUpdateInput =
      slot === 'navigation'
        ? { navigationLogoUrl: fileUrl }
        : slot === 'login'
          ? { loginLogoUrl: fileUrl }
          : slot === 'favicon'
            ? { faviconUrl: fileUrl }
            : { studiesDirectorPhotoUrl: fileUrl };

    const row = await appBranding.upsert({
      where: { id: brandingId },
      create: {
        id: brandingId,
        schoolId: req.schoolId ?? undefined,
        navigationLogoUrl: slot === 'navigation' ? fileUrl : null,
        loginLogoUrl: slot === 'login' ? fileUrl : null,
        faviconUrl: slot === 'favicon' ? fileUrl : null,
        studiesDirectorPhotoUrl: slot === 'studiesDirector' ? fileUrl : null,
      },
      update,
    });

    if (oldUrl && oldUrl !== fileUrl) {
      await deleteStoredUploadUrl(oldUrl);
    }

    res.json(toPublicShape(row as Parameters<typeof toPublicBrandingShape>[0]));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('POST /admin/app-branding/upload:', error);
    res.status(500).json({ error: message });
  }
});

export default router;
