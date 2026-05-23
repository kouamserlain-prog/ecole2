/** Niveaux collège (formulaire public 6ème → 3ème). */
export const COLLEGE_ADMISSION_LEVELS = ['6ème', '5ème', '4ème', '3ème'] as const;

export const LYCEE_ADMISSION_LEVELS = ['2nde', '1ère', 'Terminale'] as const;

export const ADMISSION_SECONDARY_LEVELS = [
  ...COLLEGE_ADMISSION_LEVELS,
  ...LYCEE_ADMISSION_LEVELS,
] as const;

function normalizeAdmissionLevel(desiredLevel: string): string {
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

export function isAdmissionSecondaryLevel(desiredLevel: string): boolean {
  return isCollegeAdmissionLevel(desiredLevel) || isLyceeAdmissionLevel(desiredLevel);
}

export function admissionLevelRequiresGrades(desiredLevel: string): boolean {
  return isLyceeAdmissionLevel(desiredLevel);
}

export function parseAdmissionGrade(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const raw = typeof value === 'number' ? String(value) : String(value).trim().replace(',', '.');
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n < 0 || n > 20) return null;
  return Math.round(n * 100) / 100;
}

export type AdmissionGradeFields = {
  gradeTerm1: number | null;
  gradeTerm2: number | null;
  gradeAnnualGeneral: number | null;
  gradeAnnualSpecific: number | null;
  gradeAnnualLiterary: number | null;
};

export function parseAdmissionGradeFields(body: Record<string, unknown>): AdmissionGradeFields {
  return {
    gradeTerm1: parseAdmissionGrade(body.gradeTerm1),
    gradeTerm2: parseAdmissionGrade(body.gradeTerm2),
    gradeAnnualGeneral: parseAdmissionGrade(body.gradeAnnualGeneral),
    gradeAnnualSpecific: parseAdmissionGrade(body.gradeAnnualSpecific),
    gradeAnnualLiterary: parseAdmissionGrade(body.gradeAnnualLiterary),
  };
}

export function validateAdmissionTerm3ReportCard(
  desiredLevel: string,
  hasFile: boolean,
): string | null {
  if (!isAdmissionSecondaryLevel(desiredLevel)) {
    if (hasFile) {
      return 'Le bulletin du 3e trimestre n’est requis que pour les niveaux de la 6ème à la Terminale.';
    }
    return null;
  }
  if (!hasFile) {
    return 'Le bulletin du 3e trimestre est obligatoire (PDF ou image JPG/PNG).';
  }
  return null;
}

export function validateAdmissionGrades(
  desiredLevel: string,
  grades: AdmissionGradeFields,
): string | null {
  if (isLyceeAdmissionLevel(desiredLevel)) {
    const missing: string[] = [];
    if (grades.gradeTerm1 === null) missing.push('moyenne du 1er trimestre');
    if (grades.gradeTerm2 === null) missing.push('moyenne du 2e trimestre');
    if (grades.gradeAnnualGeneral === null) missing.push('moyenne générale annuelle');
    if (grades.gradeAnnualSpecific === null) missing.push('moyenne annuelle des matières spécifiques');
    if (grades.gradeAnnualLiterary === null) missing.push('moyenne annuelle des matières littéraires');
    if (missing.length === 0) return null;
    return `Pour le niveau ${desiredLevel.trim()}, renseignez : ${missing.join(', ')} (note sur 20).`;
  }

  if (isCollegeAdmissionLevel(desiredLevel)) {
    const missing: string[] = [];
    if (grades.gradeTerm1 === null) missing.push('moyenne du 1er trimestre');
    if (grades.gradeTerm2 === null) missing.push('moyenne du 2e trimestre');
    if (grades.gradeAnnualGeneral === null) missing.push('moyenne générale annuelle');
    if (missing.length === 0) return null;
    return `Pour le niveau ${desiredLevel.trim()}, renseignez : ${missing.join(', ')} (note sur 20).`;
  }

  return null;
}

export function admissionGradeDataForCreate(
  desiredLevel: string,
  body: Record<string, unknown>,
): Partial<AdmissionGradeFields> {
  const grades = parseAdmissionGradeFields(body);
  if (!isAdmissionSecondaryLevel(desiredLevel)) return {};

  const out: Partial<AdmissionGradeFields> = {};
  if (grades.gradeTerm1 !== null) out.gradeTerm1 = grades.gradeTerm1;
  if (grades.gradeTerm2 !== null) out.gradeTerm2 = grades.gradeTerm2;
  if (grades.gradeAnnualGeneral !== null) out.gradeAnnualGeneral = grades.gradeAnnualGeneral;

  if (isLyceeAdmissionLevel(desiredLevel)) {
    if (grades.gradeAnnualSpecific !== null) out.gradeAnnualSpecific = grades.gradeAnnualSpecific;
    if (grades.gradeAnnualLiterary !== null) out.gradeAnnualLiterary = grades.gradeAnnualLiterary;
  }

  return out;
}
