/** Libellés officiels lycée — déclenchent moyennes + bulletin 3e trimestre. */
export const LYCEE_ADMISSION_LEVELS = ['2nde', '1ère', 'Terminale'] as const;

function normalizeAdmissionLevel(desiredLevel: string): string {
  return desiredLevel
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/** Niveaux lycée concernés par les moyennes au formulaire d'inscription. */
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
  if (!admissionLevelRequiresGrades(desiredLevel)) return null;
  if (!hasFile) {
    return 'Le bulletin du 3e trimestre est obligatoire (PDF ou image JPG/PNG).';
  }
  return null;
}

export function validateAdmissionGrades(
  desiredLevel: string,
  grades: AdmissionGradeFields,
): string | null {
  if (!admissionLevelRequiresGrades(desiredLevel)) return null;
  const missing: string[] = [];
  if (grades.gradeTerm1 === null) missing.push('moyenne du 1er trimestre');
  if (grades.gradeTerm2 === null) missing.push('moyenne du 2e trimestre');
  if (grades.gradeAnnualGeneral === null) missing.push('moyenne générale annuelle');
  if (grades.gradeAnnualSpecific === null) missing.push('moyenne annuelle des matières spécifiques');
  if (grades.gradeAnnualLiterary === null) missing.push('moyenne annuelle des matières littéraires');
  if (missing.length === 0) return null;
  return `Pour le niveau ${desiredLevel.trim()}, renseignez : ${missing.join(', ')} (note sur 20).`;
}

export function admissionGradeDataForCreate(
  desiredLevel: string,
  body: Record<string, unknown>,
): Partial<AdmissionGradeFields> {
  const grades = parseAdmissionGradeFields(body);
  if (!admissionLevelRequiresGrades(desiredLevel)) return {};
  return {
    ...(grades.gradeTerm1 !== null && { gradeTerm1: grades.gradeTerm1 }),
    ...(grades.gradeTerm2 !== null && { gradeTerm2: grades.gradeTerm2 }),
    ...(grades.gradeAnnualGeneral !== null && { gradeAnnualGeneral: grades.gradeAnnualGeneral }),
    ...(grades.gradeAnnualSpecific !== null && { gradeAnnualSpecific: grades.gradeAnnualSpecific }),
    ...(grades.gradeAnnualLiterary !== null && { gradeAnnualLiterary: grades.gradeAnnualLiterary }),
  };
}
