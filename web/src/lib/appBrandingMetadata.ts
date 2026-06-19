import type { Metadata } from 'next';
import {
  fetchPublicAppBrandingForMetadata,
  type BrandingPayload,
} from '@/lib/homeMetadata';
import { resolveUploadPublicUrlForServer } from '@/lib/uploadsPublicUrl';

const DEFAULT_TITLE = 'École · Gestion scolaire';
const DEFAULT_DESCRIPTION =
  'Plateforme de gestion scolaire : administration, pédagogie, familles et paiements.';

export async function buildRootLayoutMetadata(): Promise<Metadata> {
  const b = await fetchPublicAppBrandingForMetadata();
  const title = (b?.appTitle && String(b.appTitle).trim()) || DEFAULT_TITLE;
  const description =
    (b?.appTagline && String(b.appTagline).trim()) || DEFAULT_DESCRIPTION;
  const faviconAbsolute = resolveUploadPublicUrlForServer(
    (b as BrandingPayload | null)?.faviconUrl ?? null,
  );

  const icons: Metadata['icons'] = faviconAbsolute
    ? {
        icon: [{ url: faviconAbsolute }],
        shortcut: [{ url: faviconAbsolute }],
        apple: [{ url: faviconAbsolute }],
      }
    : undefined;

  return {
    title: {
      default: title,
      template: `%s · ${title}`,
    },
    description,
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: title.slice(0, 32),
    },
    icons,
  };
}
