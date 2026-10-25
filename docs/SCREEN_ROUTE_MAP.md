# Screen and route map

Source: `ims-final-built/web/src/App.tsx` and `config/routes.ts` (read-only). The redesign keeps **the same paths** so a page can be swapped one for one. Roles come from the source `config/permissions.ts`; the redesign mirrors them in `src/app/permissions.ts` (exact paths win over `:param` patterns, so `/orders/new` is not swallowed by `/orders/:id`, which the source's first-match lookup does).

Legend: **Done** = built with local interactions, crawled at 6 viewports with no console error or overflow.

| Source route | Redesign page | Roles | Notes |
|---|---|---|---|
| `/dashboard` | `pages/DashboardPage` | all | KPIs, sales chart (7/14/30 d), SiBorg brief, watchlist, alerts side panel |
| `/pos` | `pages/PosPage` + `features/pos/*` | admin, manager, pos_operator | search/scan, cart, discount, cash/UPI/card + split, receipt, offline queue |
| `/products`, `/products/:productId`, `/products/:productId/variants`, `/variants/:variantId` | `ProductsPage`, `ProductDetailPage`, `ProductVariantsPage`, `VariantDetailPage` | all | product groups variants (SKUs); source's product/variant split kept |
| `/categories`, `/product-types` | `CategoriesPage` (both exports) | warehouse+ | |
| `/catalog/search` | `CatalogSearchPage` | warehouse+ | search by photo is a labelled prototype |
| `/barcodes`, `/generate`, `/bulk`, `/templates`, `/print`, `/scanner-test`, `/history` | `BarcodePages` (7 exports) | warehouse+ | real EAN-13 bars |
| `/inventory`, `/inventory/:variantId` | `InventoryPage`, `InventoryDetailPage` | warehouse+ | reasoned adjustment dialog with before/event/after flow |
| `/alerts` | `AlertsPage` | warehouse+ | derived from stock, POs, batches |
| `/warranty` | `WarrantyPage` | all | serial first |
| `/purchase-orders`, `/new`, `/:id` | `PurchaseOrdersPage`, `PurchaseOrderNewPage`, `PurchaseOrderDetailPage` | warehouse+ (`/new`: manager+) | Draft → Ordered → Received; receiving updates stock + supplier balance |
| `/suppliers`, `/suppliers/:id/balance`, `/supplier-payments` | `SupplierPages` | warehouse+ / manager+ | |
| `/orders`, `/orders/new`, `/orders/:id` | `OrdersPage`, `OrderNewPage`, `OrderDetailPage` | all / manager+pos for `/new` | full backend status enum |
| `/quotations`, `/quotations/:id` | `QuotationPages` | warehouse+ | convert accepted quote to order |
| `/customers` | `CustomersPage` | warehouse+ | |
| `/expenses` | `FinancePages.ExpensesPage` | manager+ | |
| `/ledger`, `/reports/financial-statements`, `/gst/returns` | `FinancePages` | admin | derived from orders/receipts/payments/expenses; always balanced |
| `/analytics` + `/sales-summary`, `/inventory-value`, `/turnover`, `/alerts-summary`, `/supplier-balance` | `AnalyticsPages` | manager+ (alerts-summary warehouse+) | |
| `/briefing`, `/action-center`, `/campaigns` | `InsightPages` | all / manager+ | campaign fields need verification (see API map) |
| `/agent/chat`, `/agent/proposals`, `/agent/proposals/:sessionId` | `SiBorgPages` | all / manager+ | label **SiBorg**; route kept |
| `/documents/extract` | `SiBorgPages.DocumentExtractPage` | manager+ | example extraction |
| `/settings` (hub), `/settings/items`, `/metal-rates`, `/channels`, `/cashiers`, `/terminals`, `/billing`, `/integrations` | `SettingsPages` + `SettingsShell` | admin (metal rates: manager+) | horizontal sub-nav, no sidebar |
| *(inside source SettingsPage)* | `/settings/business`, `/settings/users`, `/settings/notifications`, `/settings/appearance` | admin (appearance: all) | new paths for sections that were tabs in the source page |
| `/import` | `SystemPages.ImportPage` | admin | CSV, check-then-commit, undo |
| `/audit-log` | `SystemPages.AuditLogPage` | admin | |
| `/help` | `SystemPages.HelpPage` | all | |
| `/design-system` | `SystemPages.DesignSystemPage` | admin | |
| `/login` | `pages/auth/LoginPage` | public | sign-in; redirects here with `?next=` when signed out |
| `/signup` | `pages/auth/SignupPage` | public | two steps, starts the trial clock at creation |
| `/verify-email?token=` | `pages/auth/VerifyEmailPage` | public | verified, expired/invalid, unknown account, and the waiting state |
| `/reset-password`, `/reset-password?token=` | `pages/auth/ResetPasswordPage` | public | request (neutral answer), new password, used/expired link |
| `/onboarding/start`, `/business`, `/sells`, `/catalogue`, `/team`, `/review`, `/done` | `pages/auth/OnboardingPages` | signed in | trial introduction, five setup steps, completion with trial summary; draft saved as you type |
| `/trial-ended` | `pages/TrialPages` | all roles | one page for every phase (running, read-only, archived, paid) |
| `/account/export` | `pages/TrialPages` (`ExportPage`) | all roles | real CSV and JSON downloads, open in every phase except archived |
| `/platform-admin` | `PlatformAdminPage` | operator | separate area, no tenant navigation |

## Source limitations (capabilities that do not exist in the code)

Verified against `src/api/routes/*` (223 route definitions) and `docs/database-schema.md`.

- **No locations, warehouses, bins, transfers or stocktakes.** Stock is one on-hand / reserved / damaged figure per variant. The redesign shows exactly that and does **not** invent a location model. The brief's "locations / transfers / stocktakes / bins" therefore have no screen.
- **No ITC matching, TDS, fixed assets, cost centres or money accounts** routes. GST returns, ledger, journal entries and the three statements do exist and are covered.
- **No manual journal create/reverse screen** in the redesign (endpoints exist: `POST /journal-entries`, `/reverse`); ledger is read-only here.
- **Shipment booking**: `POST /orders/:id/create-shipment` exists but depends on a configured carrier connector. The redesign's "Book shipment" assigns a sample AWB locally and says so.
- **Carrier name**: `docs/features.md` says Delhivery; code and webhooks say Shiprocket. The redesign follows the code.
- **Historical docs disagree with code** (e.g. `pos-capability-map.md` says no discounts/tax/shifts; `features.md` lists discounts, shifts, offline). Code is the authority; items marked *verify* in the API map.
- **Separate POS terminal repository** is not in the ZIP and was not inspected. The `/pos` page here is a web preview of its flow, not that app.
