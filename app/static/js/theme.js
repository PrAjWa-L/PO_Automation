/**
 * theme.js — Light / Dark mode toggle
 * Persists preference to localStorage
 * Exposes: window.Theme
 */

const Theme = (() => {

  const KEY = 'procureiq-theme';

  function init() {
    const saved = localStorage.getItem(KEY) || 'light';
    _apply(saved);
  }

  function toggle() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next    = current === 'dark' ? 'light' : 'dark';
    _apply(next);
    localStorage.setItem(KEY, next);
  }

  function _apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  return { init, toggle };
})();

window.Theme = Theme;
document.addEventListener('DOMContentLoaded', Theme.init);