# Tasks — Kiện hàng đa chi phí, Sale sản phẩm & Quản trị xóa tồn kho

- [x] Schema & Migration: Cập nhật schema `batches`, `items`, enum `itemStatusEnum` và tạo migration 0005.
- [x] Áp dụng migration vào CSDL (`pnpm run db:migrate`).
- [x] Tạo các DTO Zod validation cho chi phí kiện và các thao tác sản phẩm.
- [x] Bổ sung các phương thức repository cho Item và Batch.
- [x] Cập nhật mappers (`batch-mapper.util.ts`, `item-mapper.util.ts`).
- [x] Cài đặt business logic trong `AdminService` (tính toán chi phí, hòa vốn, dòng tiền, sale, xóa, tiêu hủy, chuyển kiện).
- [x] Cài đặt `AdminController` và đăng ký routes trong `admin.route.ts`.
- [x] Cập nhật contract OpenAPI (`docs/02-api/openapi.yaml`).
- [x] Viết và chạy script smoke test `scripts/check-batch-costs-sale-item-mgmt.ts`.
- [x] Chạy `pnpm run typecheck` và `pnpm run build` verify 100%.
