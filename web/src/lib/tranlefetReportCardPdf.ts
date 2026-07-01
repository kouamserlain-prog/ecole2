import jsPDF from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import { TRANLEFET_SCHOOL } from '../data/tranlefetSchool';
import { resolveUploadFetchUrl, resolveUploadPublicUrl } from './uploadsPublicUrl';

const REPORT_CARD_MARGIN = 8;

/** Photo d'identité ronde (à droite du titre « Bulletin trimestriel »). */
const STUDENT_PHOTO_SIZE = 28;

/** Polices et espacements — lisibilité impression A4. */
const BULLETIN_FS = {
  ministry: 8,
  schoolName: 10.5,
  schoolMeta: 8,
  code: 8,
  mainTitle: 10,
  period: 9,
  academicYear: 8.5,
  identity: 8.5,
  table: 7.5,
  tableHead: 7.5,
  tableProf: 7,
  resume: 8,
  mentionsTitle: 7.5,
  mentions: 7,
  signature: 7.5,
  signatureDate: 8,
  checkbox: 7,
} as const;

const BULLETIN_PAD = {
  identity: 1.5,
  table: 1.2,
  resume: 1.4,
} as const;

/** Espace entre le tableau RÉSUMÉ et « Mentions du conseil de classe ». */
const MENTIONS_SECTION_TOP_GAP = 10;

function reportCardTableWidth(pageWidth: number): number {
  return pageWidth - REPORT_CARD_MARGIN * 2;
}

function reportCardTableMargins(): { left: number; right: number } {
  return { left: REPORT_CARD_MARGIN, right: REPORT_CARD_MARGIN };
}

/** Répartit des largeurs relatives sur la largeur utile du bulletin. */
function buildColumnStyles(
  relativeWidths: number[],
  tableWidth: number,
  overrides: Record<number, Record<string, unknown>> = {},
): Record<number, Record<string, unknown>> {
  const sum = relativeWidths.reduce((acc, value) => acc + value, 0);
  const styles: Record<number, Record<string, unknown>> = {};
  let allocated = 0;

  relativeWidths.forEach((width, index) => {
    const isLast = index === relativeWidths.length - 1;
    const cellWidth = isLast
      ? Math.round((tableWidth - allocated) * 10) / 10
      : Math.round((width / sum) * tableWidth * 10) / 10;
    allocated += cellWidth;
    styles[index] = { cellWidth, ...(overrides[index] ?? {}) };
  });

  return styles;
}

export type TranlefetBranding = {
  schoolName: string;
  schoolPhone: string;
  schoolAddress: string;
  schoolEmail: string;
  schoolCode: string;
  schoolLocation: string;
  regionalDirection: string;
  principalName: string;
  studiesDirectorName: string;
  city: string;
  motto: string;
  logoAbsoluteUrl?: string | null;
  /** Préchargé côté serveur (évite fetch CORS / Blob dans le navigateur). */
  logoDataUrl?: string | null;
};

async function loadImageToJpegDataUrl(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, img.naturalWidth);
        canvas.height = Math.max(1, img.naturalHeight);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function fetchRemoteImageAsDataUrl(url: string): Promise<string | null> {
  const absolute =
    url.startsWith('data:') || url.startsWith('blob:')
      ? url
      : resolveUploadFetchUrl(url) ?? resolveUploadPublicUrl(url) ?? url;

  if (absolute.startsWith('data:')) {
    return absolute;
  }

  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const res = await fetch(absolute, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('pdf') || absolute.toLowerCase().endsWith('.pdf')) {
      return null;
    }
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function fetchLogoDataUrl(logoUrl: string | null | undefined): Promise<string | null> {
  if (!logoUrl) return null;
  return fetchRemoteImageAsDataUrl(logoUrl);
}

async function resolveLogoDataUrlForPdf(branding: TranlefetBranding): Promise<string | null> {
  const preloaded = branding.logoDataUrl?.trim();
  const raw =
    preloaded?.startsWith('data:image/') ? preloaded : await fetchLogoDataUrl(branding.logoAbsoluteUrl);
  if (!raw) return null;
  if (raw.startsWith('data:image/jpeg')) return raw;
  const jpeg = await loadImageToJpegDataUrl(raw);
  return jpeg ?? raw;
}

async function toCircularPhotoDataUrl(dataUrl: string, size = 320): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
        const w = img.naturalWidth * scale;
        const h = img.naturalHeight * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function resolveStudentPhotoDataUrl(
  studentData: ReportCardStudentPayload,
): Promise<string | null> {
  const raw = studentData.photoUrl ?? studentData.user.avatar ?? null;
  if (!raw) return null;
  const absolute = resolveUploadFetchUrl(raw) ?? resolveUploadPublicUrl(raw);
  if (!absolute) return null;
  const dataUrl = await fetchRemoteImageAsDataUrl(absolute);
  if (!dataUrl) return null;
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/png')) {
    return toCircularPhotoDataUrl(dataUrl);
  }
  const jpeg = await loadImageToJpegDataUrl(dataUrl);
  return jpeg ? toCircularPhotoDataUrl(jpeg) : null;
}

function drawStudentPhotoBox(
  doc: jsPDF,
  photoDataUrl: string | null,
  x: number,
  y: number,
  size: number,
): void {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const radius = size / 2;

  if (photoDataUrl) {
    try {
      doc.addImage(photoDataUrl, 'PNG', x, y, size, size, undefined, 'FAST');
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.25);
      doc.circle(cx, cy, radius, 'S');
      return;
    } catch {
      // placeholder ci-dessous
    }
  }

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.circle(cx, cy, radius, 'S');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('Sans photo', cx, cy, { align: 'center', baseline: 'middle' });
  doc.setTextColor(0, 0, 0);
}

function imageFormatFromDataUrl(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' {
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
  return 'JPEG';
}

