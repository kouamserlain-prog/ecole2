'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { publicApi } from '@/services/api/public';
import { resolveUploadPublicUrl } from '@/lib/uploadsPublicUrl';
import { applyBrandingToDocument } from '@/lib/applyBrandingDocument';
import type { HomePageImagesRecord } from '@/lib/homePageImages.types';
import { ACADEMIC_YEAR_OVERRIDE_STORAGE_KEY } from '@/utils/academicYear';
import { loadCachedGetPayload } from '@/lib/offline-api';

export type AppBrandingPayload = {
  navigationLogoUrl: string | null;
  loginLogoUrl: string | null;
  faviconUrl: string | null;
  appTitle: string | null;
  appTagline: string | null;
  currentAcademicYear: string | null;
  schoolDisplayName: string | null;
  schoolAddress: string | null;
  schoolPhone: string | null;
  schoolEmail: string | null;
  schoolWebsite: string | null;
  schoolPrincipal: string | null;
  schoolCode: string | null;
  studiesDirectorPhotoUrl: string | null;
  studiesDirectorName: string | null;
  studiesDirectorOccasionBadge: string | null;
  studiesDirectorMessageTitle: string | null;
  studiesDirectorMessage: string | null;
  studiesDirectorClosing: string | null;
  studiesDirectorFooterLine: string | null;
  homePageImages: HomePageImagesRecord;
};

type AppBrandingContextValue = {
  branding: AppBrandingPayload;
  loading: boolean;
  error: string | null;
  refreshBranding: () => Promise<void>;
  navigationLogoAbsolute: string | null;
  loginLogoAbsolute: string | null;
  faviconAbsolute: string | null;
  studiesDirectorPhotoAbsolute: string | null;
};

const DEFAULT_BRANDING: AppBrandingPayload = {
  navigationLogoUrl: null,
  loginLogoUrl: null,
  faviconUrl: null,
  appTitle: null,
  appTagline: null,
  currentAcademicYear: null,
  schoolDisplayName: null,
  schoolAddress: null,
  schoolPhone: null,
  schoolEmail: null,
  schoolWebsite: null,
  schoolPrincipal: null,
  schoolCode: null,
  studiesDirectorPhotoUrl: null,
  studiesDirectorName: null,
  studiesDirectorOccasionBadge: null,
  studiesDirectorMessageTitle: null,
  studiesDirectorMessage: null,
  studiesDirectorClosing: null,
  studiesDirectorFooterLine: null,
  homePageImages: {},
};

const AppBrandingContext = createContext<AppBrandingContextValue | null>(null);

