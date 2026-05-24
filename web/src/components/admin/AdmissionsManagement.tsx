'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import AdmissionGradesDisplay from '../admission/AdmissionGradesDisplay';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import toast from 'react-hot-toast';
import { ADM } from './adminModuleLayout';
import {
  FiUserPlus,
  FiFilter,
  FiRefreshCw,
  FiCheck,
  FiEdit3,
  FiKey,
  FiMail,
  FiPhone,
  FiCalendar,
  FiBook,
  FiDownload,
} from 'react-icons/fi';
import { downloadStudentEnrollmentDossier } from '@/lib/downloadStudentEnrollmentDossier';
import EnrollmentTuitionSummary from './EnrollmentTuitionSummary';
import { getCurrentAcademicYear } from '@/utils/academicYear';

type AdmissionStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WAITLIST'
  | 'ENROLLED';

const STATUS_LABEL: Record<AdmissionStatus, string> = {
  PENDING: 'En attente',
  UNDER_REVIEW: 'En examen',
  ACCEPTED: 'Accepté',
  REJECTED: 'Refusé',
  WAITLIST: "Liste d'attente",
  ENROLLED: 'Inscrit',
};

function statusVariant(s: AdmissionStatus): 'success' | 'warning' | 'danger' | 'info' | 'default' | 'secondary' {
  switch (s) {
    case 'ENROLLED':
    case 'ACCEPTED':
      return 'success';
    case 'REJECTED':
      return 'danger';
    case 'UNDER_REVIEW':
    case 'WAITLIST':
      return 'warning';
    case 'PENDING':
      return 'info';
    default:
      return 'default';
  }
}

