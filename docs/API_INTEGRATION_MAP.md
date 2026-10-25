# API integration map

All endpoints below were taken from the route definitions in `ims-final-built/src/api/routes/*.ts` (read-only), not from memory. The redesign makes **no network request**. To integrate: implement `ImsService` (`src/services/contracts/service.ts`) in `src/services/adapters/api.ts`; every UI command already goes through `useCommands()`.

Three separate auth contexts exist in the backend and stay separate: tenant session (`/login`, `/session`), POS terminal token (`/terminals`, cashier PIN), platform operator (`/platform/*`). The redesign's role switcher only previews tenant roles `admin | manager | warehouse_staff | pos_operator`.

Naming: the UI says **Sikick** and **SiBorg**. Do not rename wire identifiers (`/agent/*`, any AxBrain fields); map names at the adapter.

Money crosses the API in rupees or paise depending on the route (e.g. adjustments take MRP in rupees, stored as paise). The redesign holds integer paise; convert at the adapter.

Status key: ✅ route confirmed in code · 🔍 shape or role needs verification before wiring.

## Command → endpoint

| Command / screen | Endpoint | Notes |
|---|---|---|
| Sign in / session | `POST /login`, `GET /session`, `POST /logout`, `POST /session/switch`, `POST /shops` ✅ | shop switcher in header maps to `session/switch` 🔍 |
| Sign in, sign up, verify, reset, trial | `POST /login`, `GET /session`, `POST /signup`, `GET /verify-email`, `POST /password-reset/request` and `/confirm`, `/auth/google/*`, `GET /billing/status` ✅ | Mapped screen by screen, with the gaps (no resend route, no retention deadline in billing status, no `emailVerified` in the session), in `AUTH_AND_TRIAL_MAP.md`. The local adapter implements `AuthService` (`contracts/account.ts`); the API adapter implements the same interface. |
| Dashboard | `GET /analytics/dashboard-summary` ✅, `GET /alerts` ✅, `GET /agent/briefing` ✅ | local derived selectors replace these |
| Products | `GET/POST /products`, `GET/PATCH/DELETE /products/:id`, variants `GET/POST /products/:id/variants`, `PATCH/DELETE …/variants/:variantId` ✅ | |
| Bulk import | `POST /import/dry-run`, `POST /import/commit`, `GET /import/runs`, `POST /import/runs/:runId/undo` ✅, also `POST /products/bulk-import` | caps (5,000 rows, dup rules) per the migration notes 🔍 |
| Photo recognition | `POST /products/analyze-image`, `POST /products/upload-image`, `GET /product-images/*` ✅ | |
| Categories / types | `GET/POST/DELETE /categories`, `/product-types` ✅, `POST /ai/generate-category` | `PATCH` not present for categories |
| Catalogue search | `GET /catalog/search` ✅ | |
| Inventory read | `GET /inventory/:variantId`, `/lots`, `/serials`, `GET /inventory/stagnant`, `GET /variants/:variantId/stock-events` ✅ | |
| Stock adjustment | `POST /inventory/adjust` ✅ | body `eventType` ∈ SALE, RESERVE, RELEASE, RETURN, DAMAGE, PURCHASE_RECEIPT, ADJUSTMENT; `idempotencyKey` required; optional `lot`, `serials`, `negativeOverride`; quantity in milli-units. Redesign uses ADJUSTMENT / DAMAGE / RETURN. Roles: admin, manager, warehouse_staff |
| Warranty | `GET /serials/:serialNumber` ✅ | all four roles, rate limited per tenant |
| Alerts | `GET /alerts`, `GET /alerts/:id`, `PATCH /alerts/:id/acknowledge`, `/resolve` ✅ | |
| Orders | `GET/POST /orders`, `GET /orders/:id`, `PATCH /orders/:id/confirm`, `/pay`, `/ship`, `/deliver`, `/return`, `/cancel` ✅ | status enum Draft, Pending, Paid, Packed, Shipped, Delivered, Completed, Cancelled, Returned, Refunded. Stock reserve on confirm, deduct on pay (per `pos-capability-map.md`) 🔍 |
| POS payment QR | `POST /orders/:id/generate-payment-qr`, `/void-payment-qr` ✅ | tenders cash, UPI, card (+ Razorpay) 🔍 split tenders and discounts: confirm in order schema |
| Receipt email | `POST /orders/:id/email-receipt` ✅ | |
| Shipments | `POST /orders/:id/create-shipment`, `GET /shipments`, `/:id`, `/:id/tracking`, `POST /shipments/:id/label`, `/cancel`, `/refresh` ✅ | needs carrier connector |
| Credit / debit notes, e-invoice, e-way bill | `GET/POST /orders/:id/credit-notes`, `/debit-notes`, `/einvoice`, `/eway-bill` (+ cancel/extend/part-b), `POST /credit-notes/:id/refund` ✅ | not surfaced in the redesign beyond a settings flag |
| Quotations | `GET/POST /quotations`, `GET/PATCH /quotations/:id`, `PATCH /quotations/:id/status`, `POST /quotations/:id/convert` ✅ | status enum draft, sent, accepted, rejected, expired, converted |
| Customers | `GET/POST /customers`, `GET/PATCH /customers/:id`, `GET …/gstin-status`, `POST /gstin/verify` ✅ | |
| Suppliers | `GET/POST /suppliers`, `PATCH /suppliers/:id`, `GET /suppliers/:id/balance`, `GET /analytics/supplier-balance/:id` ✅ | |
| Supplier payments | `GET/POST /supplier-payments` ✅ | |
| Purchase orders | `GET/POST /purchase-orders`, `GET /purchase-orders/:id`, `PATCH /purchase-orders/:id/receive` ✅ | status Draft, Ordered, Received. Place (Draft→Ordered) endpoint not found as its own route 🔍 (likely `PATCH /purchase-orders/:id`) |
| Expenses | `GET/POST /expenses` ✅ | |
| Ledger / journal | `GET /chart-of-accounts`, `POST /journal-entries`, `/:id/reverse` ✅, `DELETE /chart-of-accounts/:id` | admin |
| Statements | `GET /reports/profit-loss`, `/balance-sheet`, `/cash-flow`, `/trial-balance` (+ `.csv`) ✅ | admin |
| GST | `GET /gst/returns`, `/:type/:period`, `.csv`, `/json`; `POST …/generate`; `PATCH …/filed` ✅ | type gstr1 / gstr3b; admin |
| Analytics | `GET /analytics/sales-summary`, `/inventory-value`, `/turnover`, `/alerts-summary`, `/suggestions` ✅ | |
| Campaigns | `GET/POST /campaigns`, `PATCH /campaigns/:id` ✅ | field set 🔍 (redesign fixture is illustrative) |
| SiBorg | `POST /agent/sessions`, `GET /agent/sessions`, `GET/POST /agent/sessions/:sessionId/messages`, `GET /agent/proposals`, `/:id`, `PATCH /agent/proposals/:id`, `POST /agent/proposals/:id/approve`, `/reject`, `DELETE /agent/sessions/:sessionId` ✅ | approval is the human gate; manager+ |
| Document extraction | `POST /documents/extract` ✅ | |
| Business settings | `GET/PATCH /settings/business` ✅ | exact fields: auditLogRetentionMonths, taxRatePercent, sellerGstin (15), sellerStateCode (2 digits), eInvoiceApplicable, eInvoiceAatoAbove10Cr, ewayBillThreshold, drugLicenceNumber. `requireOwner` |
| Item settings | `GET/PATCH /settings/items` ✅ | item.field.serial_no / batch_no / expiry_date / model_no / size, item.units.enabled, customFieldLabels[≤20], visionProfile. admin |
| Metal rates | `GET/POST /settings/metal-rates`, `GET /settings/metal-rates/history` ✅ | admin, manager |
| Notifications | `GET/PATCH /settings/notifications`, `/deliveries`, `/phone`, `/phone/verify`, `/opt-out` ✅ | emailEnabled, whatsappEnabled, severityFloor, timezone |
| Integrations status | `GET /settings/integrations` ✅ | razorpay, shiprocket, meta, email: connected / not_configured / error. No secrets, no credential API |
| Connectors | `GET /connectors`, `/:provider/start`, `/credentials`, `/pull`, `/callback`, `/runs/:id`, `DELETE /connectors/:provider` ✅ | 13 providers; each stays off until its live flag is on |
| Channels | `GET /channel/state`, `/keys`, `/rejects`; `POST /channel/keys`, `/channel/orders` (API key), `/rejects/:id/replay`; `DELETE /channel/keys/:id` ✅ | |
| Cashiers | `GET/POST /cashiers`, `PATCH /cashiers/:id`, `POST …/reset-pin`, `GET …/activity(.csv)` ✅ | |
| Terminals | `GET/POST /terminals`, `PATCH /terminals/:id` ✅ | |
| Users | `GET/POST /users`, `PATCH /users/:id`, `POST /users/:id/reset-password` ✅ | |
| Billing | `GET /billing/status`, `POST /billing/subscribe`, `/cancel` ✅ | plans starter, growth, business; states trial, active, past_due, suspended, cancelled |
| Audit log | `GET /audit-log`, `.csv`, `/archives`, `/archives/download` ✅ | |
| Platform admin | `POST /platform/login`, `GET /platform/tenants`, `/:id`, `PATCH …/lifecycle`, `/plan`, `POST …/disable`, `/enable`, `/impersonate`, `GET /platform/usage`, retention and cleanup routes ✅ | operator roles admin/viewer; entirely separate session |

## Fixtures → real data

- `src/data/fixtures/seed.ts` is the only data source (Morrow Goods). Orders are generated deterministically so each product's 30-day units and last-sale day match the figures on the public site.
- `src/services/selectors.ts` and `finance.ts` derive everything (alerts, KPIs, ledger, statements, GST). When connecting, keep selectors and feed them API-backed state, or replace with server-side reads.
- Open points: purchase-order *place* endpoint; split-tender and discount fields on `POST /orders`; campaign schema; whether `GET /customers/:id` returns outstanding balance (redesign derives it from orders).
