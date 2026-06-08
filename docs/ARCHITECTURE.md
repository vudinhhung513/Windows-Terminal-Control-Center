# Kiến trúc WTCC (Windows Terminal Control Center)

## Tổng quan

WTCC là ứng dụng web single-process, kiến trúc monolith đơn giản:

- **Backend**: Node.js ESM + Fastify 5 (HTTP/HTTPS + WebSocket)
- **Frontend**: HTML/CSS/JS thuần (không framework), xterm.js terminal emulator
- **Terminal**: ConPTY spawn qua node-pty (in-process, thuộc sở hữu server)
- **Dữ liệu**: JSON file (config, metadata phiên) + ring buffer RAM (scrollback)

## Stack công nghệ

| Tầng | Công nghệ |
|---|---|
| Runtime | Node.js 18+ (ESM) |
| HTTP framework | Fastify 5 |
| WebSocket | @fastify/websocket |
| Terminal PTY | node-pty (ConPTY trên Windows) |
| Auth | scrypt (native crypto) + cookie session |
| TLS | selfsigned (pure JS, tự sinh cert) |
| Encoding | iconv-lite |
| Frontend terminal | xterm.js + addon-fit |
| Frontend UI | Vanilla JS + CSS |

## Sơ đồ thành phần

```
┌─────────────────────────────────────────────────────────────────┐
│                        TRÌNH DUYỆT                              │
│  ┌──────────────┐    ┌───────────────────────────────────────┐  │
│  │  Dashboard   │    │  Terminal Page                         │  │
│  │ (index.html) │    │  (terminal.html)                      │  │
│  │              │    │  ┌─────────┐  ┌─────────────────────┐ │  │
│  │  REST API ◄──┼────┼──┤ xterm.js│  │ WebSocket client    │ │  │
│  │  calls       │    │  └────▲────┘  └──────────▲──────────┘ │  │
│  └──────────────┘    └───────┼──────────────────┼────────────┘  │
└──────────────────────────────┼──────────────────┼───────────────┘
                               │                  │
═══════════════════════════════╪══════════════════╪═══ HTTPS/WSS ══
                               │                  │
┌──────────────────────────────┼──────────────────┼───────────────┐
│                     SERVER WTCC (Node.js)        │               │
│                              │                  │               │
│  ┌───────────────────────────┼──────────────────┼────────────┐  │
│  │              Fastify 5 (app.js)              │            │  │
│  │  ┌────────────────────┐  │  ┌───────────────┴──────────┐ │  │
│  │  │   REST Routes      │  │  │   ws-session.js          │ │  │
│  │  │  sessions/meta/    │  │  │   (WebSocket bridge)     │ │  │
│  │  │  settings/logs     │  │  │   multi-device logic     │ │  │
│  │  └────────┬───────────┘  │  └───────────────┬──────────┘ │  │
│  │           │              │                  │            │  │
│  │  ┌────────┴───────────┐  │  ┌───────────────┴──────────┐ │  │
│  │  │   auth.js          │  │  │   session-manager.js     │ │  │
│  │  │   CSRF + rate-limit│  │  │   ┌───────────────────┐  │ │  │
│  │  └────────────────────┘  │  │   │ ConPTY (node-pty) │  │ │  │
│  │                          │  │   │ + Ring Buffer RAM  │  │ │  │
│  │  ┌────────────────────┐  │  │   └───────────────────┘  │ │  │
│  │  │ config.js          │  │  └───────────────────────────┘ │  │
│  │  │ meta-store.js      │  │                                │  │
│  │  │ password.js        │  │  ┌───────────────────────────┐ │  │
│  │  │ shells.js          │  │  │   session-logger.js       │ │  │
│  │  │ tls.js             │  │  │   (subscribe output)      │ │  │
│  │  └────────────────────┘  │  └───────────────────────────┘ │  │
│  └───────────────────────────┴───────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Filesystem: config.json, data/meta/*.json, data/logs/,   │  │
│  │              data/tls/key.pem + cert.pem                   │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## Mô hình phiên: ConPTY in-process + Ring Buffer

Đây là **khác biệt cốt lõi** so với bản Linux/tmux:

```
┌─────────────┐      ┌──────────────────────────────────────────┐
│  Browser A  │─WSS─▶│                                          │
├─────────────┤      │  session-manager.js                      │
│  Browser B  │─WSS─▶│  ┌────────────────┐  ┌───────────────┐  │
├─────────────┤      │  │ ConPTY process │  │ Ring Buffer   │  │
│  Browser C  │─WSS─▶│  │ (cmd/pwsh/...) │──│ (1 MiB RAM)  │  │
└─────────────┘      │  └────────────────┘  └───────────────┘  │
                     │         ▲                    │           │
                     │         │ stdin              │ stdout    │
                     │         │                    ▼           │
                     │  ┌──────┴─────┐    ┌────────────────┐   │
                     │  │ write()    │    │ broadcast to   │   │
                     │  │ from any WS│    │ all WS clients │   │
                     │  └────────────┘    └────────────────┘   │
                     └──────────────────────────────────────────┘
