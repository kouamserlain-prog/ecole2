'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import toast from 'react-hot-toast';
import { staffApi } from '@/services/api/staff.api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Modal from '../ui/Modal';
import AdmissionGradesDisplay from '../admission/AdmissionGradesDisplay';
import { FiKey } from 'react-icons/fi';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  UNDER_REVIEW: 'À l’étude',
  ACCEPTED: 'Accepté',
  REJECTED: 'Refusé',
  WAITLIST: 'Liste d’attente',
  ENROLLED: 'Inscrit',
};

type StaffAdmissionRow = {
  id: string;
  reference: string;
  firstName: string;
  lastName: string;
  matricule?: string | null;
  email: string;
  phone?: string | null;
  status: string;
  desiredLevel: string;
  academicYear: string;
  adminNotes?: string | null;
  proposedClassId?: string | null;
  createdAt: string;
  proposedClass?: { name: string; level: string } | null;
  enrolledStudentId?: string | null;
  gradeTerm1?: number | null;
  gradeTerm2?: number | null;
  gradeAnnualGeneral?: number | null;
  gradeAnnualSpecific?: number | null;
  gradeAnnualLiterary?: number | null;
};

export default function StaffAdmissionsPanel() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [proposedClassId, setProposedClassId] = useState('');
  const [enrollTarget, setEnrollTarget] = useState<StaffAdmissionRow | null>(null);
  const [enrollPassword, setEnrollPassword] = useState('');
  const [enrollStudentId, setEnrollStudentId] = useState('');
  const [enrollClassId, setEnrollClassId] = useState('');
  const [enrollStateAssignment, setEnrollStateAssignment] = useState<
    'STATE_ASSIGNED' | 'NOT_STATE_ASSIGNED'
  >('NOT_STATE_ASSIGNED');

  const { data: workspace } = useQuery({
    queryKey: ['staff-workspace'],
    queryFn: staffApi.getWorkspace,
  });
  const admissionsAllowed =
    (workspace as { visibleModules?: string[] } | undefined)?.visibleModules?.includes('admissions') ??
    false;

  const onAdmissionsForbidden = (e: unknown) => {
    const body = (e as { response?: { data?: { error?: string; code?: string } } })?.response?.data;
    toast.error(
      body?.error ||
        'Accès refusé au module admissions. Reconnectez-vous ou contactez l’administration.',
    );
  };

  const { data: stats, isError: statsError } = useQuery({
    queryKey: ['staff-admissions-stats'],
    queryFn: staffApi.getAdmissionsStats,
    enabled: admissionsAllowed,
    retry: false,
  });
  const { data: classes = [] } = useQuery({
    queryKey: ['staff-admission-classes'],
    queryFn: staffApi.listAdmissionClasses,
    enabled: admissionsAllowed,
    retry: false,
  });
  const { data: rows = [], isLoading, isError: listError } = useQuery({
    queryKey: ['staff-admissions', statusFilter, q],
    queryFn: () => staffApi.listAdmissions({ status: statusFilter || undefined, q: q || undefined }),
    enabled: admissionsAllowed,
    retry: false,
  });

  if (workspace && !admissionsAllowed) {
    return (
      <Card className="p-6 text-sm text-amber-900 bg-amber-50 border-amber-200">
        Le module <strong>Inscriptions &amp; admissions</strong> n’est pas activé pour votre compte. Si vous
        êtes secrétaire, économe ou directeur(trice) des études, demandez à l’administration de vérifier votre
        fiche personnel (catégorie Soutien + métier).
      </Card>
    );
  }

  useEffect(() => {
    if (!statsError && !listError) return;
    onAdmissionsForbidden(null);
  }, [statsError, listError]);

  const selected = (rows as StaffAdmissionRow[]).find((r) => r.id === selectedId);

  const saveMut = useMutation({
    mutationFn: () =>
      staffApi.updateAdmission(selectedId!, {
        status: newStatus || undefined,
        adminNotes: notes,
        proposedClassId: proposedClassId || null,
      }),
    onSuccess: () => {
      toast.success('Dossier mis à jour');
      void qc.invalidateQueries({ queryKey: ['staff-admissions'] });
      void qc.invalidateQueries({ queryKey: ['staff-admissions-stats'] });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Enregistrement impossible');
    },
  });

  const enrollMut = useMutation({
    mutationFn: () =>
      staffApi.enrollFromAdmission(enrollTarget!.id, {
        ...(enrollPassword.trim().length >= 6 ? { password: enrollPassword.trim() } : {}),
        stateAssignment: enrollStateAssignment,
        ...(enrollStudentId.trim() ? { studentId: enrollStudentId.trim() } : {}),
        ...(enrollClassId ? { classId: enrollClassId } : {}),
      }),
    onSuccess: (data: unknown) => {
      const sent = (data as { passwordSetupEmailSent?: boolean })?.passwordSetupEmailSent;
      toast.success(
        sent
          ? 'Élève inscrit. Un lien pour choisir le mot de passe a été envoyé par e-mail (48 h).'
          : 'Élève inscrit — dossier finalisé',
      );
      setEnrollTarget(null);
      setEnrollPassword('');
      setEnrollStudentId('');
      setEnrollClassId('');
      setEnrollStateAssignment('NOT_STATE_ASSIGNED');
      void qc.invalidateQueries({ queryKey: ['staff-admissions'] });
      void qc.invalidateQueries({ queryKey: ['staff-admissions-stats'] });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg || 'Inscription impossible');
    },
  });

  const openRow = (row: StaffAdmissionRow) => {
    if (!row) return;
    setSelectedId(row.id);
    setNotes(row.adminNotes ?? '');
    setNewStatus(row.status);
    setProposedClassId(row.proposedClassId ?? '');
  };

  const openEnroll = (row: StaffAdmissionRow) => {
    setEnrollTarget(row);
    setEnrollPassword('');
    setEnrollStudentId(row.matricule?.trim() ?? '');
    setEnrollClassId(row.proposedClassId ?? '');
    setEnrollStateAssignment('NOT_STATE_ASSIGNED');
  };

  const canEnroll = (row: StaffAdmissionRow) =>
    row.status === 'ACCEPTED' && !row.enrolledStudentId;

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'En attente', value: stats.pending },
            { label: 'À l’étude', value: stats.underReview },
            { label: 'Acceptés', value: stats.accepted },
            { label: 'Total', value: stats.total },
          ].map((s) => (
            <Card key={s.label} className="p-3 text-center">
              <p className="text-2xl font-bold text-stone-900">{s.value}</p>
              <p className="text-xs text-stone-500">{s.label}</p>
            </Card>
          ))}
        </div>
      )}

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <input
            className="flex-1 min-w-[200px] rounded-lg border px-3 py-2 text-sm"
            placeholder="Rechercher (nom, email, référence…)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filtrer par statut"
          >
            <option value="">Tous les statuts</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <p className="text-sm text-stone-500">Chargement…</p>
        ) : (
          <ul className="divide-y divide-stone-100 max-h-[360px] overflow-y-auto">
            {(rows as StaffAdmissionRow[]).map((row) => (
              <li key={row.id} className="flex items-stretch border-b border-stone-50 last:border-0">
                <button
                  type="button"
                  onClick={() => openRow(row)}
                  className={`flex-1 min-w-0 text-left px-2 py-3 hover:bg-stone-50 ${selectedId === row.id ? 'bg-sky-50' : ''}`}
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-medium text-sm">
                      {row.lastName} {row.firstName}
                    </span>
                    <Badge>{STATUS_LABELS[row.status] ?? row.status}</Badge>
                  </div>
                  <p className="text-xs text-stone-500 mt-1">
                    {row.reference} · {row.desiredLevel} · {format(new Date(row.createdAt), 'dd/MM/yyyy')}
                  </p>
                </button>
                {canEnroll(row) && (
                  <button
                    type="button"
                    onClick={() => openEnroll(row)}
                    className="shrink-0 self-center mr-2 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 ring-1 ring-emerald-200/80"
                  >
                    <FiKey className="w-3.5 h-3.5" aria-hidden />
                    Inscrire
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {selected && (
        <Card className="p-4 space-y-3">
          <h3 className="font-semibold">
            {selected.lastName} {selected.firstName}
          </h3>
          <p className="text-sm text-stone-600">
            {selected.email}
            {selected.phone ? ` · ${selected.phone}` : ''}
          </p>
          <p className="text-xs text-stone-500">
            Niveau souhaité : {selected.desiredLevel} — {selected.academicYear}
          </p>
          {selected.matricule ? (
            <p className="text-xs text-stone-600">
              Matricule : <span className="font-mono font-medium">{selected.matricule}</span>
            </p>
          ) : null}
          <AdmissionGradesDisplay row={selected} />
          <label className="block text-xs font-medium text-stone-700">
            Statut
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
            >
              {['PENDING', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'WAITLIST'].map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-stone-700">
            Classe proposée
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={proposedClassId}
              onChange={(e) => setProposedClassId(e.target.value)}
            >
              <option value="">— Non définie —</option>
              {(classes as { id: string; name: string; level: string }[]).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.level})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-stone-700">
            Notes internes
            <textarea
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              Enregistrer le dossier
            </Button>
            {canEnroll(selected) && (
              <Button
                type="button"
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => openEnroll(selected)}
              >
                <FiKey className="w-4 h-4" aria-hidden />
                Inscrire
              </Button>
            )}
            {selected.status === 'ENROLLED' || selected.enrolledStudentId ? (
              <p className="text-xs text-emerald-700 w-full">Dossier déjà inscrit — compte élève actif.</p>
            ) : null}
          </div>
        </Card>
      )}

      <Modal
        isOpen={!!enrollTarget}
        onClose={() => setEnrollTarget(null)}
        title="Inscrire l’élève"
        size="md"
      >
        {enrollTarget && (
          <form
            className="p-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              enrollMut.mutate();
            }}
          >
            <p className="text-sm text-stone-600">
              Un compte sera créé avec l’e-mail du dossier :{' '}
              <strong className="text-stone-900">{enrollTarget.email}</strong>
            </p>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Mot de passe initial <span className="text-stone-500 font-normal">(optionnel)</span>
              </label>
              <input
                type="password"
                minLength={6}
                value={enrollPassword}
                onChange={(e) => setEnrollPassword(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                autoComplete="new-password"
                placeholder="Laisser vide : lien par e-mail (48 h)"
              />
              <p className="text-xs text-stone-500 mt-1">
                Si vous ne renseignez rien, un e-mail est envoyé à l’adresse du dossier pour que l’élève
                choisisse son mot de passe.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Numéro élève (optionnel)
              </label>
              <input
                type="text"
                value={enrollStudentId}
                onChange={(e) => setEnrollStudentId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
                placeholder="Généré automatiquement si vide"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Classe</label>
              <select
                value={enrollClassId}
                onChange={(e) => setEnrollClassId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                aria-label="Classe de l’élève"
              >
                <option value="">— Selon dossier / à choisir —</option>
                {(classes as { id: string; name: string; level: string }[]).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.level})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Affectation État</label>
              <select
                value={enrollStateAssignment}
                onChange={(e) =>
                  setEnrollStateAssignment(
                    e.target.value === 'STATE_ASSIGNED' ? 'STATE_ASSIGNED' : 'NOT_STATE_ASSIGNED',
                  )
                }
                className="w-full border rounded-lg px-3 py-2 text-sm"
                aria-label="Affectation État"
              >
                <option value="STATE_ASSIGNED">Affecté de l&apos;État</option>
                <option value="NOT_STATE_ASSIGNED">Non affecté</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setEnrollTarget(null)}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={enrollMut.isPending}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                <FiKey className="w-4 h-4" aria-hidden />
                {enrollMut.isPending ? 'Inscription…' : 'Inscrire'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
