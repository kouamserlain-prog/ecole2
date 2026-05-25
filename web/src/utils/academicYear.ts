export const ACADEMIC_YEAR_OVERRIDE_STORAGE_KEY = 'activeAcademicYear';

const isValidAcademicYear = (value: string | null | undefined): value is string =>
  !!value && /^\d{4}-\d{4}$/.test(value);

/**
 * Calcule l'année scolaire actuelle sans tenir compte d'un réglage admin.
 * Format: "2024-2025" (de septembre à août)
 */
export const computeCurrentAcademicYear = (): string => {
  const now = new Date();
  // UTC : même résultat en SSR et dans le navigateur (évite les écarts de fuseau)
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1; // 1-12
  
  // Si on est entre septembre (9) et décembre (12), l'année scolaire est année en cours - année suivante
  // Sinon (janvier à août), l'année scolaire est année précédente - année en cours
  if (currentMonth >= 9) {
    return `${currentYear}-${currentYear + 1}`;
  } else {
    return `${currentYear - 1}-${currentYear}`;
  }
};

/**
 * Année scolaire active : réglage admin en priorité, sinon calcul automatique.
 */
export const getCurrentAcademicYear = (): string => {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(ACADEMIC_YEAR_OVERRIDE_STORAGE_KEY);
      if (isValidAcademicYear(stored)) return stored;
    } catch {
      /* localStorage indisponible */
    }
  }
  return computeCurrentAcademicYear();
};

/**
 * Formate l'année scolaire pour l'affichage
 */
export const formatAcademicYear = (academicYear?: string): string => {
  if (!academicYear) {
    return getCurrentAcademicYear();
  }
  return academicYear;
};



