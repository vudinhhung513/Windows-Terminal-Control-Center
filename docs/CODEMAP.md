# Bản đồ mã nguồn — WTCC

Tài liệu mức cao mô tả cấu trúc module, vai trò từng file, và tiện ích dùng chung. Dùng để tra cứu nhanh khi cần tìm/sửa code.

## Cấu trúc thư mục

```
Windows-Terminal-Control-Center/
├── src/                    # Backend (Node.js ESM)
│   ├── server.js           # Entry point
│   ├── app.js              # Fastify app builder
│   ├── config.js           # Config loader
│   ├── auth.js             # Xác thực
│   ├── password.js         # Hash mật khẩu
│   ├── session-manager.js  # Quản lý phiên ConPTY
│   ├── shells.js           # Shell resolver
│   ├── meta-store.js       # Metadata phiên
│   ├── session-logger.js   # Ghi log phiên
│   ├── tls.js              # TLS cert management
│   ├── ws-session.js       # WebSocket bridge
│   └── routes/
│       ├── sessions.js     # API phiên
│       ├── meta.js         # API metadata
│       ├── settings.js     # API cài đặt
│       └── logs.js         # API logs
├── public/                 # Frontend (static files)
│   ├── index.html          # Dashboard page
│   ├── terminal.html       # Terminal page
│   ├── manifest.json       # PWA manifest
│   ├── css/styles.css      # Stylesheet
│   ├── js/
│   │   ├── dashboard.js    # Logic dashboard
│   │   ├── terminal.js     # Logic terminal + xterm
│   │   ├── i18n.js         # Đa ngôn ngữ
│   │   └── theme.js        # Theme switcher
│   └── vendor/
│       ├── xterm.js        # Terminal emulator lib
│       ├── xterm.css       # xterm styles
│       └── addon-fit.js    # Auto-fit addon
├── test/                   # Unit tests
├── docs/                   # Tài liệu
├── config.example.json     # Mẫu cấu hình
├── start.ps1               # Script khởi động
├── install-service.ps1     # Cài Windows Service
├── uninstall-service.ps1   # Gỡ Windows Service
├── package.json
└── eslint.config.js
```

## Backend — Bảng module

| File | Vai trò |
|---|---|
| `src/server.js` | Entry point: đọc config, đọc version từ package.json, gọi `ensureCert` (TLS), build app, listen, khởi động logger loop. |
| `src/app.js` | Build Fastify app: đăng ký plugin (static, cookie, websocket), routes, auth hooks, CSRF. Export `buildApp()` + `computeWarnings()`. |
| `src/config.js` | Load/validate/save `config.json`. Export: `loadConfig()`, `saveConfig()`, `DEFAULTS`. Merge user config với defaults, validate types. |
| `src/auth.js` | Đăng ký route login/logout, middleware kiểm tra session cookie, CSRF double-submit (set cookie `tcc_csrf` + check header `X-CSRF-Token`), rate-limit đăng nhập. |
| `src/password.js` | Hash và verify mật khẩu bằng scrypt (native `crypto`). Export: `hashPassword()`, `verifyPassword()`. |
| `src/session-manager.js` | **Module trung tâm** — quản lý toàn bộ phiên ConPTY. Export: `validateName()`, `expandHome()`, `listSessions()`, `createSession()`, `killSession()`, `renameSession()`, `hasSession()`, `isAttached()`, `attach()`, `write()`, `resize()`, `getScrollback()`, `setOnExit()`. Sở hữu ring buffer scrollback cho mỗi phiên. |
| `src/shells.js` | Allowlist shell Windows. Detect binary path cho từng shell (cmd, PowerShell, pwsh, wsl, gitbash). Export: danh sách shell khả dụng + resolve path. |
| `src/meta-store.js` | Lưu/đọc metadata phiên (note, lastAccess, order) dạng JSON file. Hỗ trợ override thư mục data qua env `WTCC_DATA_DIR`. |
| `src/session-logger.js` | Ghi log output phiên ra file. Subscribe vào luồng data từ session-manager. Hỗ trợ mode off/input/full, tự xoá file cũ theo `retentionDays`. |
| `src/tls.js` | Quản lý TLS certificate. Kiểm tra cert tồn tại, nếu chưa thì sinh self-signed bằng package `selfsigned`. |
| `src/ws-session.js` | WebSocket handler: bridge giữa client WS và ConPTY. Xử lý multi-device mode (takeover/lock), replay scrollback khi attach. |
| `src/routes/sessions.js` | REST endpoints: list, create, kill, touch, rename phiên. |
| `src/routes/meta.js` | REST endpoints: get/put note, put order. |
| `src/routes/settings.js` | REST endpoints: get/put settings (validate + save config, trigger restart nếu cần). |
| `src/routes/logs.js` | REST endpoints: list logs, get log content, delete log. |

