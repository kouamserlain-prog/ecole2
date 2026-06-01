import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_USER_UI_PREFERENCES,
  mergeUserUiPreferences,
  normalizeUserUiPreferences,
} from './user-ui-preferences.util';

describe('normalizeUserUiPreferences', () => {
  it('retourne les valeurs par défaut si absent', () => {
    assert.deepEqual(normalizeUserUiPreferences(null), DEFAULT_USER_UI_PREFERENCES);
  });

  it('conserve theme et timezone valides', () => {
    const prefs = normalizeUserUiPreferences({
      theme: 'dark',
      timezone: 'America/New_York',
    });
    assert.equal(prefs.theme, 'dark');
    assert.equal(prefs.timezone, 'America/New_York');
  });
});

describe('mergeUserUiPreferences', () => {
  it('fusionne partiellement', () => {
    const merged = mergeUserUiPreferences(
      { theme: 'light', timezone: 'Europe/Paris' },
      { theme: 'dark' }
    );
    assert.equal(merged.theme, 'dark');
    assert.equal(merged.timezone, 'Europe/Paris');
  });
});
