# Observability

## Health

`GET /api/health` → `{ status: "ok", timestamp }`.  
Dùng cho load balancer / uptime check. (Có thể mở rộng: check DB `SELECT 1` sau.)

## Logging

`Logger` util — format tối thiểu: level, message, method, path, error code.  
Không PII (xem [`../05-quality/security.md`](../05-quality/security.md)).

Production: stdout JSON (mỗi dòng một event) để PaaS thu thập.

Không log body chứa password/OTP; không dump cookie header.

## Error tracking

Chưa gắn Sentry/GlitchTip mặc định. Khi thêm:

- Capture `500` + `AppError` bất thường.
- Scrub cookie / Authorization / body fields nhạy cảm trước gửi.

## Metrics (sau)

Latency p95 theo route, rate 409 `OUT_OF_STOCK`, số đơn hold expire — đủ cho shop nhỏ khi có traffic.
