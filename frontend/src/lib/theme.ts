export type ThemeId = 'green' | 'blue' | 'red' | 'purple' | 'orange';

export const THEMES: { id: ThemeId; label: string; hint: string; color: string }[] = [
  { id: 'green', label: 'Verde', hint: 'Estilo Xbox', color: '#2fe08a' },
  { id: 'blue', label: 'Azul', hint: 'Estilo PlayStation', color: '#4c8dff' },
  { id: 'red', label: 'Rojo', hint: 'Estilo Nintendo', color: '#ff4d5e' },
  { id: 'purple', label: 'Morado', hint: 'Estilo streamer', color: '#a970ff' },
  { id: 'orange', label: 'Naranja', hint: 'Estilo arcade', color: '#ff8a3d' },
];

const KEY = 'gz_theme';

const isTheme = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v);

export function applyTheme(theme: string | null | undefined) {
  const id = isTheme(theme) ? theme : 'green';
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    return;
  }
}

export function applySavedTheme() {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    saved = null;
  }
  document.documentElement.dataset.theme = isTheme(saved) ? saved : 'green';
}
