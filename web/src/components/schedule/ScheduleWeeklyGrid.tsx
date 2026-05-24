'use client';

import { useMemo } from 'react';
import { SCHEDULE_TIME_SLOTS } from '@/lib/scheduleTimeSlots';

export type ScheduleGridSlot = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  courseName: string;
  courseCode?: string;
  teacherName?: string;
  room?: string | null;
};

const WEEK_DAYS = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
] as const;

type ScheduleWeeklyGridProps = {
  slots: ScheduleGridSlot[];
  title?: string;
};

export default function ScheduleWeeklyGrid({ slots, title }: ScheduleWeeklyGridProps) {
  const activeDays = useMemo(() => {
    const used = new Set(slots.map((s) => s.dayOfWeek));
    const days = WEEK_DAYS.filter((d) => used.has(d.value));
    return days.length > 0 ? days : WEEK_DAYS.slice(0, 5);
  }, [slots]);

  const byDay = useMemo(() => {
    const map: Record<number, ScheduleGridSlot[]> = {};
    for (const day of activeDays) {
      map[day.value] = slots
        .filter((s) => s.dayOfWeek === day.value)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [slots, activeDays]);

  if (slots.length === 0) return null;

  return (
    <div className="space-y-2">
      {title ? <h3 className="text-sm font-bold text-stone-800">{title}</h3> : null}
      <div className="overflow-x-auto rounded-xl border border-stone-200/90 bg-white">
        <table className="w-full border-collapse text-xs min-w-[640px]">
          <thead>
            <tr>
              <th className="border border-stone-200 bg-stone-50 px-2 py-2 font-semibold text-stone-700 w-16">
                Heure
              </th>
              {activeDays.map((day) => (
                <th
                  key={day.value}
                  className="border border-stone-200 bg-stone-50 px-2 py-2 font-semibold text-stone-700 min-w-[120px]"
                >
                  {day.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SCHEDULE_TIME_SLOTS.map((time, idx) => {
              if (idx % 2 !== 0) return null;
              return (
                <tr key={time}>
                  <td className="border border-stone-200 bg-stone-50/80 px-2 py-1.5 font-medium text-stone-600">
                    {time}
                  </td>
                  {activeDays.map((day) => {
                    const cellSlot = byDay[day.value]?.find(
                      (s) => s.startTime <= time && s.endTime > time
                    );
                    return (
                      <td key={day.value} className="border border-stone-200 p-1 align-top h-12">
                        {cellSlot ? (
                          <div className="rounded-lg border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-1.5 text-[11px] leading-snug shadow-sm">
                            <p className="font-semibold text-violet-950">{cellSlot.courseName}</p>
                            {cellSlot.teacherName ? (
                              <p className="text-stone-600 truncate">{cellSlot.teacherName}</p>
                            ) : null}
                            <p className="text-stone-500 tabular-nums">
                              {cellSlot.startTime}–{cellSlot.endTime}
                              {cellSlot.room ? ` · ${cellSlot.room}` : ''}
                            </p>
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
