# Error handling

## Format

`AppError` → middleware trả:

```json
{
  "code": "OUT_OF_STOCK",
  "message": "Rất tiếc! Món […] vừa được người khác đặt trước.",
  "fields": [{ "field": "itemIds", "message": "Món không khả dụng" }]
}
```

(`fields` optional — dùng cho validation Zod.)

Unhandled → `500` + `INTERNAL_ERROR`, message tiếng Việt generic; log chi tiết server-side (không PII).

## HTTP mapping

| HTTP | Khi nào |
|---|---|
| 400 | Validation, transition sai, OTP sai, policy chưa accept |
| 401 | Chưa đăng nhập / session hết hạn |
| 403 | Có session nhưng không đủ quyền |
| 404 | Item/order không tìm thấy (hoặc món đã rời kệ với public) |
| 409 | Conflict: out of stock, policy version outdated, deposit required |
| 500 | Lỗi không预期 |

## Error codes (`src/constants/http-status.ts`)

| Code | Status điển hình |
|---|---|
| `VALIDATION_FAILED` | 400 |
| `NOT_FOUND` | 404 |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `INVALID_CREDENTIALS` | 401 |
| `EMAIL_ALREADY_EXISTS` / `PHONE_ALREADY_EXISTS` | 409 |
| `EMAIL_NOT_VERIFIED` | 403 |
| `INVALID_OTP` / `OTP_EXPIRED` | 400 |
| `ITEM_NOT_FOUND` / `ITEM_NOT_AVAILABLE` | 404 / 409 |
| `OUT_OF_STOCK` | 409 |
| `ORDER_NOT_FOUND` | 404 |
| `INVALID_TRANSITION` | 400 |
| `HOLD_ALREADY_EXTENDED` / `HOLD_EXPIRED` | 400 |
| `DEPOSIT_REQUIRED` | 409 |
| `CANCEL_NOT_ALLOWED` | 400 |
| `POLICY_NOT_ACCEPTED` | 400 |
| `POLICY_VERSION_OUTDATED` | 409 |
| `INTERNAL_ERROR` | 500 |

Bổ sung code mới: thêm vào `ErrorCode` + OpenAPI + bảng này.

## Quy tắc viết message

- Tiếng Việt, đủ để user/FE hiển thị.
- Không lộ stack, SQL, đường dẫn file, secret.
