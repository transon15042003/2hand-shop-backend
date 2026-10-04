# 007 — Quản lý tồn kho độc bản (1-of-1) và Kiểm soát tranh chấp đồng thời (Concurrency Control)

Trạng thái: Đã chốt ngày 2026-10-04.  
Nguồn: Giải pháp giải quyết bài toán cốt lõi của cửa hàng đồ si: Mỗi món chỉ có 1 chiếc duy nhất.

---

## 1. Bài toán Tranh chấp Đồng thời (The Race Condition Problem)

Trong một cửa hàng đồ si tuyển chọn:
- Một chiếc áo khoác độc bản rất đẹp có giá trị cao, vào giờ mở bán có thể có **hàng chục khách hàng cùng truy cập và ấn nút Đặt hàng cùng một thời điểm**.
- Nếu Backend chỉ dùng câu lệnh kiểm tra thông thường (`SELECT status FROM items WHERE id = ?`), sau đó mới cập nhật (`UPDATE items SET status = 'reserved'`), hiện tượng **Race Condition** chắc chắn sẽ xảy ra: Cả hai request cùng đọc thấy trạng thái `shelf` và cùng tạo thành công 2 đơn hàng cho cùng một chiếc áo vật lý duy nhất.
- Hậu quả: Chủ shop bị vỡ trận vận hành, phải gọi điện xin lỗi và hủy đơn của một bên, làm mất uy tín cửa hàng nghiêm trọng.

---

## 2. Giải pháp Kỹ thuật: PostgreSQL Row-Level Locking (`FOR UPDATE`)

Để giải quyết triệt để vấn đề này, Backend áp dụng cơ chế khóa dòng ở cấp độ cơ sở dữ liệu bên trong một Transaction duy nhất:

```typescript
return await db.transaction(async (tx) => {
  // 1. Khóa toàn bộ các dòng của items được đặt bằng SELECT ... FOR UPDATE
  const selectedItems = await tx.execute(
    sql`SELECT * FROM items WHERE id = ANY(${data.itemIds}) FOR UPDATE`
  );

  const rows = selectedItems.rows as any[];

  // 2. Kiểm tra tính tồn tại
  if (rows.length !== data.itemIds.length) {
    throw new AppError(
      'Một số sản phẩm không tồn tại trong hệ thống',
      HttpStatus.BAD_REQUEST,
      ErrorCode.ITEM_NOT_FOUND
    );
  }

  // 3. Kiểm tra tính khả dụng: Toàn bộ món phải đang ở trạng thái 'shelf'
  const unavailable = rows.filter((r) => r.status !== 'shelf');
  if (unavailable.length > 0) {
    const itemNames = unavailable.map((u) => u.name).join(', ');
    throw new AppError(
      `Rất tiếc! Món [${itemNames}] vừa được người khác đặt trước.`,
      HttpStatus.CONFLICT,
      ErrorCode.OUT_OF_STOCK
    );
  }

  // 4. Chuyển trạng thái items sang 'reserved'
  await tx
    .update(items)
    .set({
      status: 'reserved',
      reservedUntil: holdExpiresAt,
      reservedByCustomerPhone: data.customerPhone,
      updatedAt: new Date(),
    })
    .where(inArray(items.id, data.itemIds));

  // 5. Tạo đơn hàng và chi tiết đơn hàng
  // ...
});
```

### Nguyên lý hoạt động:
1. Khi Request A bắt đầu transaction và gọi `SELECT ... FOR UPDATE`, cơ sở dữ liệu PostgreSQL sẽ cấp quyền khóa độc quyền (Exclusive Lock) trên các dòng của những món hàng đó.
2. Nếu Request B gửi tới ngay sau đó mili-giây và cố gắng truy vấn cùng những món hàng đó, PostgreSQL sẽ **buộc Request B phải chờ (block)** cho đến khi Transaction của Request A hoàn tất (COMMIT hoặc ROLLBACK).
3. Khi Transaction A hoàn tất, trạng thái món đồ đã chuyển thành `reserved`. Lúc này khóa được giải phóng, Request B tiếp tục thực thi nhưng lập tức phát hiện trạng thái món không còn là `shelf` nữa $\rightarrow$ Request B bị từ chối an toàn với mã lỗi HTTP 409 Conflict (`OUT_OF_STOCK`).

---

## 3. Quản lý Thời hạn Giữ đơn (`hold_expires_at`) và Thu hồi Tồn kho

### 3.1 Thời gian giữ đơn
- Khi đơn hàng được tạo, `hold_expires_at` được gán = `now() + settings.orderHoldMinutes * 60 * 1000` (mặc định 30 phút).
- Trong khoảng thời gian này, các món hàng nằm ở trạng thái `reserved`.

### 3.2 Cơ chế Lazy-Check & Background Worker
Để giải phóng các món hàng bị giữ chỗ khi khách hàng không chuyển cọc hoặc quá hạn giữ đơn:
1. **Lazy-check khi truy vấn**: Khi khách xem chi tiết một món đồ hoặc khi admin tải danh sách đơn, hệ thống kiểm tra nếu `items.status = 'reserved'` và `now() > reserved_until`:
   - Nếu đơn hàng tương ứng có `deposit_status = 'pending'`, hệ thống tự động hủy đơn và chuyển món về lại `shelf`.
2. **Cronjob / Scheduled Task**: Định kỳ mỗi 2-5 phút quét các đơn hàng có:
   ```sql
   WHERE order_status = 'new' 
     AND hold_expires_at < NOW()
   ```
   - Nếu `deposit_status = 'pending'`: Chuyển đơn sang `cancelled`, lý do: `Quá hạn giữ đơn và chưa nhận cọc`, giải phóng toàn bộ món về `shelf`.
   - Nếu `deposit_status IN ('not_required', 'paid')`: Chuyển đơn sang `confirmed`, lý do: `Tự động xác nhận khi hết hạn giữ đơn`.

---

## 4. Xử lý Trả hàng và Hủy đơn

- Khi đơn hàng bị hủy (`cancelled`): Toàn bộ các món thuộc đơn đó được cập nhật chuyển từ `reserved` về lại `shelf` để khách khác có thể nhìn thấy và mua tiếp.
- Khi đơn hàng bị trả (`returned` trong 2 ngày): Toàn bộ các món thuộc đơn đó được chuyển từ `sold` về lại `shelf`.
- Khi đơn hàng hoàn tất (`completed`): Toàn bộ các món thuộc đơn đó được chuyển từ `reserved` sang `sold` vĩnh viễn.
