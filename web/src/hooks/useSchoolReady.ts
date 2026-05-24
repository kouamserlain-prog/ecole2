import { useSchool } from '@/contexts/SchoolContext';

/** true lorsque l’établissement actif est résolu — à utiliser dans `enabled` des requêtes admin/staff. */
export function useSchoolReady(): boolean {
  const { isLoading, activeSchoolId, schools } = useSchool();
  if (isLoading || !activeSchoolId) return false;
  return schools.some((s) => s.id === activeSchoolId);
}

/** Clé React Query incluant l’établissement (évite le cache d’un autre collège). */
export function schoolQueryKey(base: readonly unknown[], activeSchoolId: string | null): unknown[] {
  return [...base, activeSchoolId ?? 'pending'];
}
