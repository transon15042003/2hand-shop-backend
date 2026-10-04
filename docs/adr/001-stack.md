# 001 — Kiến trúc công nghệ Backend: Node.js, Express, Drizzle ORM, Neon Postgres

Trạng thái: Đã chốt ngày 2026-09-27.  
Nguồn: Quyết định lựa chọn công nghệ cho dự án `2hand-shop-backend`.

---

## 1. Bối cảnh & Yêu cầu

Hệ thống Backend cần một nền tảng công nghệ thỏa mãn các yêu cầu:
1. **Kiểm soát chặt chẽ và nhẹ nhàng**: Dễ bảo trì cho mô hình một lập trình viên/chủ shop, không cần cấu hình cồng kềnh.
2. **Hỗ trợ ACID Transaction và Khóa dòng (Row-level Locking)**: Bắt buộc để đảm bảo tính toàn vẹn của món hàng độc bản (1-of-1) khi có nhiều người cùng mua.
3. **Type-safety tuyệt đối**: TypeScript đồng bộ từ Database Schema, DTOs, Services đến Controllers để tránh lỗi runtime.
4. **Hiệu năng cao và tiết kiệm tài nguyên**: Tối ưu chi phí hạ tầng (có thể chạy trên nền tảng Serverless hoặc Container nhỏ như Render, Railway, Fly.io).

---

## 2. Các Lựa chọn đã Cân nhắc

| Công nghệ | Điểm mạnh | Lý do từ chối |
|---|---|---|
| **NestJS** | Cấu trúc module chặt chẽ, dependency injection mạnh. | Quá nhiều boilerplate, cấu hình decorartor phức tạp, tạo overhead không cần thiết cho quy mô cửa hàng độc lập. |
| **Prisma ORM** | Hệ sinh thái phong phú, cú pháp trực quan. | Sử dụng Rust query engine nhúng làm tăng dung lượng bundle và thời gian cold start trên môi trường serverless; việc hỗ trợ raw query locking (`FOR UPDATE`) phức tạp hơn. |
| **MongoDB** | Schema linh hoạt, nhanh gọn lúc đầu. | Mô hình NoSQL không tối ưu cho giao dịch tài chính nhiều bảng, thiếu ràng buộc toàn vẹn khóa ngoại (Foreign Keys) và ACID chặt chẽ như PostgreSQL. |
| **Supabase** | Đầy đủ Auth và Storage tích hợp. | Bị phụ thuộc dịch vụ bên ngoài (vendor lock-in), khó tách bạch logic nghiệp vụ phức tạp của việc giữ đơn, cọc và hoàn phí. |

---

## 3. Quyết định: Express + Drizzle ORM + Neon PostgreSQL

| Thành phần | Lựa chọn | Lý do quyết định |
|---|---|---|
| **Web Framework** | **Express 4.x** (TypeScript) | Tiêu chuẩn ổn định nhất của Node.js, thư viện middleware phong phú (`cors`, `cookie-parser`), dễ dàng tinh chỉnh pipeline xử lý request và error handling. |
| **Cơ sở dữ liệu** | **Neon PostgreSQL** | Cơ sở dữ liệu quan hệ mạnh mẽ, chuẩn ACID, hỗ trợ ENUMs, JSONB, serverless compute tự động co giãn, tính năng database branching tiện lợi cho môi trường preview/test. |
| **ORM / Query Builder** | **Drizzle ORM** | Type-safe 100%, không sinh mã engine ẩn (zero overhead), cú pháp tự nhiên như SQL, hỗ trợ xuất sắc transaction và `SELECT ... FOR UPDATE` cần thiết cho bài toán độc bản. |
| **Validation** | **Zod** | Schema validator mạnh nhất trong hệ sinh thái TypeScript, dễ dàng tạo DTOs và tích hợp với middleware kiểm thực request. |
| **Bảo mật & Phiên** | **bcryptjs** + **jsonwebtoken** + **HttpOnly Cookie** | Mật khẩu khách hàng được băm an toàn; phiên khách duy trì qua HttpOnly Cookie 400 ngày; token admin độc lập bảo vệ các thao tác tài chính. |

---

## 4. Kiến trúc 3 Lớp (Layered Architecture)

Mã nguồn Backend được tổ chức nghiêm ngặt theo mô hình 3 lớp:

```
[ Client Request ]
       │
       ▼
┌──────────────────────────────────────────────┐
│ Middlewares (CORS, Cookie, Validate, Auth)   │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ Controllers (HTTP Parsing, Status Codes)     │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ Services (Business Logic, Transactions, Calc)│
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ Repositories (Drizzle ORM, Database Queries) │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
             [ Neon PostgreSQL ]
```

- **Controller**: Tiếp nhận request, trích xuất params/body/cookies, ủy quyền xử lý cho Service và trả HTTP Response. Tuyệt đối không chứa logic tính toán hay query database.
- **Service**: Trái tim nghiệp vụ của hệ thống. Chứa toàn bộ quy tắc: tính tiền, kiểm tra cọc, quản lý giao dịch transaction, kiểm tra hạn giữ đơn và chuyển đổi trạng thái.
- **Repository**: Đóng gói các thao tác CRUD với cơ sở dữ liệu qua Drizzle ORM.
