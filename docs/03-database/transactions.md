# Transactions

Dùng `db.transaction(async (tx) => { ... })` khi thao tác phải atomic.

## Bắt buộc transaction + row lock

| Use case | Vì sao |
|---|---|
| `POST /orders` tạo đơn | Khóa `items` `FOR UPDATE`, set `reserved`, insert order + order_items, snapshot |
| Cancel / expire hold | Nhả món `reserved → shelf` + cập nhật order + (có thể) cash-flow |
| Complete order | `reserved → sold`, payment/deposit status, cash-flow income |
| Return order | `sold → shelf`, refund amount, cash-flow refund |
| Confirm deposit | Cập nhật deposit + ghi `cash_flow_entries` income |
| Ship / confirm có side-effect tiền | Giữ số liệu kế toán khớp trạng thái đơn |

## Pattern khóa tồn kho

```ts
await db.transaction(async (tx) => {
  // SELECT ... FROM items WHERE id = ANY(...) FOR UPDATE
  // assert every row status === 'shelf'
  // update items → reserved
  // insert orders + order_items
});
```

Request khác chờ lock; sau commit thấy `reserved` → `OUT_OF_STOCK` 409.

Chi tiết: [`../adr/007-inventory-and-concurrency.md`](../adr/007-inventory-and-concurrency.md).

## Không cần transaction

- `GET` list/detail thuần đọc.
- Đổi settings đơn bảng (trừ khi vừa bump `policyVersion` vừa audit nhiều bảng — khi đó bọc transaction).
- Login đọc/ghi session một dòng (vẫn nên atomic update session fields trong một statement).

## Rules

1. Truyền `tx` xuống repository methods khi đang trong transaction — không mở connection thứ hai ghi cùng nghiệp vụ.
2. Giữ transaction ngắn: không gọi HTTP ngoài / sleep trong transaction.
3. Ném lỗi → rollback; map thành `AppError` cho client.
