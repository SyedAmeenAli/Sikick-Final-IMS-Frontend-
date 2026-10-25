# Design system

Tokens live in `src/theme/tokens.css`; components in `components.css`, shell in `shell.css`, page-specific in `pages.css`. Nothing hard-codes a colour: the dark theme redefines the same semantic tokens (`:root[data-theme='dark']`), so tables, charts, dialogs and the receipt stay readable. Open any page with `?theme=dark` to review it.

## Theme

Light, Dark or System, chosen in the account menu, the drawer, a toggle in the bar on wide screens, or Settings, Appearance. The choice is kept in this browser; with no choice the app follows the device, and an explicit choice is never overwritten by it. An inline script in `index.html` sets `data-theme` and `color-scheme` before first paint, so there is no flash of the wrong theme. Native controls, scrollbars, placeholders and the browser chrome colour follow. All colours are semantic tokens (surface, field, table head, row hover, row selected, chart series, grid and axis, glass, shadow colour and strength, focus), registered with `@property` so a theme switch animates them together (see `MOTION_SPEC.md`). Light `--ink-4` was darkened so inactive step labels and separators pass 3:1; a contrast check over ten screens in both themes reports no text below it.

## Colour

| Token | Light | Use |
|---|---|---|
| `--bg` | `#f4efea` | workspace |
| `--surface`, `--surface-2/3` | `#fffdfb`, `#faf6f2`, `#f3ece6` | panels, sunk areas, hover |
| `--ink`, `--ink-2/3/4` | `#1f171a` … `#a0929a` | text, muted, disabled |
| `--wine`, `--wine-strong`, `--wine-soft` | `#8b1538`, `#6e0f2b`, `#f5e8ea` | brand, primary action, selected, POS |
| `--ok / --warn / --bad / --info` (+ `-soft`) | green, amber, red, blue | status only |
| `--line`, `--line-strong` | `#e5dbd4`, `#d6c9c0` | 1 px borders |

Wine is used sparingly: primary actions, the active nav indicator, selection, the POS pill and the SiBorg mark. The old AX green is not used.

## Type

DM Sans for everything operational (13.5 px base, tabular figures for money), Newsreader only for page titles and dialog titles. Scale tokens `--fs-xs … --fs-2xl`.

## Spacing, shape

4 / 8 / 12 / 16 / 20 / 24 / 32 / 40. Radii 4 / 6 / 9 / 13 px, pills for chips and POS. Panels use a 1 px border and a faint shadow, no heavy cards.

## Navigation (all sizes)

| Width | Navigation |
|---|---|
| 1181 px and up | horizontal top bar, wine POS pill, More menu |
| 900 to 1180 px, landscape | bottom quick bar (Dashboard, Inventory, POS, Sales, More) plus a collapsible icon rail; "All pages" opens the full drawer |
| up to 1180 px otherwise (phones, portrait tablets) | bottom quick bar plus the left overlay drawer from More or the menu button |

The bar is for frequent destinations; the drawer is the complete list. They are not copies of each other. Content keeps `padding-bottom: var(--bottom-nav-h)` (60 px plus the safe-area inset), toasts, the assistant launcher and the till's sale bar sit above the bar, and dialogs, the drawer and the assistant sit above it.

## Navigation, desktop details

- **Desktop ≥ 1181 px**: horizontal top bar. Logo, optional workspace chip (≥ 1620 px), 12 primary items, search, sound mute, alerts, account. **POS** is the only filled item (wine pill); the active ring shows when `/pos` is open. Dropdown groups are click-to-open (never hover-only), close on outside press and Escape, and keep focus on their trigger. The wine underline is one shared element that travels between items.
- **≤ 1180 px**: the top menu is replaced by the bottom quick bar and the left drawer (table above); POS is the centre capsule of the bar and the first card in the drawer.
- **No permanent global sidebar** on desktop; the tablet-landscape rail is a compact convenience, not a second full menu. Settings uses a horizontal `RouteTabs` strip plus an overview grid.
- Header turns to a translucent glass surface (blur, border, soft shadow) progressively over the first 40 px of scroll; height never changes.

## Glass

Glass is for layers that float above the page, never for data. Tokens in `tokens.css`: `--glass-1/2/3`, `--glass-border`, `--glass-edge`, `--glass-shadow(-hover)`, `--glass-blur` (16 px, 10 px under 640 px), `--glass-sat`. A soft ambient light sits behind the workspace (`body::before`, fixed, so no repaint on scroll) so the blur has something to show.

| Surface | Fill | Blur | Notes |
|---|---|---|---|
| Top bar | 0 to 78 % by scroll | 0 to 16 px by scroll | on a `::before` layer, so menus inside it keep their own blur |
| Menus, popovers | 78 % | 16 px | 1 px border, top-edge highlight |
| Dialogs, side panels, drawer, assistant, search | 88 % | 16 px | |
| `Panel glass` (dashboard sales and SiBorg brief, SiBorg chat and proposals) | 93 % | 16 px | hover or focus-within: border toward wine, shadow lifts, fill brightens; the panel never moves |
| Metric tiles, card links | solid | none | top highlight, one slow sheen on hover or focus |
| Tables, forms, receipts | solid | none | readability first |

Fallbacks: no `backdrop-filter` support, or `prefers-reduced-transparency`, gives solid surfaces; reduced motion removes the entrance blur and shows everything at once.

## Components

`Button`, `Chip/StatusChip`, `Panel`, `Metric`, `PageHeader`, `Page/Block` (grouped entrance), `Field/Input/Select/Toggle`, `Tabs/RouteTabs`, `DataTable` (search, sort, paging, selection, card layout under 720 px), `Dialog`, `SidePanel`, `Confirm`, `Toast`, `LineChart/BarChart/Donut/Spark` (hand-rolled SVG), `Barcode` (EAN-13), `SiBorgIcon` (2D, mood ring) and the 3D `SiBorgObject3D`, hairline illustrations in `components/illustrations.tsx`.

## Responsive rules

Tables become stacked cards with `data-label` under 720 px. Grids drop 4 → 2 → 1 columns. POS stacks catalogue over cart under 1000 px with a sticky total bar. Tab strips scroll horizontally without scrollbars. Safe-area insets are respected in the drawer and sticky bars. Verified at 1440, 1280, 1024, 768, 390, 360 wide.
