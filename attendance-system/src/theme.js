/* theme.js — light/dark switch, persisted, applied as a class on <html>. */
const KEY = 'saes_theme';

export function getTheme() {
  return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
}
export function applyTheme(t) {
  document.documentElement.classList.toggle('dark', t === 'dark');
  localStorage.setItem(KEY, t);
}
export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}
