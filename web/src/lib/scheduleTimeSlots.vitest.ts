import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCHEDULE_END,
  DEFAULT_SCHEDULE_START,
  buildScheduleTimeSlots,
  isValidScheduleTimeRange,
  minutesToScheduleTime,
  normalizeScheduleTime,
  planScheduleGridCell,
  SCHEDULE_TIME_SLOTS,
  scheduleDurationMinutes,
  scheduleTimeToMinutes,
} from './scheduleTimeSlots';

describe('normalizeScheduleTime', () => {
  it('normalise heures et minutes sur un chiffre', () => {
    expect(normalizeScheduleTime('8:5')).toBe('08:05');
  });

  it('conserve un horaire déjà au format HH:MM', () => {
    expect(normalizeScheduleTime('08:15')).toBe('08:15');
  });

  it('borne les heures entre 0 et 23', () => {
    expect(normalizeScheduleTime('25:00')).toBe('23:00');
    expect(normalizeScheduleTime('0:30')).toBe('00:30');
  });

  it('borne les minutes entre 0 et 59', () => {
    expect(normalizeScheduleTime('10:99')).toBe('10:59');
  });

  it('retourne la valeur telle quelle si le format est invalide', () => {
    expect(normalizeScheduleTime('invalid')).toBe('invalid');
  });
});

describe('scheduleTimeToMinutes', () => {
  it('convertit un horaire valide en minutes', () => {
    expect(scheduleTimeToMinutes('08:15')).toBe(8 * 60 + 15);
    expect(scheduleTimeToMinutes('00:00')).toBe(0);
    expect(scheduleTimeToMinutes('23:59')).toBe(23 * 60 + 59);
  });

  it('retourne null pour un format invalide', () => {
    expect(scheduleTimeToMinutes('invalid')).toBeNull();
  });
});

describe('isValidScheduleTimeRange', () => {
  it('accepte un créneau où la fin est après le début', () => {
    expect(isValidScheduleTimeRange('08:00', '09:30')).toBe(true);
    expect(isValidScheduleTimeRange('08:15', '08:45')).toBe(true);
    expect(isValidScheduleTimeRange('08:07', '09:22')).toBe(true);
  });

  it('refuse un créneau où la fin est égale ou avant le début', () => {
    expect(isValidScheduleTimeRange('09:00', '09:00')).toBe(false);
    expect(isValidScheduleTimeRange('10:00', '09:30')).toBe(false);
  });

  it('refuse des horaires invalides', () => {
    expect(isValidScheduleTimeRange('bad', '10:00')).toBe(false);
    expect(isValidScheduleTimeRange('08:00', 'bad')).toBe(false);
  });
});

describe('buildScheduleTimeSlots', () => {
  it('commence et termine aux bornes demandées', () => {
    const slots = buildScheduleTimeSlots('08:00', '08:02', 1);
    expect(slots).toEqual(['08:00', '08:01', '08:02']);
  });

  it('utilise un pas d’une minute par défaut', () => {
    const slots = buildScheduleTimeSlots('10:00', '10:02');
    expect(slots.length).toBe(3);
    expect(slots[1]).toBe('10:01');
  });
});

describe('SCHEDULE_TIME_SLOTS', () => {
  it('commence à l’heure par défaut', () => {
    expect(SCHEDULE_TIME_SLOTS[0]).toBe(DEFAULT_SCHEDULE_START);
  });

  it('se termine à la fin de journée par défaut', () => {
    expect(SCHEDULE_TIME_SLOTS[SCHEDULE_TIME_SLOTS.length - 1]).toBe(DEFAULT_SCHEDULE_END);
  });

  it('contient des créneaux d’une minute consécutifs', () => {
    expect(SCHEDULE_TIME_SLOTS.length).toBeGreaterThan(1);
    for (let i = 1; i < SCHEDULE_TIME_SLOTS.length; i += 1) {
      const prev = scheduleTimeToMinutes(SCHEDULE_TIME_SLOTS[i - 1]);
      const curr = scheduleTimeToMinutes(SCHEDULE_TIME_SLOTS[i]);
      expect(curr! - prev!).toBe(1);
    }
  });
});

describe('scheduleDurationMinutes', () => {
  it('calcule la durée en minutes', () => {
    expect(scheduleDurationMinutes('08:07', '09:22')).toBe(75);
    expect(scheduleDurationMinutes('08:00', '08:01')).toBe(1);
  });
});

describe('planScheduleGridCell', () => {
  const slots = [{ id: '1', startTime: '08:07', endTime: '09:00' }];

  it('place le cours sur la ligne de début avec rowspan', () => {
    const { plan, nextOccupiedUntil } = planScheduleGridCell(slots, '08:07', 0);
    expect(plan.type).toBe('slot');
    if (plan.type === 'slot') {
      expect(plan.rowSpan).toBe(53);
    }
    expect(nextOccupiedUntil).toBe(scheduleTimeToMinutes('09:00'));
  });

  it('ignore les lignes couvertes par rowspan', () => {
    const { plan } = planScheduleGridCell(slots, '08:08', scheduleTimeToMinutes('09:00')!);
    expect(plan.type).toBe('skip');
  });
});

describe('minutesToScheduleTime', () => {
  it('reconvertit les minutes en HH:MM', () => {
    expect(minutesToScheduleTime(8 * 60 + 7)).toBe('08:07');
  });
});
