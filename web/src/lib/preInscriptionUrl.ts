/** Lien public vers le formulaire de pré-inscription (optionnellement filtré par établissement). */
export function preInscriptionHref(schoolSlug?: string): string {
  const slug = schoolSlug?.trim().toLowerCase();
  if (!slug) return '/inscription';
  return `/inscription?school=${encodeURIComponent(slug)}`;
}
