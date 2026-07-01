'use client';

import { useState } from 'react';
import { FiDownload, FiFileText, FiPrinter, FiX } from 'react-icons/fi';
import {
  downloadStudentEnrollmentDossier,
  printStudentEnrollmentDossier,
  type EnrollmentDossierFetcher,
} from '@/lib/downloadStudentEnrollmentDossier';

export type EnrollmentDossierSuccessModalProps = {
  open: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  /** Par défaut : API admin */
  fetcher?: EnrollmentDossierFetcher;
};

export function EnrollmentDossierSuccessModal({
  open,
  onClose,
  studentId,
  studentName,
  fetcher,
}: EnrollmentDossierSuccessModalProps) {
  const [busy, setBusy] = useState<'download' | 'print' | null>(null);

  if (!open) return null;

  const handleDownload = async () => {
    setBusy('download');
    try {
      await downloadStudentEnrollmentDossier(studentId, fetcher);
    } catch (e) {
      console.error(e);
      alert('Impossible de générer le dossier PDF. Réessayez ou contactez l\'administrateur.');
    } finally {
      setBusy(null);
    }
  };

  const handlePrint = async () => {
    setBusy('print');
    try {
      await printStudentEnrollmentDossier(studentId, fetcher);
    } catch (e) {
      console.error(e);
      alert('Impossible d\'ouvrir le dossier pour impression.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl dark:bg-gray-900"
        role="dialog"
        aria-labelledby="enrollment-dossier-title"
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <FiFileText className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 id="enrollment-dossier-title" className="text-lg font-semibold text-gray-900 dark:text-white">
                Inscription définitive enregistrée
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Le dossier de <strong>{studentName}</strong> est prêt à être imprimé ou archivé.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
            aria-label="Fermer"
          >
            <FiX className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Téléchargez le dossier d&apos;inscription (PDF) pour le classeur administratif ou imprimez-le directement.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={busy !== null}
              onClick={handleDownload}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <FiDownload className="h-4 w-4" aria-hidden />
              {busy === 'download' ? 'Génération…' : 'Télécharger le dossier PDF'}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={handlePrint}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <FiPrinter className="h-4 w-4" aria-hidden />
              {busy === 'print' ? 'Ouverture…' : 'Imprimer'}
            </button>
          </div>
        </div>

        <div className="border-t border-gray-100 px-5 py-3 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
