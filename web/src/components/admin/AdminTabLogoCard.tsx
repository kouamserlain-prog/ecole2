'use client';

import Card from '../ui/Card';
import Button from '../ui/Button';
import { useAppBranding } from '@/contexts/AppBrandingContext';
import { useBrandingFileUpload } from '@/hooks/useBrandingFileUpload';
import { FiGlobe, FiLoader, FiTrash2, FiUpload } from 'react-icons/fi';

type Props = {
  onOpenFullSettings?: () => void;
};

/** Changement rapide du favicon (logo affiché dans l’onglet du navigateur). */
export default function AdminTabLogoCard({ onOpenFullSettings }: Props) {
  const { faviconAbsolute, refreshBranding } = useAppBranding();
  const { uploading, triggerUpload, clearAsset } = useBrandingFileUpload(refreshBranding);

  return (
    <Card variant="premium" className="border border-stone-200/90">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-stone-100 border border-stone-200 overflow-hidden">
          {faviconAbsolute ? (
            <img src={faviconAbsolute} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <FiGlobe className="w-8 h-8 text-stone-400" aria-hidden />
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <h3 className="text-lg font-bold text-stone-900">Logo de l’onglet du navigateur</h3>
          <p className="text-sm text-stone-600 leading-relaxed">
            Petite icône affichée dans l’onglet et les favoris (PNG ou ICO carré, 32×32 à 512×512,
            max 5 Mo). Visible pour tous les utilisateurs après enregistrement.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => triggerUpload('favicon')}
              disabled={!!uploading}
              className="inline-flex items-center gap-2"
            >
              {uploading === 'favicon' ? (
                <FiLoader className="w-4 h-4 animate-spin" aria-hidden />
              ) : (
                <FiUpload className="w-4 h-4" aria-hidden />
              )}
              Changer le logo de l’onglet
            </Button>
            {faviconAbsolute ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => clearAsset('faviconUrl')}
                disabled={!!uploading}
                className="inline-flex items-center gap-2"
              >
                <FiTrash2 className="w-4 h-4" aria-hidden />
                Réinitialiser
              </Button>
            ) : null}
            {onOpenFullSettings ? (
              <Button type="button" variant="outline" size="sm" onClick={onOpenFullSettings}>
                Tous les logos →
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}
