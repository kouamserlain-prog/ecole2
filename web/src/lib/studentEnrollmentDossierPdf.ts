import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import { ENROLLMENT_STATUS_LABELS, type EnrollmentStatusValue } from './enrollmentStatus';
import { STATE_ASSIGNMENT_LABELS, type StudentStateAssignmentValue } from './stateAssignment';
import { TRANLEFET_SCHOOL } from '../data/tranlefetSchool';

export type StudentEnrollmentDossierPayload = {
  generatedAt: string;
  school: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    principalName?: string | null;
    schoolCode?: string | null;
    motto?: string | null;
    logoUrl?: string | null;
  } | null;
  student: {
    id: string;
    studentId: string;
    enrollmentDate: string;
    enrollmentStatus: string;
    stateAssignment?: string | null;
    dateOfBirth: string;
    birthPlace?: string | null;
    isRepeating?: boolean;
    gender: string;
    address?: string | null;
    emergencyContact?: string | null;
    emergencyPhone?: string | null;
    emergencyContact2?: string | null;
    emergencyPhone2?: string | null;
    medicalInfo?: string | null;
    allergies?: string | null;
    specialNeeds?: string | null;
  };
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
  };
  class: {
    name: string;
    level: string;
    academicYear: string;
    trackName?: string | null;
  } | null;
  subjectOptions: { name: string; code?: string | null }[];
  parents: {
    relation?: string | null;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
  }[];
  admission: {
    reference: string;
    desiredLevel?: string | null;
    academicYear?: string | null;
    previousSchool?: string | null;
    motivation?: string | null;
    parentName?: string | null;
    parentPhone?: string | null;
    parentEmail?: string | null;
    gradeTerm1?: number | null;
    gradeTerm2?: number | null;
    gradeAnnualGeneral?: number | null;
    gradeAnnualSpecific?: number | null;
    gradeAnnualLiterary?: number | null;
    term3ReportCardOriginalName?: string | null;
    reviewedAt?: string | null;
  } | null;
  identityDocuments: {
    type: string;
    typeLabel: string;
    label?: string | null;
    originalName: string;
    createdAt: string;
  }[];
  digitalCard: {
    cardPageUrl: string;
    qrDataUrl: string;
  } | null;
};

const GENDER_LABELS: Record<string, string> = {
  MALE: 'Masculin',
  FEMALE: 'Féminin',
  OTHER: 'Autre',
};

const RELATION_LABELS: Record<string, string> = {
  father: 'Père',
  mother: 'Mère',
  guardian: 'Tuteur légal',
};

const C = {
  brand: [0, 24, 168] as [number, number, number],
  ink: [28, 25, 23] as [number, number, number],
  muted: [87, 83, 78] as [number, number, number],
  line: [231, 229, 228] as [number, number, number],
  gold: [235, 176, 45] as [number, number, number],
};

function val(v: string | null | undefined, fallback = '—'): string {
  const t = v?.trim();
  return t ? t : fallback;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return format(d, 'dd MMMM yyyy', { locale: fr });
}

function slugifyFilename(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function writeSection(
  doc: jsPDF,
  title: string,
  body: string,
  x: number,
  y: number,
  maxWidth: number,
  pageWidth: number,
  pageHeight: number,
): number {
  const bottomMargin = 18;
  if (y > pageHeight - 40) {
    doc.addPage();
    y = 20;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...C.ink);
  doc.text(title, x, y);
  y += 5;
  doc.setDrawColor(...C.brand);
  doc.setLineWidth(0.35);
  doc.line(x, y, pageWidth - x, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...C.muted);
  const lines = doc.splitTextToSize(body, maxWidth);
  for (const line of lines) {
    if (y > pageHeight - bottomMargin) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, x, y);
    y += 5;
  }
  return y + 4;
}

function gradeLine(label: string, value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(value)) return null;
  return `${label} : ${value} / 20`;
}

function imageFormatFromDataUrl(dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' {
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
  return 'JPEG';
}

