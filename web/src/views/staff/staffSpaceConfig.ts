/** Valeurs alignées sur l’enum Prisma `SupportStaffKind` (personnel catégorie Soutien). */

export type SupportStaffKindKey =
  | 'LIBRARIAN'
  | 'NURSE'
  | 'SECRETARY'
  | 'ACCOUNTANT'
  | 'IT'
  | 'MAINTENANCE'
  | 'STUDIES_DIRECTOR'
  | 'BURSAR'
  | 'OTHER';

const ALLOWED = new Set<string>([
  'LIBRARIAN',
  'NURSE',
  'SECRETARY',
  'ACCOUNTANT',
  'IT',
  'MAINTENANCE',
  'STUDIES_DIRECTOR',
  'BURSAR',
  'OTHER',
]);

export const STAFF_KIND_LABELS: Record<SupportStaffKindKey, string> = {
  STUDIES_DIRECTOR: 'Directeur(trice) des études',
  SECRETARY: 'Secrétaire',
  BURSAR: 'Économe',
  NURSE: 'Infirmier(e)',
  LIBRARIAN: 'Bibliothécaire',
  ACCOUNTANT: 'Comptabilité',
  IT: 'Informatique',
  MAINTENANCE: 'Maintenance',
  OTHER: 'Personnel',
};

export function resolveStaffSupportKind(kind: unknown): SupportStaffKindKey {
  const k = typeof kind === 'string' ? kind.trim() : '';
  if (ALLOWED.has(k)) return k as SupportStaffKindKey;
  // Compte soutien sans métier renseigné : aligné serveur (défaut secrétariat)
  if (!k) return 'SECRETARY';
  return 'OTHER';
}

export function staffNavBadgeLabel(kind: SupportStaffKindKey): string {
  return STAFF_KIND_LABELS[kind] ?? 'Personnel';
}
