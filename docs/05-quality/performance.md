# Performance

## N+1

- List orders kèm items: join / `inArray` một lần — không loop `findItem` từng dòng.
- List items: không `include` quan hệ nặng nếu UI không cần.

## Select / include

- Public list: chỉ field summary (id, name, price, images[0], condition, size…).
- Detail mới lấy measurements / defects đầy đủ.
- Admin list có thể rộng hơn nhưng vẫn paginate.

## Indexes

Xem [`../03-database/drizzle-conventions.md`](../03-database/drizzle-conventions.md) (stub template: `prisma-conventions.md`). Filter hot path (`status=shelf`) cần index.

## Caching

MVP: không Redis. Dựa PG + connection pool Neon.  
Cache được cân nhắc sau cho `GET /settings` (TTL ngắn) và list shelf — invalidate khi admin sửa item/settings.

## Transactions

Giữ ngắn (xem transactions.md). Không I/O ngoài trong lock.

## Payloads

Ảnh = URL; không base64 lớn trong JSON. Giới hạn `limit` ≤ 50.
