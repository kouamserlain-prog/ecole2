import { useMemo, useState } from 'react';
import { DEFAULT_SCHEDULE_START } from '../../../lib/scheduleTimeSlots';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../../services/api';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import toast from 'react-hot-toast';
import { FiRefreshCw, FiTrash2 } from 'react-icons/fi';

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function defaultPeriod() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 14);
  return { from: from.toISOString(), to: to.toISOString() };
}

const MaterialRoomOccupancyPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const def = useMemo(() => defaultPeriod(), []);
  const [roomId, setRoomId] = useState('');
  const [fromIso, setFromIso] = useState(def.from.slice(0, 16));
  const [toIso, setToIso] = useState(def.to.slice(0, 16));
  const [academicYear, setAcademicYear] = useState('');
  const [slotForm, setSlotForm] = useState({
    dayOfWeek: 1,
    startTime: DEFAULT_SCHEDULE_START,
    endTime: '09:00',
    reason: '',
  });

  const { data: rooms } = useQuery({
    queryKey: ['material-rooms-occ'],
    queryFn: () => adminApi.getMaterialRooms({ isActive: 'true' }),
  });

  const occupancyQuery = useQuery({
    queryKey: ['material-room-occupancy', roomId, fromIso, toIso, academicYear],
    queryFn: () =>
      adminApi.getMaterialRoomOccupancy(roomId, {
        from: new Date(fromIso).toISOString(),
        to: new Date(toIso).toISOString(),
        ...(academicYear.trim() && { academicYear: academicYear.trim() }),
      }),
    enabled: Boolean(roomId),
  });

  const { data: slots } = useQuery({
    queryKey: ['material-room-unavail', roomId],
    queryFn: () => adminApi.getMaterialRoomUnavailableSlots({ roomKey: roomId }),
    enabled: Boolean(roomId),
  });

  const createSlotMutation = useMutation({
    mutationFn: () =>
      adminApi.createMaterialRoomUnavailableSlot({
        roomKey: roomId,
        dayOfWeek: Number(slotForm.dayOfWeek),
        startTime: slotForm.startTime,
        endTime: slotForm.endTime,
        reason: slotForm.reason.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-room-unavail'] });
      queryClient.invalidateQueries({ queryKey: ['material-room-occupancy'] });
      toast.success('Créneau d’indisponibilité ajouté');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const deleteSlotMutation = useMutation({
    mutationFn: adminApi.deleteMaterialRoomUnavailableSlot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-room-unavail'] });
      queryClient.invalidateQueries({ queryKey: ['material-room-occupancy'] });
      toast.success('Créneau supprimé');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erreur'),
  });

  const roomList = (rooms as any[]) ?? [];
  const occ = occupancyQuery.data as any;
  const slotList = (slots as any[]) ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Vue synthèse : réservations sur la période, indisponibilités récurrentes (nettoyage, fermeture), et cours dont le
        champ « salle » de l’emploi du temps correspond au nom, au code ou à l’identifiant de la salle matérielle.
      </p>

      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Salle *</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            >
              <option value="">— Choisir —</option>
              {roomList.map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.code ? ` (${r.code})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Du (local)</label>
            <input
              type="datetime-local"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={fromIso}
              onChange={(e) => setFromIso(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Au (local)</label>
            <input
              type="datetime-local"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={toIso}
              onChange={(e) => setToIso(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Année scolaire (filtre emploi du temps, optionnel)
          </label>
          <input
            className="w-full max-w-xs border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="ex. 2025-2026"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
          />
        </div>
        <Button type="button" onClick={() => occupancyQuery.refetch()} disabled={!roomId || occupancyQuery.isFetching}>
          <FiRefreshCw className={`w-4 h-4 mr-2 ${occupancyQuery.isFetching ? 'animate-spin' : ''}`} />
          Actualiser l’occupation
        </Button>
      </Card>

      {!roomId ? (
        <p className="text-sm text-gray-500">Sélectionnez une salle pour afficher les données.</p>
      ) : occupancyQuery.isLoading ? (
        <div className="p-6 text-center text-gray-500">Chargement…</div>
      ) : occupancyQuery.isError ? (
        <p className="text-sm text-rose-600">Impossible de charger l’occupation.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Réservations ({occ?.reservations?.length ?? 0})</h3>
            <ul className="text-xs text-gray-700 space-y-2 max-h-64 overflow-y-auto">
              {(occ?.reservations ?? []).length === 0 ? (
                <li className="text-gray-500">Aucune sur la période.</li>
              ) : (
                occ.reservations.map((r: any) => (
                  <li key={r.id} className="border-b border-gray-100 pb-2">
                    <span className="font-medium">{r.title}</span>
                    <br />
                    {new Date(r.startAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} —{' '}
                    {new Date(r.endAt).toLocaleString('fr-FR', { timeStyle: 'short' })}
                    <span className="text-gray-500"> · {r.status}</span>
                  </li>
                ))
              )}
            </ul>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Cours (emploi du temps) ({occ?.scheduleSlots?.length ?? 0})
            </h3>
            <ul className="text-xs text-gray-700 space-y-2 max-h-64 overflow-y-auto">
              {(occ?.scheduleSlots ?? []).length === 0 ? (
                <li className="text-gray-500">Aucune ligne trouvée pour cette salle.</li>
              ) : (
                occ.scheduleSlots.map((s: any) => (
                  <li key={s.id} className="border-b border-gray-100 pb-2">
                    {DAYS[s.dayOfWeek]} {s.startTime}–{s.endTime}: {s.courseName}{' '}
                    <span className="text-gray-500">({s.className})</span>
                  </li>
                ))
              )}
            </ul>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Indisponibilités récurrentes</h3>
            <p className="text-[11px] text-gray-500 mb-3">
              Enregistrées avec la clé <code className="bg-gray-100 px-1 rounded">{roomId}</code> (id de la salle).
            </p>
            <ul className="text-xs text-gray-700 space-y-2 max-h-40 overflow-y-auto mb-4">
              {slotList.length === 0 ? (
                <li className="text-gray-500">Aucun créneau.</li>
              ) : (
                slotList.map((s: any) => (
                  <li key={s.id} className="flex justify-between items-start gap-2 border-b border-gray-100 pb-2">
                    <span>
                      {DAYS[s.dayOfWeek]} {s.startTime}–{s.endTime}
                      {s.reason ? <span className="text-gray-500"> — {s.reason}</span> : null}
                    </span>
                    <button
                      type="button"
                      className="p-1 text-rose-600 hover:bg-rose-50 rounded shrink-0"
                      onClick={() => {
                        if (confirm('Supprimer ce créneau ?')) deleteSlotMutation.mutate(s.id);
                      }}
                    >
                      <FiTrash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))
              )}
            </ul>
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <p className="text-xs font-medium text-gray-700">Ajouter un créneau bloqué (hebdo)</p>
              <div className="grid grid-cols-3 gap-2">
                <select
                  className="border border-gray-200 rounded px-2 py-1 text-xs"
                  value={slotForm.dayOfWeek}
                  onChange={(e) => setSlotForm((f) => ({ ...f, dayOfWeek: Number(e.target.value) }))}
                >
                  {DAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
                <input
                  className="border border-gray-200 rounded px-2 py-1 text-xs"
                  value={slotForm.startTime}
                  onChange={(e) => setSlotForm((f) => ({ ...f, startTime: e.target.value }))}
                />
                <input
                  className="border border-gray-200 rounded px-2 py-1 text-xs"
                  value={slotForm.endTime}
                  onChange={(e) => setSlotForm((f) => ({ ...f, endTime: e.target.value }))}
                />
              </div>
              <input
                className="w-full border border-gray-200 rounded px-2 py-1 text-xs"
                placeholder="Motif (optionnel)"
                value={slotForm.reason}
                onChange={(e) => setSlotForm((f) => ({ ...f, reason: e.target.value }))}
              />
              <Button type="button" size="sm" onClick={() => createSlotMutation.mutate()} disabled={createSlotMutation.isPending}>
                Ajouter
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default MaterialRoomOccupancyPanel;
