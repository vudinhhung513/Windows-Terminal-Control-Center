# Lộ trình — WTCC

## v1.0.0 — Nền tảng (hiện tại)

Mục tiêu: đạt feature parity với TCC (bản Linux/tmux) trên nền tảng Windows.

### Đã hoàn thành

- [x] Quản lý phiên ConPTY in-process + ring buffer scrollback
- [x] Dashboard: tạo/đóng/đổi tên phiên, ghi chú, sắp xếp kéo-thả
- [x] Web terminal realtime (xterm.js + WebSocket)
- [x] Hỗ trợ nhiều shell: cmd, PowerShell, pwsh, WSL, Git Bash
- [x] Control bar: copy/paste, phím tắt
- [x] Scroll client-side (xterm scrollback)
- [x] Ô nhập mobile hỗ trợ IME tiếng Việt
- [x] Encoding (UTF-8, GBK, Big5, EUC-KR)
- [x] Đa ngôn ngữ EN/VI
- [x] Theme dark/light/auto
- [x] Xác thực: scrypt + CSRF + rate-limit
- [x] HTTPS self-signed (selfsigned, pure JS)
- [x] Logging phiên (off/input/full) + retention tự động
- [x] Multi-device mode (takeover/lock)
- [x] Cảnh báo cấu hình kém an toàn
- [x] Cài đặt Windows Service (nssm) + auto-restart
- [x] Settings UI (thay đổi cấu hình qua trình duyệt)

## Định hướng tương lai

> Các hướng dưới đây là **cân nhắc**, chưa cam kết timeline. Ưu tiên có thể thay đổi theo nhu cầu thực tế.

### Hub quản lý nhiều instance (TCC/WTCC)

- **Mục tiêu**: xây dựng một "Hub" trung tâm — single pane of glass — để xem và điều khiển nhiều instance TCC (Linux/macOS) và WTCC (Windows) từ một giao diện duy nhất, đăng nhập một lần.
- **Vai trò Hub**:
  - Registry các instance: tên, địa chỉ, nền tảng (Linux/Windows), trạng thái online/offline.
  - Tổng hợp danh sách phiên từ mọi instance.
  - Proxy/định tuyến terminal WebSocket tới instance đích.
  - Xác thực tập trung (SSO): người dùng đăng nhập Hub một lần, truy cập mọi instance qua Hub.
- **Vai trò Instance (TCC/WTCC)**: đóng vai "agent/node" — giữ nguyên toàn bộ chức năng hiện tại (quản lý phiên, REST API, WebSocket, auth cục bộ). Chỉ bổ sung khả năng đăng ký với Hub và endpoint cho Hub gọi.
- **Trạng thái**: định hướng nghiên cứu, chưa cam kết timeline.
- **Chi tiết kiến trúc**: xem [docs/HUB.md](HUB.md).

### Persistence phiên (nghiên cứu)

- Lưu/restore scrollback ra đĩa khi server shutdown gracefully → phục hồi lịch sử khi restart.
- **Giới hạn cơ bản**: Không thể detach/attach process ConPTY native trên Windows. Phiên pty vẫn chết khi server crash — chỉ scrollback history có thể khôi phục.
- Hướng tiếp cận khả thi: serialize ring buffer → file trước shutdown; restore vào xterm khi client reconnect (read-only history + phiên mới).

### Đa người dùng

- Hỗ trợ nhiều tài khoản (username/password riêng).
- Phân quyền: mỗi user chỉ thấy phiên của mình.
- Cần thay đổi: auth module, session ownership, meta-store schema.

### Thêm ngôn ngữ

- Bổ sung zh-CN (Simplified Chinese) vào từ điển i18n.
- Cơ chế i18n hiện tại (public/js/i18n.js) đã hỗ trợ mở rộng — chỉ cần thêm object ngôn ngữ mới.

### Cải thiện UX

- Tìm kiếm trong scrollback (search addon xterm.js).
- Tab completion hint.
- Upload/download file qua terminal (rz/sz hoặc drag-drop).
- Notification khi lệnh chạy xong (long-running command).

### Vận hành

- Health check endpoint (`/api/health`).
- Metrics cơ bản (số phiên active, memory usage, uptime).
- Backup/restore config + metadata.

## Giới hạn không thể vượt qua

| Giới hạn | Lý do |
|---|---|
| Không thể detach/attach ConPTY process native | Windows ConPTY không hỗ trợ tách process ra khỏi parent. Pty luôn thuộc tiến trình server. |
| Phiên chết khi server crash | Hệ quả trực tiếp của giới hạn trên. Chỉ có thể giảm thiểu (service auto-restart, save scrollback). |
| Resize global (last-writer-wins) | 1 pty = 1 kích thước terminal. Nhiều client khác nhau resize sẽ ghi đè lẫn nhau. |
