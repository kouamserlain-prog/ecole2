import { resolveStaffSupportKind } from '@/views/staff/staffSpaceConfig';

type AuthUserLike = {
  role?: string;
  staffProfile?: { supportKind?: string | null } | null;
} | null;

/** Compte personnel avec métier secrétaire (y compris défaut sans métier renseigné). */
export function isStaffSecretaryAccount(user: AuthUserLike): boolean {
  if (!user || user.role !== 'STAFF') return false;
  return resolveStaffSupportKind(user.staffProfile?.supportKind) === 'SECRETARY';
}

/** Suppression définitive d’élève ou de classe : admin uniquement, pas la secrétaire. */
export function canDeleteStudentsOrClasses(user: AuthUserLike): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true;
  if (user.role === 'STAFF') return !isStaffSecretaryAccount(user);
  return false;
}
