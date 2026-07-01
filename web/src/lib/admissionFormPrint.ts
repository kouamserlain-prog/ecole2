import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import { printHtmlDocument } from '@/lib/printHtml';
import {
  ADMISSION_GRADE_FIELD_LABELS,
  type AdmissionGradeFieldKey,
  getAdmissionGradeKeysForLevel,
  isAdmissionSecondaryLevel,
  isLyceeAdmissionLevel,
} from '@/utils/admissionGrades';

export type AdmissionPrintFormData = {
  firstName?: string;
  lastName?: string;
  matricule?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  birthPlace?: string;
  isRepeating?: string;
  gender?: string;
  desiredLevel?: string;
  academicYear?: string;
  previousSchool?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  address?: string;
  motivation?: string;
  gradeTerm1?: string;
  gradeTerm2?: string;
  gradeAnnualGeneral?: string;
  gradeAnnualSpecific?: string;
  gradeAnnualLiterary?: string;
};

const GENDER_LABELS: Record<string, string> = {
  MALE: 'Masculin',
  FEMALE: 'Féminin',
  OTHER: 'Autre',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fieldValue(raw: string | undefined, width = '100%'): string {
  const v = raw?.trim();
  if (v) return `<span class="value">${escapeHtml(v)}</span>`;
  return `<span class="blank" style="min-width:${width}">&nbsp;</span>`;
}

function row(label: string, content: string, required = false): string {
  return `<tr><td class="label">${escapeHtml(label)}${required ? ' *' : ''}</td><td class="field">${content}</td></tr>`;
}

export type AdmissionFormExportOptions = {
  schoolName?: string;
  academicYear?: string;
  form?: AdmissionPrintFormData;
  bulletinFileName?: string;
  logoUrl?: string | null;
  reference?: string;
  schoolSlug?: string;
};

function inscriptionOnlineUrl(schoolSlug?: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  const q = schoolSlug?.trim() ? `?school=${encodeURIComponent(schoolSlug.trim())}` : '';
  return `${base}/inscription${q}`;
}

function buildPrintHtml(opts: {
  schoolName: string;
  academicYear: string;
  form?: AdmissionPrintFormData;
  bulletinFileName?: string;
  onlineUrl: string;
  logoUrl?: string | null;
  reference?: string;
}): string {
  const f = opts.form ?? {};
  const generated = format(new Date(), "d MMMM yyyy", { locale: fr });
  const school = escapeHtml(opts.schoolName);
  const year = escapeHtml(opts.academicYear);
  const level = f.desiredLevel ?? '';
  const showSecondary = isAdmissionSecondaryLevel(level) || !level.trim();
  const showLycee = isLyceeAdmissionLevel(level) || !level.trim();
  const gradeKeys = level.trim()
    ? getAdmissionGradeKeysForLevel(level)
    : ([
        'gradeTerm1',
        'gradeTerm2',
        'gradeAnnualGeneral',
        'gradeAnnualSpecific',
        'gradeAnnualLiterary',
      ] as AdmissionGradeFieldKey[]);

  const dob =
    f.dateOfBirth && /^\d{4}-\d{2}-\d{2}/.test(f.dateOfBirth)
      ? format(new Date(f.dateOfBirth), 'dd/MM/yyyy', { locale: fr })
      : f.dateOfBirth?.trim() || '';

  const genderLabel = f.gender ? (GENDER_LABELS[f.gender] ?? f.gender) : '';
  const repeatingLabel =
    f.isRepeating === 'true' || f.isRepeating === '1' || f.isRepeating === 'oui'
      ? 'Oui'
      : f.isRepeating === 'false' || f.isRepeating === '0' || f.isRepeating === 'non'
        ? 'Non'
        : '';

  const gradeRows = gradeKeys
    .map((key) => row(ADMISSION_GRADE_FIELD_LABELS[key], fieldValue(f[key], '4rem'), true))
    .join('');

  const bulletinNote = opts.bulletinFileName
    ? fieldValue(opts.bulletinFileName)
    : '<span class="checkbox">☐</span> Copie jointe (PDF ou image) — obligatoire (6ème à Terminale)';

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8" /><title>Formulaire de pré-inscription</title><style>
    *{box-sizing:border-box}
    body{font-family:Georgia,'Times New Roman',serif;color:#0c0a09;margin:0;padding:18px 22px;font-size:11pt;line-height:1.45}
    .header{border-bottom:2px solid #b45309;padding-bottom:12px;margin-bottom:16px}
    .logo{max-height:56px;max-width:220px;object-fit:contain;margin-bottom:10px;display:block}
    .school{font-size:9pt;color:#57534e;text-transform:uppercase;letter-spacing:.1em}
    h1{margin:8px 0 4px;font-size:18pt;color:#1c1917}
    .meta{font-size:9pt;color:#78716c}
    .intro{font-size:9.5pt;color:#44403c;margin:0 0 14px}
    h2{font-size:11pt;color:#92400e;margin:18px 0 8px;border-bottom:1px solid #e7e5e4;padding-bottom:4px}
    table{width:100%;border-collapse:collapse;margin-bottom:6px}
  td{padding:6px 8px;vertical-align:top;border-bottom:1px solid #f5f5f4}
    td.label{width:42%;font-size:9.5pt;font-weight:600;color:#292524}
    td.field{width:58%}
    .value{display:inline-block;font-weight:600;color:#0c0a09}
    .blank{display:inline-block;border-bottom:1px solid #a8a29e;min-height:1.2em}
    .checkbox{font-size:14pt;line-height:1}
    .lycee-note{font-size:8.5pt;color:#57534e;font-style:italic;margin:0 0 8px}
    .signatures{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:28px}
    .sign-box{border-top:1px solid #a8a29e;padding-top:6px;font-size:9pt;color:#57534e}
    .footer{margin-top:20px;font-size:8.5pt;color:#78716c;border-top:1px solid #e7e5e4;padding-top:10px}
    @media print{body{padding:10mm 12mm}@page{margin:10mm}}
  </style></head><body>
  <div class="header">
    ${
      opts.logoUrl
        ? `<img class="logo" src="${escapeHtml(opts.logoUrl)}" alt="${school}" />`
        : ''
    }
    <div class="school">${school}</div>
    <h1>Formulaire de pré-inscription</h1>
    <div class="meta">Année scolaire ${year} · Document généré le ${escapeHtml(generated)}${
      opts.reference ? ` · Dossier n° ${escapeHtml(opts.reference)}` : ''
    }</div>
  </div>
  <p class="intro">Remplissez ce formulaire en lettres lisibles. Les champs marqués d’un astérisque (*) sont obligatoires.
  Vous pouvez aussi déposer votre demande en ligne : <strong>${escapeHtml(opts.onlineUrl)}</strong></p>

  <h2>Identité du candidat</h2>
  <table>
    ${row('Prénom', fieldValue(f.firstName), true)}
    ${row('Nom', fieldValue(f.lastName), true)}
    ${row('Numéro matricule', fieldValue(f.matricule))}
    ${row('Date de naissance', fieldValue(dob), true)}
    ${row('Lieu de naissance', fieldValue(f.birthPlace), true)}
    ${row('Genre', fieldValue(genderLabel), true)}
    ${row('Doublant (e)', fieldValue(repeatingLabel || 'Non'), true)}
    ${row('E-mail', fieldValue(f.email), true)}
    ${row('Téléphone', fieldValue(f.phone))}
  </table>

  <h2>Scolarité demandée</h2>
  <table>
    ${row('Niveau souhaité', fieldValue(f.desiredLevel), true)}
    ${row('Année scolaire', fieldValue(f.academicYear || opts.academicYear), true)}
    ${row('Établissement précédent', fieldValue(f.previousSchool))}
  </table>

  ${
    showSecondary
      ? `<h2>Résultats scolaires (6ème à Terminale)</h2>
  <p class="lycee-note">${
    showLycee
      ? 'Lycée (2nde, 1ère, Terminale) : cinq moyennes sur 20.'
      : 'Collège (6ème à 3ème) : trois moyennes sur 20 (1er et 2e trimestre, moyenne générale annuelle).'
  } Bulletin du 3e trimestre obligatoire.</p>
  <table>${gradeRows}</table>
  <table>${row('Bulletin du 3e trimestre', bulletinNote, true)}</table>`
      : ''
  }

  <h2>Responsable légal & coordonnées</h2>
  <table>
    ${row('Nom du responsable', fieldValue(f.parentName))}
    ${row('Téléphone', fieldValue(f.parentPhone))}
    ${row('E-mail', fieldValue(f.parentEmail))}
    ${row('Adresse', fieldValue(f.address))}
  </table>

  <h2>Informations complémentaires</h2>
  <table>
    ${row('Message / motivation', fieldValue(f.motivation))}
  </table>

  <div class="signatures">
    <div class="sign-box">Date et signature du responsable légal</div>
    <div class="sign-box">Cachet et visa de l’administration (réservé)</div>
  </div>

  <p class="footer">* Champs obligatoires · Joindre les pièces demandées · Conservez une copie de ce document.
  Dépôt en ligne : ${escapeHtml(opts.onlineUrl)}</p>
  </body></html>`;
}

export function buildAdmissionRegistrationHtml(opts?: AdmissionFormExportOptions): string {
  return buildPrintHtml({
    schoolName: opts?.schoolName?.trim() || 'Établissement scolaire',
    academicYear: opts?.academicYear?.trim() || '___________',
    form: opts?.form,
    bulletinFileName: opts?.bulletinFileName,
    logoUrl: opts?.logoUrl ?? null,
    reference: opts?.reference?.trim(),
    onlineUrl: inscriptionOnlineUrl(opts?.schoolSlug),
  });
}

export function printAdmissionRegistrationForm(opts?: AdmissionFormExportOptions): void {
  printHtmlDocument(buildAdmissionRegistrationHtml(opts), 350);
}

/** Télécharge la fiche pré-remplie (fichier HTML ouvrable dans le navigateur / imprimable en PDF). */
export function downloadAdmissionRegistrationForm(opts: AdmissionFormExportOptions): void {
  if (typeof document === 'undefined') return;
  const html = buildAdmissionRegistrationHtml(opts);
  const ref = opts.reference?.trim().replace(/[^\w-]+/g, '_');
  const fileName = ref
    ? `pre-inscription-${ref}.html`
    : `pre-inscription-${opts.schoolSlug?.trim() || 'dossier'}.html`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
