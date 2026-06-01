export type UserUiPreferences = {
  language: string;
  theme: 'light' | 'dark' | 'auto';
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
};

export const DEFAULT_USER_UI_PREFERENCES: UserUiPreferences = {
  language: 'fr',
  theme: 'light',
  timezone: 'Europe/Paris',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
};

const ALLOWED_THEMES = new Set<UserUiPreferences['theme']>(['light', 'dark', 'auto']);
const ALLOWED_TIME_FORMATS = new Set<UserUiPreferences['timeFormat']>(['12h', '24h']);
const ALLOWED_DATE_FORMATS = new Set(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']);
const ALLOWED_LANGUAGES = new Set(['fr', 'en', 'es']);
const ALLOWED_TIMEZONES = new Set([
  'Europe/Paris',
  'Europe/London',
  'America/New_York',
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function normalizeUserUiPreferences(input: unknown): UserUiPreferences {
  const raw = asRecord(input) ?? {};
  const themeRaw = String(raw.theme ?? DEFAULT_USER_UI_PREFERENCES.theme);
  const timeFormatRaw = String(raw.timeFormat ?? DEFAULT_USER_UI_PREFERENCES.timeFormat);
  const dateFormatRaw = String(raw.dateFormat ?? DEFAULT_USER_UI_PREFERENCES.dateFormat);
  const languageRaw = String(raw.language ?? DEFAULT_USER_UI_PREFERENCES.language);
  const timezoneRaw = String(raw.timezone ?? DEFAULT_USER_UI_PREFERENCES.timezone);

  return {
    language: ALLOWED_LANGUAGES.has(languageRaw) ? languageRaw : DEFAULT_USER_UI_PREFERENCES.language,
    theme: ALLOWED_THEMES.has(themeRaw as UserUiPreferences['theme'])
      ? (themeRaw as UserUiPreferences['theme'])
      : DEFAULT_USER_UI_PREFERENCES.theme,
    timezone: ALLOWED_TIMEZONES.has(timezoneRaw) ? timezoneRaw : DEFAULT_USER_UI_PREFERENCES.timezone,
    dateFormat: ALLOWED_DATE_FORMATS.has(dateFormatRaw)
      ? dateFormatRaw
      : DEFAULT_USER_UI_PREFERENCES.dateFormat,
    timeFormat: ALLOWED_TIME_FORMATS.has(timeFormatRaw as UserUiPreferences['timeFormat'])
      ? (timeFormatRaw as UserUiPreferences['timeFormat'])
      : DEFAULT_USER_UI_PREFERENCES.timeFormat,
  };
}

export function mergeUserUiPreferences(
  current: unknown,
  patch: unknown
): UserUiPreferences {
  const base = normalizeUserUiPreferences(current);
  const delta = asRecord(patch);
  if (!delta) return base;
  return normalizeUserUiPreferences({ ...base, ...delta });
}
