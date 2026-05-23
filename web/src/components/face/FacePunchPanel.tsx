'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { faceApi, type FacePersonType } from '@/services/api/face.api';
import FaceCapture from './FaceCapture';
import Card from '../ui/Card';
import Badge from '../ui/Badge';

type FacePunchPanelProps = {
  /** Obligatoire pour le pointage élève */
  courseId?: string | null;
  date?: string;
  /** Limite la recherche à un type (sinon auto : élève / enseignant / personnel) */
  personType?: FacePersonType;
  notifyParentsOnSave?: boolean;
  onPunchSuccess?: () => void;
};

export default function FacePunchPanel({
  courseId,
  date,
  personType,
  notifyParentsOnSave = true,
  onPunchSuccess,
}: FacePunchPanelProps) {
  const [lastResult, setLastResult] = useState<{
    message: string;
    personType: string;
    punchPhase: string;
    displayName?: string;
  } | null>(null);

  const punchMut = useMutation({
    mutationFn: (descriptor: number[]) =>
      faceApi.punch({
        descriptor,
        courseId: courseId || undefined,
        date: date ? new Date(date).toISOString() : undefined,
        personType,
        notifyParentsOnSave,
      }),
    onSuccess: (data: {
      message?: string;
      personType?: string;
      punchPhase?: string;
      match?: { displayName?: string };
    }) => {
      setLastResult({
        message: data.message ?? 'Pointage enregistré',
        personType: data.personType ?? '',
        punchPhase: data.punchPhase ?? '',
        displayName: data.match?.displayName,
      });
      const phase = data.punchPhase;
      if (phase === 'CHECK_OUT') toast.success('Sortie enregistrée (reconnaissance faciale)');
      else if (phase === 'ALREADY_COMPLETE') toast('Pointage déjà complet', { icon: 'ℹ️' });
      else toast.success(data.message ?? 'Pointage enregistré');
      onPunchSuccess?.();
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e.response?.data?.error ?? 'Pointage impossible'),
  });

  const needsCourse = personType === 'STUDENT' || (!personType && courseId !== undefined);

  return (
    <Card className="p-4 border-2 border-violet-200 bg-violet-50/30">
      <div className="mb-3">
        <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
          Reconnaissance faciale
          <Badge variant="info">Caméra</Badge>
        </h3>
        <p className="text-sm text-stone-600 mt-1">
          {personType === 'STUDENT' || (needsCourse && courseId)
            ? '1er scan = entrée, 2e scan = sortie de cours.'
            : personType === 'STAFF'
              ? 'Pointage entrée / sortie du personnel administratif.'
              : 'Pointage enseignant (entrée / sortie selon l’emploi du temps).'}
        </p>
        {needsCourse && !courseId && (
          <p className="text-sm text-amber-800 mt-2 font-medium">
            Sélectionnez d’abord un cours pour le pointage des élèves.
          </p>
        )}
      </div>

      <FaceCapture
        label="Pointer avec le visage"
        disabled={punchMut.isPending || (needsCourse && !courseId)}
        onError={(msg) => toast.error(msg)}
        onDescriptor={(descriptor) => punchMut.mutate(descriptor)}
      />

      {lastResult && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-900">
          <p className="font-semibold">{lastResult.displayName ?? lastResult.message}</p>
          <p className="text-xs mt-0.5">
            {lastResult.personType} · {lastResult.punchPhase}
          </p>
        </div>
      )}
    </Card>
  );
}
