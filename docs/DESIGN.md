# Quyết định thiết kế — WTCC

Tài liệu ghi lại các quyết định thiết kế quan trọng (ADR rút gọn) khi port TCC từ Linux/tmux sang Windows.

---

## ADR-1: ConPTY in-process + Ring Buffer thay tmux

### Bối cảnh

TCC bản Linux dựa hoàn toàn vào tmux: tạo/attach/detach phiên, scroll (copy-mode), pipe-pane logging. Windows không có tmux hay giải pháp tương đương với khả năng detach/attach native.

### Quyết định

Server WTCC tự sở hữu phiên ConPTY in-process thông qua node-pty. Mỗi phiên có ring buffer (circular buffer) trong RAM lưu output gần nhất (mặc định 1 MiB, cấu hình qua `serverScrollbackBytes`). Khi client WebSocket attach, server replay toàn bộ ring buffer để client thấy lịch sử.

### Lý do

- ConPTY là API terminal chính thức của Windows 10+ — stable, được Microsoft hỗ trợ.
- node-pty wrap ConPTY, API đơn giản (spawn/write/resize/kill/onData).
- Ring buffer cho phép replay scrollback cho client mới mà không cần lưu toàn bộ output ra đĩa.
- Mô hình đơn giản: server = owner duy nhất, không phụ thuộc process bên ngoài.

### Đánh đổi

- **Phiên chết khi server crash/restart** — không có cơ chế persist native. Đây là giới hạn cơ bản.
- **RAM**: Mỗi phiên chiếm `serverScrollbackBytes` RAM. 100 phiên × 1 MiB = 100 MiB.
- **Không detach/attach native**: "Detach" ở đây chỉ có nghĩa client ngắt WS, phiên vẫn chạy trong server process.
- Giảm thiểu (một phần): Chạy WTCC như Windows Service (nssm, session 0) giúp phiên SỐNG QUA LOGOUT. Nhưng REBOOT vẫn kết thúc tiến trình server → phiên ConPTY và scrollback RAM mất; auto-restart chỉ giúp server tự sẵn sàng lại ngay, KHÔNG giữ phiên qua reboot.

---

## ADR-2: Scroll client-side (xterm.js scrollback)

### Bối cảnh

TCC bản Linux dùng tmux copy-mode để scroll server-side vì tmux chiếm alternate screen và quản lý scrollback riêng.

### Quyết định

WTCC để xterm.js tự quản lý scrollback phía client. Server chỉ replay ring buffer khi attach — sau đó mọi scroll là local trong xterm.

### Lý do

- ConPTY không chiếm alternate screen như tmux → output đi thẳng tới client.
- xterm.js có scrollback buffer built-in, UX mượt (chuột wheel, touch).
- Đơn giản hoá: không cần implement scroll API server-side, giảm round-trip.

### Đánh đổi

- Nếu client mất kết nối rồi reconnect, chỉ thấy lại phần ring buffer server — phần scroll cũ trên client bị mất.
- Scrollback phía client bị giới hạn bởi bộ nhớ trình duyệt (xterm mặc định 1000 dòng, có thể tăng).

---

## ADR-3: Logging qua subscribe luồng thay pipe-pane

### Bối cảnh

TCC Linux dùng `tmux pipe-pane` để redirect output phiên vào file log. WTCC không có tmux.

### Quyết định

`session-logger.js` subscribe vào event `data` của pty (thông qua session-manager) để ghi output ra file log. Hỗ trợ 3 chế độ:
- `off`: không log
- `input`: chỉ ghi lệnh input
- `full`: ghi toàn bộ output

Log được xoá tự động theo `retentionDays`.

### Lý do

- Server đã sở hữu luồng output (mọi data từ pty đi qua session-manager) → chỉ cần thêm subscriber, không cần pipe bên ngoài.
- Kiến trúc event-driven tự nhiên của Node.js.
- Linh hoạt: dễ thêm/bớt chế độ log, filter, rotation.

### Đánh đổi

- Log chỉ hoạt động khi server đang chạy (nếu server crash giữa chừng, có thể mất vài byte cuối).
- Ghi file đồng bộ có thể ảnh hưởng throughput nếu output quá nhiều → dùng write stream có buffer.

---

## ADR-4: TLS bằng `selfsigned` (pure JS) thay openssl CLI

### Bối cảnh

TCC Linux dùng `openssl` CLI để sinh self-signed certificate. Windows không đảm bảo có `openssl` trong PATH.

### Quyết định

