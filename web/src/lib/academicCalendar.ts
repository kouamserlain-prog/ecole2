/** Année scolaire courante (ex. 2025-2026 à partir de septembre). */
export function getCurrentAcademicYear(reference = new Date()): string {
  const month = reference.getMonth();
  const year = reference.getFullYear();
  const startYear = month >= 8 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

/** Trimestre courant selon la date du jour. */
export function getCurrentTrimester(reference = new Date(), academicYear = getCurrentAcademicYear(reference)): string {
  const month = reference.getMonth();
  const [yearStart, yearEnd] = academicYear.split('-').map(Number);
  const yEnd = yearEnd ?? yearStart + 1;

  if (month >= 8 && reference.getFullYear() === yearStart) return 'trim1';
  if (month === 11 || (month <= 1 && reference.getFullYear() <= yEnd)) return 'trim2';
  if (month >= 2 && month <= 5) return 'trim3';
  return 'trim1';
}
