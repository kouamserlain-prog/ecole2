/** Heure de début de la journée scolaire (premier créneau emploi du temps). */
export const DEFAULT_SCHEDULE_START = '07:00';

/** Fin de journée affichée dans les grilles emploi du temps. */
export const DEFAULT_SCHEDULE_END = '18:00';

/** Pas de la grille (1 = une ligne par minute). */
export const SCHEDULE_GRID_STEP_MINUTES = 1;

/** Normalise une saisie HH:MM (ex. "8:5" → "08:05"). */
export function normalizeScheduleTime(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return trimmed;
  const hours = Math.min(23, Math.max(0, Number.parseInt(match[1], 10)));
  const minutes = Math.min(59, Math.max(0, Number.parseInt(match[2], 10)));
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function minutesToScheduleTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
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

/** Durée d’un créneau en minutes (minimum 1). */
export function scheduleDurationMinutes(startTime: string, endTime: string): number {
  const start = scheduleTimeToMinutes(startTime);
  const end = scheduleTimeToMinutes(endTime);
  if (start === null || end === null || end <= start) return 1;
  return end - start;
}

/** Génère les lignes de grille entre deux horaires (pas en minutes, défaut 1). */
export function buildScheduleTimeSlots(
  dayStart = DEFAULT_SCHEDULE_START,
  dayEnd = DEFAULT_SCHEDULE_END,
  stepMinutes = SCHEDULE_GRID_STEP_MINUTES
): string[] {
  const start = scheduleTimeToMinutes(dayStart);
  const end = scheduleTimeToMinutes(dayEnd);
  if (start === null || end === null || end < start) return [dayStart];
  const step = Math.max(1, Math.min(60, stepMinutes));
  const slots: string[] = [];
  for (let m = start; m <= end; m += step) {
    slots.push(minutesToScheduleTime(m));
  }
  return slots;
}

/** Créneaux minute par minute affichés dans les grilles emploi du temps (7h → 18h). */
export const SCHEDULE_TIME_SLOTS = buildScheduleTimeSlots();

export type ScheduleGridCellPlan<T extends { startTime: string; endTime: string }> =
  | { type: 'skip' }
  | { type: 'empty' }
  | { type: 'slot'; slot: T; rowSpan: number };

/**
 * Planifie une cellule de grille : rowspan depuis l’heure de début exacte,
 * lignes suivantes ignorées jusqu’à la fin du créneau.
 */
export function planScheduleGridCell<T extends { startTime: string; endTime: string }>(
  daySlots: T[],
  time: string,
  occupiedUntilMinutes: number
): { plan: ScheduleGridCellPlan<T>; nextOccupiedUntil: number } {
  const timeMin = scheduleTimeToMinutes(time);
  if (timeMin === null) {
    return { plan: { type: 'empty' }, nextOccupiedUntil: occupiedUntilMinutes };
  }
  if (timeMin < occupiedUntilMinutes) {
    return { plan: { type: 'skip' }, nextOccupiedUntil: occupiedUntilMinutes };
  }
  const slot = daySlots.find((s) => {
    const startMin = scheduleTimeToMinutes(normalizeScheduleTime(s.startTime));
    return startMin !== null && startMin === timeMin;
  });
  if (slot) {
    const rowSpan = scheduleDurationMinutes(slot.startTime, slot.endTime);
    return {
      plan: { type: 'slot', slot, rowSpan },
      nextOccupiedUntil: timeMin + rowSpan,
    };
  }
  return { plan: { type: 'empty' }, nextOccupiedUntil: occupiedUntilMinutes };
}

/** Libellé colonne « Heure » : toutes les minutes (:00 à :59). */
export function formatScheduleGridTimeLabel(time: string): string {
  return normalizeScheduleTime(time);
}
