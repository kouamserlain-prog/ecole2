import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatScheduleMinutesLabel,
  parseGradingCoefficient,
  parseWeeklyHours,
  scheduleDurationMinutes,
  weeklyHoursToTargetMinutes,
  weeklyHoursToTargetSlots,
} from './course-fields.util';

describe('weeklyHoursToTargetMinutes', () => {
  it('convertit les heures en minutes', () => {
    assert.equal(weeklyHoursToTargetMinutes(4), 240);
    assert.equal(weeklyHoursToTargetMinutes(1.5), 90);
    assert.equal(weeklyHoursToTargetMinutes(null), 60);
  });
});

describe('scheduleDurationMinutes', () => {
  it('calcule la durée entre deux horaires', () => {
    assert.equal(scheduleDurationMinutes('08:07', '09:22'), 75);
    assert.equal(scheduleDurationMinutes('08:00', '09:00'), 60);
  });
});

describe('formatScheduleMinutesLabel', () => {
  it('formate heures et minutes', () => {
    assert.equal(formatScheduleMinutesLabel(45), '45 min');
    assert.equal(formatScheduleMinutesLabel(60), '1 h');
    assert.equal(formatScheduleMinutesLabel(125), '2 h 05');
  });
});

describe('parseGradingCoefficient', () => {
  it('accepte un coefficient valide', () => {
    assert.equal(parseGradingCoefficient(2), 2);
    assert.equal(parseGradingCoefficient('1.5'), 1.5);
  });

  it('rejette les valeurs invalides', () => {
    assert.equal(parseGradingCoefficient(0), null);
    assert.equal(parseGradingCoefficient(101), null);
    assert.equal(parseGradingCoefficient('x'), null);
  });
});

describe('parseWeeklyHours', () => {
  it('parse les heures et null', () => {
    assert.equal(parseWeeklyHours(3), 3);
    assert.equal(parseWeeklyHours(''), null);
    assert.equal(parseWeeklyHours(undefined), undefined);
  });
});

describe('weeklyHoursToTargetSlots', () => {
  it('dérive le nombre de créneaux d’1 h', () => {
    assert.equal(weeklyHoursToTargetSlots(4), 4);
    assert.equal(weeklyHoursToTargetSlots(4.5), 5);
  });
});
