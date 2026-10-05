# Order flow (state machine)

## States

```
                 ┌──────────────┐
                 │     new      │
                 └───┬──────┬───┘
         confirm/    │      │ cancel / hold expire (pending deposit)
         auto-confirm│      ▼
                 ┌───▼──┐  cancelled
                 │confirmed│
                 └───┬───┘
                     │ ship (deposit ok)
                 ┌───▼───┐
                 │shipping│
                 └───┬───┘
                     │ complete
                 ┌───▼────┐
                 │completed│──return (trong window)──► returned
                 └─────────┘
```

Không nhảy cóc (vd `new → shipping`). Sai → `INVALID_TRANSITION` 400.

## Item side-effects

| Order transition | Item status |
|---|---|
| create (`new`) | `shelf → reserved` |
| cancel / expire pending | `reserved → shelf` |
| complete | `reserved → sold` |
| return | `sold → shelf` |

## Hold window

- `holdExpiresAt = now + holdMinutes` (snapshot).
- Hết hạn + `depositStatus = pending` → `cancelled`, nhả món.
- Hết hạn + `not_required` | `received` → auto `confirmed`.
- Cơ chế: lazy-check khi đọc + **in-process scheduler** (`HOLD_EXPIRE_INTERVAL_MS`, mặc định 3 phút) và CLI `pnpm run job:expire-holds` (cron PaaS).

## Extend hold

`POST /orders/:code/extend` — tối đa 1 lần (`HOLD_ALREADY_EXTENDED` nếu lặp).

## Deposit gate on ship

`depositStatus === pending` → không `ship` → `DEPOSIT_REQUIRED` 409.

## Return window

`now - completedAt <= returnWindowDays` (snapshot). Quá hạn → lỗi return (FE/ADR: `RETURN_WINDOW_EXPIRED`).

Hoàn: `subtotal - returnFee` (mất cọc hoặc trừ phí 2 chiều). Phí ship lúc giao không hoàn.

## Actors

`cancelledBy`: `customer` | `shop` | `system`  
`confirmedBy`: `shop` | `system`

ADR: [`../adr/004-deposit-and-return-fee.md`](../adr/004-deposit-and-return-fee.md), [`../adr/007-inventory-and-concurrency.md`](../adr/007-inventory-and-concurrency.md).
