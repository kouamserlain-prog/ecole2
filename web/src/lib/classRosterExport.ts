import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import {
  ENROLLMENT_STATUS_LABELS,
  type EnrollmentStatusValue,
} from './enrollmentStatus';
import {
  STATE_ASSIGNMENT_LABELS,
  normalizeStateAssignment,
  type StudentStateAssignmentValue,
} from './stateAssignment';

export type ClassRosterMeta = {
  schoolName?: string | null;
  classId: string;
  className: string;
  level?: string | null;
  section?: string | null;
  academicYear?: string | null;
  room?: string | null;
  capacity?: number | null;
  trackName?: string | null;
  teacherName?: string | null;
};

export type ClassRosterStudent = {
  studentId: string;
  lastName: string;
  firstName: string;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  enrollmentStatus?: string | null;
  stateAssignment?: string | null;
  classGroupName?: string | null;
};

const GENDER_LABELS: Record<string, string> = {
  MALE: 'M',
  FEMALE: 'F',
  OTHER: '—',
};

const C = {
  brand: [0, 24, 168] as [number, number, number],
  ink: [28, 25, 23] as [number, number, number],
  muted: [87, 83, 78] as [number, number, number],
};

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function formatDob(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'dd/MM/yyyy', { locale: fr });
}

export function sortRosterStudents(students: ClassRosterStudent[]): ClassRosterStudent[] {
  return [...students].sort((a, b) => {
    const ln = a.lastName.localeCompare(b.lastName, 'fr');
    if (ln !== 0) return ln;
    return a.firstName.localeCompare(b.firstName, 'fr');
  });
}

export function mapApiStudentToRosterRow(s: {
  studentId?: string;
  id?: string;
  gender?: string | null;
  dateOfBirth?: string | null;
  enrollmentStatus?: string | null;
  stateAssignment?: string | null;
  classGroup?: { name?: string | null } | null;
  user?: {
    firstName?: string;
    lastName?: string;
    email?: string | null;
    phone?: string | null;
  } | null;
}): ClassRosterStudent {
  return {
    studentId: s.studentId || s.id || '—',
    lastName: s.user?.lastName?.trim() || '—',
    firstName: s.user?.firstName?.trim() || '—',
    email: s.user?.email,
    phone: s.user?.phone,
    gender: s.gender,
    dateOfBirth: s.dateOfBirth,
    enrollmentStatus: s.enrollmentStatus,
    stateAssignment: s.stateAssignment,
    classGroupName: s.classGroup?.name ?? null,
  };
}

function rosterTableBody(students: ClassRosterStudent[]): string[][] {
  const sorted = sortRosterStudents(students);
  return sorted.map((s, i) => {
    const es = ((s.enrollmentStatus as EnrollmentStatusValue) || 'ACTIVE');
    const sa = normalizeStateAssignment(s.stateAssignment);
    return [
      String(i + 1),
      s.studentId,
      s.lastName,
      s.firstName,
      GENDER_LABELS[s.gender ?? ''] ?? '—',
      formatDob(s.dateOfBirth),
      s.email?.trim() || '—',
      s.phone?.trim() || '—',
      ENROLLMENT_STATUS_LABELS[es] ?? es,
      STATE_ASSIGNMENT_LABELS[sa as StudentStateAssignmentValue] ?? '—',
    ];
  });
}

const TABLE_HEAD = [
  'N°',
  'Matricule',
  'Nom',
  'Prénom',
  'S.',
  'Naissance',
  'E-mail',
  'Tél.',
  'Inscription',
  'Affect. État',
];

function drawClassRosterHeader(
  doc: jsPDF,
  meta: ClassRosterMeta,
  studentCount: number,
  startY = 14,
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = startY;

  if (meta.schoolName?.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.brand);
    doc.text(meta.schoolName.trim().toUpperCase(), pageWidth / 2, y, { align: 'center' });
    y += 6;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...C.ink);
  doc.text('LISTE DES ÉLÈVES', pageWidth / 2, y, { align: 'center' });
  y += 7;

  const classTitle = [meta.level, meta.section, meta.className].filter(Boolean).join(' · ');
  doc.setFontSize(12);
  doc.text(classTitle || meta.className, pageWidth / 2, y, { align: 'center' });
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.muted);
  const metaLines: string[] = [];
  if (meta.academicYear) metaLines.push(`Année scolaire ${meta.academicYear}`);
  if (meta.trackName) metaLines.push(`Filière : ${meta.trackName}`);
  if (meta.room) metaLines.push(`Salle : ${meta.room}`);
  if (meta.teacherName) metaLines.push(`Prof. principal : ${meta.teacherName}`);
  const cap = meta.capacity ?? 0;
  metaLines.push(
    `Effectif : ${studentCount}${cap > 0 ? ` / ${cap}` : ''} élève${studentCount > 1 ? 's' : ''}`,
  );
  metaLines.push(`Édité le ${format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}`);
  for (const line of metaLines) {
    doc.text(line, pageWidth / 2, y, { align: 'center' });
    y += 4.2;
  }
  return y + 4;
}