/** Drapeau de la Côte d'Ivoire (bandes verticales orange, blanc, vert). */
function drawCoteDivoireFlag(doc: jsPDF, x: number, y: number, width: number, height: number): void {
  const stripeW = width / 3;
  doc.setFillColor(255, 130, 0);
  doc.rect(x, y, stripeW, height, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(x + stripeW, y, stripeW, height, 'F');
  doc.setFillColor(0, 154, 68);
  doc.rect(x + stripeW * 2, y, stripeW, height, 'F');
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.12);
  doc.rect(x, y, width, height, 'S');
}

export const TRANLEFET_DEFAULT_BRANDING: TranlefetBranding = {
  schoolName: 'COLLEGE PRIVE TRANLEFET DE BOUAKÉ',
  schoolPhone: '07 88 94 87 12',
  schoolAddress: 'Bouaké',
  schoolEmail: 'collegetranlefet@gmail.com',
  schoolCode: '253798',
  schoolLocation: 'Minankro',
  regionalDirection: 'DIRECTION REGIONALE DE BOUAKE 1',
  principalName: '',
  studiesDirectorName: '',
  city: 'Bouaké',
  motto: TRANLEFET_SCHOOL.motto,
};

export type TermHistoryEntry = {
  average: number;
  rank: number;
  byCourse: Record<string, { average: number; rank: number }>;
  bilanLettres?: { average: number; rank: number };
  bilanSciences?: { average: number; rank: number };
};

export type ReportCardStudentPayload = {
  studentIdNumber?: string;
  /** Avatar profil ou pièce « photo d'identité » (chemin relatif ou URL). */
  photoUrl?: string | null;
  user: { firstName: string; lastName: string; avatar?: string | null };
  class?: { name: string; level: string };
  gender?: string;
  dateOfBirth?: string;
  birthPlace?: string;
  nationality?: string;
  address?: string | null;
  grades?: Array<{
    courseId: string;
    title: string;
    score: number;
    maxScore: number;
    coefficient: number;
    date: string;
    course?: { id: string; name: string; code?: string };
  }>;
  allCourses?: Array<{
    id: string;
    name: string;
    code?: string;
    teacherName?: string;
    gradingCoefficient?: number | null;
  }>;
  courseAverages?: Record<string, { average: number; count?: number }>;
  average?: number;
  rank?: number;
  totalStudents?: number;
  absences?: { total: number; unexcused: number; excused: number; late: number };
  termHistory?: {
    trim1?: TermHistoryEntry;
    trim2?: TermHistoryEntry;
    trim3?: TermHistoryEntry;
  };
  annualSummary?: { average: number; rank: number };
  classStats?: {
    periodAverage: number;
    periodMin: number;
    periodMax: number;
    annualAverage?: number;
    annualMin?: number;
    annualMax?: number;
  };
  conduct?: { average: number; byTerm?: Record<string, number> };
  distinctions?: string[];
  sanctions?: string[];
  repeating?: boolean;
  yearEndDecision?: string;
};

type DisciplineRow = {
  label: string;
  indent?: boolean;
  isBilan?: boolean;
  /** Afficher le nom du professeur (ligne matière principale uniquement). */
  showProfessor?: boolean;
  coefficient?: number;
  courseMatch?: RegExp;
  subGradeMatch?: RegExp;
};

