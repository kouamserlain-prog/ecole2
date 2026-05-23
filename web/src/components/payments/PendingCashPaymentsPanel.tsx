'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import toast from 'react-hot-toast';
import { FiCheck, FiClock, FiX } from 'react-icons/fi';
import { adminApi } from '@/services/api/admin.api';
import { staffApi } from '@/services/api/staff.api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { formatFCFA } from '../../utils/currency';

type PendingRow = {
  id: string;
  amount: number;
  createdAt: string;
  paymentReference?: string | null;
  payer?: { firstName?: string; lastName?: string; role?: string };
  student?: {
    user?: { firstName?: string; lastName?: string };
    class?: { name?: string } | null;
  };
  tuitionFee?: { period?: string; academicYear?: string };
};

type PendingCashPaymentsPanelProps = {
  mode: 'admin' | 'staff';
  compact?: boolean;
};

export default function PendingCashPaymentsPanel({ mode, compact = false }: PendingCashPaymentsPanelProps) {
  const qc = useQueryClient();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const api = mode === 'admin' ? adminApi : staffApi;
  const queryKey = mode === 'admin' ? ['admin-pending-cash'] : ['staff-pending-cash'];

  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => api.listPendingCashPayments() as Promise<PendingRow[]>,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey });
    if (mode === 'admin') {
      qc.invalidateQueries({ queryKey: ['admin-payments-grouped'] });
      qc.invalidateQueries({ queryKey: ['admin-tuition-fees'] });
    } else {
      qc.invalidateQueries({ queryKey: ['admin-payments-grouped'] });
      qc.invalidateQueries({ queryKey: ['staff-treasury-summary'] });
      qc.invalidateQueries({ queryKey: ['staff-treasury-recent'] });
    }
  };

  const validateMut = useMutation({
    mutationFn: (paymentId: string) => api.validateCashPayment(paymentId),
    onSuccess: () => {
      toast.success('Paiement espèces validé');
      invalidate();
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e.response?.data?.error ?? 'Erreur'),
  });

  const rejectMut = useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason?: string }) =>
      api.rejectCashPayment(paymentId, reason),
    onSuccess: () => {
      toast.success('Déclaration refusée');
      setRejectId(null);
      setRejectReason('');
      invalidate();
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e.response?.data?.error ?? 'Erreur'),
  });

  return (
    <Card className={compact ? 'p-3 sm:p-4' : 'p-4'}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-stone-900">
            <FiClock className="h-4 w-4 text-amber-600" aria-hidden />
            Espèces en attente de validation
          </h3>
          <p className="mt-1 text-xs text-stone-600">
            Déclarations des parents et élèves à confirmer après encaissement physique par l&apos;économe.
          </p>
        </div>
        <Badge variant="warning">{rows.length} en attente</Badge>
      </div>

      {isLoading ? (
        <p className="text-sm text-stone-500">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-200 bg-stone-50 px-3 py-4 text-sm text-stone-500">
          Aucune déclaration espèces en attente.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-amber-100 bg-amber-50/40 p-3 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-stone-900">
                    {row.student?.user?.lastName} {row.student?.user?.firstName}
                    {row.student?.class?.name ? ` · ${row.student.class.name}` : ''}
                  </p>
                  <p className="text-xs text-stone-600">
                    {row.tuitionFee?.period} — {row.tuitionFee?.academicYear}
                  </p>
                  <p className="text-xs text-stone-500">
                    Déclaré par {row.payer?.firstName} {row.payer?.lastName}
                    {row.payer?.role ? ` (${row.payer.role === 'PARENT' ? 'parent' : 'élève'})` : ''}
                    {' · '}
                    {format(new Date(row.createdAt), 'dd MMM yyyy à HH:mm', { locale: fr })}
                  </p>
                  {row.paymentReference ? (
                    <p className="text-[10px] text-stone-400">Réf. {row.paymentReference}</p>
                  ) : null}
                </div>
                <p className="shrink-0 text-base font-bold text-amber-900">{formatFCFA(row.amount)}</p>
              </div>

              {rejectId === row.id ? (
                <div className="mt-3 space-y-2 border-t border-amber-100 pt-3">
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Motif du refus (optionnel)"
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                    aria-label="Motif du refus"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRejectId(null);
                        setRejectReason('');
                      }}
                    >
                      Annuler
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      disabled={rejectMut.isPending}
                      onClick={() => rejectMut.mutate({ paymentId: row.id, reason: rejectReason || undefined })}
                    >
                      Confirmer le refus
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-amber-100 pt-3">
                  <Button
                    type="button"
                    size="sm"
                    disabled={validateMut.isPending}
                    onClick={() => validateMut.mutate(row.id)}
                  >
                    <FiCheck className="mr-1 h-3.5 w-3.5" />
                    Valider l&apos;encaissement
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={rejectMut.isPending}
                    onClick={() => setRejectId(row.id)}
                  >
                    <FiX className="mr-1 h-3.5 w-3.5" />
                    Refuser
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
