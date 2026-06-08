# Hub quản lý nhiều instance TCC/WTCC — Kiến trúc cơ bản

> Tài liệu định hướng kiến trúc. Chưa cam kết timeline triển khai.

## 1. Tổng quan & mục tiêu

Khi quản lý nhiều máy (mỗi máy chạy một instance TCC hoặc WTCC), người dùng phải
nhớ nhiều địa chỉ, đăng nhập từng cái, không có cái nhìn tổng hợp.

**Hub** giải quyết vấn đề này bằng cách cung cấp:

- **Single pane of glass**: một giao diện web duy nhất hiển thị tất cả instance và
  phiên terminal trên mọi máy.
- **SSO (Single Sign-On)**: đăng nhập Hub một lần, truy cập mọi instance mà không
  cần xác thực lại từng cái.
- **Tổng hợp phiên**: xem danh sách phiên từ tất cả instance, tìm kiếm, lọc theo
  máy/nền tảng.
- **Không thay thế instance**: Hub chỉ điều phối — mỗi instance vẫn tự quản lý
  phiên terminal trên máy của nó như hiện tại.

## 2. Thành phần

### Hub Server

- **Nền tảng**: Node.js + Fastify (giống stack hiện tại của TCC/WTCC).
- **Chức năng chính**:
  - UI dashboard tổng hợp (danh sách instance, danh sách phiên gom từ nhiều máy).
  - Instance registry: quản lý thông tin các instance đã đăng ký.
  - Auth tập trung: xác thực người dùng, cấp phiên làm việc.
  - Reverse proxy WebSocket/REST: chuyển tiếp request từ client tới instance đích.

### Instance Agent

- Chính là TCC/WTCC hiện tại + một lớp "agent" nhẹ bổ sung:
  - Đăng ký thông tin (tên, địa chỉ, nền tảng) với Hub.
  - Chấp nhận lệnh điều phối từ Hub (thông qua token xác thực riêng Hub↔instance).
  - Cung cấp endpoint health/status cho Hub poll.
- Toàn bộ chức năng hiện tại (session-manager, ws-session, auth cục bộ, REST API)
  **giữ nguyên** — instance vẫn hoạt động độc lập nếu không kết nối Hub.

### Lưu trữ registry

- **Giai đoạn đầu**: JSON file (giống meta-store hiện tại của WTCC) — đơn giản,
  không thêm dependency.
- **Khi cần mở rộng**: nâng lên SQLite (query linh hoạt hơn, hỗ trợ tìm kiếm/lọc
  khi số lượng instance lớn).

## 3. Sơ đồ kiến trúc

```
┌──────────────┐
│  Trình duyệt │
│  (Dashboard) │
└──────┬───────┘
       │ HTTPS
       ▼
┌──────────────────────────────────────────────┐
│                  HUB SERVER                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ Auth     │ │ Registry │ │ WS/REST      │ │
│  │ tập trung│ │ instance │ │ Reverse Proxy│ │
│  └──────────┘ └──────────┘ └──────┬───────┘ │
└──────────────────────────────────────┼───────┘
           │              │            │
           ▼              ▼            ▼
  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
  │ WTCC #1     │ │ TCC #2      │ │ WTCC #3     │
  │ (Windows)   │ │ (Linux)     │ │ (Windows)   │
  │ ┌─────────┐ │ │ ┌─────────┐ │ │ ┌─────────┐ │
  │ │ ConPTY  │ │ │ │  tmux   │ │ │ │ ConPTY  │ │
  │ └─────────┘ │ │ └─────────┘ │ │ └─────────┘ │
  └─────────────┘ └─────────────┘ └─────────────┘
```

## 4. Mô hình kết nối Hub ↔ Instance

### Phương án A — Hub chủ động gọi instance (pull)

Hub giữ danh sách địa chỉ + token của mỗi instance, chủ động gọi REST/WebSocket
trực tiếp tới instance khi cần.

| Ưu điểm | Nhược điểm |
|---|---|
| Đơn giản triển khai | Hub phải tới được instance (cùng mạng/VPN) |
| Instance không cần mở kết nối ngược | Khó hoạt động khi instance sau NAT/firewall |
| Dễ debug (request đi một chiều rõ ràng) | Hub cần retry/timeout khi instance offline |

### Phương án B — Instance kết nối ngược về Hub (reverse tunnel/outbound)

Instance chủ động mở kết nối (WebSocket hoặc tunnel) tới Hub. Hub sử dụng kết nối
đó để gửi lệnh và proxy traffic.

| Ưu điểm | Nhược điểm |
|---|---|
| Hoạt động được khi instance sau NAT/firewall | Phức tạp hơn đáng kể (quản lý tunnel, heartbeat) |
| Instance không cần IP public/port mở | Cần xử lý reconnect khi kết nối đứt |
| Phù hợp môi trường phân tán | Debug khó hơn (traffic hai chiều trên 1 kết nối) |

