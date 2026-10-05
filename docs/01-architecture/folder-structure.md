# Folder structure

```
hk-small-store-backend/
├── AGENTS.md
├── CLAUDE.md                    # @AGENTS.md
├── .cursor/rules/               # alwaysApply agent rules
├── README.md
├── CHANGELOG.md
├── package.json
├── drizzle.config.ts
├── .env.example
├── drizzle/
│   └── migrations/              # SQL từ drizzle-kit — không sửa đã apply
├── docs/                        # 00-product … 06-operations, adr/, features/, superpowers/
└── src/
    ├── server.ts                # listen PORT
    ├── app.ts                   # express app factory
    ├── configs/                 # app + database
    ├── db/schema.ts             # SSOT data model
    ├── routes/                  # Express routers
    ├── controllers/
    ├── services/
    ├── repositories/
    ├── dtos/                    # Zod schemas
    ├── middlewares/
    ├── constants/
    ├── interfaces/
    └── utils/
```

## Module hiện tại (flat theo resource)

| Resource | Route | Controller | Service | Repository | DTO |
|---|---|---|---|---|---|
| Auth | `auth.route` | `auth.controller` | `auth.service` | `customer.repository` | `auth.dto` |
| Items | `item.route` | `item.controller` | `item.service` | `item.repository` | `item.dto` |
| Orders | `order.route` | `order.controller` | `order.service` | `order.repository` | `order.dto` |
| Settings | `setting.route` | `setting.controller` | `setting.service` | `setting.repository` | `setting.dto` |
| Admin | `admin.route` | `admin.controller` | `admin.service` (+ order/item) | batch, cash-flow, … | mixed |

## Quy ước đặt code mới

| Loại thay đổi | Đặt ở |
|---|---|
| Endpoint mới | DTO → repository → service → controller → route + OpenAPI |
| Enum/cột DB | `schema.ts` → `db:generate` → migrate — không sửa SQL đã apply trên shared env |
| Business rule | `services/` only |
| HTTP status / cookie | `controllers/` + middlewares |

## Hướng module hóa (khi cần)

Khi resource phình: `src/modules/<name>/{controller,service,dto,repository}.ts`. Không tách sớm (YAGNI).

## Mount path

`app.use('/api', routes)` → `/api/v1/...` và `/api/...` (tương thích rewrite Next.js).
