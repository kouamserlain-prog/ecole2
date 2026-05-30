import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCHEDULE_START,
  isValidScheduleTimeRange,
  normalizeScheduleTime,
  SCHEDULE_TIME_SLOTS,
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

describe('SCHEDULE_TIME_SLOTS', () => {
  it('commence à l’heure par défaut', () => {
    expect(SCHEDULE_TIME_SLOTS[0]).toBe(DEFAULT_SCHEDULE_START);
  });

  it('contient des créneaux demi-heure consécutifs', () => {
    expect(SCHEDULE_TIME_SLOTS.length).toBeGreaterThan(1);
    for (let i = 1; i < SCHEDULE_TIME_SLOTS.length; i += 1) {
      const prev = scheduleTimeToMinutes(SCHEDULE_TIME_SLOTS[i - 1]);
      const curr = scheduleTimeToMinutes(SCHEDULE_TIME_SLOTS[i]);
      expect(curr! - prev!).toBe(30);
    }
  });
});
