# Plan — Kiện hàng đa chi phí, Sale sản phẩm & Quản trị xóa tồn kho

## Approach

1. **Schema & Database**: Bổ sung các trường chi phí vào `batches` (`shipping_cost`, `other_cost`), thêm `discarded` vào `item_status_enum`, thêm `discard_reason` và `discarded_at` vào `items`. Viết migration Drizzle `0005_batch_costs_and_item_discard.sql` và apply qua `db:migrate`.
2. **DTO & Validation**: Viết Zod schemas cho `createBatchBodySchema`, `updateBatchCostsBodySchema`, `applyItemDiscountSchema`, `bulkDiscountSchema`, `bulkRemoveDiscountSchema`, `discardItemSchema`, `reassignBatchSchema`, `deleteItemQuerySchema`.
3. **Repository Layer**:
   - `BatchRepository`: Cập nhật `statsForBatches` để tính chi phí và đếm cả trạng thái `discarded`.
   - `ItemRepository`: Thêm `delete`, `countOrderItems`, `findItemsForDiscount`.
4. **Service & Mappers**:
   - `batch-mapper.util.ts`: Tính toán `total_investment`, `break_even_target`, `estimated_cost_per_item`, `item_status_counts.discarded`.
   - `item-mapper.util.ts`: Thêm `original_price`, `is_on_sale`, `discount_percent`, `discard_reason`, `discarded_at`.
   - `AdminService`: Xử lý nghiệp vụ tiền tệ, đồng bộ dòng tiền với `cash_flow_entries`, các chốt chặn an toàn giá vốn và trạng thái đơn hàng.
5. **OpenAPI Sync**: Cập nhật `docs/02-api/openapi.yaml` đồng bộ với contract mới.
6. **Verification**: Viết script smoke test `scripts/check-batch-costs-sale-item-mgmt.ts` kiểm thử toàn bộ luồng.

## Files Touched

| File | Thay đổi |
|---|---|
| `src/db/schema.ts` | Thêm cột chi phí, enum discarded, discard columns |
| `drizzle/migrations/0005_...` | Migration SQL |
| `src/dtos/batch.dto.ts` | Zod schemas chi phí kiện |
| `src/dtos/item.dto.ts` | Zod schemas discount, delete, discard, reassign |
| `src/repositories/batch.repository.ts` | Cập nhật stats query |
| `src/repositories/item.repository.ts` | Delete, order check, bulk query |
| `src/utils/batch-mapper.util.ts` | Batch summary calculation |
| `src/utils/item-mapper.util.ts` | Item discount & discard mapping |
| `src/services/admin.service.ts` | Business logic & financial flow |
| `src/controllers/admin.controller.ts` | Controller handlers |
| `src/routes/admin.route.ts` | Router endpoints |
| `docs/02-api/openapi.yaml` | Cập nhật contract OpenAPI |
| `scripts/check-batch-costs-sale-item-mgmt.ts` | Smoke test script |
