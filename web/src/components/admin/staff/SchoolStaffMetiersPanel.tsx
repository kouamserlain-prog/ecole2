'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/services/api';
import { useSchool } from '@/contexts/SchoolContext';
import { useSchoolReady, schoolQueryKey } from '@/hooks/useSchoolReady';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import {
  STAFF_MODULE_DESCRIPTIONS,
  getAllConfigurableStaffModules,
  type StaffModuleId,
} from '@/lib/staffModules';
import toast from 'react-hot-toast';
import { FiBriefcase, FiRefreshCw, FiSave } from 'react-icons/fi';

type MetierRow = {
  id: string;
  supportKind: string;
  label: string;
  description: string | null;
  defaultModules: string[];
  isActive: boolean;
};

export default function SchoolStaffMetiersPanel() {
  const { activeSchool, activeSchoolId } = useSchool();
  const schoolReady = useSchoolReady();
  const qc = useQueryClient();
  const [editingKind, setEditingKind] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftModules, setDraftModules] = useState<StaffModuleId[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: schoolQueryKey(['school-staff-metiers'], activeSchoolId),
    queryFn: () => adminApi.getSchoolStaffMetiers(),
    enabled: schoolReady,
  });

  const metiers = (data?.metiers ?? []) as MetierRow[];
  const moduleLabels = (data?.moduleLabels ?? {}) as Record<string, string>;

  const saveMut = useMutation({
    mutationFn: async (row: MetierRow) => {
      return adminApi.updateSchoolStaffMetier(row.supportKind, {
        label: draftLabel.trim() || null,
        defaultModules: draftModules,
        isActive: row.isActive,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: schoolQueryKey(['school-staff-metiers'], activeSchoolId) });
      toast.success('Métier enregistré pour cet établissement');
      setEditingKind(null);
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error ?? 'Erreur');
    },
  });

  const toggleActiveMut = useMutation({
    mutationFn: ({ supportKind, isActive }: { supportKind: string; isActive: boolean }) =>
      adminApi.updateSchoolStaffMetier(supportKind, { isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: schoolQueryKey(['school-staff-metiers'], activeSchoolId) });
    },
    onError: () => toast.error('Impossible de modifier le statut'),
  });

  const seedMut = useMutation({
    mutationFn: () => adminApi.seedSchoolStaffMetiersDefaults(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: schoolQueryKey(['school-staff-metiers'], activeSchoolId) });
      toast.success('Métiers réinitialisés aux défauts plateforme');
    },
    onError: () => toast.error('Erreur'),
  });

  const activeCount = useMemo(() => metiers.filter((m) => m.isActive).length, [metiers]);

  const startEdit = (row: MetierRow) => {
    setEditingKind(row.supportKind);
    setDraftLabel(row.label);
    setDraftModules(row.defaultModules as StaffModuleId[]);
  };

  if (!schoolReady) {
    return <p className="text-sm text-stone-500">Sélectionnez un établissement pour configurer les métiers.</p>;
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 border-indigo-100 bg-indigo-50/40">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <FiBriefcase className="text-indigo-700" />
              Métiers — {activeSchool?.name ?? 'établissement actif'}
            </h3>
            <p className="text-xs text-stone-600 mt-1 max-w-2xl leading-relaxed">
              Chaque établissement définit ses propres métiers (modules par défaut, libellés, activation).
              Les comptes <strong>administrateur</strong> et <strong>super-admin</strong> restent{' '}
              <strong>globaux</strong> (espaces &amp; modules admin, pas liés à un collège).
            </p>
            <p className="text-[11px] text-stone-500 mt-2">
              {activeCount} métier(s) actif(s) sur {metiers.length} pour le personnel de soutien STAFF.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => seedMut.mutate()}
            disabled={seedMut.isPending}
          >
            <FiRefreshCw className="w-3.5 h-3.5 mr-1 inline" />
            Réinitialiser défauts
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <p className="text-sm text-stone-500">Chargement…</p>
      ) : (
        <div className="grid gap-3">
          {metiers.map((row) => {
            const editing = editingKind === row.supportKind;
            return (
              <Card key={row.id} className={`p-3 ${!row.isActive ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-stone-900">{row.label}</p>
                    <p className="text-[10px] font-mono text-stone-500">{row.supportKind}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-stone-600">
                      <input
                        type="checkbox"
                        checked={row.isActive}
                        onChange={(e) =>
                          toggleActiveMut.mutate({
                            supportKind: row.supportKind,
                            isActive: e.target.checked,
                          })
                        }
                      />
                      Actif
                    </label>
                    {!editing ? (
                      <Button type="button" size="sm" variant="secondary" onClick={() => startEdit(row)}>
                        Configurer
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {row.defaultModules.slice(0, 8).map((id) => (
                    <Badge key={id} variant="secondary" className="text-[10px]">
                      {moduleLabels[id] ?? id}
                    </Badge>
                  ))}
                  {row.defaultModules.length > 8 ? (
                    <Badge variant="secondary" className="text-[10px]">
                      +{row.defaultModules.length - 8}
                    </Badge>
                  ) : null}
                </div>

                {editing ? (
                  <div className="mt-3 pt-3 border-t border-stone-200 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-stone-700">Libellé affiché</label>
                      <input
                        className="w-full border rounded-lg px-2 py-1.5 mt-0.5 text-sm"
                        value={draftLabel}
                        onChange={(e) => setDraftLabel(e.target.value)}
                      />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-stone-800 mb-2">Modules par défaut</p>
                      <div className="grid sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                        {getAllConfigurableStaffModules().map((id) => (
                          <label
                            key={id}
                            className="flex items-start gap-2 text-[11px] p-1.5 rounded-lg hover:bg-stone-50"
                          >
                            <input
                              type="checkbox"
                              checked={draftModules.includes(id)}
                              onChange={() => {
                                const set = new Set(draftModules);
                                if (set.has(id)) set.delete(id);
                                else set.add(id);
                                set.add('overview');
                                setDraftModules([...set] as StaffModuleId[]);
                              }}
                            />
                            <span>
                              <span className="font-medium">{moduleLabels[id] ?? id}</span>
                              {STAFF_MODULE_DESCRIPTIONS[id] ? (
                                <span className="block text-stone-500">{STAFF_MODULE_DESCRIPTIONS[id]}</span>
                              ) : null}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => saveMut.mutate(row)}
                        disabled={saveMut.isPending}
                      >
                        <FiSave className="w-3.5 h-3.5 mr-1 inline" />
                        Enregistrer
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => setEditingKind(null)}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