export function AppBrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<AppBrandingPayload>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshBranding = useCallback(async () => {
    try {
      setError(null);
      const data = (await publicApi.getAppBranding()) as AppBrandingPayload;
      setBranding({
        navigationLogoUrl: data.navigationLogoUrl ?? null,
        loginLogoUrl: data.loginLogoUrl ?? null,
        faviconUrl: data.faviconUrl ?? null,
        appTitle: data.appTitle ?? null,
        appTagline: data.appTagline ?? null,
        currentAcademicYear: data.currentAcademicYear ?? null,
        schoolDisplayName: data.schoolDisplayName ?? null,
        schoolAddress: data.schoolAddress ?? null,
        schoolPhone: data.schoolPhone ?? null,
        schoolEmail: data.schoolEmail ?? null,
        schoolWebsite: data.schoolWebsite ?? null,
        schoolPrincipal: data.schoolPrincipal ?? null,
        schoolCode: data.schoolCode ?? null,
        studiesDirectorPhotoUrl: data.studiesDirectorPhotoUrl ?? null,
        studiesDirectorName: data.studiesDirectorName ?? null,
        studiesDirectorOccasionBadge: data.studiesDirectorOccasionBadge ?? null,
        studiesDirectorMessageTitle: data.studiesDirectorMessageTitle ?? null,
        studiesDirectorMessage: data.studiesDirectorMessage ?? null,
        studiesDirectorClosing: data.studiesDirectorClosing ?? null,
        studiesDirectorFooterLine: data.studiesDirectorFooterLine ?? null,
        homePageImages:
          data.homePageImages && typeof data.homePageImages === 'object' && !Array.isArray(data.homePageImages)
            ? (data.homePageImages as HomePageImagesRecord)
            : {},
      });
      try {
        if (data.currentAcademicYear) {
          window.localStorage.setItem(ACADEMIC_YEAR_OVERRIDE_STORAGE_KEY, data.currentAcademicYear);
        } else {
          window.localStorage.removeItem(ACADEMIC_YEAR_OVERRIDE_STORAGE_KEY);
        }
      } catch {
        /* ignore */
      }
    } catch (e: unknown) {
      const cached = (await loadCachedGetPayload('/api/public/app-branding')) as
        | AppBrandingPayload
        | null;
      if (cached) {
        setBranding({
          navigationLogoUrl: cached.navigationLogoUrl ?? null,
          loginLogoUrl: cached.loginLogoUrl ?? null,
          faviconUrl: cached.faviconUrl ?? null,
          appTitle: cached.appTitle ?? null,
          appTagline: cached.appTagline ?? null,
          currentAcademicYear: cached.currentAcademicYear ?? null,
          schoolDisplayName: cached.schoolDisplayName ?? null,
          schoolAddress: cached.schoolAddress ?? null,
          schoolPhone: cached.schoolPhone ?? null,
          schoolEmail: cached.schoolEmail ?? null,
          schoolWebsite: cached.schoolWebsite ?? null,
          schoolPrincipal: cached.schoolPrincipal ?? null,
          schoolCode: cached.schoolCode ?? null,
          studiesDirectorPhotoUrl: cached.studiesDirectorPhotoUrl ?? null,
          studiesDirectorName: cached.studiesDirectorName ?? null,
          studiesDirectorOccasionBadge: cached.studiesDirectorOccasionBadge ?? null,
          studiesDirectorMessageTitle: cached.studiesDirectorMessageTitle ?? null,
          studiesDirectorMessage: cached.studiesDirectorMessage ?? null,
          studiesDirectorClosing: cached.studiesDirectorClosing ?? null,
          studiesDirectorFooterLine: cached.studiesDirectorFooterLine ?? null,
          homePageImages:
            cached.homePageImages &&
            typeof cached.homePageImages === 'object' &&
            !Array.isArray(cached.homePageImages)
              ? cached.homePageImages
              : {},
        });
        setError(null);
      } else {
        const msg = e instanceof Error ? e.message : 'Chargement de la charte impossible';
        setError(msg);
        setBranding(DEFAULT_BRANDING);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshBranding();
  }, [refreshBranding]);

  useEffect(() => {
    const href = resolveUploadPublicUrl(branding.faviconUrl);
    const title = branding.appTitle?.trim() || null;
    applyBrandingToDocument(href, title);
  }, [branding.faviconUrl, branding.appTitle]);

  const navigationLogoAbsolute = useMemo(
    () => resolveUploadPublicUrl(branding.navigationLogoUrl),
    [branding.navigationLogoUrl]
  );
  const loginLogoAbsolute = useMemo(() => {
    const login = resolveUploadPublicUrl(branding.loginLogoUrl);
    if (login) return login;
    return navigationLogoAbsolute;
  }, [branding.loginLogoUrl, navigationLogoAbsolute]);
  const faviconAbsolute = useMemo(
    () => resolveUploadPublicUrl(branding.faviconUrl),
    [branding.faviconUrl]
  );
  const studiesDirectorPhotoAbsolute = useMemo(
    () => resolveUploadPublicUrl(branding.studiesDirectorPhotoUrl),
    [branding.studiesDirectorPhotoUrl]
  );

  const value = useMemo<AppBrandingContextValue>(
    () => ({
      branding,
      loading,
      error,
      refreshBranding,
      navigationLogoAbsolute,
      loginLogoAbsolute,
      faviconAbsolute,
      studiesDirectorPhotoAbsolute,
    }),
    [
      branding,
      loading,
      error,
      refreshBranding,
      navigationLogoAbsolute,
      loginLogoAbsolute,
      faviconAbsolute,
      studiesDirectorPhotoAbsolute,
    ]
  );

  return <AppBrandingContext.Provider value={value}>{children}</AppBrandingContext.Provider>;
}

const FALLBACK_CTX: AppBrandingContextValue = {
  branding: DEFAULT_BRANDING,
  loading: false,
  error: null,
  refreshBranding: async () => {},
  navigationLogoAbsolute: null,
  loginLogoAbsolute: null,
  faviconAbsolute: null,
  studiesDirectorPhotoAbsolute: null,
};

/** Retourne un contexte par défaut si le provider est absent (ex. tests). */
export function useAppBranding(): AppBrandingContextValue {
  const ctx = useContext(AppBrandingContext);
  return ctx ?? FALLBACK_CTX;
}
