/** Niveaux lycée (2nde, 1ère, Terminale) — affichage des moyennes au formulaire public. */
export function admissionLevelRequiresGrades(desiredLevel: string): boolean {
  const n = desiredLevel
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
  if (!n) return false;
  if (n.includes('2nde') || n.includes('2nd ') || n === 'seconde' || /^2\s*nd(e)?$/.test(n)) return true;
  if (n.includes('1ere') || n.includes('1re ') || n.includes('premiere') || /^1\s*(ere|re)$/.test(n)) return true;
  if (n.includes('terminale') || n === 'tle' || n.startsWith('term')) return true;
  return false;
}

export const ADMISSION_GRADE_FIELD_LABELS = {
  gradeTerm1: 'Moyenne du 1er trimestre',
  gradeTerm2: 'Moyenne du 2e trimestre',
  gradeAnnualGeneral: 'Moyenne générale annuelle',
  gradeAnnualSpecific: 'Moyenne annuelle — matières spécifiques',
  gradeAnnualLiterary: 'Moyenne annuelle — matières littéraires',
} as const;

export type AdmissionGradeFieldKey = keyof typeof ADMISSION_GRADE_FIELD_LABELS;

export function formatAdmissionGrade(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function hasAnyAdmissionGrade(row: Partial<Record<AdmissionGradeFieldKey, number | null>>): boolean {
  return (
    row.gradeTerm1 != null ||
    row.gradeTerm2 != null ||
    row.gradeAnnualGeneral != null ||
    row.gradeAnnualSpecific != null ||
    row.gradeAnnualLiterary != null
  );
}
