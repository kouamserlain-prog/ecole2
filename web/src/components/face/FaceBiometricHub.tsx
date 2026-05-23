'use client';

import { useState } from 'react';
import FaceEnrollmentPanel from './FaceEnrollmentPanel';
import FacePunchPanel from './FacePunchPanel';
import Card from '../ui/Card';

type HubMode = 'punch' | 'enroll';

export default function FaceBiometricHub() {
  const [mode, setMode] = useState<HubMode>('punch');
  const [punchTarget, setPunchTarget] = useState<'auto' | 'STUDENT' | 'TEACHER' | 'STAFF'>('auto');

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            onClick={() => setMode('punch')}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              mode === 'punch' ? 'bg-violet-100 text-violet-900 ring-1 ring-violet-200' : 'bg-stone-100'
            }`}
          >
            Pointage par visage
          </button>
          <button
            type="button"
            onClick={() => setMode('enroll')}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              mode === 'enroll' ? 'bg-violet-100 text-violet-900 ring-1 ring-violet-200' : 'bg-stone-100'
            }`}
          >
            Enrôlement des visages
          </button>
        </div>
        <p className="text-sm text-stone-600">
          Enregistrez d’abord les visages (élèves, enseignants, personnel), puis utilisez la caméra au poste de
          pointage. Compatible avec les badges NFC et empreintes existants.
        </p>
      </Card>

      {mode === 'enroll' ? (
        <FaceEnrollmentPanel />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'auto', label: 'Détection automatique' },
                { id: 'STUDENT', label: 'Élèves uniquement' },
                { id: 'TEACHER', label: 'Enseignants' },
                { id: 'STAFF', label: 'Personnel admin.' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setPunchTarget(t.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  punchTarget === t.id
                    ? 'bg-indigo-100 text-indigo-900'
                    : 'bg-stone-100 text-stone-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <FacePunchPanel
            personType={punchTarget === 'auto' ? undefined : punchTarget}
          />
        </>
      )}
    </div>
  );
}
