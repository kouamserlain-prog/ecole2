'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import toast from 'react-hot-toast';
import { staffApi } from '@/services/api/staff.api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import AdmissionGradesDisplay from '../admission/AdmissionGradesDisplay';
import { admissionLevelRequiresGrades } from '@/utils/admissionGrades';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  UNDER_REVIEW: 'À l’étude',
  ACCEPTED: 'Accepté',
  REJECTED: 'Refusé',
  WAITLIST: 'Liste d’attente',
  ENROLLED: 'Inscrit',
};

export default function StaffAdmissionsPanel() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [proposedClassId, setProposedClassId] = useState('');

  const { data: stats } = useQuery({ queryKey: ['staff-admissions-stats'], queryFn: staffApi.getAdmissionsStats });
  const { data: classes = [] } = useQuery({
    queryKey: ['staff-admission-classes'],
    queryFn: staffApi.listAdmissionClasses,
  });
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['staff-admissions', statusFilter, q],
    queryFn: () => staffApi.listAdmissions({ status: statusFilter || undefined, q: q || undefined }),
  });

  const selected = (rows as { id: string }[]).find((r) => r.id === selectedId) as
    | {
        id: string;
        reference: string;
        firstName: string;
        lastName: string;
        email: string;
        phone?: string | null;
        status: string;
        desiredLevel: string;
        academicYear: string;
        adminNotes?: string | null;
        proposedClassId?: string | null;
        createdAt: string;
        proposedClass?: { name: string; level: string } | null;
        gradeTerm1?: number | null;
        gradeTerm2?: number | null;
        gradeAnnualGeneral?: number | null;
        gradeAnnualSpecific?: number | null;
        gradeAnnualLiterary?: number | null;
      }
    | undefined;

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
    onError: (e: Error) => toast.error(e.message),
  });

  const openRow = (row: typeof selected) => {
    if (!row) return;
    setSelectedId(row.id);
    setNotes(row.adminNotes ?? '');
    setNewStatus(row.status);
    setProposedClassId(row.proposedClassId ?? '');
  };

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
            {(rows as typeof selected[]).map((row) =>
              row ? (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => openRow(row)}
                    className={`w-full text-left px-2 py-3 hover:bg-stone-50 ${selectedId === row.id ? 'bg-sky-50' : ''}`}
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
                </li>
              ) : null,
            )}
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
          {admissionLevelRequiresGrades(selected.desiredLevel) && (
            <AdmissionGradesDisplay row={selected} />
          )}
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
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            Enregistrer
          </Button>
        </Card>
      )}
    </div>
  );
}
