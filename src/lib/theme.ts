import type { ThemeMode } from '../stores/documentStore';

const STORAGE_KEY = 'md-theme';

export function loadThemePreference(): ThemeMode {
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'system';
}

export function saveThemePreference(mode: ThemeMode) {
  localStorage.setItem(STORAGE_KEY, mode);
}

export function resolveDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyThemeClass(mode: ThemeMode) {
  const dark = resolveDark(mode);
  document.documentElement.classList.toggle('dark', dark);
}
