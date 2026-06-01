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

export function parseUserUiPreferences(raw: unknown): UserUiPreferences {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_USER_UI_PREFERENCES };
  }
  const o = raw as Record<string, unknown>;
  const theme = o.theme === 'dark' || o.theme === 'auto' || o.theme === 'light' ? o.theme : 'light';
  const timeFormat = o.timeFormat === '12h' || o.timeFormat === '24h' ? o.timeFormat : '24h';
  const language =
    o.language === 'en' || o.language === 'es' || o.language === 'fr' ? o.language : 'fr';
  const timezone =
    o.timezone === 'Europe/London' ||
    o.timezone === 'America/New_York' ||
    o.timezone === 'Europe/Paris'
      ? o.timezone
      : 'Europe/Paris';
  const dateFormat =
    o.dateFormat === 'MM/DD/YYYY' || o.dateFormat === 'YYYY-MM-DD' || o.dateFormat === 'DD/MM/YYYY'
      ? o.dateFormat
      : 'DD/MM/YYYY';
  return { language, theme, timezone, dateFormat, timeFormat };
}

export function resolveEffectiveTheme(theme: UserUiPreferences['theme']): 'light' | 'dark' {
  if (theme === 'dark') return 'dark';
  if (theme === 'light') return 'light';
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function applyDocumentTheme(theme: UserUiPreferences['theme']): void {
  if (typeof document === 'undefined') return;
  const effective = resolveEffectiveTheme(theme);
  document.documentElement.classList.toggle('dark', effective === 'dark');
  document.documentElement.dataset.theme = theme;
}