/** Modèle officiel Tranlefet — 1er / 2ème trimestre (cf. bulletin papier). */
const DISCIPLINE_TEMPLATE: DisciplineRow[] = [
  { label: 'Français', courseMatch: /^(français|francais)\b/i, showProfessor: true },
  {
    label: 'Expression orale',
    indent: true,
    courseMatch: /expression\s*[-–]?\s*orale|\(expression\s*[-–]?\s*oral/i,
    coefficient: 1,
  },
  {
    label: 'Orthographe -\ngrammaire',
    indent: true,
    courseMatch: /orthographe|grammaire/i,
    coefficient: 1,
  },
  {
    label: 'Expression écrite',
    indent: true,
    courseMatch: /composition|expression\s*écrite|expression\s*ecrite/i,
    coefficient: 1,
  },
  { label: 'Anglais', courseMatch: /^anglais\b|english/i, showProfessor: true, coefficient: 2 },
  {
    label: 'Histoire – géographie',
    courseMatch: /^histoire|histoire\s*[-–]\s*géographie|histoire\s*[-–]\s*geographie|^hg$/i,
    showProfessor: true,
    coefficient: 2,
  },
  {
    label: 'BILAN LETTRES',
    isBilan: true,
    courseMatch: /français|francais|anglais|english|histoire|géographie|geographie|\bhg\b|lettres/i,
  },
  { label: 'Mathématiques', courseMatch: /^math/i, showProfessor: true, coefficient: 3 },
  {
    label: 'Physique – chimie',
    courseMatch: /^physique|physique\s*[-–]\s*chimie|^pc$/i,
    showProfessor: true,
    coefficient: 2,
  },
  { label: 'SVT', courseMatch: /^svt\b|sciences?\s+de\s+la\s+vie|\(svt\)/i, showProfessor: true, coefficient: 2 },
  {
    label: 'BILAN SCIENCES',
    isBilan: true,
    courseMatch: /math|physique|chimie|svt|science/i,
  },
  { label: 'EDHC', courseMatch: /^edhc|emc|éducation.*citoyenneté/i, showProfessor: true, coefficient: 1 },
  { label: 'EPS', courseMatch: /^eps|éducation\s+physique|sport/i, showProfessor: true, coefficient: 1 },
  { label: 'CONDUITE', courseMatch: /conduite|comportement/i, showProfessor: false, coefficient: 1 },
];

/** Français + 3 sous-disciplines : fusion Appréciations / Professeurs / Signature. */
const FRENCH_BLOCK_ROW_COUNT = 4;

function frenchBlockRowIndex(templateIndex: number): number | null {
  if (templateIndex >= 0 && templateIndex < FRENCH_BLOCK_ROW_COUNT) return templateIndex;
  return null;
}

const mergedFrenchCellStyle = { valign: 'middle' as const };

function resolveFrenchBlockProfessor(studentData: ReportCardStudentPayload): string {
  const frenchRow = DISCIPLINE_TEMPLATE[0];
  return resolveProfessorForRow(frenchRow, studentData.allCourses || []);
}

function buildSingleTrimDisciplineRow(
  studentData: ReportCardStudentPayload,
  row: DisciplineRow,
  rowIndex: number,
  activePeriod: string,
): RowInput {
  const values = resolveSingleTrimRowValues(studentData, row, activePeriod);
  const labelStyle = row.isBilan
    ? { fontStyle: 'bold' as const, fillColor: [235, 235, 235] as [number, number, number] }
    : row.indent
      ? { cellPadding: { left: 5 } }
      : row.label === 'Français'
        ? { fontStyle: 'bold' as const }
        : {};

  const gradeCells: RowInput = [
    { content: row.label, styles: labelStyle },
    values.moy,
    values.coef,
    values.total,
    values.rang,
  ];

  const frenchIdx = frenchBlockRowIndex(rowIndex);
  if (frenchIdx === 0) {
    return [
      ...gradeCells,
      { content: '', rowSpan: FRENCH_BLOCK_ROW_COUNT, styles: mergedFrenchCellStyle },
      {
        content: resolveFrenchBlockProfessor(studentData),
        rowSpan: FRENCH_BLOCK_ROW_COUNT,
        styles: mergedFrenchCellStyle,
      },
      { content: '', rowSpan: FRENCH_BLOCK_ROW_COUNT, styles: mergedFrenchCellStyle },
    ];
  }
  if (frenchIdx !== null && frenchIdx > 0) {
    return gradeCells;
  }

  return [...gradeCells, values.appreciation, values.prof, ''];
}

function buildMultiTrimDisciplineRow(
  studentData: ReportCardStudentPayload,
  row: DisciplineRow,
  rowIndex: number,
  activePeriod: string,
): RowInput {
  const values = resolveRowValues(studentData, row, activePeriod);
  const labelStyle = row.isBilan
    ? { fontStyle: 'bold' as const, fillColor: [235, 235, 235] as [number, number, number] }
    : row.indent
      ? { cellPadding: { left: 5 } }
      : row.label === 'Français'
        ? { fontStyle: 'bold' as const }
        : {};

  const gradeCells: RowInput = [
    { content: row.label, styles: labelStyle },
    values.trim1,
    values.rank1,
    values.trim2,
    values.rank2,
    values.trim3,
    values.rank3,
    values.moy,
    values.rang,
  ];

  const frenchIdx = frenchBlockRowIndex(rowIndex);
  if (frenchIdx === 0) {
    return [
      ...gradeCells,
      {
        content: resolveFrenchBlockProfessor(studentData),
        rowSpan: FRENCH_BLOCK_ROW_COUNT,
        styles: mergedFrenchCellStyle,
      },
      { content: '', rowSpan: FRENCH_BLOCK_ROW_COUNT, styles: mergedFrenchCellStyle },
    ];
  }
  if (frenchIdx !== null && frenchIdx > 0) {
    return gradeCells;
  }

  return [...gradeCells, values.prof, ''];
}

const TRIM_KEYS = ['trim1', 'trim2', 'trim3'] as const;

export function isSingleTrimesterBulletin(periodKey: string): boolean {
  return periodKey === 'trim1' || periodKey === 'trim2';
}

function fmtNote(value?: number): string {
  if (value === undefined || value <= 0) return '';
  return value.toFixed(2);
}

function fmtRank(value?: number): string {
  if (value === undefined || value <= 0) return '';
  return String(value);
}

function genderLabel(g?: string): string {
  if (g === 'FEMALE') return 'F';
  if (g === 'MALE') return 'M';
  return '';
}

function periodTitle(periodKey: string): string {
  const map: Record<string, string> = {
    trim1: '1er Trimestre',
    trim2: '2ème Trimestre',
    trim3: '3ème Trimestre',
    sem1: '1er Semestre',
    sem2: '2ème Semestre',
  };
  return map[periodKey] ?? periodKey;
}

function findCourses(
  courses: ReportCardStudentPayload['allCourses'],
  match?: RegExp,
): Array<{ id: string; name: string; teacherName?: string; gradingCoefficient?: number | null }> {
  if (!courses || !match) return [];
  return courses.filter((c) => match.test(c.name) || (c.code ? match.test(c.code) : false));
}

/** Choisit le cours le plus pertinent pour une ligne (évite de mélanger les professeurs). */
export function pickPrimaryCourseForRow(
  row: DisciplineRow,
  courses: ReportCardStudentPayload['allCourses'],
): { id: string; name: string; teacherName?: string; gradingCoefficient?: number | null } | undefined {
  const matched = findCourses(courses, row.courseMatch);
  if (matched.length === 0) return undefined;
  if (matched.length === 1) return matched[0];

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

  const rowKey = normalize(row.label.replace(/\n/g, ' ').split('–')[0]);

  const exact = matched.find((c) => normalize(c.name) === rowKey);
  if (exact) return exact;

  const labelRules: Array<{ test: (n: string) => boolean; prefer: (c: (typeof matched)[0]) => boolean }> = [
    { test: (n) => n.includes('composition') || n.includes('écrit') || n.includes('ecrit'), prefer: (c) => /composition|écrit|ecrit/i.test(c.name) && !/orale|oral/i.test(c.name) },
    { test: (n) => n.includes('orthographe') || n.includes('grammaire'), prefer: (c) => /orthographe|grammaire/i.test(c.name) },
    { test: (n) => n.includes('oral'), prefer: (c) => /expression\s*[-–]?\s*orale|oral/i.test(c.name) && !/composition/i.test(c.name) },
    { test: (n) => n.includes('anglais'), prefer: (c) => /anglais|english/i.test(c.name) },
    { test: (n) => n.includes('histoire'), prefer: (c) => /histoire|geographie|géographie|^hg$/i.test(c.name) },
    { test: (n) => n.includes('math'), prefer: (c) => /^math/i.test(c.name) },
    { test: (n) => n.includes('physique'), prefer: (c) => /physique|chimie|^pc$/i.test(c.name) },
    { test: (n) => n === 'svt', prefer: (c) => /^svt|vie|biolog/i.test(c.name) },
    { test: (n) => n === 'edhc', prefer: (c) => /edhc|emc|citoyen/i.test(c.name) },
    { test: (n) => n === 'eps', prefer: (c) => /^eps|éducation\s+physique|^sport/i.test(c.name) && !/chimie/i.test(c.name) },
  ];

  for (const rule of labelRules) {
    if (rule.test(rowKey)) {
      const hit = matched.find(rule.prefer);
      if (hit) return hit;
    }
  }

  return [...matched].sort((a, b) => a.name.length - b.name.length)[0];
}

export function resolveProfessorForRow(
  row: DisciplineRow,
  courses: ReportCardStudentPayload['allCourses'],
): string {
  if (!row.showProfessor || row.indent || row.isBilan || row.subGradeMatch) return '';
  const course = pickPrimaryCourseForRow(row, courses);
  return course?.teacherName?.trim() ?? '';
}

function subGradeAverage(
  studentData: ReportCardStudentPayload,
  courseIds: string[],
  subMatch: RegExp,
): number {
  const grades = (studentData.grades || []).filter(
    (g) => courseIds.includes(g.courseId) && subMatch.test(g.title),
  );
  if (grades.length === 0) return 0;
  let total = 0;
  let coeff = 0;
  grades.forEach((g) => {
    const on20 = (g.score / g.maxScore) * 20;
    total += on20 * g.coefficient;
    coeff += g.coefficient;
  });
  return coeff > 0 ? total / coeff : 0;
}

function courseAverageFromPayload(
  studentData: ReportCardStudentPayload,
  courseId: string,
): number {
  const fromMap = studentData.courseAverages?.[courseId]?.average;
  if (fromMap !== undefined && fromMap > 0) return fromMap;
  const grades = (studentData.grades || []).filter((g) => g.courseId === courseId);
  if (grades.length === 0) return 0;
  let total = 0;
  let coeff = 0;
  grades.forEach((g) => {
    const on20 = (g.score / g.maxScore) * 20;
    total += on20 * g.coefficient;
    coeff += g.coefficient;
  });
  return coeff > 0 ? total / coeff : 0;
}

function termCourseAverage(
  studentData: ReportCardStudentPayload,
  term: (typeof TRIM_KEYS)[number],
  courseId: string,
  activePeriod: string,
): number {
  const fromHistory = studentData.termHistory?.[term]?.byCourse[courseId]?.average;
  if (fromHistory !== undefined && fromHistory > 0) return fromHistory;
  if (term === activePeriod) {
    return courseAverageFromPayload(studentData, courseId);
  }
  return 0;
}

function termCourseRank(
  studentData: ReportCardStudentPayload,
  term: (typeof TRIM_KEYS)[number],
  courseId: string,
): number | undefined {
  return studentData.termHistory?.[term]?.byCourse[courseId]?.rank;
}

function resolveBilanRank(
  studentData: ReportCardStudentPayload,
  row: DisciplineRow,
  term: (typeof TRIM_KEYS)[number],
): number | undefined {
  if (!row.isBilan) return undefined;
  const entry = studentData.termHistory?.[term];
  if (row.label === 'BILAN LETTRES') return entry?.bilanLettres?.rank;
  if (row.label === 'BILAN SCIENCES') return entry?.bilanSciences?.rank;
  return undefined;
}

function resolveBilanAverage(
  studentData: ReportCardStudentPayload,
  row: DisciplineRow,
  term: (typeof TRIM_KEYS)[number],
): number | undefined {
  if (!row.isBilan) return undefined;
  const entry = studentData.termHistory?.[term];
  if (row.label === 'BILAN LETTRES') return entry?.bilanLettres?.average;
  if (row.label === 'BILAN SCIENCES') return entry?.bilanSciences?.average;
  return undefined;
}

function resolveRowValues(
  studentData: ReportCardStudentPayload,
  row: DisciplineRow,
  activePeriod: string,
): {
  trim1: string;
  rank1: string;
  trim2: string;
  rank2: string;
  trim3: string;
  rank3: string;
  moy: string;
  rang: string;
  prof: string;
} {
  const courses = studentData.allCourses || [];
  const matched = findCourses(courses, row.courseMatch);
  const courseIds = matched.map((c) => c.id);

  if (row.label === 'CONDUITE') {
    const conduct = studentData.conduct;
    return {
      trim1: fmtNote(conduct?.byTerm?.trim1),
      rank1: '',
      trim2: fmtNote(conduct?.byTerm?.trim2),
      rank2: '',
      trim3: fmtNote(conduct?.byTerm?.trim3 ?? conduct?.average),
      rank3: '',
      moy: fmtNote(conduct?.average),
      rang: '',
      prof: '',
    };
  }

  const computeForTerm = (term: (typeof TRIM_KEYS)[number]): { avg: number; rank?: number } => {
    if (row.subGradeMatch && courseIds.length > 0) {
      if (activePeriod === term) {
        return { avg: subGradeAverage(studentData, courseIds, row.subGradeMatch) };
      }
      return { avg: 0 };
    }
    if (row.isBilan && row.courseMatch) {
      const fromServer = resolveBilanAverage(studentData, row, term);
      if (fromServer !== undefined && fromServer > 0) {
        return { avg: fromServer, rank: resolveBilanRank(studentData, row, term) };
      }
      const bilanCourses = findCourses(courses, row.courseMatch);
      const avgs = TRIM_KEYS.map((t) => {
        const values = bilanCourses
          .map((c) => termCourseAverage(studentData, t, c.id, activePeriod))
          .filter((v) => v > 0);
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      });
      const idx = TRIM_KEYS.indexOf(term);
      return { avg: avgs[idx] ?? 0, rank: resolveBilanRank(studentData, row, term) };
    }
    if (courseIds.length === 1) {
      const avg = termCourseAverage(studentData, term, courseIds[0], activePeriod);
      const rank = termCourseRank(studentData, term, courseIds[0]);
      return { avg, rank };
    }
    if (courseIds.length > 1) {
      const values = courseIds.map((id) => termCourseAverage(studentData, term, id, activePeriod)).filter((v) => v > 0);
      const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      return { avg };
    }
    return { avg: 0 };
  };

  const t1 = computeForTerm('trim1');
  const t2 = computeForTerm('trim2');
  const t3 = computeForTerm('trim3');

  const activeTerm = (['trim1', 'trim2', 'trim3'].includes(activePeriod)
    ? activePeriod
    : 'trim3') as (typeof TRIM_KEYS)[number];
  const active = computeForTerm(activeTerm);

  const prof = resolveProfessorForRow(row, courses);

  return {
    trim1: fmtNote(t1.avg),
    rank1: fmtRank(t1.rank),
    trim2: fmtNote(t2.avg),
    rank2: fmtRank(t2.rank),
    trim3: fmtNote(t3.avg),
    rank3: fmtRank(t3.rank),
    moy: fmtNote(
      active.avg > 0
        ? active.avg
        : courseIds.length === 1
          ? courseAverageFromPayload(studentData, courseIds[0])
          : 0,
    ),
    rang: row.isBilan
      ? (() => {
          const r = resolveBilanRank(studentData, row, activeTerm);
          return r && r > 0 ? `RANG : ${r}` : active.avg > 0 ? 'RANG :' : '';
        })()
      : fmtRank(active.rank),
    prof,
  };
}

type SingleTrimRowValues = {
  moy: string;
  coef: string;
  total: string;
  rang: string;
  appreciation: string;
  prof: string;
};

function resolveCoefficient(row: DisciplineRow, courses: ReportCardStudentPayload['allCourses']): number {
  if (row.coefficient !== undefined) return row.coefficient;
  if (!row.showProfessor) return 0;
  const course = pickPrimaryCourseForRow(row, courses);
  if (course?.gradingCoefficient && course.gradingCoefficient > 0) {
    return course.gradingCoefficient;
  }
  return 0;
}

function resolveSingleTrimRowValues(
  studentData: ReportCardStudentPayload,
  row: DisciplineRow,
  activePeriod: string,
): SingleTrimRowValues {
  const multi = resolveRowValues(studentData, row, activePeriod);
  const courses = studentData.allCourses || [];
  const activeTerm = (['trim1', 'trim2', 'trim3'].includes(activePeriod)
    ? activePeriod
    : 'trim1') as (typeof TRIM_KEYS)[number];

  let moyNum = 0;
  if (row.label === 'CONDUITE') {
    moyNum = studentData.conduct?.byTerm?.[activeTerm] ?? studentData.conduct?.average ?? 0;
  } else if (row.isBilan) {
    const fromServer = resolveBilanAverage(studentData, row, activeTerm);
    if (fromServer !== undefined && fromServer > 0) {
      moyNum = fromServer;
    } else {
      const bilanCourses = findCourses(courses, row.courseMatch);
      const values = bilanCourses
        .map((c) => termCourseAverage(studentData, activeTerm, c.id, activePeriod))
        .filter((v) => v > 0);
      moyNum = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    }
  } else if (row.subGradeMatch) {
    const course = pickPrimaryCourseForRow(row, courses);
    if (course && activePeriod === activeTerm) {
      moyNum = subGradeAverage(studentData, [course.id], row.subGradeMatch);
    }
  } else {
    const course = pickPrimaryCourseForRow(row, courses);
    if (course) {
      moyNum = termCourseAverage(studentData, activeTerm, course.id, activePeriod);
    }
  }

  const coef = resolveCoefficient(row, courses);
  const moy = fmtNote(moyNum);
  const total = moyNum > 0 && coef > 0 ? (moyNum * coef).toFixed(2) : '';
  const bilanRank = row.isBilan ? resolveBilanRank(studentData, row, activeTerm) : undefined;
  const rang = row.isBilan
    ? bilanRank && bilanRank > 0
      ? `RANG : ${bilanRank}`
      : moyNum > 0
        ? 'RANG :'
        : ''
    : multi.rang || '';

  return {
    moy,
    coef: coef > 0 ? String(coef) : row.isBilan || row.label === 'Français' ? '' : '',
    total,
    rang,
    appreciation: '',
    prof: resolveProfessorForRow(row, courses),
  };
}

function totalTemplateCoefficients(): number {
  return DISCIPLINE_TEMPLATE.reduce((sum, row) => sum + (row.coefficient ?? 0), 0);
}

/** Moyenne générale, somme des coef. et total points (moy × coef) pour la ligne TOTAUX. */
function computeTrimesterTableTotals(
  studentData: ReportCardStudentPayload,
  activePeriod: string,
): { moyenne: number; coefSum: number; totalSum: number } {
  let coefSum = 0;
  let totalSum = 0;

  for (const row of DISCIPLINE_TEMPLATE) {
    if (row.isBilan) continue;
    const values = resolveSingleTrimRowValues(studentData, row, activePeriod);
    const coef = Number(values.coef);
    const lineTotal = Number(values.total);
    if (!Number.isFinite(coef) || coef <= 0) continue;
    if (!Number.isFinite(lineTotal) || lineTotal <= 0) continue;
    coefSum += coef;
    totalSum += lineTotal;
  }

  const periodKey = ['trim1', 'trim2', 'trim3'].includes(activePeriod)
    ? (activePeriod as 'trim1' | 'trim2' | 'trim3')
    : null;
  const fromServer =
    (periodKey ? studentData.termHistory?.[periodKey]?.average : undefined) ??
    studentData.average ??
    0;

  const moyenne =
    fromServer > 0 ? fromServer : coefSum > 0 ? totalSum / coefSum : 0;

  return {
    moyenne,
    coefSum: coefSum > 0 ? coefSum : totalTemplateCoefficients(),
    totalSum,
  };
}

function resolvePeriodAverage(
  studentData: ReportCardStudentPayload,
  activePeriod: string,
): number {
  const periodKey = ['trim1', 'trim2', 'trim3'].includes(activePeriod)
    ? (activePeriod as 'trim1' | 'trim2' | 'trim3')
    : null;
  const fromServer =
    (periodKey ? studentData.termHistory?.[periodKey]?.average : undefined) ??
    studentData.average ??
    0;
  if (fromServer > 0) return fromServer;
  return computeTrimesterTableTotals(studentData, activePeriod).moyenne;
}

function drawStudentIdentityTable(
  doc: jsPDF,
  studentData: ReportCardStudentPayload,
  startY: number,
  pageWidth: number,
): number {
  const fullName = `${studentData.user.lastName} ${studentData.user.firstName}`.toUpperCase();
  const dob = studentData.dateOfBirth
    ? format(new Date(studentData.dateOfBirth), 'dd/MM/yyyy', { locale: fr })
    : '';
  const tableWidth = reportCardTableWidth(pageWidth);

  autoTable(doc, {
    startY,
    theme: 'grid',
    styles: { fontSize: BULLETIN_FS.identity, cellPadding: BULLETIN_PAD.identity, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 },
    body: [
      [
        { content: 'NOM ET PRENOM', styles: { fontStyle: 'bold' } },
        { content: fullName, colSpan: 3 },
      ],
      [
        { content: 'Matricule', styles: { fontStyle: 'bold' } },
        studentData.studentIdNumber || '',
        { content: 'Classe', styles: { fontStyle: 'bold' } },
        studentData.class?.name || '',
      ],
      [
        { content: 'Effectif', styles: { fontStyle: 'bold' } },
        studentData.totalStudents ? String(studentData.totalStudents) : '',
        { content: 'Sexe', styles: { fontStyle: 'bold' } },
        genderLabel(studentData.gender),
      ],
      [
        { content: 'Né (e) le', styles: { fontStyle: 'bold' } },
        dob,
        { content: 'Lieu de naissance', styles: { fontStyle: 'bold' } },
        studentData.birthPlace || '',
      ],
      [
        { content: 'Nationalité', styles: { fontStyle: 'bold' } },
        studentData.nationality || 'Ivoirienne',
        { content: 'Doublant (e)', styles: { fontStyle: 'bold' } },
        studentData.repeating ? 'Oui' : 'Non',
      ],
    ],
    tableWidth,
    columnStyles: buildColumnStyles([38, 57, 38, 57], tableWidth),
    margin: reportCardTableMargins(),
  });

  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2;
}

function drawSingleTrimesterGradesTable(
  doc: jsPDF,
  studentData: ReportCardStudentPayload,
  startY: number,
  pageWidth: number,
  activePeriod: string,
): number {
  const tableHead: RowInput[] = [
    [
      'Discipline',
      'Moy.',
      'Coef.',
      'Total',
      'Rang',
      'Appréciations',
      'Professeurs',
      'Signature',
    ],
  ];

  const tableBody: RowInput[] = DISCIPLINE_TEMPLATE.map((row, rowIndex) =>
    buildSingleTrimDisciplineRow(studentData, row, rowIndex, activePeriod),
  );

  const totals = computeTrimesterTableTotals(studentData, activePeriod);
  tableBody.push([
    { content: 'TOTAUX', styles: { fontStyle: 'bold' } },
    fmtNote(totals.moyenne),
    String(totals.coefSum),
    totals.totalSum > 0 ? totals.totalSum.toFixed(2) : '',
    '',
    '',
    '',
    '',
  ]);

  const tableWidth = reportCardTableWidth(pageWidth);

  autoTable(doc, {
    startY,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: BULLETIN_FS.table,
      cellPadding: BULLETIN_PAD.table,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [220, 220, 220],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: BULLETIN_FS.tableHead,
      halign: 'center',
    },
    columnStyles: buildColumnStyles([32, 11, 10, 11, 14, 28, 26, 14], tableWidth, {
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      6: { fontSize: BULLETIN_FS.tableProf },
    }),
    tableWidth,
    margin: reportCardTableMargins(),
  });

  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2;
}

