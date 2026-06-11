/**
 * file: terminal.js
 * Chuc nang: Khoi tao xterm.js terminal, ket noi WebSocket toi phien ConPTY,
 *            xu ly input/output, resize, font tu config, thanh nut dieu khien
 *            va tu dong ket noi lai (auto-reconnect co backoff).
 */

(function () {
  'use strict';

  // === Lay ten phien tu query string ===
  var params = new URLSearchParams(window.location.search);
  var sessionName = params.get('name');

  // Tham chieu DOM
  var sessionTitle = document.getElementById('session-title');
  var container = document.getElementById('terminal-container');
  var reconnectOverlay = document.getElementById('reconnect-overlay');
  var btnReconnect = document.getElementById('btn-reconnect');
  var controlBar = document.getElementById('control-bar');
  var inputBar = document.getElementById('input-bar');
  var inputBarField = document.getElementById('input-bar-field');

  /** Shorthand dich i18n. */
  function t(key, vars) { return window.I18N.t(key, vars); }

  // Nguong coi la mobile (khop breakpoint responsive trong styles.css)
  var MOBILE_MAX_WIDTH = 640;
  /** Co phai dang xem tren man hinh mobile khong (theo be rong viewport). */
  function isMobile() {
    return window.matchMedia
      ? window.matchMedia('(max-width: ' + MOBILE_MAX_WIDTH + 'px)').matches
      : window.innerWidth <= MOBILE_MAX_WIDTH;
  }

  // Co chu desktop/mobile lay tu config (cap nhat sau khi fetch /api/config)
  var fontSizeDesktop = 14;
  var fontSizeMobile = 12;

  // Trang thai hien/an o nhap lieu luc chay (runtime). Mac dinh an; nguoi dung
  // bat/tat bang nut toggle tren control bar. La nguon duy nhat quyet dinh o
  // nhap co hien khong (khong con phu thuoc config).
  var inputVisible = false;

  /** Ap font size phu hop voi kich thuoc man hinh hien tai. */
  function applyFontSize() {
    var size = isMobile() ? fontSizeMobile : fontSizeDesktop;
    if (term.options.fontSize !== size) {
      term.options.fontSize = size;
    }
  }

  /**
   * Ap che do o nhap theo trang thai runtime `inputVisible`:
   * - mobile + hien: hien o nhap + tat ban phim ao cua terminal (tranh terminal
   *   chiem focus va tranh ban phim che noi dung).
   * - mobile + an: go truc tiep vao terminal (chieu cao trang da thu nho theo
   *   visualViewport o ham applyViewportHeight).
   * - desktop + hien: hien o nhap rieng (du phong IME nhu Unikey) nhung GIU
   *   terminal tuong tac duoc (con phim cung de dung Ctrl+C, cuon...).
   */
  function applyKeyboardMode() {
    if (inputBar) inputBar.classList.toggle('hidden', !inputVisible);
    // Chi tat ban phim ao cua terminal o che do mobile (mobile khong co phim
    // cung). Desktop giu terminal tuong tac de dung phim tat.
    if (term.textarea) {
      if (inputVisible && isMobile()) {
        term.textarea.setAttribute('inputmode', 'none');
        term.textarea.readOnly = true;
      } else {
        term.textarea.removeAttribute('inputmode');
        term.textarea.readOnly = false;
      }
    }
    updateToggleButton();
  }

  /** Cap nhat trang thai sang/tat (active) cho nut toggle o nhap tren control bar. */
  function updateToggleButton() {
    if (!controlBar) return;
    var b = controlBar.querySelector('[data-toggle="input"]');
    if (b) b.classList.toggle('ctrl-btn--active', inputVisible);
  }

  /** Focus dung dich theo trang thai (o nhap rieng khi dang hien, nguoc lai terminal). */
  function focusActive() {
    if (inputVisible && inputBarField) {
      inputBarField.focus();
    } else {
      term.focus();
    }
  }

  /** Cap nhat tieu de phien theo ngon ngu hien tai. */
  function updateTitle() {
    sessionTitle.textContent = sessionName ? t('term.title') + sessionName : t('term.titleDefault');
  }
  updateTitle();

  if (!sessionName) {
    container.innerHTML = '<p style="color:var(--danger);padding:16px;">' + t('term.missingName') + '</p>';
    return;
  }

  // === Khoi tao xterm (font ap sau khi lay config) ===
  var term = new Terminal({
    cursorBlink: true,
    fontFamily: 'monospace',
    fontSize: 14,
    scrollback: 5000
  });

  var fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  term.open(container);
  fit.fit();

  /** Ap mau xterm theo theme da resolve ('dark'|'light'). */
  function applyXtermTheme(resolved) {
    if (resolved === 'light') {
      term.options.theme = { background: '#ffffff', foreground: '#1a1b2e', cursor: '#1a1b2e' };
    } else {
      term.options.theme = { background: '#000000', foreground: '#ffffff', cursor: '#ffffff' };
    }
  }

  // Theo doi thay doi theme (vd mode 'auto' khi he dieu hanh doi che do)
  document.addEventListener('tcc:theme-change', function (e) {
    if (e && e.detail) applyXtermTheme(e.detail.resolved);
  });

  // Lay config server de ap font terminal + ngon ngu + theme
  fetch('/api/config')
    .then(function (res) { return res.json(); })
    .then(function (cfg) {
      if (cfg.termFontFamily) term.options.fontFamily = cfg.termFontFamily;
      // Luu co chu desktop/mobile roi ap theo kich thuoc man hinh
      if (cfg.termFontSize) fontSizeDesktop = cfg.termFontSize;
      if (cfg.termFontSizeMobile) fontSizeMobile = cfg.termFontSizeMobile;
      applyFontSize();
      // O nhap lieu mac dinh an; nguoi dung bat/tat bang nut toggle tren control bar.
      applyKeyboardMode();
      // Ap ngon ngu cho text tinh (data-i18n) + tieu de
      window.I18N.setLang(cfg.language || 'en');
      window.I18N.apply();
      updateTitle();
      // Ap theme (qua module Theme dung chung, ho tro auto)
      var resolved = window.Theme.applyTheme(cfg.theme || 'dark');
      applyXtermTheme(resolved);
      fit.fit();
      sendResize();
    })
    .catch(function () { /* giu font/ngon ngu mac dinh */ });

  // === WebSocket + auto-reconnect ===
  var ws = null;
  var reconnectAttempts = 0;
  var reconnectTimer = null;
  var manualClose = false;
  var MAX_RECONNECT_DELAY = 10000; // toi da 10s giua cac lan thu

  function buildWsUrl() {
    var protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    return protocol + window.location.host + '/ws/session/' + encodeURIComponent(sessionName);
  }

  function sendResize() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    }
  }

  /** Gui chuoi input tho len server. */
  function sendInput(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', data: data }));
    }
  }

  /** Lich ket noi lai voi backoff luy tien. */
  function scheduleReconnect() {
    if (manualClose) return;
    reconnectAttempts += 1;
    var delay = Math.min(1000 * reconnectAttempts, MAX_RECONNECT_DELAY);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, delay);
  }

  function connect() {
    reconnectOverlay.classList.add('hidden');
    manualClose = false;
    ws = new WebSocket(buildWsUrl());

    ws.onopen = function () {
      reconnectAttempts = 0; // reset backoff khi thanh cong
      fit.fit();
      sendResize();
    };

    ws.onmessage = function (ev) { term.write(ev.data); };

    ws.onclose = function (ev) {
      if (manualClose) return;
      // Close code rieng cho che do da thiet bi: KHONG tu reconnect (tranh
      // vong tranh nhau giua hai thiet bi). Van hien nut Reconnect thu cong.
      if (ev && ev.code === 4001) {
        // Bi thiet bi khac cuop quyen
        term.write('\r\n\x1b[1;31m' + t('term.takenOver') + '\x1b[0m\r\n');
        reconnectOverlay.classList.remove('hidden');
        return;
      }
      if (ev && ev.code === 4002) {
        // Phien dang khoa o thiet bi khac
        term.write('\r\n\x1b[1;31m' + t('term.locked') + '\x1b[0m\r\n');
        reconnectOverlay.classList.remove('hidden');
        return;
      }
      // Mat ket noi thong thuong -> tu reconnect co backoff
      term.write('\r\n\x1b[1;31m' + t('term.disconnected') + '\x1b[0m\r\n');
      reconnectOverlay.classList.remove('hidden');
      scheduleReconnect();
    };

    ws.onerror = function () { /* onclose se chay sau */ };
  }

  // === Terminal input → gui len server ===
  // Xu ly IME (bo go tieng Viet nhu Unikey tren Chrome/Windows, IME tren iOS):
  // GIAO cho xterm.js tu xu ly composition. xterm da co CompositionHelper lang
  // nghe compositionstart/update/end tren chinh <textarea> an cua no va chi
  // emit chuoi DA HOAN CHINH mot lan qua onData. KHONG tu them listener
  // composition o day: hai lop chay chong nhau gay loi ky tu co dau "nhay"/lap
  // (vd go "cộng" hien sai thu tu coô...). O nhap rieng (bat/tat bang nut
  // toggle tren control bar) la duong du phong chac chan khi IME van loi.

  // === Phim bo tro "dinh" (sticky) Ctrl/Shift tu control bar ===
  // Bam Ctrl/Shift mot lan -> ap cho ky tu ke tiep (mo phong sticky-key tren
  // ban phim mobile). Ap o onData (go thang) va o keydown cua o nhap rieng.
  var pendingCtrl = false;
  var pendingShift = false;

  /** Cap nhat trang thai sang/tat (active) cho nut Ctrl/Shift tren control bar. */
  function updateModifierButtons() {
    if (!controlBar) return;
    var c = controlBar.querySelector('[data-mod="ctrl"]');
    var s = controlBar.querySelector('[data-mod="shift"]');
    if (c) c.classList.toggle('ctrl-btn--active', pendingCtrl);
    if (s) s.classList.toggle('ctrl-btn--active', pendingShift);
  }

  /** Xoa cac phim bo tro dang cho (sau khi da ap cho mot ky tu). */
  function clearModifiers() {
    if (pendingCtrl || pendingShift) {
      pendingCtrl = false;
      pendingShift = false;
      updateModifierButtons();
    }
  }

  /**
   * Chuyen mot ky tu thuong thanh ma dieu khien Ctrl (vd 'c' -> \x03).
   * Chi ap cho ky tu @ A-Z [ \ ] ^ _ va a-z; nguoc lai giu nguyen.
   * @param {string} ch - mot ky tu
   * @returns {string}
   */
  function applyCtrl(ch) {
    var code = ch.toUpperCase().charCodeAt(0);
    if (code >= 64 && code <= 95) return String.fromCharCode(code & 0x1f);
    return ch;
  }

  /**
   * Ap cac phim bo tro dang cho vao mot ky tu don (Shift uppercase, Ctrl thanh
   * ma dieu khien). Tra ve chuoi da bien doi (khong xoa co — caller tu xoa).
   * @param {string} data
   * @returns {string}
   */
  function applyModifiers(data) {
    if (data.length !== 1) return data;
    if (pendingShift) data = data.toUpperCase();
    if (pendingCtrl) data = applyCtrl(data);
    return data;
  }

  term.onData(function (data) {
    // Ap phim bo tro dang cho (Ctrl/Shift) cho ky tu vua go, roi xoa co
    if (pendingCtrl || pendingShift) {
      data = applyModifiers(data);
      clearModifiers();
    }
    sendInput(data);
  });

  // === Phim tat copy/paste (chuan terminal Ubuntu: Ctrl+Shift+C/V) ===
  // Tra ve false de xterm KHONG gui phim nay vao tmux (Ctrl+C van la ngat).
  term.attachCustomKeyEventHandler(function (e) {
    if (e.type !== 'keydown' || !e.ctrlKey || !e.shiftKey) return true;
    var k = e.key.toLowerCase();
    if (k === 'c') { copySelection(); return false; }
    // Paste: tra ve false de xterm KHONG gui \x16 vao tmux, nhung su kien
    // 'paste' goc cua trinh duyet van chay (doc clipboard CLIENT qua
    // clipboardData, ho tro ca HTTP). Khong tu doc clipboard o day de tranh
    // prompt thua tren HTTP va tranh paste 2 lan tren HTTPS.
    if (k === 'v') { return false; }
    return true;
  });

  // === Resize ===
  function handleResize() { applyFontSize(); applyKeyboardMode(); fit.fit(); sendResize(); }
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(handleResize).observe(container);
  } else {
    window.addEventListener('resize', handleResize);
  }

  // === Ban phim ao mobile: thu nho trang theo vung hien thi con lai ===
  // Khi ban phim ao bat len, visualViewport.height giam. Dat chieu cao trang
  // (terminal-page) bang chieu cao do de header + terminal + thanh nut khit
  // phia tren ban phim, khong bi che. Ap cho ca 2 che do (resize/input).
  var pageEl = document.querySelector('.terminal-page');
  function applyViewportHeight() {
    if (!pageEl) return;
    var vv = window.visualViewport;
    if (vv && isMobile()) {
      pageEl.style.height = vv.height + 'px';
    } else {
      pageEl.style.height = '';
    }
    fit.fit();
    sendResize();
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', applyViewportHeight);
    window.visualViewport.addEventListener('scroll', applyViewportHeight);
  }

  // === Thanh nut dieu khien ===
  // Map phim → chuoi escape gui qua WebSocket
  var KEY_MAP = {
    enter: '\r',
    esc: '\x1b',
    ctrlc: '\x03',
    tab: '\t',
    up: '\x1b[A',
    down: '\x1b[B',
    left: '\x1b[D',
    right: '\x1b[C'
  };

  // Map phim mui ten -> ky tu cuoi escape sequence (dung khi co modifier)
  var ARROW_FINAL = { up: 'A', down: 'B', right: 'C', left: 'D' };

  // Phim non-character co ho tro phim bo tro (Ctrl/Shift) qua resolveKeyCombo:
  // anh xa e.key (KeyboardEvent) -> khoa noi bo trong KEY_MAP.
  var NAV_COMBO_KEY = {
    Enter: 'enter', Tab: 'tab', Escape: 'esc',
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right'
  };

  // Phim non-character con lai -> chuoi escape gui thang (khong kem modifier).
  var NAV_KEY_MAP = {
    Backspace: '\x7f', Delete: '\x1b[3~',
    Home: '\x1b[H', End: '\x1b[F',
    PageUp: '\x1b[5~', PageDown: '\x1b[6~', Insert: '\x1b[2~',
    F1: '\x1bOP', F2: '\x1bOQ', F3: '\x1bOR', F4: '\x1bOS',
    F5: '\x1b[15~', F6: '\x1b[17~', F7: '\x1b[18~', F8: '\x1b[19~',
    F9: '\x1b[20~', F10: '\x1b[21~', F11: '\x1b[23~', F12: '\x1b[24~'
  };

  /**
   * Dung chuoi escape cho phim dac biet (Tab/ESC/Enter/mui ten) co kem phim bo
   * tro Ctrl/Shift dang cho. Theo chuan xterm modifier m = 1 + shift + ctrl*4:
   *   - mui ten: \x1b[1;{m}{A|B|C|D} (vim/bash hieu), khong modifier -> KEY_MAP.
   *   - Tab: Shift+Tab -> \x1b[Z (back-tab chuan); con lai (gom Ctrl+Tab) -> \t.
   *   - Enter: Ctrl+Enter -> \n (LF); con lai -> \r.
   *   - ESC/Ctrl+C: giu nguyen (modifier khong co y nghia chuan).
   * @param {string} key - khoa trong KEY_MAP
   * @param {boolean} ctrl
   * @param {boolean} shift
   * @returns {string}
   */
  function resolveKeyCombo(key, ctrl, shift) {
    var m = 1 + (shift ? 1 : 0) + (ctrl ? 4 : 0);
    if (ARROW_FINAL[key]) {
      return m === 1 ? KEY_MAP[key] : '\x1b[1;' + m + ARROW_FINAL[key];
    }
    if (key === 'tab') return (shift && !ctrl) ? '\x1b[Z' : '\t';
    if (key === 'enter') return ctrl ? '\n' : '\r';
    return KEY_MAP[key];
  }

  // === Clipboard helpers (co fallback cho HTTP LAN) ===
  // Luu y: navigator.clipboard chi ton tai trong secure context (HTTPS hoac
  // localhost). Khi truy cap qua HTTP tren LAN/VPN thi no la undefined nen nut
  // copy/paste "khong lam gi". Cac ham duoi co fallback de van hoat dong.

  /** Hien thong bao ngan tren terminal (mau xam, khong gui vao tmux). */
  function notify(msg) {
    term.write('\r\n\x1b[2m' + msg + '\x1b[0m\r\n');
  }

  /**
   * Sao chep text vao clipboard. Thu navigator.clipboard truoc, neu khong co
   * thi fallback sang textarea + execCommand('copy').
   * @param {string} text
   * @returns {Promise<boolean>} true neu sao chep thanh cong
   */
  function copyToClipboard(text) {
    if (window.navigator.clipboard && window.navigator.clipboard.writeText) {
      return window.navigator.clipboard.writeText(text).then(function () { return true; })
        .catch(function () { return execCopy(text); });
    }
    return Promise.resolve(execCopy(text));
  }

  /** Fallback copy bang textarea an + execCommand. */
  function execCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  /**
   * Doc clipboard roi gui vao terminal. Thu navigator.clipboard truoc, neu
   * khong co thi fallback hoi nguoi dung qua prompt (ho tu Ctrl+Shift+V/dan).
   */
  function pasteFromClipboard() {
    if (window.navigator.clipboard && window.navigator.clipboard.readText) {
      window.navigator.clipboard.readText()
        .then(function (txt) { if (txt) sendInput(txt); })
        .catch(function () { promptPaste(); });
    } else {
      promptPaste();
    }
    term.focus();
  }

  /** Fallback paste: hop thoai cho nguoi dung dan text thu cong. */
  function promptPaste() {
    var txt = window.prompt(t('ctrl.pastePrompt'), '');
    if (txt) sendInput(txt);
  }

  /** Sao chep vung dang chon; bao trang thai len terminal. */
  function copySelection() {
    var sel = term.getSelection();
    if (!sel) { notify(t('ctrl.copyEmpty')); term.focus(); return; }
    copyToClipboard(sel).then(function (ok) {
      if (ok) notify(t('ctrl.copyOk'));
    });
    term.focus();
  }

  // So dong cuon moi lan bam nut (cuon tung phan cho de kiem soat)
  var SCROLL_LINES = 5;

  /**
   * Cuon noi dung terminal client-side qua scrollback cua xterm.js.
   * Khac ban Linux/tmux: ConPTY khong chiem alternate-screen nen scrollback
   * cua xterm hoat dong binh thuong -> cuon truc tiep tai client, khong goi server.
   * @param {'up'|'down'|'top'|'bottom'} action
   */
  function scrollSession(action) {
    switch (action) {
      case 'up': term.scrollLines(-SCROLL_LINES); break;
      case 'down': term.scrollLines(SCROLL_LINES); break;
      case 'top': term.scrollToTop(); break;
      case 'bottom': term.scrollToBottom(); break;
      default: break;
    }
  }

  if (controlBar) {
    controlBar.addEventListener('click', function (e) {
      var btn = e.target.closest('.ctrl-btn');
      if (!btn) return;

      // Nut bo tro dinh (sticky) Ctrl/Shift: bat/tat cho ky tu ke tiep
      var mod = btn.dataset.mod;
      if (mod === 'ctrl') { pendingCtrl = !pendingCtrl; updateModifierButtons(); focusActive(); return; }
      if (mod === 'shift') { pendingShift = !pendingShift; updateModifierButtons(); focusActive(); return; }

      // Nut bat/tat o nhap lieu (runtime, ghi de mac dinh tu config)
      if (btn.dataset.toggle === 'input') {
        inputVisible = !inputVisible;
        applyKeyboardMode();
        focusActive();
        return;
      }

      // Nut cuon → cuon scrollback xterm client-side
      var scroll = btn.dataset.scroll;
      if (scroll) {
        scrollSession(scroll);
        return;
      }

      // Nut copy/paste (co fallback cho HTTP LAN)
      var action = btn.dataset.action;
      if (action === 'copy') { copySelection(); return; }
      if (action === 'paste') { pasteFromClipboard(); return; }

      // Nut gui phim (Tab/ESC/Enter/mui ten...) — ket hop phim bo tro dang cho
      var key = btn.dataset.key;
      if (key && KEY_MAP[key] !== undefined) {
        sendInput(resolveKeyCombo(key, pendingCtrl, pendingShift));
        clearModifiers();
        focusActive();
      }
    });
  }

  // === O nhap lieu rieng (bat/tat bang nut toggle tren control bar) ===
  // Soan van ban trong o nay (o input HTML that nen IME nhu Unikey hoat dong
  // dung) roi bam nut gui: CHI chen ca doan van ban vao terminal mot lan, KHONG
  // kem ky tu Enter/return o cuoi. Nguoi dung tu bam nut ⏎ tren control bar khi
  // muon chay lenh. Sau khi gui thi xoa o + giu focus.
  if (inputBar) {
    inputBar.addEventListener('submit', function (e) {
      e.preventDefault();
      var val = inputBarField.value;
      if (val) sendInput(val);
      inputBarField.value = '';
      inputBarField.focus();
    });
  }

  // Khi o nhap RONG: cac phim non-character (Enter/Tab/ESC/mui ten/Backspace/
  // Delete/Home/End/PageUp/PageDown/Insert/F1-F12) duoc gui THANG vao terminal
  // thay vi chi soan trong o. Khi o CO text thi giu nguyen hanh vi soan thao
  // binh thuong. Cung ho tro phim bo tro dinh (Ctrl/Shift) cho ky tu don va cho
  // cac phim non-character co modifier khi o rong (vd Ctrl roi 'c' -> ^C).
  if (inputBarField) {
    inputBarField.addEventListener('keydown', function (e) {
      var empty = inputBarField.value === '';

      // Ctrl dang cho + ky tu don (chi khi o rong) -> gui ma dieu khien
      if (empty && pendingCtrl && e.key && e.key.length === 1) {
        e.preventDefault();
        sendInput(applyModifiers(e.key));
        clearModifiers();
        return;
      }

      if (!empty) return;

      // Phim non-character co ho tro modifier (Enter/Tab/ESC/mui ten):
      // ket hop Ctrl/Shift dang cho qua resolveKeyCombo roi gui thang.
      var comboKey = NAV_COMBO_KEY[e.key];
      if (comboKey) {
        e.preventDefault();
        sendInput(resolveKeyCombo(comboKey, pendingCtrl, pendingShift));
        clearModifiers();
        return;
      }

      // Phim non-character con lai (Backspace/Delete/Home/End/PageUp...
      // /Insert/F1-F12): gui escape sequence tuong ung thang vao terminal.
      var navSeq = NAV_KEY_MAP[e.key];
      if (navSeq !== undefined) {
        e.preventDefault();
        sendInput(navSeq);
        clearModifiers();
      }
    });
  }

  // Khi o nhap dang hien: cham/click vao terminal se focus o nhap lieu thay vi
  // terminal (de bo go IME hoat dong dung tren o nhap that).
  if (container) {
    container.addEventListener('click', function () {
      if (inputVisible && inputBarField) {
        inputBarField.focus();
      }
    });
  }

  // === Nut ket noi lai (thu cong) ===
  btnReconnect.addEventListener('click', function () {
    reconnectAttempts = 0;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    connect();
  });

  // Dong ket noi sach khi roi trang (tranh reconnect thua)
  window.addEventListener('beforeunload', function () {
    manualClose = true;
    if (ws) ws.close();
  });

  connect();
})();