const AdmissionsManagement = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selected, setSelected] = useState<any | null>(null);
  const [enrollTarget, setEnrollTarget] = useState<any | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState<AdmissionStatus>('PENDING');
  const [editClassId, setEditClassId] = useState<string>('');

  const [enrollPassword, setEnrollPassword] = useState('');
  const [enrollStudentId, setEnrollStudentId] = useState('');
  const [enrollClassId, setEnrollClassId] = useState('');
  const [enrollStateAssignment, setEnrollStateAssignment] = useState<
    'STATE_ASSIGNED' | 'NOT_STATE_ASSIGNED'
  >('NOT_STATE_ASSIGNED');

  const { data: admissions, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admissions', statusFilter],
    queryFn: () =>
      adminApi.getAdmissions({
        ...(statusFilter ? { status: statusFilter } : {}),
      }),
  });

  const { data: stats } = useQuery({
    queryKey: ['admission-stats'],
    queryFn: adminApi.getAdmissionStats,
  });

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: adminApi.getClasses,
  });

  const enrollSelectedClass = (classes as { id: string; name: string; level?: string; academicYear?: string }[] | undefined)?.find(
    (c) => c.id === enrollClassId
  );

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { status?: AdmissionStatus; adminNotes?: string; proposedClassId?: string | null };
    }) => adminApi.updateAdmission(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admissions'] });
      queryClient.invalidateQueries({ queryKey: ['admission-stats'] });
      toast.success('Dossier mis à jour');
      setSelected(null);
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.error || 'Mise à jour impossible');
    },
  });

  const enrollMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        password?: string;
        studentId?: string;
        classId?: string;
        stateAssignment?: 'STATE_ASSIGNED' | 'NOT_STATE_ASSIGNED';
      };
    }) => adminApi.enrollFromAdmission(id, payload),
    onSuccess: (data: unknown) => {
      queryClient.invalidateQueries({ queryKey: ['admissions'] });
      queryClient.invalidateQueries({ queryKey: ['admission-stats'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['admin-parents'] });
      const d = data as {
        passwordSetupEmailSent?: boolean;
        user?: { studentProfile?: { id?: string } };
        parentAccount?: {
          created?: boolean;
          linked?: boolean;
          parentSetupEmailSent?: boolean;
          skippedReason?: string;
        };
      };
      const sent = d?.passwordSetupEmailSent;
      const pa = d?.parentAccount;
      let msg = sent
        ? 'Compte élève créé. Un lien pour choisir le mot de passe a été envoyé à l’adresse du dossier (48 h).'
        : 'Compte élève créé et dossier marqué comme inscrit';
      if (pa?.created && pa.parentSetupEmailSent) {
        msg += ' Compte parent créé et invitation envoyée à l’e-mail du tuteur.';
      } else if (pa?.linked && !pa.created) {
        msg += ' Parent existant rattaché à l’élève.';
      } else if (pa?.skippedReason === 'parent_email_missing') {
        msg += ' Aucun e-mail parent sur le dossier — compte parent non créé.';
      } else if (pa?.skippedReason === 'same_email_as_student') {
        msg += ' E-mail parent identique à celui de l’élève — compte parent non créé.';
      } else if (pa?.skippedReason === 'email_used_by_other_role') {
        msg += ' E-mail parent déjà utilisé par un autre type de compte.';
      }
      toast.success(msg);
      const enrolledStudentDbId = d?.user?.studentProfile?.id;
      if (enrolledStudentDbId) {
        void downloadStudentEnrollmentDossier(enrolledStudentDbId).catch(() => {
          toast.error('Dossier PDF : échec du téléchargement automatique. Téléchargez-le depuis la fiche élève.');
        });
      }
      setEnrollTarget(null);
      setEnrollPassword('');
      setEnrollStudentId('');
      setEnrollClassId('');
      setEnrollStateAssignment('NOT_STATE_ASSIGNED');
    },
    onError: (e: any) => {
      toast.error(e.response?.data?.error || "Inscription impossible");
    },
  });

  const openEdit = (row: any) => {
    setSelected(row);
    setEditStatus(row.status);
    setEditNotes(row.adminNotes || '');
    setEditClassId(row.proposedClassId || '');
  };

  const openEnroll = (row: any) => {
    setEnrollTarget(row);
    setEnrollPassword('');
    setEnrollStudentId('');
    setEnrollClassId(row.proposedClassId || '');
    setEnrollStateAssignment('NOT_STATE_ASSIGNED');
  };

  const submitEdit = () => {
    if (!selected) return;
    updateMutation.mutate({
      id: selected.id,
      payload: {
        status: editStatus,
        adminNotes: editNotes,
        proposedClassId: editClassId || null,
      },
    });
  };

  const submitEnroll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollTarget) return;
    enrollMutation.mutate({
      id: enrollTarget.id,
      payload: {
        ...(enrollPassword.trim().length >= 6 ? { password: enrollPassword.trim() } : {}),
        stateAssignment: enrollStateAssignment,
        ...(enrollStudentId.trim() ? { studentId: enrollStudentId.trim() } : {}),
        ...(enrollClassId ? { classId: enrollClassId } : {}),
      },
    });
  };

  return (
    <div className={ADM.root}>
      <Card className="bg-gradient-to-r from-indigo-600 to-violet-700 text-white border-0 shadow-lg p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-white/15 shrink-0">
              <FiUserPlus className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold leading-tight">Inscriptions & admissions</h2>
              <p className="text-indigo-100/95 text-xs mt-1 max-w-xl leading-relaxed">
                Traitez les pré-inscriptions en ligne, proposez une classe, acceptez le dossier puis créez le compte
                élève lorsque l’admission est finalisée.
              </p>
            </div>
          </div>
          {stats && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-white/10">
                En attente: <strong>{stats.pending}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/10">
                Examen: <strong>{stats.underReview}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/10">
                Acceptés: <strong>{stats.accepted}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/10">
                Total: <strong>{stats.total}</strong>
              </span>
            </div>
          )}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-gray-600 text-xs">
          <FiFilter className="w-3.5 h-3.5 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white"
          >
            <option value="">Tous les statuts</option>
            {(Object.keys(STATUS_LABEL) as AdmissionStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 text-xs"
        >
          <FiRefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <p className="text-gray-500 py-8 text-center">Chargement des dossiers…</p>
        ) : !admissions?.length ? (
          <p className="text-gray-500 py-8 text-center">Aucune demande pour ce filtre.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-3 pr-4 font-medium">Réf.</th>
                  <th className="py-3 pr-4 font-medium">Candidat</th>
                  <th className="py-3 pr-4 font-medium">Niveau / année</th>
                  <th className="py-3 pr-4 font-medium">Statut</th>
                  <th className="py-3 pr-4 font-medium">Date</th>
                  <th className="py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {admissions.map((a: any) => (
                  <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                    <td className="py-3 pr-4 font-mono text-xs">{a.reference}</td>
                    <td className="py-3 pr-4">
                      <div className="font-medium text-gray-900">
                        {a.firstName} {a.lastName}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <FiMail className="w-3 h-3" />
                        {a.email}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div>{a.desiredLevel}</div>
                      <div className="text-xs text-gray-500">{a.academicYear}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant={statusVariant(a.status)} size="sm">
                        {STATUS_LABEL[a.status as AdmissionStatus]}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">
                      {format(new Date(a.createdAt), 'dd MMM yyyy', { locale: fr })}
                    </td>
                    <td className="py-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEdit(a)}
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        <FiEdit3 className="w-4 h-4" />
                        Traiter
                      </button>
                      {a.status === 'ACCEPTED' && !a.enrolledStudentId && (
                        <button
                          type="button"
                          onClick={() => openEnroll(a)}
                          className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-800 font-medium ml-2"
                        >
                          <FiKey className="w-4 h-4" />
                          Inscrire
                        </button>
                      )}
                      {a.enrolledStudentId && (
                        <button
                          type="button"
                          onClick={() => {
                            void downloadStudentEnrollmentDossier(a.enrolledStudentId).then(() =>
                              toast.success('Dossier PDF téléchargé'),
                            ).catch(() =>
                              toast.error('Impossible de télécharger le dossier PDF'),
                            );
                          }}
                          className="inline-flex items-center gap-1 text-violet-600 hover:text-violet-800 font-medium ml-2"
                        >
                          <FiDownload className="w-4 h-4" />
                          Dossier PDF
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title="Traiter le dossier"
        size="lg"
      >
        {selected && (
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <p>
                <span className="text-gray-500">Référence</span>
                <br />
                <span className="font-mono font-semibold">{selected.reference}</span>
              </p>
              <p>
                <span className="text-gray-500">Statut</span>
                <br />
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as AdmissionStatus)}
                  disabled={selected.status === 'ENROLLED'}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                >
                  {(Object.keys(STATUS_LABEL) as AdmissionStatus[])
                    .filter((s) => s !== 'ENROLLED' || selected.status === 'ENROLLED')
                    .map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                </select>
              </p>
            </div>

            <div className="border rounded-xl p-4 bg-gray-50 space-y-2 text-sm">
              <p className="flex items-center gap-2">
                <FiCalendar className="w-4 h-4 text-gray-400" />
                Né(e) le{' '}
                {format(new Date(selected.dateOfBirth), 'dd/MM/yyyy', { locale: fr })} — {selected.gender}
              </p>
              <p className="flex items-center gap-2">
                <FiPhone className="w-4 h-4 text-gray-400" />
                {selected.phone || '—'}
              </p>
              <p className="flex items-center gap-2">
                <FiBook className="w-4 h-4 text-gray-400" />
                Niveau souhaité : {selected.desiredLevel} ({selected.academicYear})
              </p>
              {selected.matricule && (
                <p>
                  <span className="text-gray-500">Matricule déclaré :</span>{' '}
                  <span className="font-mono font-medium">{selected.matricule}</span>
                </p>
              )}
              {selected.previousSchool && (
                <p>
                  <span className="text-gray-500">Établissement précédent :</span> {selected.previousSchool}
                </p>
              )}
              {(selected.parentName || selected.parentPhone) && (
                <p>
                  Responsable : {selected.parentName || '—'} — {selected.parentPhone || '—'}{' '}
                  {selected.parentEmail && <span className="text-gray-600">({selected.parentEmail})</span>}
                </p>
              )}
              {selected.address && <p>Adresse : {selected.address}</p>}
              {selected.motivation && (
                <p className="italic text-gray-700 border-l-2 border-indigo-300 pl-3">
                  {selected.motivation}
                </p>
              )}
              <AdmissionGradesDisplay row={selected} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Classe proposée</label>
              <select
                value={editClassId}
                onChange={(e) => setEditClassId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">— Non définie —</option>
                {(classes || []).map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.level}) — {c.academicYear}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes internes</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Commentaires visibles uniquement par l’administration"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setSelected(null)}>
                Annuler
              </Button>
              <Button
                type="button"
                onClick={submitEdit}
                disabled={updateMutation.isPending || selected.status === 'ENROLLED'}
                className="inline-flex items-center gap-2"
              >
                <FiCheck className="w-4 h-4" />
                Enregistrer
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!enrollTarget}
        onClose={() => setEnrollTarget(null)}
        title="Finaliser l’inscription (compte élève)"
        size="md"
      >
        {enrollTarget && (
          <form onSubmit={submitEnroll} className="p-6 space-y-4">
            <p className="text-sm text-gray-600">
              Un compte sera créé avec l’email du dossier :{' '}
              <strong className="text-gray-900">{enrollTarget.email}</strong>
            </p>
            {enrollTarget.parentEmail ? (
              <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                E-mail parent / tuteur : <strong>{enrollTarget.parentEmail}</strong> — un compte parent sera
                créé (ou rattaché) automatiquement, avec invitation mot de passe si besoin.
              </p>
            ) : (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Aucun e-mail parent sur ce dossier : seul le compte élève sera créé. Le nom et le téléphone du
                tuteur restent en contacts d’urgence sur la fiche élève.
              </p>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe initial <span className="text-gray-500 font-normal">(optionnel)</span>
              </label>
              <input
                type="password"
                minLength={6}
                value={enrollPassword}
                onChange={(e) => setEnrollPassword(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                autoComplete="new-password"
                placeholder="Laisser vide : l’élève reçoit un lien par e-mail (48 h)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Si vous ne renseignez rien, un e-mail est envoyé à l’adresse du dossier pour que l’élève choisisse son mot de passe.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Numéro élève (optionnel)</label>
              <input
                type="text"
                value={enrollStudentId}
                onChange={(e) => setEnrollStudentId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
                placeholder="Généré automatiquement si vide"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Classe</label>
              <select
                value={enrollClassId}
                onChange={(e) => setEnrollClassId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">— Selon dossier / à choisir —</option>
                {(classes || []).map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.level})
                  </option>
                ))}
              </select>
            </div>
            {enrollClassId ? (
              <EnrollmentTuitionSummary
                classId={enrollClassId}
                academicYear={enrollSelectedClass?.academicYear?.trim() || getCurrentAcademicYear()}
                classLabel={
                  enrollSelectedClass
                    ? `${enrollSelectedClass.name}${enrollSelectedClass.level ? ` (${enrollSelectedClass.level})` : ''}`
                    : undefined
                }
              />
            ) : null}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Affectation État</label>
              <select
                value={enrollStateAssignment}
                onChange={(e) =>
                  setEnrollStateAssignment(
                    e.target.value === 'STATE_ASSIGNED' ? 'STATE_ASSIGNED' : 'NOT_STATE_ASSIGNED'
                  )
                }
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="STATE_ASSIGNED">Affecté de l&apos;État</option>
                <option value="NOT_STATE_ASSIGNED">Non affecté</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setEnrollTarget(null)}>
                Annuler
              </Button>
              <Button type="submit" disabled={enrollMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                Créer le compte élève
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default AdmissionsManagement;
