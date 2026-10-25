# Control audit

Every interactive control on every route was exercised in a real browser (headless Chrome driving the running app), not read from code. The harness lives outside the project in `sikick-film-tooling/` (`ims-controls.mjs`, `ims-final.mjs`, `ims-typing.mjs`, `ims-menus.mjs`) so the app has no test-only code in it.

## Method

1. **Click pass** (`ims-controls.mjs`): opens each route at 1440 x 900, lists every visible button, link, tab, select, input, textarea, summary and clickable row inside `<main>`, and acts on each (click, type, change a select, drag a range). A control passes only if something observable changed: the URL, the content, a dialog or side panel opening or closing, a toast, a toggled `aria-*` state or a form value. Links must land on their own `href`; `#` links are flagged; console and page errors are captured.
2. **Layer pass** (`ims-final.mjs dialogs`): every dialog and side panel that the click pass opened was driven through Cancel, empty submit (validation must be visible), valid submit (the record must appear and related figures must change).
3. **Typing pass** (`ims-typing.mjs`): real key events into every text field on the page and inside each dialog; focus must stay in the field and the value must hold what was typed.
4. **Menu pass** (`ims-menus.mjs`): every link in every top-bar menu (39 followed) and in the phone drawer (38 followed): lands on its own path, renders, closes the menu or drawer, releases the scroll lock, marks the right module active.
5. **Shell pass** (`ims-final.mjs shell`): alerts popover, account menu (role, theme, reset), search, assistant (open, quick prompt, close, focus return), drawer at 1024, 768, 390 and 360.
6. **Sound pass** (`ims-final.mjs sound`): which cue fires for which action, and nothing else.

## Result

| | |
|---|---|
| Routes opened | 69 (every route in `routes.tsx` plus a 404) |
| Controls acted on in the click pass | 653 distinct controls (de-duplicated by role, label and destination per route) |
| Changed something observable | 570 |
| Disabled on purpose (state not reached) | 19 |
| No visible change | 64, all explained below |
| Wrong destination, dead link, `#` link, console error | 0 |
| Menu and drawer links followed | 77 (39 + 38), 0 problems |
| Text fields typed into | 65 on pages and in dialogs |
| Scripted behaviour checks (`ims-final`) | 130 passed, 0 failed |

The 64 "no visible change" controls are all correct behaviour: 38 are a tab, filter or option that is **already current** (20 links to the tab you are on, 18 selected filter or segment buttons such as "All" while "All" is active), 13 are the sound-palette audition buttons (audio only, covered by the sound pass), 5 download a file (the download happens outside the page; all six downloads were captured and are non-empty files with real headers: audit-log.csv, gstr-summary.json, gstr1-hsn.csv, morrow-sample.csv, profit-and-loss.csv, trial-balance.csv), 7 are design-system demo buttons including the motion "Replay", and 1 is a read-only field (the unit on a variant).

## Defects found and repaired

| Where | Before | Repair | Verified |
|---|---|---|---|
| **Every dialog with a form** (Record expense, New supplier, Adjust stock, Invite, Record payment, New category and more) | After the first character, each keystroke sent focus back to the first field, so later fields could not be typed into reliably. Cause: the shared modal effect depended on an `onClose` arrow that is new on every render, so it re-ran on every keystroke and re-focused | `useModal` keeps `onClose` in a ref and re-runs only when the dialog opens or closes | typing pass; "every keystroke lands in the field you are typing in" |
| Settings, Business and tax: tax rate, e-way threshold, audit retention | Typing a letter or clearing the box showed `NaN` and could not be corrected | `NumInput` keeps what you type, accepts digits only, reports "not a number" until it is one; validation catches blanks | typing pass: 0 bad fields after the fix |
| POS receipt **Print** and label **Print studio** | Showed a toast claiming the receipt or labels went to a "printer preview"; nothing printed | Opens the browser print dialog for just the receipt (80 mm) or the label sheet; the job is recorded in print history first for labels | `window.print` called once per press |
| Settings, Notifications **Save** | Said "saved" although nothing is stored by the service | Says the settings are kept for this session and that delivery is not connected | read in the toast |
| Back / forward | Every route change jumped to the top, including browser Back | New routes start at the top; Back and Forward restore the saved position of that history entry | "back restores the earlier scroll position" |
| Assistant | Closing it dropped focus | Focus returns to its launcher; Escape and the close button agree | shell pass |
| Drawer, dialog and search scroll lock | Each added and removed the same class, so closing one while another was open unlocked the page | One counted lock shared by all three | shell and drawer passes |
| Menus | Closing menus could still catch the pointer for their last 140 ms; no arrow-key movement | `pointer-events: none` on exit; Up and Down move through items | glass pass |
| Loading | A `Skeleton` component and CSS existed but nothing used them | Removed | none left on screen |
| Sound toggle and volume | Preference lost on reload; slider did not affect any preview; no way to audition | See `SOUND_DESIGN.md` | sound pass |

## What is still a prototype

Not defects, but not real either, and labelled so on screen: photo recognition, document extraction, e-mailing receipts, shipment booking, PIN issuing, billing changes, the "Add a shop" action and campaign delivery. Each says it is not connected; none shows a success state.

## Second pass: theme, figures, navigation, sign-in and trial

Repeated after the sign-in, trial, theme and navigation work (80 routes now, including the 14 new account screens).

| | |
|---|---|
| Routes opened | 80, at 1440, 1280, 1024, 768, 390 and 360 wide: no console error, no overflow, none empty |
| Controls acted on in the click pass | 735 distinct controls on 77 routes: 650 changed something visible, 19 disabled on purpose, 66 correctly no change (current tab or option, audio-only previews, downloads, demo buttons, a read-only field) |
| Wrong destination, dead link, `#` link, error | 0 |
| Scripted behaviour checks | 305 (theme, figures, navigation, sign-in, sign-up, verification, recovery, onboarding, seven trial states, no network) plus the earlier 130 and 73, all passing on the production build |
| Unit tests | 27 |

Defects found and repaired in this pass: inactive step labels and breadcrumb separators were below 3:1 contrast in the light theme (found by a contrast audit over ten screens; `--ink-4` darkened); a hidden menu button on tablet landscape left the old tests unable to open the drawer (the rail and the bottom bar's More now do); the animated total briefly lagged a typed discount by about 300 ms (display only; the amount due and the receipt always used the exact value, and the check now waits for the figure to settle).
