'use client';

import { useQuery } from '@tanstack/react-query';
import { teacherApi } from '../../services/api';
import Card from '../ui/Card';
import { FiCalendar, FiClock, FiMapPin, FiBook } from 'react-icons/fi';

const TeacherScheduleTab = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['teacher-schedule'],
    queryFn: teacherApi.getSchedule,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <Card>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
          <p className="mt-4 text-gray-600">Chargement de l&apos;emploi du temps...</p>
        </div>
      </Card>
    );
  }

  const slots = data?.slots ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/20 px-5 py-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Emploi du temps</h1>
        <p className="mt-2 text-sm text-gray-600">
          Créneaux issus des cours qui vous sont assignés (emploi du temps des classes). Les horaires se
          mettent à jour automatiquement après modification par l&apos;administration.
        </p>
      </div>

      {slots.length === 0 ? (
        <Card className="p-10 text-center text-gray-500">
          <FiCalendar className="w-14 h-14 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Aucun créneau planifié pour vos cours.</p>
          <p className="text-sm mt-2">Les horaires sont définis lors de la constitution des emplois du temps par l&apos;administration.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden border border-gray-200/80">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="py-3 px-4 font-semibold text-gray-700">Jour</th>
                  <th className="py-3 px-4 font-semibold text-gray-700">Horaire</th>
                  <th className="py-3 px-4 font-semibold text-gray-700">Matière</th>
                  <th className="py-3 px-4 font-semibold text-gray-700">Classe</th>
                  <th className="py-3 px-4 font-semibold text-gray-700">Salle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {slots.map((s: any) => (
                  <tr key={s.id} className="hover:bg-emerald-50/40">
                    <td className="py-3 px-4 font-medium text-gray-900">{s.dayLabel}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-gray-800">
                        <FiClock className="w-4 h-4 text-emerald-600 shrink-0" />
                        {s.startTime} – {s.endTime}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-900">{s.courseName}</span>
                      <span className="text-gray-500 text-xs ml-2 font-mono">{s.courseCode}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-700">
                      {s.className} <span className="text-gray-500">({s.classLevel})</span>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
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
        </Card>
      )}
    </div>
  );
};

export default TeacherScheduleTab;