```

- **Server sở hữu pty**: ConPTY process là child process của server WTCC.
- **Ring buffer**: Mỗi phiên giữ scrollback trong RAM (cấu hình `serverScrollbackBytes`). Khi client mới attach, server replay toàn bộ buffer.
- **Multi-subscriber**: Nhiều WebSocket client cùng đọc/ghi vào 1 pty.
- **Resize global**: Kích thước terminal là chung cho phiên (last-writer-wins).
- **Phiên chết khi server chết**: Không có cơ chế detach/persist native như tmux.

## Luồng dữ liệu chính

### 1. Liệt kê phiên (Dashboard)

```
Browser → GET /api/sessions → sessions.js → session-manager.listSessions()
                                           + meta-store (notes, lastAccess, order)
       ← JSON [{name, shell, attached, note, lastAccess}]
```

### 2. Tạo phiên

```
Browser → POST /api/sessions {name, shell, path}
       → sessions.js → session-manager.createSession(name, shell, path)
                      → node-pty.spawn(shellBinary, args, {cwd})
                      → Ring buffer khởi tạo
       ← 201 {name, shell}
```

### 3. Kết nối terminal (WebSocket + Replay scrollback)

```
Browser → WS /ws/session/:name
       → ws-session.js: kiểm tra multi-device mode (takeover/lock)
       → session-manager.attach(name)
       → Gửi scrollback buffer hiện có → Browser (xterm render)
       → Stream song song: pty stdout → WS → xterm
                           xterm input → WS → pty stdin
```

### 4. Kill phiên

```
Browser → DELETE /api/sessions/:name
       → session-manager.killSession(name) → pty.kill()
       → Ring buffer giải phóng
       → meta-store xoá metadata
       ← 200 OK
```

### 5. Scroll (client-side)

Scroll hoàn toàn do xterm.js xử lý phía client (scrollback buffer của xterm). Server không can thiệp — khác bản Linux nơi scroll qua tmux copy-mode.

### 6. Settings

```
Browser → GET /api/settings → settings.js → config.js (đọc config hiện tại)
Browser → PUT /api/settings {changes} → config.js validate + save
       → Nếu đổi port/host + WTCC_SERVICE → server tự restart
```

### 7. Đa ngôn ngữ (i18n)

- Config `language` lưu server-side.
- Frontend load từ điển EN/VI từ `public/js/i18n.js`, apply qua `data-i18n*` attributes và hàm `t()`.

### 8. Warnings (cảnh báo cấu hình)

```
server.js khởi động → app.js computeWarnings(config)
→ Kiểm tra: authEnabled=false, sessionSecret mặc định, host=0.0.0.0...
→ Hiển thị trên dashboard + console
```

### 9. Theme

Client-side: `theme.js` đọc config theme (dark/light/auto), apply CSS class, theo dõi `prefers-color-scheme` nếu auto.

### 10. Multi-device (takeover/lock)

- `ws-session.js` quản lý khi nhiều WS client cùng mở 1 phiên:
  - **takeover**: client mới chiếm quyền, client cũ bị disconnect.
  - **lock**: client mới bị từ chối nếu đã có client đang active.

## Bảo mật (tóm tắt)

| Lớp | Cơ chế |
|---|---|
| Xác thực | Scrypt password hash, cookie-based session |
| CSRF | Double-submit cookie (`tcc_csrf` + header `X-CSRF-Token`) |
| Rate-limit | Giới hạn lần đăng nhập sai (cấu hình maxAttempts/windowMs) |
| Transport | HTTPS mặc định (self-signed hoặc cert tuỳ chỉnh) |
| Input | Validate tên phiên, path, shell trước khi spawn |
| Shell | Allowlist — chỉ cho phép shell trong danh sách `shells` config |
| Logging | Không ghi secret/password vào log |

## So sánh với bản Linux (TCC)

| Khía cạnh | TCC (Linux) | WTCC (Windows) |
|---|---|---|
| Terminal multiplexer | tmux (detach/attach native) | ConPTY in-process (server sở hữu) |
| Phiên persist | Sống qua server restart (tmux riêng) | Chết khi server restart |
| Scroll | Server-side (tmux copy-mode) | Client-side (xterm scrollback) |
| Logging | pipe-pane | Subscribe luồng output |
| TLS | openssl CLI | selfsigned (pure JS) |
| Service | systemd | nssm (Windows Service) |
| Service detect | — | Biến môi trường `WTCC_SERVICE` |
| Shell | bash, zsh, fish... | cmd, PowerShell, pwsh, wsl, gitbash |
