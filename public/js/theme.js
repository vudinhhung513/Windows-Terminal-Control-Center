/**
 * file: theme.js
 * Chuc nang: Module dung chung quan ly theme giao dien (dark/light/auto).
 *            Resolve 'auto' theo he dieu hanh (prefers-color-scheme), ap
 *            data-theme cho document, va phat su kien 'tcc:theme-change' de
 *            cac trang (vd terminal) cap nhat mau theo theme da resolve.
 * Dung cho ca index.html va terminal.html (tranh viet trung logic).
 */

(function () {
  'use strict';

  // Mode hien tai do nguoi dung chon: 'dark' | 'light' | 'auto'
  var currentMode = 'dark';

  // MediaQuery theo doi che do toi cua he dieu hanh (dung cho mode 'auto')
  var darkMql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  /**
   * Resolve mode ve theme thuc te ('dark' | 'light').
   * 'auto' -> doc preference he dieu hanh.
   * @param {string} mode
   * @returns {'dark'|'light'}
   */
  function resolveTheme(mode) {
    if (mode === 'light') return 'light';
    if (mode === 'dark') return 'dark';
    // auto: theo he dieu hanh (mac dinh dark neu khong ho tro matchMedia)
    return (darkMql && darkMql.matches) ? 'dark' : 'light';
  }

  /**
   * Ap theme len document theo mode. Phat su kien de nghe ben ngoai.
   * @param {string} mode - 'dark' | 'light' | 'auto'
   */
  function applyTheme(mode) {
    currentMode = (mode === 'light' || mode === 'auto') ? mode : 'dark';
    var resolved = resolveTheme(currentMode);
    document.documentElement.setAttribute('data-theme', resolved);
    // Phat su kien cho cac trang muon dong bo mau (vd xterm)
    var ev;
    try {
      ev = new CustomEvent('tcc:theme-change', { detail: { mode: currentMode, resolved: resolved } });
    } catch {
      // Fallback cho moi truong cu khong ho tro CustomEvent constructor
      ev = document.createEvent('CustomEvent');
      ev.initCustomEvent('tcc:theme-change', false, false, { mode: currentMode, resolved: resolved });
    }
    document.dispatchEvent(ev);
    return resolved;
  }

  /** Lay mode hien tai. */
  function getMode() { return currentMode; }

  /** Lay theme da resolve hien tai ('dark'|'light'). */
  function getResolved() { return resolveTheme(currentMode); }

  // Khi he dieu hanh doi che do va dang o mode 'auto' -> re-apply
  if (darkMql) {
    var onChange = function () { if (currentMode === 'auto') applyTheme('auto'); };
    if (typeof darkMql.addEventListener === 'function') {
      darkMql.addEventListener('change', onChange);
    } else if (typeof darkMql.addListener === 'function') {
      darkMql.addListener(onChange); // API cu
    }
  }

  // Expose ra global
  window.Theme = {
    applyTheme: applyTheme,
    resolveTheme: resolveTheme,
    getMode: getMode,
    getResolved: getResolved
  };
})();
