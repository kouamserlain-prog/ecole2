'use client';

import {
  ADMISSION_GRADE_FIELD_LABELS,
  type AdmissionGradeFieldKey,
  formatAdmissionGrade,
  hasAnyAdmissionGrade,
} from '@/utils/admissionGrades';

type Props = {
  row: Partial<Record<AdmissionGradeFieldKey, number | null>> & {
    term3ReportCardUrl?: string | null;
    term3ReportCardOriginalName?: string | null;
  };
  className?: string;
};

export default function AdmissionGradesDisplay({ row, className = '' }: Props) {
  const hasBulletin = Boolean(row.term3ReportCardUrl);
  if (!hasAnyAdmissionGrade(row) && !hasBulletin) return null;

  const entries = (Object.keys(ADMISSION_GRADE_FIELD_LABELS) as AdmissionGradeFieldKey[]).filter(
    (k) => row[k] != null,
  );

  return (
    <div className={`rounded-xl border border-amber-200/80 bg-amber-50/50 p-3 space-y-2 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Résultats scolaires déclarés</p>
      {hasBulletin && (
        <p className="text-sm">
          <span className="text-stone-500">Bulletin du 3e trimestre : </span>
          <a
            href={row.term3ReportCardUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-amber-900 underline underline-offset-2 hover:text-stone-900"
          >
            {row.term3ReportCardOriginalName || 'Ouvrir le document'}
          </a>
        </p>
      )}
      {entries.length > 0 && (
        <dl className="grid sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {entries.map((key) => (
            <div key={key}>
              <dt className="text-stone-500 text-xs">{ADMISSION_GRADE_FIELD_LABELS[key]}</dt>
              <dd className="font-semibold text-stone-900 tabular-nums">{formatAdmissionGrade(row[key])} / 20</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