## Frontend — Bảng module

| File | Vai trò |
|---|---|
| `public/index.html` | Dashboard: hiển thị danh sách phiên, form tạo mới, kéo-thả sắp xếp, ghi chú, cảnh báo cấu hình. |
| `public/terminal.html` | Trang terminal: embed xterm.js, control bar (copy/paste/phím), ô nhập mobile. |
| `public/js/dashboard.js` | Logic dashboard: fetch phiên, render card, drag-drop, create/kill/rename phiên, hiển thị warnings. |
| `public/js/terminal.js` | Logic terminal: khởi tạo xterm + addon-fit, kết nối WebSocket, xử lý resize, control bar actions, encoding. |
| `public/js/i18n.js` | Từ điển đa ngôn ngữ EN/VI. Hàm `t(key)`, apply text qua `data-i18n*` attributes. Đọc config language. |
| `public/js/theme.js` | Theme dark/light/auto. Đọc config, apply CSS class, theo dõi `prefers-color-scheme` media query. |
| `public/vendor/xterm.js` | Thư viện xterm.js (bundled). |
| `public/vendor/addon-fit.js` | xterm addon auto-fit terminal vào container. |

## Tiện ích dùng chung (shared utilities)

Các module được dùng bởi nhiều thành phần khác — kiểm tra đây trước khi viết code mới:

| Module | Dùng bởi | Chức năng |
|---|---|---|
| `src/config.js` | server, app, routes/settings, session-manager, session-logger | Load/save config, cung cấp DEFAULTS |
| `src/password.js` | auth, routes/settings | Hash/verify mật khẩu |
| `src/session-manager.js` | routes/sessions, ws-session, session-logger | **MỌI thao tác phiên đều qua module này** |
| `src/meta-store.js` | routes/sessions, routes/meta, dashboard | Metadata phiên (note, order, lastAccess) |
| `src/shells.js` | session-manager, routes/sessions, routes/settings | Resolve shell path, list available |
| `public/js/i18n.js` | dashboard.js, terminal.js, index.html, terminal.html | Text đa ngôn ngữ |
| `public/js/theme.js` | dashboard.js, terminal.js | Apply theme |

## Quy tắc quan trọng

### Thao tác phiên terminal: LUÔN qua `session-manager.js`

**KHÔNG BAO GIỜ** tương tác trực tiếp với node-pty từ routes hay ws-session. Mọi thao tác (create, kill, write, resize, attach, getScrollback) phải gọi qua session-manager. Module này là single source of truth cho trạng thái phiên.

### Khi thêm/sửa module

1. **Search codebase trước** để kiểm tra chức năng đã tồn tại chưa.
2. Nếu thêm module mới hoặc đổi vai trò module hiện có → **cập nhật file này** (`CODEMAP.md`).
3. Nếu thêm tiện ích dùng chung → ghi vào bảng "Tiện ích dùng chung" ở trên.
4. Giữ file header (mô tả chức năng) và comment block tiếng Việt trong code.
