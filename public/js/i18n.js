/**
 * file: i18n.js
 * Chuc nang: He thong da ngon ngu (EN/VI) cho frontend. Cung cap tu dien,
 *            ham dich t() va apply() de dich cac phan tu co thuoc tinh
 *            data-i18n / data-i18n-placeholder / data-i18n-title.
 * Mac dinh tieng Anh ('en'); doi qua Settings (luu trong config server).
 */

(function () {
  'use strict';

  // Tu dien dich: key -> { en, vi }
  var DICT = {
    // Header / chung
    'app.title': { en: 'Terminal Control Center', vi: 'Terminal Control Center' },
    'btn.settings': { en: '\u2699 Settings', vi: '\u2699 Cài đặt' },
    'btn.logs': { en: '\u{1F4C4} Logs', vi: '\u{1F4C4} Log' },
    'btn.theme': { en: 'Theme', vi: 'Giao diện' },
    'btn.logout': { en: 'Log out', vi: 'Đăng xuất' },

    // Dang nhap
    'login.title': { en: 'Log in', vi: 'Đăng nhập' },
    'login.password': { en: 'Password', vi: 'Mật khẩu' },
    'login.submit': { en: 'Log in', vi: 'Đăng nhập' },
    'login.needPassword': { en: 'Please enter a password.', vi: 'Vui lòng nhập mật khẩu.' },
    'login.wrong': { en: 'Wrong password.', vi: 'Sai mật khẩu.' },

    // Toolbar
    'toolbar.sessionName': { en: 'Session name (option, only A-Z a-z 0-9 _ -)', vi: 'Tên phiên (tuỳ chọn, chỉ A-Z a-z 0-9 _ -)' },
    'toolbar.create': { en: '+ New session', vi: '+ Tạo phiên mới' },

    // Session card
    'card.created': { en: 'Created: ', vi: 'Tạo: ' },
    'card.windows': { en: ' \u00b7 Windows: ', vi: ' \u00b7 Cửa sổ: ' },
    'card.lastAccess': { en: 'Last access: ', vi: 'Truy cập cuối: ' },
    'card.neverAccessed': { en: 'Never accessed', vi: 'Chưa truy cập' },
    'card.attached': { en: 'Attached', vi: 'Đang gắn' },
    'card.detached': { en: 'Detached', vi: 'Đã tách' },
    'card.notePlaceholder': { en: 'Note (what is this session for?)', vi: 'Ghi chú (phiên này làm gì?)' },
    'card.open': { en: 'Open', vi: 'Mở' },
    'card.rename': { en: 'Rename', vi: 'Đổi tên' },
    'card.kill': { en: 'Kill', vi: 'Kill' },
    'card.dragHint': { en: 'Drag to reorder', vi: 'Kéo để sắp xếp' },
    'card.empty': { en: 'No sessions yet. Create one to get started.', vi: 'Chưa có phiên nào. Tạo phiên mới để bắt đầu.' },

    // Thong bao dong
    'msg.killConfirm': { en: 'Are you sure you want to kill session "{name}"?', vi: 'Bạn có chắc muốn xoá phiên "{name}"?' },
    'msg.killFail': { en: 'Could not kill session: ', vi: 'Không thể xoá phiên: ' },
    'msg.renamePrompt': { en: 'New name for session "{name}" (only A-Z a-z 0-9 _ -):', vi: 'Tên mới cho phiên "{name}" (chỉ A-Z a-z 0-9 _ -):' },
    'msg.renameFail': { en: 'Could not rename: ', vi: 'Không đổi được tên: ' },
    'msg.noteFail': { en: 'Could not save note: ', vi: 'Không lưu được ghi chú: ' },
    'msg.loadSessionsFail': { en: 'Could not load sessions: ', vi: 'Không thể tải danh sách phiên: ' },
    'msg.createFail': { en: 'Could not create session: ', vi: 'Lỗi tạo phiên: ' },
    'msg.connectFail': { en: 'Could not connect to server.', vi: 'Không thể kết nối tới server.' },
    'msg.loadSettingsFail': { en: 'Could not load settings: ', vi: 'Không tải được cài đặt: ' },
    'msg.saveSettingsFail': { en: 'Could not save settings: ', vi: 'Lỗi lưu cài đặt: ' },
    'msg.unknownError': { en: 'Unknown error', vi: 'Lỗi không xác định' },
    'msg.connError': { en: 'Connection error', vi: 'Lỗi kết nối' },

    // Settings modal
    'settings.title': { en: 'Settings', vi: 'Cài đặt' },
    'settings.close': { en: 'Close', vi: 'Đóng' },
    'settings.authLegend': { en: 'Authentication', vi: 'Xác thực' },
    'settings.authEnabled': { en: 'Require password to access', vi: 'Yêu cầu mật khẩu khi truy cập' },
    'settings.newPassword': { en: 'New password', vi: 'Mật khẩu mới' },
    'settings.newPasswordHint': { en: '(leave blank to keep)', vi: '(để trống nếu không đổi)' },
    'settings.sessionMaxAge': { en: 'Login session lifetime (hours)', vi: 'Thời gian sống của phiên đăng nhập (giờ)' },
    'settings.sessionMaxAgeHint': { en: '(0 = until browser closes)', vi: '(0 = đến khi đóng trình duyệt)' },
    'settings.netLegend': { en: 'Network (requires restart)', vi: 'Mạng (cần khởi động lại)' },
    'settings.host': { en: 'Host', vi: 'Host' },
    'settings.port': { en: 'Port', vi: 'Port' },
    'settings.fontLegend': { en: 'Terminal font', vi: 'Font terminal' },
    'settings.fontFamily': { en: 'Font family', vi: 'Font family' },
    'settings.fontSize': { en: 'Desktop font size (8\u201340)', vi: 'Cỡ chữ desktop (8\u201340)' },
    'settings.fontSizeMobile': { en: 'Mobile font size (8\u201340)', vi: 'Cỡ chữ mobile (8\u201340)' },
    'settings.encodingLegend': { en: 'Encoding', vi: 'Bảng mã (encoding)' },
    'settings.encoding': { en: 'Character encoding', vi: 'Bảng mã ký tự' },
    'settings.encodingHint': { en: '(reopen terminal after change)', vi: '(đổi xong cần mở lại terminal)' },
    'settings.multiDeviceLegend': { en: 'Multi-device access', vi: 'Truy cập đa thiết bị' },
    'settings.multiDevice': { en: 'When a session is open on another device', vi: 'Khi phiên đang mở ở thiết bị khác' },
    'settings.multiDeviceTakeover': { en: 'Take over (disconnect the other device)', vi: 'Cướp quyền (ngắt thiết bị kia)' },
    'settings.multiDeviceLock': { en: 'Lock (block the new device)', vi: 'Khoá (chặn thiết bị mới)' },
    'settings.logLegend': { en: 'Terminal logging', vi: 'Ghi log terminal' },
    'settings.logMode': { en: 'Log level', vi: 'Mức độ log' },
    'settings.logModeOff': { en: 'Off', vi: 'Tắt' },
    'settings.logModeInput': { en: 'Input only (commands)', vi: 'Chỉ input (dòng lệnh)' },
    'settings.logModeFull': { en: 'Full (input + output)', vi: 'Đầy đủ (input + output)' },
    'settings.logRetention': { en: 'Retention (days)', vi: 'Số ngày lưu' },
    'settings.logWarn': { en: 'Warning: logging may record passwords typed at prompts (sudo/ssh). Logs are stored on the server in data/logs/.', vi: 'Cảnh báo: bật log có thể ghi lại mật khẩu gõ ở prompt (sudo/ssh). Log lưu trên server tại data/logs/.' },
    'settings.sessionLegend': { en: 'New session', vi: 'Phiên mới' },
    'settings.defaultPath': { en: 'Default path', vi: 'Thư mục mặc định' },
    'settings.defaultPathHint': { en: '(blank = shell default)', vi: '(để trống = mặc định của shell)' },
    'settings.rlLegend': { en: 'Login brute-force protection', vi: 'Chống brute-force đăng nhập' },
    'settings.rlEnabled': { en: 'Enable attempt limit', vi: 'Bật giới hạn số lần thử' },
    'settings.rlMax': { en: 'Max attempts', vi: 'Số lần thử tối đa' },
    'settings.rlWindow': { en: 'Within window (seconds)', vi: 'Trong cửa sổ (giây)' },
    'settings.langLegend': { en: 'Language', vi: 'Ngôn ngữ' },
    'settings.language': { en: 'Interface language', vi: 'Ngôn ngữ giao diện' },
    'settings.confirmLegend': { en: 'Confirm', vi: 'Xác nhận' },
    'settings.currentPassword': { en: 'Current password', vi: 'Mật khẩu hiện tại' },
    'settings.currentPasswordHint': { en: '(required for sensitive changes)', vi: '(bắt buộc khi đổi mục nhạy cảm)' },
    'settings.cancel': { en: 'Cancel', vi: 'Huỷ' },
    'settings.save': { en: 'Save', vi: 'Lưu' },
    'settings.saved': { en: 'Saved.', vi: 'Đã lưu.' },

    // Terminal page
    'term.back': { en: '\u2190 Back', vi: '\u2190 Quay lại' },
    'term.title': { en: 'Terminal: ', vi: 'Terminal: ' },
    'term.titleDefault': { en: 'Terminal', vi: 'Terminal' },
    'term.reconnect': { en: 'Reconnect', vi: 'Kết nối lại' },
    'term.missingName': { en: 'Missing ?name= parameter. Please go back to the dashboard.', vi: 'Thiếu tham số ?name=. Vui lòng quay lại dashboard.' },
    'term.disconnected': { en: '** Disconnected \u2014 reconnecting... **', vi: '** Mất kết nối \u2014 đang thử kết nối lại... **' },
    'term.takenOver': { en: '** Disconnected: session opened on another device. Press Reconnect to take it back. **', vi: '** Đã bị ngắt: phiên được mở ở thiết bị khác. Bấm Kết nối lại để giành lại. **' },
    'term.locked': { en: '** Session is in use on another device (locked). **', vi: '** Phiên đang được dùng ở thiết bị khác (đã khoá). **' },

    // Control bar titles
    'ctrl.enter': { en: 'Enter', vi: 'Enter' },
    'ctrl.esc': { en: 'ESC', vi: 'ESC' },
    'ctrl.ctrlc': { en: 'Ctrl+C', vi: 'Ctrl+C' },
    'ctrl.tab': { en: 'Tab', vi: 'Tab' },
    'ctrl.ctrl': { en: 'Ctrl (next key)', vi: 'Ctrl (phím kế tiếp)' },
    'ctrl.shift': { en: 'Shift (next key)', vi: 'Shift (phím kế tiếp)' },
    'ctrl.toggleInput': { en: 'Toggle input box', vi: 'Bật/tắt ô nhập' },
    'ctrl.up': { en: 'Up', vi: 'Lên' },
    'ctrl.down': { en: 'Down', vi: 'Xuống' },
    'ctrl.left': { en: 'Left', vi: 'Trái' },
    'ctrl.right': { en: 'Right', vi: 'Phải' },
    'ctrl.scrollUp': { en: 'Scroll up', vi: 'Cuộn lên' },
    'ctrl.scrollDown': { en: 'Scroll down', vi: 'Cuộn xuống' },

    // Copy/Paste (mobile control bar)
    'ctrl.copy': { en: 'Copy', vi: 'Sao chép' },
    'ctrl.paste': { en: 'Paste', vi: 'Dán' },
    'ctrl.copyOk': { en: 'Copied', vi: 'Đã sao chép' },
    'ctrl.copyEmpty': { en: 'Select text first', vi: 'Hãy bôi đen vùng cần sao chép' },
    'ctrl.pastePrompt': { en: 'Auto-paste needs HTTPS — over HTTP the browser blocks clipboard access. Paste your text here then OK (or use Ctrl+Shift+V):', vi: 'Dán tự động cần HTTPS — đang chạy HTTP nên trình duyệt chặn đọc clipboard. Dán nội dung vào đây rồi bấm OK (hoặc dùng Ctrl+Shift+V):' },

    // O nhap lieu (bat/tat bang nut toggle tren control bar)
    'input.placeholder': { en: 'Type here, then insert…', vi: 'Gõ vào đây, rồi chèn…' },
    'input.send': { en: 'Insert into terminal (no Enter)', vi: 'Chèn vào terminal (không kèm Enter)' },

    // Toolbar: chon shell
    'toolbar.shell': { en: 'Shell', vi: 'Shell' },

    // Settings: theme
    'settings.themeLegend': { en: 'Theme', vi: 'Giao diện' },
    'settings.theme': { en: 'Color theme', vi: 'Tông màu' },
    'theme.dark': { en: 'Dark', vi: 'Tối' },
    'theme.light': { en: 'Light', vi: 'Sáng' },
    'theme.auto': { en: 'Auto (system)', vi: 'Tự động (theo hệ thống)' },

    // Canh bao bao mat
    'warn.defaultSecret': { en: 'sessionSecret is still the default value \u2014 change it in config.json.', vi: 'sessionSecret v\u1EABn l\u00E0 gi\u00E1 tr\u1ECB m\u1EB7c \u0111\u1ECBnh \u2014 h\u00E3y \u0111\u1ED5i trong config.json.' },
    'warn.exposedNoAuth': { en: 'Server is exposed beyond localhost without authentication.', vi: 'Server \u0111ang expose ra ngo\u00E0i localhost m\u00E0 kh\u00F4ng b\u1EADt x\u00E1c th\u1EF1c.' },

    // Modal quan ly log
    'logs.title': { en: 'Logs', vi: 'Log terminal' },
    'logs.close': { en: 'Close', vi: 'Đóng' },
    'logs.hint': { en: 'View-only. Logs are read-only here; you can view or delete but not edit them.', vi: 'Chỉ xem. Log ở đây là read-only; bạn có thể xem hoặc xoá nhưng không sửa.' },
    'logs.empty': { en: 'No log files yet.', vi: 'Chưa có file log nào.' },
    'logs.view': { en: 'View', vi: 'Xem' },
    'logs.delete': { en: 'Delete', vi: 'Xoá' },
    'logs.back': { en: '← Back', vi: '← Quay lại' },
    'logs.deleteConfirm': { en: 'Delete log file for session "{name}"?', vi: 'Xoá file log của phiên "{name}"?' },
    'logs.loadFail': { en: 'Could not load logs: ', vi: 'Không tải được log: ' },
    'logs.deleteFail': { en: 'Could not delete log: ', vi: 'Không xoá được log: ' }
  };

  // Ngon ngu hien tai (mac dinh 'en')
  var current = 'en';

  /** Dat ngon ngu hien tai ('en' | 'vi'). */
  function setLang(lang) {
    current = (lang === 'vi') ? 'vi' : 'en';
  }

  /** Lay ma ngon ngu hien tai. */
  function getLang() {
    return current;
  }

  /**
   * Dich mot key. Ho tro thay the bien dang {name}.
   * @param {string} key
   * @param {object} [vars] - bien thay the
   * @returns {string}
   */
  function t(key, vars) {
    var entry = DICT[key];
    var str = entry ? (entry[current] !== undefined ? entry[current] : entry.en) : key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        str = str.replace('{' + k + '}', vars[k]);
      });
    }
    return str;
  }

  /**
   * Ap dung dich cho cac phan tu co data-i18n* trong root (mac dinh document).
   * @param {Element} [root]
   */
  function apply(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
    scope.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      el.title = t(el.getAttribute('data-i18n-title'));
    });
    // Cap nhat thuoc tinh lang cua document
    document.documentElement.setAttribute('lang', current);
  }

  // Expose ra global
  window.I18N = { setLang: setLang, getLang: getLang, t: t, apply: apply };
})();