Dùng package npm `selfsigned` (pure JavaScript, dựa trên node-forge) để sinh cert khi cần. File `tls.js` kiểm tra cert có tồn tại không; nếu chưa thì tự sinh.

### Lý do

- Không phụ thuộc binary bên ngoài — hoạt động trên mọi Windows mà không cần cài thêm gì.
- API đơn giản: `selfsigned.generate(attrs, opts)`.
- Cert được lưu ra đĩa (`data/tls/`) để tái sử dụng qua restart.

### Đánh đổi

- Thêm 1 dependency (`selfsigned`).
- Cert tự sinh không được trình duyệt tin cậy → người dùng phải chấp nhận warning hoặc cung cấp cert riêng.
- Đây chỉ là giải pháp mặc định; production nên dùng cert thật (qua `tls.keyPath`/`tls.certPath`).

---

## ADR-5: Windows Service bằng nssm thay systemd

### Bối cảnh

TCC Linux dùng systemd service unit. Windows có Services nhưng không có công cụ tương đương đơn giản để wrap Node.js app thành service.

### Quyết định

Dùng **nssm** (Non-Sucking Service Manager) để đăng ký WTCC như Windows Service. Script `install-service.ps1` tự động cấu hình. Biến môi trường `WTCC_SERVICE` được set khi chạy dạng service.

### Lý do

- nssm miễn phí, nhẹ, stable, không cần code thêm trong app.
- Hỗ trợ auto-restart khi crash, chạy cùng boot, chạy không cần login.
- `WTCC_SERVICE` cho phép server biết mình đang chạy dạng service → tự restart khi đổi port/host (thay vì yêu cầu user restart thủ công).

### Đánh đổi

- Phụ thuộc nssm (cần cài riêng, không có trong Windows mặc định).
- Cần quyền Administrator để cài/gỡ service.
- Nếu không dùng nssm, user phải tự quản lý process (Task Scheduler hoặc chạy thủ công).

---

## ADR-6: Shell allowlist resolver

### Bối cảnh

WTCC hỗ trợ nhiều shell Windows khác nhau (cmd, PowerShell, pwsh, WSL, Git Bash). Cần xác định đường dẫn binary chính xác và đảm bảo chỉ spawn shell hợp lệ.

### Quyết định

`shells.js` duy trì allowlist các shell được hỗ trợ. Mỗi shell có logic resolver riêng để tìm binary path (kiểm tra PATH, registry, thư mục mặc định). Chỉ shell có trong config `shells` array mới được phép tạo phiên.

### Lý do

- **Bảo mật**: Ngăn spawn binary tuỳ ý — chỉ cho phép shell trong allowlist.
- **UX**: Tự detect shell nào có sẵn trên máy, ẩn shell không tìm thấy.
- **Đa dạng**: Mỗi shell Windows có cách tìm path khác nhau (cmd trong System32, pwsh có thể ở Program Files, gitbash trong Git folder...).

### Đánh đổi

- Cần maintain logic detect cho từng shell mới.
- Nếu shell cài ở vị trí không chuẩn, có thể không detect được (user cần cấu hình PATH).

---

## ADR-7: Giữ nguyên scrypt/CSRF/rate-limit/JSON meta-store/i18n từ bản gốc

### Bối cảnh

Nhiều thành phần của TCC bản gốc không phụ thuộc platform (Linux/Windows).

### Quyết định

Giữ nguyên thiết kế và implementation cho:
- **scrypt** (Node.js native `crypto.scryptSync`) — hash mật khẩu
- **CSRF double-submit cookie** — `tcc_csrf` cookie + `X-CSRF-Token` header
- **Rate-limit đăng nhập** — in-memory counter theo IP
- **JSON meta-store** — metadata phiên (note, lastAccess, order) lưu JSON file
- **i18n** — từ điển EN/VI phía client, setting `language` server-side

### Lý do

- Các thành phần này platform-agnostic, hoạt động tốt trên Windows.
- Giữ parity với bản gốc, giảm effort port, dễ maintain cùng codebase.
- scrypt là standard NIST, đủ mạnh cho use case single-user/small-team.
- JSON meta-store đơn giản, không cần database cho lượng metadata nhỏ.

### Đánh đổi

- Rate-limit in-memory reset khi server restart → chấp nhận được cho use case nhỏ.
- JSON file không atomic write → edge case mất data nếu crash giữa lúc ghi (rủi ro thấp).
- Không hỗ trợ multi-user (mỗi instance chỉ 1 password toàn cục).
