/** Niveaux collège (formulaire public 6ème → 3ème). */
export const COLLEGE_ADMISSION_LEVELS = ['6ème', '5ème', '4ème', '3ème'] as const;

/** Niveaux lycée — moyennes détaillées + bulletin. */
export const LYCEE_ADMISSION_LEVELS = ['2nde', '1ère', 'Terminale'] as const;

/** Tous les niveaux acceptés sur le formulaire de pré-inscription en ligne. */
export const ADMISSION_SECONDARY_LEVELS = [
  ...COLLEGE_ADMISSION_LEVELS,
  ...LYCEE_ADMISSION_LEVELS,
] as const;

export type CollegeAdmissionLevel = (typeof COLLEGE_ADMISSION_LEVELS)[number];
export type LyceeAdmissionLevel = (typeof LYCEE_ADMISSION_LEVELS)[number];
export type AdmissionSecondaryLevel = (typeof ADMISSION_SECONDARY_LEVELS)[number];

export function normalizeAdmissionLevel(desiredLevel: string): string {
  return desiredLevel
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function matchesLevel(desiredLevel: string, officialLabel: string): boolean {
  return normalizeAdmissionLevel(desiredLevel) === normalizeAdmissionLevel(officialLabel);
}

export function isCollegeAdmissionLevel(desiredLevel: string): boolean {
  const n = normalizeAdmissionLevel(desiredLevel);
  if (!n) return false;
  if (COLLEGE_ADMISSION_LEVELS.some((l) => matchesLevel(desiredLevel, l))) return true;
  if (/^6(e|eme)?$/.test(n) || n === '6eme') return true;
  if (/^5(e|eme)?$/.test(n) || n === '5eme') return true;
  if (/^4(e|eme)?$/.test(n) || n === '4eme') return true;
  if (/^3(e|eme)?$/.test(n) || n === '3eme') return true;
  return false;
}

export function isLyceeAdmissionLevel(desiredLevel: string): boolean {
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

  return LYCEE_ADMISSION_LEVELS.some((l) => matchesLevel(desiredLevel, l));
}

/** Candidature collège ou lycée (6ème à Terminale). */
export function isAdmissionSecondaryLevel(desiredLevel: string): boolean {
  return isCollegeAdmissionLevel(desiredLevel) || isLyceeAdmissionLevel(desiredLevel);
}

/** @deprecated Alias — lycée uniquement */
export function admissionLevelRequiresGrades(desiredLevel: string): boolean {
  return isLyceeAdmissionLevel(desiredLevel);
}

export function admissionLevelRequiresReportCard(desiredLevel: string): boolean {
  return isAdmissionSecondaryLevel(desiredLevel);
}

export const ADMISSION_GRADE_FIELD_LABELS = {
  gradeTerm1: 'Moyenne du 1er trimestre',
  gradeTerm2: 'Moyenne du 2e trimestre',
  gradeAnnualGeneral: 'Moyenne générale annuelle',
  gradeAnnualSpecific: 'Moyenne annuelle — matières spécifiques',
  gradeAnnualLiterary: 'Moyenne annuelle — matières littéraires',
} as const;

export type AdmissionGradeFieldKey = keyof typeof ADMISSION_GRADE_FIELD_LABELS;

const COLLEGE_GRADE_KEYS: AdmissionGradeFieldKey[] = [
  'gradeTerm1',
  'gradeTerm2',
  'gradeAnnualGeneral',
];

const LYCEE_GRADE_KEYS: AdmissionGradeFieldKey[] = [
  'gradeTerm1',
  'gradeTerm2',
  'gradeAnnualGeneral',
  'gradeAnnualSpecific',
  'gradeAnnualLiterary',
];

export function getAdmissionGradeKeysForLevel(desiredLevel: string): AdmissionGradeFieldKey[] {
  if (isLyceeAdmissionLevel(desiredLevel)) return LYCEE_GRADE_KEYS;
  if (isCollegeAdmissionLevel(desiredLevel)) return COLLEGE_GRADE_KEYS;
  return [];
}

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
