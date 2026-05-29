/** Heure de début de la journée scolaire (premier créneau emploi du temps). */
export const DEFAULT_SCHEDULE_START = '07:00';

/** Normalise une saisie HH:MM (ex. "8:5" → "08:05"). */
export function normalizeScheduleTime(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return trimmed;
  const hours = Math.min(23, Math.max(0, Number.parseInt(match[1], 10)));
  const minutes = Math.min(59, Math.max(0, Number.parseInt(match[2], 10)));
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function scheduleTimeToMinutes(value: string): number | null {
  const normalized = normalizeScheduleTime(value);
  const match = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return Number.parseInt(match[1], 10) * 60 + Number.parseInt(match[2], 10);
}

/** Vérifie que début et fin sont des horaires valides et que fin > début. */
export function isValidScheduleTimeRange(startTime: string, endTime: string): boolean {
  const start = scheduleTimeToMinutes(startTime);
  const end = scheduleTimeToMinutes(endTime);
  if (start === null || end === null) return false;
  return end > start;
}

/** Créneaux demi-heure affichés dans les grilles emploi du temps (7h → 18h). */
export const SCHEDULE_TIME_SLOTS = [
  '07:00',
  '07:30',
  '08:00',
  '08:30',
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
  '18:00',
] as const;
