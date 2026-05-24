'use client';

import { useQuery } from '@tanstack/react-query';
import { adminTuitionCatalogApi } from '@/services/api/admin-tuition-catalog.api';
import { getCurrentAcademicYear } from '@/utils/academicYear';
import { formatFCFA } from '@/utils/currency';
import { FiAlertCircle, FiBookOpen } from 'react-icons/fi';

type EnrollmentTuitionSummaryProps = {
  classId: string;
  academicYear?: string;
  classLabel?: string;
};

export default function EnrollmentTuitionSummary({
  classId,
  academicYear,
  classLabel,
}: EnrollmentTuitionSummaryProps) {
  const year = academicYear?.trim() || getCurrentAcademicYear();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['tuition-resolve-for-class', classId, year],
    queryFn: () => adminTuitionCatalogApi.resolveTuitionForClass(classId, year),
    enabled: !!classId,
    retry: false,
  });

  if (!classId) return null;

  if (isLoading) {
    return (
      <p className="text-xs text-stone-500 py-2">Calcul du montant de scolarité…</p>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-sm text-amber-950">
        <p className="font-medium flex items-center gap-2">
          <FiAlertCircle className="w-4 h-4 shrink-0" />
          Scolarité non définie
        </p>
        <p className="text-xs text-amber-900/90 mt-1">
          {classLabel ? (
            <>
              Classe : <strong>{classLabel}</strong> — configurez un montant par classe ou par niveau
              (Frais → scolarité).
            </>
          ) : (
            <>Configurez un montant fixe par classe ou par niveau dans le module Frais.</>
          )}
        </p>
      </div>
    );
  }

  const sourceLabel =
    data.source === 'BY_CLASS'
      ? 'barème spécifique à la classe'
      : `barème du niveau ${data.classLevel}`;

  return (
    <div className="rounded-lg border border-emerald-200 bg-gradient-to-br from-emerald-50/95 to-teal-50/80 px-3 py-2.5">
      <p className="text-xs font-semibold text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
        <FiBookOpen className="w-3.5 h-3.5" />
        Scolarité — année {year}
      </p>
      <p className="mt-1.5 text-sm text-stone-800">
        Classe : <strong>{data.className}</strong>
        {data.classLevel ? (
          <span className="text-stone-600"> ({data.classLevel})</span>
        ) : null}
      </p>
      <p className="mt-1 text-lg font-bold text-emerald-900 tabular-nums">
        {formatFCFA(data.amount)}
      </p>
      <p className="text-[11px] text-stone-600 mt-0.5">Montant fixe selon le {sourceLabel}.</p>
    </div>
  );
}
