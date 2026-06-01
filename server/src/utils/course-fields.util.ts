/** Durée d’un créneau HH:MM → HH:MM en minutes. */
export function scheduleDurationMinutes(startTime: string, endTime: string): number {
  const toMin = (t: string) => {
    const parts = t.trim().split(':');
    if (parts.length < 2) return NaN;
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
    return h * 60 + m;
  };
  const start = toMin(startTime);
  const end = toMin(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return end - start;
}

/** Volume horaire hebdomadaire → minutes à couvrir dans l’EDT. */
export function weeklyHoursToTargetMinutes(weeklyHours: number | null | undefined): number {
  if (weeklyHours == null || !Number.isFinite(weeklyHours) || weeklyHours <= 0) {
    return 60;
  }
  return Math.max(1, Math.round(weeklyHours * 60));
}

/** @deprecated Utiliser weeklyHoursToTargetMinutes — conservé pour compatibilité tests. */
export function weeklyHoursToTargetSlots(weeklyHours: number | null | undefined): number {
  return Math.max(1, Math.ceil(weeklyHoursToTargetMinutes(weeklyHours) / 60));
}

export function formatScheduleMinutesLabel(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

export function parseWeeklyHours(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseGradingCoefficient(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 100) return null;
  return n;
}