### Khuyến nghị

Bắt đầu với **Phương án A** cho mạng nội bộ hoặc VPN — đơn giản, đủ cho đa số
use-case ban đầu. Mở rộng sang Phương án B khi có nhu cầu quản lý instance qua
internet/NAT.

## 5. Xác thực & bảo mật

### Người dùng ↔ Hub

- Hub xác thực người dùng tập trung (một lần đăng nhập).
- Có thể tái sử dụng mô hình auth hiện tại (scrypt + cookie + CSRF) hoặc nâng lên
  JWT/session token tuỳ nhu cầu.

### Hub ↔ Instance

- Dùng **token/API key per-instance** — mỗi instance có một token riêng để Hub gọi.
- **Không** dùng lại mật khẩu người dùng cho kênh Hub↔instance.
- Khuyến nghị **HTTPS** (hoặc mTLS) cho kết nối Hub↔instance để bảo vệ token và
  dữ liệu terminal trên đường truyền.

### Cảnh báo bảo mật quan trọng

> Hub trở thành **điểm tập trung quyền lực**: ai kiểm soát Hub có thể thực thi lệnh
> từ xa trên nhiều máy (thông qua terminal proxy). Hub **phải** được bảo vệ nghiêm
> ngặt:
> - Hạn chế truy cập mạng vào Hub.
> - Audit log mọi thao tác qua Hub.
> - Xem xét MFA cho tài khoản Hub admin.
> - Giám sát bất thường (nhiều phiên mới cùng lúc, truy cập ngoài giờ...).

## 6. Luồng cơ bản

### Đăng ký instance

1. Admin thêm instance vào Hub: nhập tên, địa chỉ (host:port), nền tảng.
2. Hub sinh token cho instance đó, lưu vào registry.
3. Token được cấu hình trên instance (biến môi trường hoặc config file).
4. Hub gọi thử endpoint health của instance để xác nhận kết nối thành công.

### Poll trạng thái & tổng hợp phiên

1. Hub định kỳ gọi `GET /api/health` (hoặc endpoint tương đương) từng instance →
   cập nhật trạng thái online/offline trong registry.
2. Hub gọi `GET /api/sessions` từng instance online → tổng hợp danh sách phiên
   hiển thị trên dashboard Hub (kèm thông tin instance nguồn).

### Mở terminal qua Hub

1. Client (trình duyệt) chọn instance + phiên trên dashboard Hub.
2. Hub mở kết nối WebSocket tới `/ws/session/:name` của instance đích (đính kèm
   token instance trong header).
3. Hub proxy hai chiều: client ↔ Hub ↔ instance WebSocket.
4. Client thao tác terminal bình thường — Hub chỉ chuyển tiếp dữ liệu.

## 7. Tác động lên codebase hiện tại (phía instance TCC/WTCC)

Các thay đổi tối thiểu cần thiết trên mỗi instance:

| Thay đổi | Mô tả |
|---|---|
| Endpoint `/api/health` | Trả về trạng thái instance (uptime, số phiên active, nền tảng). Có thể trùng với hướng "Vận hành" trong roadmap. |
| Token auth cho Hub | Cơ chế xác thực riêng (header `X-Hub-Token` hoặc tương đương) bên cạnh cookie auth người dùng hiện tại. Cho phép Hub gọi API mà không cần cookie. |
| Config: hub address + token | Thêm trường cấu hình để instance biết Hub nào quản lý nó (dùng cho phương án B nếu triển khai sau). |

**Giữ nguyên**: session-manager, ws-session handler, auth người dùng, dashboard cục
bộ. Hub chỉ là tầng điều phối bên trên — instance hoạt động độc lập hoàn toàn khi
không có Hub.

## 8. Giới hạn & lưu ý

- **Phiên vẫn thuộc từng instance**: Hub không sở hữu pty. Mỗi phiên terminal chạy
  trên máy của instance đó (ConPTY trên Windows, tmux trên Linux/macOS).
- **Instance/máy reboot → phiên trên máy đó mất** (như hiện tại). Hub không khắc phục
  được giới hạn nền tảng — ConPTY không hỗ trợ detach/attach process.
- **Hub chỉ điều phối**: nếu Hub down, các instance vẫn hoạt động bình thường qua
  truy cập trực tiếp (URL riêng từng instance). Hub là lớp tiện ích, không phải
  single point of failure cho chức năng terminal.
- **Latency**: proxy qua Hub thêm một hop mạng. Trong mạng nội bộ thường không đáng
  kể, nhưng cần lưu ý khi Hub và instance ở xa nhau.
- **Chưa hỗ trợ di chuyển phiên giữa instance**: không thể "move" một phiên từ máy A
  sang máy B — pty gắn với process trên máy vật lý.