function drawMultiTrimesterGradesTable(
  doc: jsPDF,
  studentData: ReportCardStudentPayload,
  startY: number,
  pageWidth: number,
  activePeriod: string,
): number {
  const tableHead: RowInput[] = [
    [
      { content: 'Discipline', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'Trim 1', colSpan: 2, styles: { halign: 'center' } },
      { content: 'Trim 2', colSpan: 2, styles: { halign: 'center' } },
      { content: 'Trim 3', colSpan: 2, styles: { halign: 'center' } },
      { content: 'Moy.', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'Rang', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'Professeurs', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      { content: 'Signature', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
    ],
    ['', 'Moy.', 'Rang', 'Moy.', 'Rang', 'Moy.', 'Rang', '', '', '', ''],
  ];

  const tableBody = DISCIPLINE_TEMPLATE.map((row, rowIndex) =>
    buildMultiTrimDisciplineRow(studentData, row, rowIndex, activePeriod),
  );

  const tableWidth = reportCardTableWidth(pageWidth);

  autoTable(doc, {
    startY,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    styles: { fontSize: BULLETIN_FS.table, cellPadding: BULLETIN_PAD.table, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2, overflow: 'linebreak' },
    headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: BULLETIN_FS.tableHead, halign: 'center' },
    columnStyles: buildColumnStyles([30, 10, 8, 10, 8, 10, 8, 10, 8, 24, 14], tableWidth, {
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center' },
      6: { halign: 'center' },
      7: { halign: 'center' },
      8: { halign: 'center' },
      9: { fontSize: BULLETIN_FS.tableProf },
    }),
    tableWidth,
    margin: reportCardTableMargins(),
  });

  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2;
}

function drawOfficialHeader(
  doc: jsPDF,
  pageWidth: number,
  branding: TranlefetBranding,
  academicYear: string,
  periodKey: string,
  logoDataUrl: string | null,
  photoDataUrl: string | null = null,
): number {
  const margin = REPORT_CARD_MARGIN;
  let y = REPORT_CARD_MARGIN;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(BULLETIN_FS.ministry);
  doc.text('MINISTERE DE L\'EDUCATION NATIONALE', margin, y);
  doc.text('REPUBLIQUE DE COTE D\'IVOIRE', pageWidth - margin, y, { align: 'right' });
  y += 4;
  doc.text('ET DE L\'ALPHABETISATION', margin, y);
  doc.setFont('helvetica', 'italic');
  const mottoY = y;
  doc.text('Union – Discipline – Travail', pageWidth - margin, mottoY, { align: 'right' });

  const flagW = 15;
  const flagH = 10;
  const flagX = pageWidth - margin - flagW;
  const flagY = mottoY + 3;
  drawCoteDivoireFlag(doc, flagX, flagY, flagW, flagH);

  y += 2.5;

  if (logoDataUrl) {
    const logoSize = 21;
    const logoX = (pageWidth - logoSize) / 2;
    const logoFormat = imageFormatFromDataUrl(logoDataUrl);
    try {
      doc.addImage(logoDataUrl, logoFormat, logoX, y, logoSize, logoSize, undefined, 'FAST');
      y += logoSize + 1.5;
    } catch {
      try {
        doc.addImage(logoDataUrl, 'PNG', logoX, y, logoSize, logoSize, undefined, 'FAST');
        y += logoSize + 1.5;
      } catch {
        try {
          doc.addImage(logoDataUrl, 'JPEG', logoX, y, logoSize, logoSize, undefined, 'FAST');
          y += logoSize + 1.5;
        } catch {
          y += 0.5;
        }
      }
    }
  }

  doc.setFont('helvetica', 'normal');
  doc.text(branding.regionalDirection, margin, y);
  y += 3.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(BULLETIN_FS.schoolName);
  doc.text(branding.schoolName, pageWidth / 2, y, { align: 'center' });
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(BULLETIN_FS.schoolMeta);
  doc.text(
    `${branding.schoolAddress.toUpperCase()}, ${branding.schoolLocation} Cel : ${branding.schoolPhone.replace(/\s/g, '')}`,
    pageWidth / 2,
    y,
    { align: 'center' },
  );
  y += 4;
  doc.text(`E-mail : ${branding.schoolEmail}`, pageWidth / 2, y, { align: 'center' });
  y += 4.5;

  doc.setFontSize(BULLETIN_FS.code);
  doc.text(`CODE : ${branding.schoolCode}`, margin + 2, y);
  doc.text('Statut : Privé', pageWidth - margin - 2, y, { align: 'right' });
  y += 4.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(BULLETIN_FS.mainTitle);
  const titleY = y;
  doc.text('BULLETIN DE NOTES TRIMESTRIEL', pageWidth / 2, y, { align: 'center' });
  y += 4.5;
  doc.setFontSize(BULLETIN_FS.period);
  doc.text(periodTitle(periodKey), pageWidth / 2, y, { align: 'center' });
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(BULLETIN_FS.academicYear);
  doc.text(`Année Scolaire ${academicYear}`, pageWidth / 2, y, { align: 'center' });
  y += 4.5;

  const photoX = pageWidth - margin - STUDENT_PHOTO_SIZE;
  drawStudentPhotoBox(doc, photoDataUrl, photoX, titleY, STUDENT_PHOTO_SIZE);

  return Math.max(y, titleY + STUDENT_PHOTO_SIZE + 2);
}

function drawCheckboxLine(doc: jsPDF, x: number, y: number, label: string, checked: boolean): void {
  const box = 3;
  doc.setLineWidth(0.25);
  doc.rect(x, y - box + 0.5, box, box);
  if (checked) {
    doc.setFontSize(BULLETIN_FS.checkbox);
    doc.text('×', x + 0.55, y + 0.15);
  }
  doc.setFontSize(BULLETIN_FS.checkbox);
  doc.text(label, x + box + 1, y);
}

function buildResumeTableBody(
  studentData: ReportCardStudentPayload,
  periodLabel: string,
  activePeriod: string,
  compact: boolean,
): RowInput[] {
  const stats = studentData.classStats;
  const termAvg = resolvePeriodAverage(studentData, activePeriod);
  const termRank =
    studentData.termHistory?.[activePeriod as 'trim1' | 'trim2' | 'trim3']?.rank ?? studentData.rank;
  const annual = studentData.annualSummary;

  const rows: RowInput[] = [
    [
      { content: 'RESUME', colSpan: 4, styles: { fontStyle: 'bold', halign: 'center', fillColor: [220, 220, 220] } },
    ],
    [
      { content: `Assiduité ${periodLabel.toLowerCase()}`, styles: { fontStyle: 'bold' } },
      {
        content: studentData.absences
          ? `Abs. : ${studentData.absences.total} (J : ${studentData.absences.excused} / NJ : ${studentData.absences.unexcused})`
          : '',
        colSpan: 3,
      },
    ],
    [
      { content: 'Moyenne Trimestrielle', styles: { fontStyle: 'bold' } },
      termAvg > 0 ? `${fmtNote(termAvg)} /20` : '',
      { content: 'Rang', styles: { fontStyle: 'bold' } },
      termRank && studentData.totalStudents ? `${termRank} sur ${studentData.totalStudents}` : '',
    ],
    [
      { content: 'Moyenne générale de la classe', styles: { fontStyle: 'bold' } },
      stats?.periodAverage ? fmtNote(stats.periodAverage) : '',
      { content: 'Moy mini / maxi', styles: { fontStyle: 'bold' } },
      stats ? `${fmtNote(stats.periodMin)} / ${fmtNote(stats.periodMax)}` : '',
    ],
  ];

  if (!compact) {
    rows.push(
      [
        { content: 'Moyenne annuelle', styles: { fontStyle: 'bold' } },
        annual?.average ? `${fmtNote(annual.average)} /20` : '',
        { content: 'Rang annuel', styles: { fontStyle: 'bold' } },
        annual?.rank && studentData.totalStudents
          ? `${annual.rank} sur ${studentData.totalStudents}`
          : '',
      ],
      [
        { content: 'Résultats annuels de classe', styles: { fontStyle: 'bold' } },
        stats?.annualAverage ? fmtNote(stats.annualAverage) : '',
        { content: 'Moy mini / maxi annuelles', styles: { fontStyle: 'bold' } },
        stats?.annualMin !== undefined && stats?.annualMax !== undefined
          ? `${fmtNote(stats.annualMin)} / ${fmtNote(stats.annualMax)}`
          : '',
      ],
    );
  }

  return rows;
}

function drawMentionsAndSignatures(
  doc: jsPDF,
  pageWidth: number,
  margin: number,
  branding: TranlefetBranding,
  studentData: ReportCardStudentPayload,
  startY: number,
  compact: boolean,
): void {
  let y = startY;
  const distinctions = studentData.distinctions ?? [];
  const sanctions = studentData.sanctions ?? [];
  const distinctionOptions = [
    'Tableau d\'honneur + Félicitation',
    'Tableau d\'honneur + Encouragements',
    'Tableau d\'honneur',
  ];
  const sanctionOptions = [
    'Avertissement travail',
    'Avertissement conduite',
    'Blâme travail',
    'Blâme conduite',
  ];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(BULLETIN_FS.mentionsTitle);
  doc.text('Mentions du conseil de classe', margin, y);
  y += 3.5;
  doc.setFontSize(BULLETIN_FS.mentions);
  doc.text('DISTINCTIONS', margin, y);
  doc.text('SANCTIONS', pageWidth / 2 + 2, y);
  y += 3.5;

  distinctionOptions.forEach((label, i) => {
    drawCheckboxLine(doc, margin, y + i * 4, label, distinctions.includes(label));
  });
  sanctionOptions.forEach((label, i) => {
    drawCheckboxLine(doc, pageWidth / 2 + 2, y + i * 4, label, sanctions.includes(label));
  });

  y += 18;

  if (!compact) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(BULLETIN_FS.mentionsTitle);
    doc.text(`Redoublant (e) : ${studentData.repeating ? 'Oui' : 'Non'}`, margin, y);
    doc.text(`Décision de fin d'année : ${studentData.yearEndDecision || '…………………………'}`, margin + 48, y);
    y += 6.5;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(BULLETIN_FS.mentions);
    doc.text(branding.motto, pageWidth / 2, y, { align: 'center' });
    y += 5.5;
  }

  const sigY = y + 2;
  const directorLabel = branding.studiesDirectorName
    ? `Directeur des Etudes\n${branding.studiesDirectorName}`
    : 'Directeur des Etudes';
  const sigLabels = [
    'Nom/Signature du\nprofesseur principal',
    directorLabel,
  ];
  const colCount = sigLabels.length;
  const colW = (pageWidth - margin * 2) / colCount;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(BULLETIN_FS.signature);
  sigLabels.forEach((label, i) => {
    const x = margin + i * colW;
    const lines = doc.splitTextToSize(label, colW - 4);
    doc.text(lines, x + colW / 2, sigY, { align: 'center' });
  });

  doc.setFontSize(BULLETIN_FS.signatureDate);
  doc.text(
    `Fait à ${branding.city}, le ${format(new Date(), 'dd/MM/yyyy', { locale: fr })}`,
    pageWidth - margin,
    sigY + 18,
    { align: 'right' },
  );
}

