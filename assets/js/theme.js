/* ────────── 다크/라이트 테마 ────────── */

(function () {
  const STORAGE_KEY = 'lbt_theme';

  function getTheme() {
    return localStorage.getItem(STORAGE_KEY) || 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀' : '☾';
  }

  function toggleTheme() {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  // 페이지 로드 즉시 테마 적용 (깜빡임 방지)
  applyTheme(getTheme());

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      applyTheme(getTheme());
      btn.addEventListener('click', toggleTheme);
    }
  });
})();
