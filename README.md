# Windows Terminal Control Center (WTCC)

> Bản Windows của [Terminal Control Center (TCC)](https://github.com/vudinhhung513/Terminal-Control-Center) (bản Linux/macOS) — ứng dụng web quản lý phiên terminal Windows qua trình duyệt, sử dụng ConPTY + xterm.js.

## Giới thiệu

WTCC là web server (Node.js + Fastify) cho phép tạo, quản lý và tương tác với nhiều phiên terminal Windows ngay trên trình duyệt. Phiên terminal được spawn qua ConPTY (node-pty), hỗ trợ cmd, Windows PowerShell, PowerShell 7 (pwsh), WSL bash và Git Bash.

## ⚠️ Mô hình phiên — Quan trọng

WTCC **KHÔNG** dùng tmux (không có trên Windows). Thay vào đó, server tự sở hữu phiên ConPTY in-process:

- **Phiên sống độc lập với trình duyệt** — đóng tab, mất mạng không ảnh hưởng (giống tmux).
- **Phiên CHẾT khi server WTCC restart/crash** — vì pty thuộc tiến trình server.
- **Sống qua logout**: Chạy WTCC như **Windows Service** (qua nssm, chạy ở session 0) → phiên tồn tại khi người dùng đăng xuất (logout).
- **KHÔNG sống qua reboot**: Khởi động lại máy (reboot) kết thúc tiến trình server → mọi phiên ConPTY và scrollback trong RAM bị mất. Auto-restart của service chỉ giúp **server tự sẵn sàng lại ngay** sau reboot, **không** khôi phục được phiên cũ (giới hạn nền tảng của ConPTY).

Nhiều client WebSocket có thể subscribe cùng 1 phiên; khi attach, server replay scrollback từ ring buffer trong RAM (mặc định 1 MiB).

## Tính năng

- **Dashboard** — tạo/đóng/đổi tên phiên, ghi chú, hiển thị lần truy cập cuối, kéo-thả sắp xếp
- **Web terminal realtime** — xterm.js + WebSocket, scroll client-side
- **Nhiều shell** — cmd, PowerShell, pwsh, WSL bash, Git Bash (allowlist cấu hình)
- **Control bar** — copy/paste, phím tắt Ctrl+C/D/L, clear
- **Ô nhập mobile** — hỗ trợ gõ tiếng Việt IME trên điện thoại
- **Encoding** — UTF-8 mặc định, hỗ trợ GBK/Big5/EUC-KR (iconv-lite)
- **Đa ngôn ngữ** — English / Tiếng Việt (i18n client + server)
- **Theme** — dark / light / auto (theo hệ thống)
- **Xác thực** — scrypt password hash + CSRF double-submit cookie + rate-limit đăng nhập
- **HTTPS** — tự sinh self-signed certificate (thư viện `selfsigned`, không cần openssl)
- **Logging** — ghi log phiên (off/input/full) qua subscribe luồng output, tự xoá theo retention
- **Multi-device** — chế độ takeover (chiếm) hoặc lock (khoá) khi nhiều thiết bị cùng mở 1 phiên
- **Cảnh báo cấu hình** — hiển thị warning khi phát hiện cấu hình kém an toàn (auth tắt, secret mặc định, bind 0.0.0.0...)

## Yêu cầu hệ thống

| Thành phần | Yêu cầu |
|---|---|
| OS | Windows 10/11 hoặc Windows Server 2019+ |
| Node.js | 18+ (khuyến nghị 20 LTS) |
| node-pty | Cần prebuilt binaries hoặc [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (C++ workload) |
| nssm | Tùy chọn — cần nếu muốn cài Windows Service ([nssm.cc](https://nssm.cc)) |
| Git for Windows | Tùy chọn — cần nếu dùng shell `gitbash` |
| WSL | Tùy chọn — cần nếu dùng shell `wsl` |

## Cài đặt

```powershell
# Clone repo
git clone <repo-url> Windows-Terminal-Control-Center
cd Windows-Terminal-Control-Center

# Cài dependencies
npm install

# Tạo file cấu hình
Copy-Item config.example.json config.json

# (Tuỳ chỉnh config.json theo nhu cầu)

# Chạy server
./start.ps1
```

Server khởi động tại `https://localhost:7171` (HTTPS mặc định, self-signed cert).

## Cấu hình

File `config.json` (tạo từ `config.example.json`):

| Field | Mặc định | Mô tả |
|---|---|---|
| `host` | `"0.0.0.0"` | Địa chỉ bind (dùng `127.0.0.1` nếu chỉ truy cập local) |
| `port` | `7171` | Cổng HTTP/HTTPS |
| `authEnabled` | `false` | Bật/tắt xác thực mật khẩu |
| `password` | `""` | Hash scrypt của mật khẩu (được tạo tự động qua Settings UI) |
| `sessionSecret` | `"REPLACE_WITH_RANDOM_SECRET"` | Secret cho cookie session — **BẮT BUỘC ĐỔI trong production** |
| `shell` | `"PowerShell"` | Shell mặc định cho phiên mới |
| `shells` | `["cmd","PowerShell","pwsh","wsl","gitbash"]` | Danh sách shell được phép |
| `theme` | `"dark"` | Giao diện: `dark` / `light` / `auto` |
| `defaultPath` | `""` | Thư mục mặc định khi tạo phiên (hỗ trợ `~`) |
| `sessionPrefix` | `"wtcc"` | Tiền tố tên phiên tự sinh |
| `serverScrollbackBytes` | `1048576` | Kích thước ring buffer scrollback mỗi phiên (byte) |
| `termFontFamily` | `"monospace"` | Font terminal |
| `termFontSize` | `14` | Cỡ chữ terminal desktop |
| `termFontSizeMobile` | `12` | Cỡ chữ terminal mobile |
| `termEncoding` | `"utf-8"` | Encoding output (`utf-8`, `gbk`, `big5`, `euc-kr`...) |
| `multiDeviceMode` | `"takeover"` | Chế độ đa thiết bị: `takeover` (chiếm) / `lock` (khoá) |
| `logging.mode` | `"off"` | Chế độ log phiên: `off` / `input` / `full` |
| `logging.retentionDays` | `7` | Số ngày giữ log |
| `language` | `"en"` | Ngôn ngữ giao diện: `en` / `vi` |
| `loginRateLimit.enabled` | `true` | Bật rate-limit đăng nhập |
| `loginRateLimit.maxAttempts` | `5` | Số lần thử tối đa |
| `loginRateLimit.windowMs` | `60000` | Thời gian cửa sổ rate-limit (ms) |
| `tls.enabled` | `true` | Bật HTTPS (self-signed nếu không chỉ định cert) |
| `tls.keyPath` | `"data/tls/key.pem"` | Đường dẫn private key |
| `tls.certPath` | `"data/tls/cert.pem"` | Đường dẫn certificate |

### Giao diện Settings

Truy cập trang Settings trên dashboard để thay đổi cấu hình trực tiếp qua trình duyệt (áp dụng ngay, không cần restart thủ công).

### HTTPS

Mặc định WTCC chạy HTTPS với self-signed certificate (tự sinh lần đầu). Trình duyệt sẽ cảnh báo — chấp nhận để tiếp tục, hoặc cung cấp cert riêng qua `tls.keyPath`/`tls.certPath`.

### Đổi port

Sửa `port` trong `config.json` hoặc qua Settings UI. Nếu chạy dạng service (biến môi trường `WTCC_SERVICE` được set), server tự restart khi đổi port/host.

## Chạy thủ công

```powershell
./start.ps1
```

Script PowerShell khởi động server Node.js.

### Lỗi: không chạy được script (Execution Policy)

Mặc định PowerShell có thể chặn chạy script (`.ps1`). Nếu khi chạy `./start.ps1` gặp lỗi dạng *"... cannot be loaded because running scripts is disabled on this system"* (PSSecurityException / UnauthorizedAccess), đó là do **Execution Policy**, KHÔNG phải thiếu file.

> Lưu ý: nếu gặp lỗi *"The term 'start.ps1' is not recognized..."* thì do PowerShell không chạy lệnh từ thư mục hiện tại — phải gõ có tiền tố `.\` : `.\start.ps1`.

Kiểm tra policy hiện tại:

```powershell
Get-ExecutionPolicy
```

Nếu kết quả là `Restricted`, dùng một trong các cách sau.

**Cách 1 — Bỏ chặn cho phiên hiện tại (khuyến nghị, không cần Admin):**

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\start.ps1
```

**Cách 2 — Bỏ chặn cho tài khoản hiện tại (mở PowerShell bằng quyền Administrator):**

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Xác nhận bằng `Y`, sau đó:

```powershell
.\start.ps1
```

**Cách 3 — Chạy trực tiếp, bỏ qua policy (không đổi cấu hình hệ thống):**

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

Hoặc với PowerShell 7:

```powershell
pwsh -ExecutionPolicy Bypass -File .\start.ps1
```

Áp dụng tương tự cho `install-service.ps1` / `uninstall-service.ps1` nếu gặp lỗi tương tự.

## Cài Windows Service (nssm)

Chạy với quyền Administrator:

```powershell
./install-service.ps1
```

Service chạy ở session 0 nên phiên terminal tồn tại qua **logout**. Lưu ý: khi **reboot**, tiến trình server bị kết thúc nên mọi phiên ConPTY (và scrollback trong RAM) sẽ mất; auto-restart chỉ giúp server tự chạy lại ngay sau khi khởi động máy, không khôi phục phiên cũ.

Gỡ service:

```powershell
./uninstall-service.ps1
```

## REST API

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/sessions` | Danh sách phiên |
| POST | `/api/sessions` | Tạo phiên mới |
| DELETE | `/api/sessions/:name` | Đóng (kill) phiên |
| POST | `/api/sessions/:name/touch` | Cập nhật thời gian truy cập |
| PUT | `/api/sessions/:name/note` | Cập nhật ghi chú phiên |
| PUT | `/api/sessions/:name/rename` | Đổi tên phiên |
| PUT | `/api/sessions/order` | Sắp xếp thứ tự phiên |
| GET | `/api/settings` | Lấy cấu hình hiện tại |
| PUT | `/api/settings` | Cập nhật cấu hình |
| GET | `/api/config` | Lấy config công khai (theme, font, language...) |
| POST | `/api/login` | Đăng nhập |
| POST | `/api/logout` | Đăng xuất |
| GET | `/api/logs` | Danh sách file log |
| GET | `/api/logs/:name` | Nội dung file log |
| DELETE | `/api/logs/:name` | Xoá file log |
| WS | `/ws/session/:name` | WebSocket kết nối terminal phiên |

> Các request thay đổi trạng thái cần header `X-CSRF-Token` (giá trị từ cookie `tcc_csrf`).

## Cấu trúc thư mục

```
Windows-Terminal-Control-Center/
├── config.example.json      # Mẫu cấu hình
├── config.json              # Cấu hình thực (gitignored)
├── start.ps1                # Script khởi động
├── install-service.ps1      # Cài Windows Service
├── uninstall-service.ps1    # Gỡ Windows Service
├── package.json
├── src/
│   ├── server.js            # Entry point
│   ├── app.js               # Fastify app builder
│   ├── config.js            # Load/validate/save config
│   ├── auth.js              # Xác thực, CSRF, rate-limit
│   ├── password.js          # Scrypt hash/verify
│   ├── session-manager.js   # Quản lý phiên ConPTY + ring buffer
│   ├── shells.js            # Allowlist shell resolver
│   ├── meta-store.js        # JSON metadata phiên
│   ├── session-logger.js    # Ghi log phiên
│   ├── tls.js               # TLS cert management
│   ├── ws-session.js        # WebSocket bridge ConPTY↔xterm
│   └── routes/
│       ├── sessions.js      # API phiên
│       ├── meta.js          # API metadata
│       ├── settings.js      # API cài đặt
│       └── logs.js          # API logs
├── public/
│   ├── index.html           # Dashboard
│   ├── terminal.html        # Trang terminal
│   ├── manifest.json
│   ├── css/styles.css
│   ├── js/
│   │   ├── dashboard.js     # Logic dashboard
│   │   ├── terminal.js      # Logic terminal + xterm
│   │   ├── i18n.js          # Đa ngôn ngữ EN/VI
│   │   └── theme.js         # Theme switcher
│   └── vendor/
│       ├── xterm.js
│       ├── xterm.css
│       └── addon-fit.js
├── docs/                    # Tài liệu chi tiết
└── test/                    # Unit tests
```

## Tài liệu chi tiết

- [Kiến trúc (ARCHITECTURE.md)](docs/ARCHITECTURE.md)
- [Quyết định thiết kế (DESIGN.md)](docs/DESIGN.md)
- [Bản đồ mã nguồn (CODEMAP.md)](docs/CODEMAP.md)
- [Lộ trình (ROADMAP.md)](docs/ROADMAP.md)
- [Quy ước đa ngôn ngữ (I18N.md)](docs/I18N.md)

## ⚠️ Cảnh báo bảo mật

**WTCC là web terminal — cho phép thực thi lệnh từ xa trên máy Windows.** Hãy đảm bảo:

1. **Bật xác thực** (`authEnabled: true`) và đặt mật khẩu mạnh
2. **Đổi `sessionSecret`** — KHÔNG dùng giá trị mặc định
3. **Bind `127.0.0.1`** nếu chỉ dùng local (không mở ra mạng)
4. **Dùng VPN hoặc SSH tunnel** nếu cần truy cập từ xa
5. **Cấu hình firewall** — chặn port 7171 từ mạng không tin cậy
6. **HTTPS luôn bật** (mặc định đã bật) — không tắt trừ khi đã có reverse proxy TLS

## Build node-pty trên Windows

Nếu `npm install` báo lỗi liên quan node-pty native module:

1. Cài [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) với workload **"Desktop development with C++"**
2. Hoặc chạy: `npm install --global windows-build-tools` (cần Administrator)
3. Đảm bảo Python 3.x có trong PATH

Xem thêm: [node-pty README](https://github.com/microsoft/node-pty#windows)

## Giấy phép

Xem file LICENSE.
