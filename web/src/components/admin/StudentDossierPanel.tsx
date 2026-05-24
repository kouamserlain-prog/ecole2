'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import toast from 'react-hot-toast';
import { FiLayers, FiShuffle, FiCreditCard, FiArchive, FiTrash2, FiPlus, FiDownload } from 'react-icons/fi';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import { downloadStudentEnrollmentDossier } from '@/lib/downloadStudentEnrollmentDossier';
import { useSchool } from '@/contexts/SchoolContext';
import { useSchoolReady, schoolQueryKey } from '@/hooks/useSchoolReady';

const TRANSFER_LABELS: Record<string, string> = {
  CLASS_CHANGE: 'Changement de classe',
  REENROLLMENT: 'Réinscription',
  MUTATION: 'Mutation',
  DEPARTURE: 'Départ (sans classe)',
};

type StudentDossierPanelProps = {
  studentId: string;
};

const StudentDossierPanel: React.FC<StudentDossierPanelProps> = ({ studentId }) => {
  const queryClient = useQueryClient();
  const { activeSchoolId } = useSchool();
  const schoolReady = useSchoolReady();
  const studentQueryKey = schoolQueryKey(['student', studentId], activeSchoolId);
  const [dossierDownloading, setDossierDownloading] = useState(false);
  const [historyForm, setHistoryForm] = useState({
    academicYear: '',
    className: '',
    classLevel: '',
    establishment: '',
    notes: '',
  });
  const [transferForm, setTransferForm] = useState({
    effectiveDate: new Date().toISOString().split('T')[0],
    transferType: 'CLASS_CHANGE' as 'CLASS_CHANGE' | 'REENROLLMENT' | 'MUTATION' | 'DEPARTURE',
    toClassId: '',
    reason: '',
  });

  const { data: classes } = useQuery({
    queryKey: schoolQueryKey(['classes'], activeSchoolId),
    queryFn: adminApi.getClasses,
    enabled: schoolReady,
  });

  const { data: digitalCard, refetch: refetchCard } = useQuery({
    queryKey: ['student-digital-card', studentId],
    queryFn: () => adminApi.getStudentDigitalCard(studentId),
    enabled: false,
  });

  const addHistoryMutation = useMutation({
    mutationFn: () =>
      adminApi.addStudentSchoolHistory(studentId, {
        academicYear: historyForm.academicYear.trim(),
        className: historyForm.className.trim() || undefined,
        classLevel: historyForm.classLevel.trim() || undefined,
        establishment: historyForm.establishment.trim() || undefined,
        notes: historyForm.notes.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentQueryKey });
      toast.success('Historique enregistré');
      setHistoryForm({
        academicYear: '',
        className: '',
        classLevel: '',
        establishment: '',
        notes: '',
      });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const deleteHistoryMutation = useMutation({
    mutationFn: (historyId: string) => adminApi.deleteStudentSchoolHistory(studentId, historyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentQueryKey });
      toast.success('Entrée supprimée');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const transferMutation = useMutation({
    mutationFn: () =>
      adminApi.recordStudentTransfer(studentId, {
        effectiveDate: new Date(transferForm.effectiveDate).toISOString(),
        transferType: transferForm.transferType,
        toClassId:
          transferForm.transferType === 'DEPARTURE' ? undefined : transferForm.toClassId || undefined,
        reason: transferForm.reason.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentQueryKey });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Mouvement enregistré');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const archiveMutation = useMutation({
    mutationFn: () => adminApi.archiveStudent(studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentQueryKey });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Dossier archivé');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Erreur'),
  });

  const { data: student } = useQuery({
    queryKey: studentQueryKey,
    queryFn: () => adminApi.getStudent(studentId),
    enabled: schoolReady && !!studentId,
  });

  const history = (student as any)?.schoolHistory as
    | Array<{
        id: string;
        academicYear: string;
        className?: string | null;
        classLevel?: string | null;
        establishment?: string | null;
        notes?: string | null;
        createdAt: string;
      }>
    | undefined;

  const transfers = (student as any)?.transfers as
    | Array<{
        id: string;
        effectiveDate: string;
        transferType: string;
        fromClassId?: string | null;
        toClassId?: string | null;
        reason?: string | null;
        createdAt: string;
      }>
    | undefined;

  return (
    <div className="space-y-4">
      <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-violet-50/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Dossier d&apos;inscription (PDF)</h3>
            <p className="text-sm text-gray-600 mt-1">
              Synthèse complète : identité, scolarité, responsables, vigilance médicale, pièces jointes et QR
              carte numérique.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={dossierDownloading}
            onClick={async () => {
              setDossierDownloading(true);
              try {
                await downloadStudentEnrollmentDossier(studentId);
                toast.success('Dossier PDF téléchargé');
              } catch (e: unknown) {
                const err = e as { response?: { data?: { error?: string } } };
                toast.error(err.response?.data?.error || 'Impossible de générer le dossier PDF');
              } finally {
                setDossierDownloading(false);
              }
            }}
            className="inline-flex items-center gap-2 shrink-0"
          >
            <FiDownload className="w-4 h-4" aria-hidden />
            {dossierDownloading ? 'Génération…' : 'Télécharger le dossier'}
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <FiCreditCard className="text-indigo-600" aria-hidden />
          Carte d&apos;étudiant numérique
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          QR et lien à présenter sur le terrain ; l&apos;identifiant dans l&apos;URL agit comme un jeton de
          possession.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => refetchCard()}>
            Générer / afficher le QR
          </Button>
          {digitalCard?.cardPageUrl && (
            <a
              href={digitalCard.cardPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 hover:bg-stone-50"
            >
              Ouvrir la carte publique
            </a>
          )}
        </div>
        {digitalCard?.qrDataUrl && (
          <div className="mt-4 flex flex-col sm:flex-row gap-4 items-start">
            <img src={digitalCard.qrDataUrl} alt="QR code carte étudiant" className="w-44 h-44 border rounded-lg" />
            <div className="text-xs text-gray-500 break-all max-w-md">{digitalCard.cardPageUrl}</div>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <FiLayers className="text-teal-600" aria-hidden />
          Historique scolaire
        </h3>
        {history && history.length > 0 ? (
          <ul className="space-y-2 mb-4 text-sm">
            {history.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap justify-between gap-2 border border-gray-100 rounded-lg p-2 bg-gray-50"
              >
                <div>
                  <span className="font-semibold text-gray-900">{h.academicYear}</span>
                  {h.establishment ? (
                    <span className="text-gray-600"> — {h.establishment}</span>
                  ) : null}
                  {h.className || h.classLevel ? (
                    <div className="text-gray-600 text-xs">
                      {[h.className, h.classLevel].filter(Boolean).join(' · ')}
                    </div>
                  ) : null}
                  {h.notes ? <p className="text-gray-600 text-xs mt-1 whitespace-pre-wrap">{h.notes}</p> : null}
                </div>
                <button
                  type="button"
                  className="text-red-600 p-1 hover:bg-red-50 rounded shrink-0"
                  title="Supprimer"
                  onClick={() => {
                    if (window.confirm('Supprimer cette entrée d’historique ?')) {
                      deleteHistoryMutation.mutate(h.id);
                    }
                  }}
                  aria-label="Supprimer l'entrée d'historique"
                >
                  <FiTrash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 mb-3">Aucune entrée pour le moment.</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <input
            className="border rounded px-2 py-1.5"
            placeholder="Année scolaire *"
            value={historyForm.academicYear}
            onChange={(e) => setHistoryForm((s) => ({ ...s, academicYear: e.target.value }))}
            aria-label="Année scolaire"
          />
          <input
            className="border rounded px-2 py-1.5"
            placeholder="Établissement"
            value={historyForm.establishment}
            onChange={(e) => setHistoryForm((s) => ({ ...s, establishment: e.target.value }))}
            aria-label="Établissement"
          />
          <input
            className="border rounded px-2 py-1.5"
            placeholder="Classe / section"
            value={historyForm.className}
            onChange={(e) => setHistoryForm((s) => ({ ...s, className: e.target.value }))}
            aria-label="Classe ou section"
          />
          <input
            className="border rounded px-2 py-1.5"
            placeholder="Niveau"
            value={historyForm.classLevel}
            onChange={(e) => setHistoryForm((s) => ({ ...s, classLevel: e.target.value }))}
            aria-label="Niveau"
          />
          <textarea
            className="border rounded px-2 py-1.5 md:col-span-2"
            rows={2}
            placeholder="Notes"
            value={historyForm.notes}
            onChange={(e) => setHistoryForm((s) => ({ ...s, notes: e.target.value }))}
            aria-label="Notes historique"
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="mt-2"
          disabled={!historyForm.academicYear.trim() || addHistoryMutation.isPending}
          onClick={() => addHistoryMutation.mutate()}
        >
          <FiPlus className="inline mr-1" aria-hidden />
          Ajouter à l&apos;historique
        </Button>
      </Card>

      <Card>
        <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
          <FiShuffle className="text-amber-700" aria-hidden />
          Transferts &amp; mutations
        </h3>
        {transfers && transfers.length > 0 ? (
          <ul className="space-y-2 mb-4 text-sm max-h-48 overflow-y-auto">
            {transfers.map((t) => (
              <li key={t.id} className="border border-gray-100 rounded-lg p-2 bg-stone-50">
                <div className="font-medium text-gray-900">
                  {TRANSFER_LABELS[t.transferType] || t.transferType}
                </div>
                <div className="text-xs text-gray-600">
                  {format(new Date(t.effectiveDate), 'd MMM yyyy', { locale: fr })}
                </div>
                {t.reason ? <p className="text-xs text-gray-600 mt-1">{t.reason}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 mb-3">Aucun mouvement enregistré.</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <label className="md:col-span-2">
            <span className="text-xs font-medium text-gray-700">Type</span>
            <select
              className="w-full border rounded px-2 py-1.5 mt-0.5"
              value={transferForm.transferType}
              onChange={(e) =>
                setTransferForm((s) => ({
                  ...s,
                  transferType: e.target.value as typeof s.transferType,
                }))
              }
            >
              <option value="CLASS_CHANGE">Changement de classe</option>
              <option value="MUTATION">Mutation</option>
              <option value="REENROLLMENT">Réinscription (réactive l&apos;inscription)</option>
              <option value="DEPARTURE">Départ (retirer de la classe)</option>
            </select>
          </label>
          <label>
            <span className="text-xs font-medium text-gray-700">Date effective</span>
            <input
              type="date"
              className="w-full border rounded px-2 py-1.5 mt-0.5"
              value={transferForm.effectiveDate}
              onChange={(e) => setTransferForm((s) => ({ ...s, effectiveDate: e.target.value }))}
            />
          </label>
          {transferForm.transferType !== 'DEPARTURE' ? (
            <label className="md:col-span-2">
              <span className="text-xs font-medium text-gray-700">Classe de destination</span>
              <select
                className="w-full border rounded px-2 py-1.5 mt-0.5"
                value={transferForm.toClassId}
                onChange={(e) => setTransferForm((s) => ({ ...s, toClassId: e.target.value }))}
              >
                <option value="">—</option>
                {(classes as any[] | undefined)?.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.level}) — {c.academicYear}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="md:col-span-2">
            <span className="text-xs font-medium text-gray-700">Motif (optionnel)</span>
            <input
              className="w-full border rounded px-2 py-1.5 mt-0.5"
              value={transferForm.reason}
              onChange={(e) => setTransferForm((s) => ({ ...s, reason: e.target.value }))}
              placeholder="Motif administratif"
            />
          </label>
        </div>
        <Button
          type="button"
          size="sm"
          className="mt-2"
          disabled={transferMutation.isPending}
          onClick={() => {
            if (transferForm.transferType !== 'DEPARTURE' && !transferForm.toClassId) {
              toast.error('Choisissez une classe de destination');
              return;
            }
            transferMutation.mutate();
          }}
        >
          Enregistrer le mouvement
        </Button>
      </Card>

      <Card className="border-red-100 bg-red-50/40">
        <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
          <FiArchive className="text-red-700" aria-hidden />
          Archive
        </h3>
        <p className="text-sm text-gray-600 mb-3">
          Marque le dossier comme archivé (ancien élève), désactive la fiche côté admin et fixe le statut
          d&apos;inscription sur « Archivé ».
        </p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="border-red-200 text-red-800 hover:bg-red-100"
          disabled={archiveMutation.isPending || (student as any)?.enrollmentStatus === 'ARCHIVED'}
          onClick={() => {
            if (
              window.confirm(
                'Archiver ce dossier élève ? Vous pourrez réactiver manuellement le statut depuis la modification de l’élève.'
              )
            ) {
              archiveMutation.mutate();
            }
          }}
        >
          Archiver le dossier
        </Button>
      </Card>
    </div>
  );
};

export default StudentDossierPanel;
