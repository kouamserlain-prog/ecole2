'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import fr from 'date-fns/locale/fr';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { FiBell, FiCheck, FiTrash2 } from 'react-icons/fi';
import { parentApi } from '@/services/api/parent.api';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

type ParentNotification = {
  id: string;
  type: string;
  title: string;
  content: string;
  link?: string | null;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
};

const TYPE_LABELS: Record<string, string> = {
  message: 'Message',
  announcement: 'Annonce',
  grade: 'Note',
  absence: 'Absence',
  attendance_alert: 'Présence',
  assignment: 'Devoir',
  payment: 'Paiement',
  appointment: 'Rendez-vous',
  bulletin: 'Bulletin',
  conduct: 'Conduite',
};

export default function ParentNotificationsPanel() {
  const router = useRouter();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const queryKey = ['parent-notifications'] as const;

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => parentApi.getNotifications() as Promise<ParentNotification[]>,
    staleTime: 20_000,
  });

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const displayed = useMemo(() => {
    const list = filter === 'unread' ? items.filter((n) => !n.read) : items;
    return list;
  }, [items, filter]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey });
    void qc.invalidateQueries({ queryKey: ['notifications', 'PARENT'] });
  };

  const markOne = useMutation({
    mutationFn: (id: string) => parentApi.markNotificationAsRead(id),
    onSuccess: invalidate,
    onError: () => toast.error('Impossible de marquer comme lu.'),
  });

  const markAll = useMutation({
    mutationFn: () => parentApi.markAllNotificationsAsRead(),
    onSuccess: () => {
      invalidate();
      toast.success('Toutes les notifications sont marquées comme lues.');
    },
    onError: () => toast.error('Impossible de tout marquer comme lu.'),
  });

  const removeOne = useMutation({
    mutationFn: (id: string) => parentApi.deleteNotification(id),
    onSuccess: () => {
      invalidate();
      toast.success('Notification supprimée.');
    },
    onError: () => toast.error('Impossible de supprimer.'),
  });

  const openNotification = (n: ParentNotification) => {
    if (!n.read) markOne.mutate(n.id);
    if (n.link) {
      router.push(n.link.startsWith('/') ? n.link : `/${n.link}`);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-stone-900">
              <FiBell className="h-5 w-5 text-amber-600" aria-hidden />
              Mes notifications
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              Paiements, notes, devoirs, présence, rendez-vous et messages de l&apos;école.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {unreadCount > 0 ? (
              <Badge variant="warning">{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</Badge>
            ) : (
              <Badge variant="success">À jour</Badge>
            )}
            {unreadCount > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={markAll.isPending}
                onClick={() => markAll.mutate()}
              >
                <FiCheck className="mr-1 h-3.5 w-3.5" />
                Tout marquer lu
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === 'all'
                ? 'bg-amber-100 text-amber-950 ring-1 ring-amber-200'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Toutes ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('unread')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === 'unread'
                ? 'bg-amber-100 text-amber-950 ring-1 ring-amber-200'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Non lues ({unreadCount})
          </button>
        </div>
      </Card>

      {isLoading ? (
        <Card className="p-8 text-center text-sm text-stone-500">Chargement…</Card>
      ) : displayed.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-stone-600">
            {filter === 'unread'
              ? 'Aucune notification non lue.'
              : 'Aucune notification pour le moment. Vous serez alerté ici pour les événements importants.'}
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {displayed.map((n) => (
            <li key={n.id}>
              <Card
                className={`p-4 transition ${!n.read ? 'border-amber-200/80 bg-amber-50/30' : ''}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => openNotification(n)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-stone-900">{n.title}</span>
                      {!n.read ? (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-stone-600 leading-relaxed">{n.content}</p>
                    <p className="mt-2 text-[11px] text-stone-400">
                      {TYPE_LABELS[n.type] ?? n.type}
                      {' · '}
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: fr })}
                      {' · '}
                      {format(new Date(n.createdAt), 'dd MMM yyyy HH:mm', { locale: fr })}
                    </p>
                  </button>
                  <div className="flex shrink-0 gap-1">
                    {!n.read ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={markOne.isPending}
                        onClick={() => markOne.mutate(n.id)}
                        aria-label="Marquer comme lu"
                      >
                        <FiCheck className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={removeOne.isPending}
                      onClick={() => removeOne.mutate(n.id)}
                      aria-label="Supprimer"
                    >
                      <FiTrash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
