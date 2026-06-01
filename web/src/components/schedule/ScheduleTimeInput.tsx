'use client';

import { normalizeScheduleTime } from '@/lib/scheduleTimeSlots';

type ScheduleTimeInputProps = {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Heure minimale (HH:MM), ex. pour l'heure de fin après le début */
  min?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

const inputClassName =
  'w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-all focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/20 disabled:bg-gray-50 disabled:text-gray-500';

export default function ScheduleTimeInput({
  id,
  label,
  value,
  onChange,
  min,
  required = false,
  disabled = false,
  className = '',
}: ScheduleTimeInputProps) {
  const inputId = id ?? `schedule-time-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-xs font-semibold text-gray-700">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      <input
        id={inputId}
        type="time"
        value={value}
        min={min}
        step={60}
        disabled={disabled}
        onChange={(e) => onChange(normalizeScheduleTime(e.target.value))}
        onBlur={(e) => onChange(normalizeScheduleTime(e.target.value))}
        className={inputClassName}
        aria-label={label}
      />
      <p className="mt-1 text-[11px] text-gray-500">
        Précision à la minute (ex. 08:07, 10:45, 14:23)
      </p>
    </div>
  );
}
