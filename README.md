# Sikick IMS redesign

Standalone frontend prototype of the IMS as **Sikick**: horizontal top navigation, prominent POS, left drawer on tablet and phone, SiBorg, optional sound, and one coherent fictional workspace (Morrow Goods, Main Store, Aster Wholesale). It sits beside `ims-final-built/`, which it only ever reads. No network calls, no database, no payments.

## Run

```bash
npm install
npm run dev        # http://localhost:5180
npm run build      # typecheck + production build
npm run typecheck
npm run lint
npm test           # 27 unit tests: stock = sum of events, cart = receipt, books balance, role gates, sound, trial phases, number formatting
```

Sign in with the demo account `ameen@morrowgoods.example` / `Morrow-demo-2026!` (the prototype opens already signed in; the account menu signs you out). `/signup` creates a trial account in this browser only. Add `?dev=1` once to get the "Prototype states" panel for every trial phase, or use `?scenario=expired`, `?session=out`. Nothing is sent anywhere.

Handy URLs: `/dashboard`, `/pos`, `/agent/chat`, `/platform-admin`, `?theme=dark` on any page. The account menu previews each role and resets local data; reload also resets.

## Where things are

| Path | What |
|---|---|
| `src/app/` | router (`routes.tsx`, same paths as the source), nav config, role gates |
| `src/layouts/` | `AppShell`, `TopNav`, `Drawer` (phone/tablet), `Assistant` (right), `CommandSearch` |
| `src/components/` | UI primitives, `DataTable`, charts, overlays, brand marks, illustrations |
| `src/features/` | `pos/`, `siborg/` (chat, brain, 3D), `catalog/` |
| `src/pages/` | route screens |
| `src/services/contracts/` | typed `ImsService`, `ImsState`, commands |
| `src/services/adapters/local.ts` | **fixture adapter** (default); `api.ts` is the unconnected boundary |
| `src/services/selectors.ts`, `finance.ts`, `insights.ts` | everything derived (stock, alerts, KPIs, ledger, GST) |
| `src/data/fixtures/seed.ts` | the one dataset |
| `src/lib/` | money (integer paise, Indian grouping), pricing, EAN-13, sound, csv |
| `docs/` | `SCREEN_ROUTE_MAP`, `API_INTEGRATION_MAP`, `DESIGN_SYSTEM` (incl. glass), `MOTION_SPEC`, `SOUND_DESIGN`, `CONTROL_AUDIT`, `AUTH_AND_TRIAL_MAP` |

## Honest limits

Prototype state is in memory. Photo recognition, document extraction, receipts, emails, shipping, PIN reset and billing are labelled examples. The source has no locations, transfers or stocktakes, so none are shown (see the route map). The separate POS terminal repository was not available.
