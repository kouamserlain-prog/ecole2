'use client';

import { useMemo } from 'react';
import {
  SCHEDULE_TIME_SLOTS,
  formatScheduleGridTimeLabel,
  planScheduleGridCell,
} from '@/lib/scheduleTimeSlots';

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

  const occupiedByDay: Record<number, number> = {};

  return (
    <div className="space-y-2">
      {title ? <h3 className="text-sm font-bold text-stone-800">{title}</h3> : null}
      <div className="max-h-[min(70vh,720px)] overflow-auto rounded-xl border border-stone-200/90 bg-white">
        <table className="w-full border-collapse text-xs min-w-[640px]">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="border border-stone-200 bg-stone-50 px-2 py-2 font-semibold text-stone-700 w-14">
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
            {SCHEDULE_TIME_SLOTS.map((time) => {
              const dayCells = activeDays.map((day) => {
                const daySlots = byDay[day.value] ?? [];
                const occupied = occupiedByDay[day.value] ?? 0;
                const { plan, nextOccupiedUntil } = planScheduleGridCell(daySlots, time, occupied);
                occupiedByDay[day.value] = nextOccupiedUntil;
                return { day, plan };
              });

              const showTimeLabel = dayCells.some((c) => c.plan.type !== 'skip');
              if (!showTimeLabel) return null;

              return (
                <tr key={time} className="h-4">
                  <td className="border border-stone-200 bg-stone-50/80 px-1 py-0 font-medium text-stone-600 text-[10px] tabular-nums whitespace-nowrap">
                    {formatScheduleGridTimeLabel(time)}
                  </td>
                  {dayCells.map(({ day, plan }) => {
                    if (plan.type === 'skip') return null;
                    if (plan.type === 'empty') {
                      return (
                        <td key={day.value} className="border border-stone-200 p-0 h-4" />
                      );
                    }
                    const cellSlot = plan.slot;
                    return (
                      <td
                        key={day.value}
                        rowSpan={plan.rowSpan}
                        className="border border-stone-200 p-1 align-top"
                      >
                        <div className="rounded-lg border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-1.5 text-[11px] leading-snug shadow-sm min-h-[2.5rem]">
                          <p className="font-semibold text-violet-950">{cellSlot.courseName}</p>
                          {cellSlot.teacherName ? (
                            <p className="text-stone-600 truncate">{cellSlot.teacherName}</p>
                          ) : null}
                          <p className="text-stone-500 tabular-nums">
                            {cellSlot.startTime}–{cellSlot.endTime}
                            {cellSlot.room ? ` · ${cellSlot.room}` : ''}
                          </p>
                        </div>
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
