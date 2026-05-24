'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { educatorApi } from '../../services/api';
import Card from '../ui/Card';
import ScheduleWeeklyGrid, { type ScheduleGridSlot } from '../schedule/ScheduleWeeklyGrid';
import { FiAlertCircle, FiCalendar, FiClock, FiList, FiMapPin } from 'react-icons/fi';

type EducatorScheduleSlot = ScheduleGridSlot & {
  classId: string;
  className: string;
  classLevel?: string;
  courseCode?: string;
  dayLabel?: string;
  substituteTeacher?: { firstName?: string; lastName?: string } | null;
};

const EducatorScheduleTab = () => {
  const [classFilter, setClassFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { data: profile } = useQuery({
    queryKey: ['educator-profile'],
    queryFn: educatorApi.getProfile,
  });

  const { data: classes } = useQuery({
    queryKey: ['educator-classes'],
    queryFn: educatorApi.getClasses,
  });

  const { data: teachers } = useQuery({
    queryKey: ['educator-teachers'],
    queryFn: educatorApi.getTeachers,
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['educator-schedules', classFilter, teacherFilter],
    queryFn: () =>
      educatorApi.getSchedules({
        ...(classFilter ? { classId: classFilter } : {}),
        ...(teacherFilter ? { teacherId: teacherFilter } : {}),
      }),
  });

  const slots = useMemo(() => {
    const raw = data as { slots?: EducatorScheduleSlot[] } | EducatorScheduleSlot[] | undefined;
    if (!raw) return [] as EducatorScheduleSlot[];
    if (Array.isArray(raw)) return raw;
    return raw.slots ?? [];
  }, [data]);

  const slotsByClass = useMemo(() => {
    const map = new Map<string, { label: string; slots: EducatorScheduleSlot[] }>();
    for (const slot of slots) {
      const key = slot.classId || slot.className || 'unknown';
      const existing = map.get(key);
      if (existing) {
        existing.slots.push(slot);
      } else {
        map.set(key, {
          label: slot.classLevel ? `${slot.className} — ${slot.classLevel}` : slot.className,
          slots: [slot],
        });
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [slots]);

  const assignedClasses = (profile as { assignedClasses?: unknown[] } | undefined)?.assignedClasses;
  const hasNoClassAssignment =
    Array.isArray(assignedClasses) && assignedClasses.length === 0;

  const renderListTable = (list: EducatorScheduleSlot[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-stone-50 border-b border-stone-200 text-left">
            <th className="py-3 px-4 font-semibold text-stone-700">Jour</th>
            <th className="py-3 px-4 font-semibold text-stone-700">Horaire</th>
            <th className="py-3 px-4 font-semibold text-stone-700">Matière</th>
            {!classFilter ? (
              <th className="py-3 px-4 font-semibold text-stone-700">Classe</th>
            ) : null}
            <th className="py-3 px-4 font-semibold text-stone-700">Enseignant</th>
            <th className="py-3 px-4 font-semibold text-stone-700">Salle</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {list.map((s) => (
            <tr key={s.id} className="hover:bg-violet-50/40">
              <td className="py-3 px-4 font-medium">{s.dayLabel ?? `J${s.dayOfWeek}`}</td>
              <td className="py-3 px-4">
                <span className="inline-flex items-center gap-1">
                  <FiClock className="w-4 h-4 text-violet-600 shrink-0" />
                  {s.startTime} – {s.endTime}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className="font-medium">{s.courseName}</span>
                {s.courseCode ? (
                  <span className="text-xs text-stone-500 ml-1 font-mono">{s.courseCode}</span>
                ) : null}
              </td>
              {!classFilter ? (
                <td className="py-3 px-4 text-stone-700">{s.className}</td>
              ) : null}
              <td className="py-3 px-4 text-stone-700">
                {s.substituteTeacher
                  ? `${s.substituteTeacher.firstName ?? ''} ${s.substituteTeacher.lastName ?? ''} (rempl.)`.trim()
                  : s.teacherName ?? '—'}
              </td>
              <td className="py-3 px-4 text-stone-600">
                {s.room ? (
                  <span className="inline-flex items-center gap-1">
                    <FiMapPin className="w-3.5 h-3.5" />
                    {s.room}
                  </span>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card className="p-4 border border-violet-100 bg-gradient-to-br from-white via-violet-50/30 to-indigo-50/20">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-stone-900">Emplois du temps</h2>
            <p className="text-sm text-stone-600 mt-1">
              Plannings des classes qui vous sont assignées, par classe ou par enseignant.
            </p>
          </div>
          <div className="flex rounded-lg border border-stone-200 bg-white p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                viewMode === 'grid'
                  ? 'bg-violet-600 text-white'
                  : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              <FiCalendar className="w-3.5 h-3.5" />
              Grille
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-violet-600 text-white'
                  : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              <FiList className="w-3.5 h-3.5" />
              Liste
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <select
            className="border border-stone-200 rounded-lg px-3 py-2 text-sm flex-1"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            aria-label="Filtrer par classe"
          >
            <option value="">Toutes les classes</option>
            {((classes as { id: string; name: string; level?: string }[]) ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.level}
              </option>
            ))}
          </select>
          <select
            className="border border-stone-200 rounded-lg px-3 py-2 text-sm flex-1"
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
            aria-label="Filtrer par enseignant"
          >
            <option value="">Tous les enseignants</option>
            {((teachers as { id: string; user?: { firstName?: string; lastName?: string } }[]) ?? []).map(
              (t) => (
                <option key={t.id} value={t.id}>
                  {t.user?.firstName} {t.user?.lastName}
                </option>
              )
            )}
          </select>
        </div>
      </Card>

      {hasNoClassAssignment ? (
        <Card className="p-4 border-amber-200 bg-amber-50/90">
          <p className="text-sm font-medium text-amber-950 flex items-center gap-2">
            <FiAlertCircle className="w-4 h-4 shrink-0" />
            Aucune classe assignée
          </p>
          <p className="text-sm text-amber-900/90 mt-1">
            Demandez à l&apos;administration de vous attribuer des classes pour consulter les emplois du temps.
          </p>
        </Card>
      ) : null}

      {isLoading ? (
        <Card>
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600" />
            <p className="mt-3 text-stone-600 text-sm">Chargement de l&apos;emploi du temps…</p>
          </div>
        </Card>
      ) : isError ? (
        <Card className="p-8 text-center">
          <FiAlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="font-medium text-stone-800">Impossible de charger l&apos;emploi du temps</p>
          <p className="text-sm text-stone-600 mt-1">
            {(error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
              'Erreur réseau ou serveur'}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 text-sm font-semibold text-violet-700 hover:text-violet-900"
          >
            Réessayer
          </button>
        </Card>
      ) : slots.length === 0 ? (
        <Card className="p-10 text-center text-stone-500">
          <FiCalendar className="w-14 h-14 mx-auto mb-3 text-stone-300" />
          <p className="font-medium text-stone-800">Aucun créneau planifié</p>
          <p className="text-sm mt-2 max-w-md mx-auto">
            Les emplois du temps sont créés par l&apos;administration (module Scolarité → Emplois du temps).
            Vérifiez qu&apos;une grille a bien été générée pour vos classes.
          </p>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="space-y-4">
          {classFilter || slotsByClass.length <= 1 ? (
            <Card className="p-4">
              <ScheduleWeeklyGrid
                slots={slots}
                title={classFilter ? slotsByClass[0]?.label : undefined}
              />
            </Card>
          ) : (
            slotsByClass.map((group) => (
              <Card key={group.label} className="p-4">
                <ScheduleWeeklyGrid slots={group.slots} title={group.label} />
              </Card>
            ))
          )}
        </div>
      ) : (
        <Card className="overflow-hidden">
          {classFilter || slotsByClass.length <= 1
            ? renderListTable(slots)
            : slotsByClass.map((group) => (
                <div key={group.label} className="border-b border-stone-200 last:border-0">
                  <div className="px-4 py-2 bg-violet-50/80 text-xs font-semibold text-violet-900 uppercase tracking-wide">
                    {group.label} ({group.slots.length} créneau{group.slots.length > 1 ? 'x' : ''})
                  </div>
                  {renderListTable(group.slots)}
                </div>
              ))}
        </Card>
      )}
    </div>
  );
};

export default EducatorScheduleTab;