function drawSignaturesBlock(
  doc: jsPDF,
  margin: number,
  pageWidth: number,
  y: number,
  pageHeight: number,
): number {
  if (y > pageHeight - 42) {
    doc.addPage();
    y = 20;
  }
  const colW = (pageWidth - margin * 2) / 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text('Date et signature du responsable légal', margin + colW / 2, y, { align: 'center' });
  doc.text('Cachet et visa de l\'administration', margin + colW + colW / 2, y, { align: 'center' });
  y += 4;
  doc.setDrawColor(...C.line);
  doc.setLineWidth(0.25);
  doc.line(margin + 4, y + 14, margin + colW - 4, y + 14);
  doc.line(margin + colW + 4, y + 14, pageWidth - margin - 4, y + 14);
  return y + 22;
}

export type EnrollmentDossierRenderOptions = {
  logoDataUrl?: string | null;
};

/** Construit le document PDF (sans téléchargement). */
export function buildStudentEnrollmentDossierDoc(
  payload: StudentEnrollmentDossierPayload,
  options: EnrollmentDossierRenderOptions = {},
): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const maxWidth = pageWidth - margin * 2;
  let y = 14;

  const schoolName = payload.school?.name?.trim() || TRANLEFET_SCHOOL.fullName;
  const schoolCode = payload.school?.schoolCode?.trim() || TRANLEFET_SCHOOL.establishmentCode;

  if (options.logoDataUrl) {
    try {
      doc.addImage(
        options.logoDataUrl,
        imageFormatFromDataUrl(options.logoDataUrl),
        pageWidth / 2 - 12,
        y,
        24,
        24,
      );
      y += 28;
    } catch {
      y += 2;
    }
  }

  doc.setFillColor(...C.brand);
  doc.rect(margin, y, pageWidth - margin * 2, 1.2, 'F');
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.brand);
  doc.text(schoolName.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 5;
  if (schoolCode) {
    doc.setFontSize(8);
    doc.text(`CODE ÉTABLISSEMENT : ${schoolCode}`, pageWidth / 2, y, { align: 'center' });
    y += 5;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...C.ink);
  doc.text("DOSSIER D'INSCRIPTION DÉFINITIVE", pageWidth / 2, y, { align: 'center' });
  y += 7;

  const fullName = [payload.user.lastName, payload.user.firstName].filter(Boolean).join(' ').trim();
  doc.setFontSize(12);
  doc.text(fullName.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.muted);
  const metaLines = [
    `Matricule : ${payload.student.studentId}`,
    payload.admission?.reference ? `Réf. pré-inscription : ${payload.admission.reference}` : null,
    `Date d'inscription définitive : ${formatDate(payload.student.enrollmentDate)}`,
    `Statut : ${ENROLLMENT_STATUS_LABELS[payload.student.enrollmentStatus as EnrollmentStatusValue] ?? payload.student.enrollmentStatus}`,
    `Document généré le ${format(new Date(payload.generatedAt), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}`,
  ].filter(Boolean) as string[];
  for (const line of metaLines) {
    doc.text(line, pageWidth / 2, y, { align: 'center' });
    y += 4.5;
  }
  y += 3;

  doc.setFillColor(...C.gold);
  doc.rect(margin, y, pageWidth - margin * 2, 0.8, 'F');
  y += 5;

  doc.setDrawColor(...C.line);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  const identityBody = [
    `Nom complet : ${fullName}`,
    `Date de naissance : ${formatDate(payload.student.dateOfBirth)}`,
    `Lieu de naissance : ${val(payload.student.birthPlace)}`,
    `Genre : ${GENDER_LABELS[payload.student.gender] ?? payload.student.gender}`,
    `Doublant (e) : ${payload.student.isRepeating ? 'Oui' : 'Non'}`,
    `E-mail : ${val(payload.user.email)}`,
    `Téléphone : ${val(payload.user.phone)}`,
    `Adresse : ${val(payload.student.address)}`,
  ].join('\n');
  y = writeSection(doc, 'Identité de l\'élève', identityBody, margin, y, maxWidth, pageWidth, pageHeight);

  const classLine = payload.class
    ? [
        `Classe : ${payload.class.name} (${payload.class.level})`,
        `Année scolaire : ${payload.class.academicYear}`,
        payload.class.trackName ? `Filière / option : ${payload.class.trackName}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    : 'Classe : non assignée';

  const scolariteBody = [
    classLine,
    `Affectation État : ${STATE_ASSIGNMENT_LABELS[(payload.student.stateAssignment as StudentStateAssignmentValue) ?? 'NOT_STATE_ASSIGNED'] ?? '—'}`,
    payload.admission?.desiredLevel ? `Niveau demandé (admission) : ${payload.admission.desiredLevel}` : null,
    payload.admission?.previousSchool ? `Établissement précédent : ${payload.admission.previousSchool}` : null,
    payload.subjectOptions.length
      ? `Options : ${payload.subjectOptions.map((o) => (o.code ? `${o.name} (${o.code})` : o.name)).join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
  y = writeSection(doc, 'Scolarité', scolariteBody, margin, y, maxWidth, pageWidth, pageHeight);

  if (payload.admission) {
    const grades = [
      gradeLine('Moy. 1er trimestre', payload.admission.gradeTerm1),
      gradeLine('Moy. 2e trimestre', payload.admission.gradeTerm2),
      gradeLine('Moyenne générale annuelle', payload.admission.gradeAnnualGeneral),
      gradeLine('Moyenne discipline spécifique', payload.admission.gradeAnnualSpecific),
      gradeLine('Moyenne discipline littéraire', payload.admission.gradeAnnualLiterary),
    ].filter(Boolean) as string[];
    if (grades.length > 0 || payload.admission.term3ReportCardOriginalName) {
      const admissionBody = [
        ...grades,
        payload.admission.term3ReportCardOriginalName
          ? `Bulletin 3e trimestre déposé : ${payload.admission.term3ReportCardOriginalName}`
          : null,
        payload.admission.motivation?.trim() ? `Motivation : ${payload.admission.motivation.trim()}` : null,
      ]
        .filter(Boolean)
        .join('\n');
      y = writeSection(doc, 'Dossier de pré-inscription', admissionBody, margin, y, maxWidth, pageWidth, pageHeight);
    }
  }

  if (payload.parents.length > 0) {
    if (y > pageHeight - 50) {
      doc.addPage();
      y = 20;
    }
    autoTable(doc, {
      startY: y,
      head: [['Lien', 'Nom', 'E-mail', 'Téléphone']],
      body: payload.parents.map((p) => [
        p.relation ? (RELATION_LABELS[p.relation] ?? p.relation) : 'Parent / tuteur',
        `${p.firstName} ${p.lastName}`.trim(),
        val(p.email),
        val(p.phone),
      ]),
      theme: 'striped',
      headStyles: { fillColor: C.brand, textColor: 255, fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 2.5 },
      margin: { left: margin, right: margin },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  } else if (payload.admission?.parentName || payload.admission?.parentEmail) {
    const parentFallback = [
      payload.admission.parentName ? `Responsable : ${payload.admission.parentName}` : null,
      payload.admission.parentPhone ? `Téléphone : ${payload.admission.parentPhone}` : null,
      payload.admission.parentEmail ? `E-mail : ${payload.admission.parentEmail}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    y = writeSection(doc, 'Responsable légal', parentFallback, margin, y, maxWidth, pageWidth, pageHeight);
  }

  const urgencyBody = [
    `Contact urgence 1 : ${val(payload.student.emergencyContact)} — ${val(payload.student.emergencyPhone)}`,
    `Contact urgence 2 : ${val(payload.student.emergencyContact2)} — ${val(payload.student.emergencyPhone2)}`,
  ].join('\n');
  y = writeSection(doc, "Contacts d'urgence", urgencyBody, margin, y, maxWidth, pageWidth, pageHeight);

  const medicalParts = [
    payload.student.allergies?.trim() ? `Allergies : ${payload.student.allergies.trim()}` : null,
    payload.student.specialNeeds?.trim()
      ? `Besoins particuliers : ${payload.student.specialNeeds.trim()}`
      : null,
    payload.student.medicalInfo?.trim()
      ? `Informations médicales : ${payload.student.medicalInfo.trim()}`
      : null,
  ].filter(Boolean);
  if (medicalParts.length > 0) {
    y = writeSection(doc, 'Vigilance médicale', medicalParts.join('\n\n'), margin, y, maxWidth, pageWidth, pageHeight);
  }

  if (payload.identityDocuments.length > 0) {
    if (y > pageHeight - 50) {
      doc.addPage();
      y = 20;
    }
    autoTable(doc, {
      startY: y,
      head: [['Type', 'Libellé', 'Fichier', 'Déposé le']],
      body: payload.identityDocuments.map((d) => [
        d.typeLabel,
        val(d.label, '—'),
        d.originalName,
        formatDate(d.createdAt),
      ]),
      theme: 'striped',
      headStyles: { fillColor: C.brand, textColor: 255, fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: margin, right: margin },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  if (payload.digitalCard?.qrDataUrl) {
    if (y > pageHeight - 70) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...C.ink);
    doc.text('Carte étudiant numérique', margin, y);
    y += 5;
    doc.setDrawColor(...C.brand);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
    try {
      doc.addImage(payload.digitalCard.qrDataUrl, 'PNG', margin, y, 36, 36);
    } catch {
      /* ignore invalid image */
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    const qrLines = doc.splitTextToSize(
      `Présentez ce QR code sur le terrain.\nLien : ${payload.digitalCard.cardPageUrl}`,
      maxWidth - 42,
    );
    doc.text(qrLines, margin + 42, y + 8);
    y += 44;
  }

  y = drawSignaturesBlock(doc, margin, pageWidth, y, pageHeight);

  if (payload.school) {
    const footerParts = [
      payload.school.address ? payload.school.address : null,
      [payload.school.phone, payload.school.email].filter(Boolean).join(' · ') || null,
      payload.school.principalName ? `Chef d'établissement : ${payload.school.principalName}` : null,
    ].filter(Boolean);
    if (footerParts.length > 0 && y < pageHeight - 30) {
      y = Math.max(y, pageHeight - 28);
      doc.setDrawColor(...C.line);
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...C.muted);
      for (const line of footerParts) {
        doc.text(String(line), pageWidth / 2, y, { align: 'center' });
        y += 4;
      }
    }
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.muted);
  doc.text(
    'Document administratif interne — conservez une copie papier ou numérique.',
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' },
  );

  return doc;
}

export function downloadStudentEnrollmentDossierPdf(
  payload: StudentEnrollmentDossierPayload,
  options?: EnrollmentDossierRenderOptions,
): void {
  const doc = buildStudentEnrollmentDossierDoc(payload, options);
  const fullName = [payload.user.lastName, payload.user.firstName].filter(Boolean).join(' ').trim();
  const fileName = `dossier-inscription-${slugifyFilename(payload.student.studentId || fullName)}.pdf`;
  doc.save(fileName);
}

export function printStudentEnrollmentDossierPdf(
  payload: StudentEnrollmentDossierPayload,
  options?: EnrollmentDossierRenderOptions,
): void {
  const doc = buildStudentEnrollmentDossierDoc(payload, options);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank', 'noopener,noreferrer');
  if (!printWindow) {
    URL.revokeObjectURL(url);
    throw new Error('Impossible d\'ouvrir la fenêtre d\'impression. Autorisez les pop-ups.');
  }
  printWindow.addEventListener('load', () => {
    printWindow.focus();
    printWindow.print();
  });
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
