# 006 — Quản lý phiên đăng nhập khách hàng lâu dài (Long-lived Session)

Trạng thái: Đã chốt ngày 2026-10-03.  
Nguồn: Yêu cầu của chủ shop Son về việc khách mua hàng không phải đăng nhập lại nhiều lần. Đồng bộ với [ADR 006 Frontend](../../../HK Small Store/docs/adr/006-customer-session.md).

---

## 1. Yêu cầu & Vấn đề

- Khách hàng mua đồ si thường quay lại sau vài tuần hoặc vài tháng. Nếu bắt khách phải đăng nhập lại mỗi khi vào web, họ sẽ dễ quên mật khẩu và bỏ đơn.
- Yêu cầu: Khách hàng đăng nhập trên một thiết bị thì **giữ trạng thái đăng nhập lâu dài** (lên đến 400 ngày) cho tới khi chủ động bấm "Đăng xuất".
- Yêu cầu bảo mật: Không lưu token thô trong `localStorage` (tránh rủi ro rò rỉ qua tấn công XSS và hạn chế cơ chế ITP của Safari xóa dữ liệu sau 7 ngày).

---

## 2. Kiến trúc Phiên Đăng nhập Phía Server

### 2.1 Bảng `customer_sessions`
Server quản lý phiên trong cơ sở dữ liệu:
```sql
CREATE TABLE customer_sessions (
  token_hash VARCHAR(128) PRIMARY KEY,
  customer_id VARCHAR(50) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);
```

### 2.2 Cơ chế Sinh Token & Lưu Băm (Token Hashing)
1. Khi khách đăng nhập thành công (`POST /auth/login` hoặc `POST /auth/verify-otp`):
   - Server sinh chuỗi ngẫu nhiên có độ entropy cao (chuỗi hex 64 ký tự = 256 bits).
   - Server tính toán băm SHA-256 của chuỗi này: `tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')`.
   - Lưu `tokenHash` vào bảng `customer_sessions` với `expiresAt = now() + 400 ngày`.
   - Gửi `rawToken` về trình duyệt qua Set-Cookie.

### 2.3 Thuộc tính Cookie `hk_small_store_customer_session`
- **Name**: `hk_small_store_customer_session`
- **HttpOnly**: `true` (Javascript phía client không thể đọc, chặn 100% XSS đánh cắp phiên).
- **SameSite**: `Lax` (Bảo vệ chống CSRF, đồng thời cho phép giữ phiên khi khách bấm link giới thiệu từ Facebook/Zalo mở sang web shop).
- **Secure**: `process.env.NODE_ENV === 'production'` (Bắt buộc truyền qua HTTPS trên môi trường production).
- **Path**: `/`
- **Max-Age**: `34560000` (400 ngày — mức tối đa trình duyệt Chromium/WebKit chấp nhận theo chuẩn RFC 6265bis).

---

## 3. Cơ chế Gia hạn Trượt (Sliding Expiration)

Khi khách hàng truy cập API kèm cookie phiên:
1. Middleware trích xuất `rawToken`, băm SHA-256 và tìm kiếm trong bảng `customer_sessions`.
2. Nếu không tìm thấy hoặc `now() > expiresAt` $\rightarrow$ Phiên hết hạn, xóa cookie và trả về mã lỗi 401.
3. Nếu hợp lệ:
   - Nếu `now() - lastSeenAt > 1 giờ`: Server cập nhật `lastSeenAt = now()`, gia hạn `expiresAt = now() + 400 ngày` và cấp lại Set-Cookie với `Max-Age` mới.
   - Cơ chế giới hạn 1 lần/giờ giúp giảm tải việc ghi liên tục vào database trong mỗi request đọc thông thường.

---

## 4. Xử lý Đăng xuất & Thu hồi Quyền (Revocation)

| Hành động | Endpoint | Xử lý Backend |
|---|---|---|
| **Đăng xuất thiết bị hiện tại** | `POST /auth/logout` | Xóa dòng tương ứng với `token_hash` trong `customer_sessions`. Set-Cookie `Max-Age=0` để trình duyệt xóa cookie. |
| **Đăng xuất toàn bộ thiết bị** | `POST /auth/logout-all` | Xóa **toàn bộ** các phiên trong `customer_sessions` có `customer_id` bằng ID của khách đang đăng nhập. |
| **Đổi mật khẩu** | `POST /auth/change-password` | Đổi mật khẩu mới, xóa mọi phiên khác trong bảng `customer_sessions` ngoại trừ phiên hiện tại của thiết bị đang thực hiện đổi. |

---

## 5. Phân biệt với Phiên Admin

- Phân hệ Admin có quyền can thiệp vào tiền bạc và dữ liệu khách hàng nên áp dụng cơ chế ngắn hạn và nghiêm ngặt hơn:
  - Admin đăng nhập bằng **username + mật khẩu** (bảng `admin_users`).
  - JWT riêng (`typ=admin`, TTL ~12h) + cookie phiên trình duyệt; RBAC `owner` / `staff` + permissions.
  - Hết hạn ngắn hoặc theo phiên làm việc, không áp dụng cơ chế 400 ngày như khách hàng.