export async function generateTranlefetReportCardPdf(
  studentData: ReportCardStudentPayload,
  options: {
    periodLabel: string;
    periodKey: string;
    academicYear: string;
    branding?: Partial<TranlefetBranding>;
  },
): Promise<void> {
  const branding: TranlefetBranding = { ...TRANLEFET_DEFAULT_BRANDING, ...options.branding };
  const logoDataUrl = await resolveLogoDataUrlForPdf(branding);
  const photoDataUrl = await resolveStudentPhotoDataUrl(studentData);
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const activePeriod = options.periodKey;
  const compactFooter = isSingleTrimesterBulletin(activePeriod);
  const tableWidth = reportCardTableWidth(pageWidth);

  let y = drawOfficialHeader(
    doc,
    pageWidth,
    branding,
    options.academicYear,
    activePeriod,
    logoDataUrl,
    photoDataUrl,
  );

  y = drawStudentIdentityTable(doc, studentData, y, pageWidth);

  if (compactFooter) {
    y = drawSingleTrimesterGradesTable(doc, studentData, y, pageWidth, activePeriod);
  } else {
    y = drawMultiTrimesterGradesTable(doc, studentData, y, pageWidth, activePeriod);
  }

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: BULLETIN_FS.resume, cellPadding: BULLETIN_PAD.resume, textColor: [0, 0, 0], lineColor: [0, 0, 0], lineWidth: 0.2 },
    body: buildResumeTableBody(studentData, options.periodLabel, activePeriod, compactFooter),
    tableWidth,
    columnStyles: buildColumnStyles([48, 48, 47, 47], tableWidth),
    margin: reportCardTableMargins(),
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + MENTIONS_SECTION_TOP_GAP;

  drawMentionsAndSignatures(doc, pageWidth, REPORT_CARD_MARGIN, branding, studentData, y, compactFooter);

  const fileName = `bulletin_${studentData.user.lastName}_${studentData.user.firstName}_${options.periodKey}_${options.academicYear}.pdf`;
  doc.save(fileName);
}
