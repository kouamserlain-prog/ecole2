/** Libellés officiels lycée — déclenchent moyennes + bulletin 3e trimestre. */
export const LYCEE_ADMISSION_LEVELS = ['2nde', '1ère', 'Terminale'] as const;

export type LyceeAdmissionLevel = (typeof LYCEE_ADMISSION_LEVELS)[number];

function normalizeAdmissionLevel(desiredLevel: string): string {
  return desiredLevel
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/** Niveaux lycée (2nde, 1ère, Terminale) — affichage des moyennes au formulaire public. */
export function admissionLevelRequiresGrades(desiredLevel: string): boolean {
  const n = normalizeAdmissionLevel(desiredLevel);
  if (!n) return false;

  if (
    n.includes('2nde') ||
    n.includes('2nd') ||
    n === 'seconde' ||
    /^2\s*nd(e)?$/.test(n) ||
    n.endsWith(' 2nd')
  ) {
    return true;
  }

  if (
    n.includes('1ere') ||
    n.includes('1re') ||
    n.includes('premiere') ||
    /^1\s*(ere|re)$/.test(n) ||
    n.startsWith('1ere ')
  ) {
    return true;
  }

  if (
    n.includes('terminale') ||
    n.includes('terminal') ||
    n === 'tle' ||
    n.startsWith('term')
  ) {
    return true;
  }

  return LYCEE_ADMISSION_LEVELS.some((label) => normalizeAdmissionLevel(label) === n);
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