function runAutoTable(doc: jsPDF, options: Record<string, unknown>) {
  const d = doc as jsPDF & { autoTable?: (o: Record<string, unknown>) => void };
  if (typeof d.autoTable === 'function') {
    d.autoTable(options);
  } else {
    autoTable(doc, options);
  }
}

export function downloadClassRosterPdf(meta: ClassRosterMeta, students: ClassRosterStudent[]): void {
  const doc = new jsPDF('l', 'mm', 'a4');
  const margin = 12;
  const startY = drawClassRosterHeader(doc, meta, students.length);

  runAutoTable(doc, {
    startY,
    head: [TABLE_HEAD],
    body: rosterTableBody(students),
    theme: 'striped',
    headStyles: {
      fillColor: C.brand,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    styles: { fontSize: 7.5, cellPadding: 2 },
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 22 },
      5: { cellWidth: 18 },
    },
  });

  const fileName = `liste-classe-${slugify(meta.className)}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
}

export function downloadClassRosterCsv(meta: ClassRosterMeta, students: ClassRosterStudent[]): void {
  const headers = [
    'N°',
    'Matricule',
    'Nom',
    'Prénom',
    'Genre',
    'Date de naissance',
    'E-mail',
    'Téléphone',
    'Statut inscription',
    'Affectation État',
    'Groupe',
  ];
  const sorted = sortRosterStudents(students);
  const rows = sorted.map((s, i) => {
    const es = ((s.enrollmentStatus as EnrollmentStatusValue) || 'ACTIVE');
    const sa = normalizeStateAssignment(s.stateAssignment);
    return [
      i + 1,
      s.studentId,
      s.lastName,
      s.firstName,
      GENDER_LABELS[s.gender ?? ''] ?? s.gender ?? '',
      formatDob(s.dateOfBirth),
      s.email ?? '',
      s.phone ?? '',
      ENROLLMENT_STATUS_LABELS[es] ?? es,
      STATE_ASSIGNMENT_LABELS[sa as StudentStateAssignmentValue] ?? sa,
      s.classGroupName ?? '',
    ]
      .map((c) => String(c).replace(/;/g, ','))
      .join(';');
  });

  const classTitle = [meta.level, meta.section, meta.className].filter(Boolean).join(' · ');
  const csv =
    '\ufeff' +
    `# ${meta.schoolName ?? 'Établissement'} — Liste de classe\n` +
    `# ${classTitle}\n` +
    `# ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })}\n` +
    headers.join(';') +
    '\n' +
    rows.join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `liste-classe-${slugify(meta.className)}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** PDF unique : une section par classe (saut de page entre chaque). */
export function downloadAllClassRostersPdf(
  schoolName: string | null | undefined,
  classes: ClassRosterMeta[],
  studentsByClassId: Map<string, ClassRosterStudent[]>,
): void {
  const doc = new jsPDF('l', 'mm', 'a4');
  const margin = 12;
  const withStudents = classes.filter((c) => (studentsByClassId.get(c.classId)?.length ?? 0) > 0);

  if (withStudents.length === 0) {
    doc.setFontSize(12);
    doc.text('Aucun élève affecté aux classes sélectionnées.', 14, 20);
    doc.save(`listes-classes-vides-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    return;
  }

  withStudents.forEach((meta, index) => {
    if (index > 0) doc.addPage();
    const students = studentsByClassId.get(meta.classId) ?? [];
    const metaWithSchool = { ...meta, schoolName: schoolName ?? meta.schoolName };
    const startY = drawClassRosterHeader(doc, metaWithSchool, students.length);
    runAutoTable(doc, {
      startY,
      head: [TABLE_HEAD],
      body: rosterTableBody(students),
      theme: 'striped',
      headStyles: {
        fillColor: C.brand,
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
      },
      styles: { fontSize: 7.5, cellPadding: 2 },
      margin: { left: margin, right: margin },
    });
  });

  doc.save(`listes-classes-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

export function buildClassMetaFromApi(classItem: {
  id: string;
  name: string;
  level?: string | null;
  section?: string | null;
  academicYear?: string | null;
  room?: string | null;
  capacity?: number | null;
  track?: { name?: string | null } | null;
  materialRoom?: { name?: string | null } | null;
  teacher?: { user?: { firstName?: string; lastName?: string } | null } | null;
}): ClassRosterMeta {
  const teacher = classItem.teacher?.user;
  return {
    classId: classItem.id,
    className: classItem.name,
    level: classItem.level,
    section: classItem.section,
    academicYear: classItem.academicYear,
    room: classItem.materialRoom?.name || classItem.room,
    capacity: classItem.capacity,
    trackName: classItem.track?.name,
    teacherName: teacher
      ? `${teacher.firstName ?? ''} ${teacher.lastName ?? ''}`.trim()
      : null,
  };
}
