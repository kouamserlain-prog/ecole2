'use client';

import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '@/services/api';

export type BrandingUploadSlot = 'navigation' | 'login' | 'favicon';

export type BrandingUrlField = 'navigationLogoUrl' | 'loginLogoUrl' | 'faviconUrl';

export function useBrandingFileUpload(onAfterChange: () => Promise<void>) {
  const [uploading, setUploading] = useState<BrandingUploadSlot | null>(null);

  const triggerUpload = useCallback(
    (slot: BrandingUploadSlot) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml,.ico';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
          toast.error('Fichier trop volumineux (max 5 Mo)');
          return;
        }
        setUploading(slot);
        try {
          await adminApi.uploadAppBrandingFile(slot, file);
          await onAfterChange();
          toast.success(
            slot === 'favicon'
              ? 'Logo de l’onglet mis à jour'
              : 'Image enregistrée',
          );
        } catch (err: unknown) {
          const msg =
            (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
            'Échec du téléversement';
          toast.error(msg);
        } finally {
          setUploading(null);
        }
      };
      input.click();
    },
    [onAfterChange],
  );

  const clearAsset = useCallback(
    async (field: BrandingUrlField) => {
      try {
        await adminApi.updateAppBranding({ [field]: null });
        await onAfterChange();
        toast.success(field === 'faviconUrl' ? 'Logo de l’onglet réinitialisé' : 'Image supprimée');
      } catch {
        toast.error('Suppression impossible');
      }
    },
    [onAfterChange],
  );

  return { uploading, triggerUpload, clearAsset };
}
