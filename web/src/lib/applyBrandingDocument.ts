/** Met à jour favicon et titre document côté client après chargement de la charte. */
export function applyBrandingToDocument(faviconHref: string | null, documentTitle: string | null): void {
  if (typeof document === 'undefined') return;

  const title = documentTitle?.trim();
  if (title) {
    document.title = title;
  }

  if (!faviconHref) return;

  const cacheBusted = faviconHref.includes('?') ? faviconHref : `${faviconHref}?v=${Date.now()}`;
  const relValues = ['icon', 'shortcut icon', 'apple-touch-icon'];

  for (const rel of relValues) {
    let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.href = cacheBusted;
    if (rel === 'icon' || rel === 'shortcut icon') {
      link.type = faviconHref.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : 'image/png';
    }
  }
}
