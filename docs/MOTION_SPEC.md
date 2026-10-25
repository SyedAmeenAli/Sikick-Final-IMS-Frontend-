# Motion spec

One library (`motion`), one easing curve `cubic-bezier(0.22, 0.8, 0.24, 1)`, tokens in `src/animations/motion.ts` and `tokens.css`. Everything settles; nothing loops except an in-progress SiBorg state.

## Reference

The recording (`20261025-0126-56`) was sampled at 1.5 fps. What it shows: the shell never moves; content goes from ghost blocks to populated in order (header block first, then cards, then lists); the active rail item changes without the shell reflowing; pages cross between "Work's always better together", "Hannah Brooks" and "Saved for later" with the shell fixed. Sikick translates this to the **top bar**: the underline travels, labels never move, content swaps beneath.

## Timings (as built)

| Thing | Value |
|---|---|
| Button / icon feedback | 150 ms |
| Hover, focus | 170 ms |
| Menus, popovers | 200 ms in, 140 ms out, 6 px rise, 2 % scale; pointer events off while leaving |
| Route content | old page out 70 ms, then the new page's own staged groups; no wrapper fade, so no dead gap |
| Page groups | 55 ms stagger, 200 ms each, 8 px rise (header, KPIs, main, secondary) |
| Glass panel entrance | about 500 ms: edge resolves (560 ms), panel rises 14 px, scale 0.985 to 1, blur 6 px to 0, content follows at 150 and 230 ms; a few panels per page only |
| Below-the-fold blocks | one shared IntersectionObserver, 420 ms rise of 14 px (glass ones 480 ms with the blur), once; visible if the observer is missing |
| Dialogs, side panels | 260 ms |
| Navigation drawer (left) | 300 ms slide, 40 ms stagger between rows, sub-links 30 ms apart, 300 ms scrim |
| Assistant drawer (right) | 300 ms |
| Chart line draw | first draw 650 ms (starts 300 ms in); switching 7/14/30 days redraws once in about 390 ms; hovering never replays it |
| Active nav indicator | 280 ms shared-layout move; pill and underline are one element and it fades out when the destination has none (POS) |
| Header glass | driven by scroll depth, 0 to 1 over the first 40 px through one CSS variable (`--sp`); fill, blur, border and shadow ramp together; height never changes |

### Dashboard entry, measured (production build, headless Chrome, client-side navigation)

Click to header starting: about 70 ms. Header settled: 280-350 ms. All first-screen groups settled: about 380 ms on a simple list page and 630 ms on the dashboard. Route chunks are preloaded when idle. The dev server is roughly twice as slow because React runs unminified.

## Theme change

One coordinated transition, 450 ms (120 ms with reduced motion), on a sharp ease-in-out (`cubic-bezier(0.8, 0, 0.2, 1)`) so the point where light text crosses dark ground, the one moment contrast dips, is as short as possible. Every colour in the product is a semantic token registered with `@property`, so changing `data-theme` on the root animates the tokens themselves: backgrounds, text, borders, shadows (colour and strength), glass fills, gradients, charts and SVG fills all move together on the same frames, because they only read tokens. There is no `transition: all`, no layout property involved, and no screen flash. The two logo files cross-fade. The sun and moon turn a quarter turn and cross-fade on the same clock. Measured in the browser: 33 frames, 19 distinct intermediate colours for the body, panels, text and borders alike; page height unchanged; six rapid toggles settle on the last choice; the active navigation indicator does not move.

## Animated figures

`AnimatedNumber` interpolates the number (integer paise or counts) and formats every frame through `lib/numfmt.ts`, so Indian grouping and the rupee sign are right on each frame. A primary figure counts up from zero **once per page load, when it scrolls into view** (780 ms, decelerating); after that it only ever glides from the value on screen to the new real value (340 ms, 260-300 ms in the till) and replaces any animation still running. Reduced motion, or no observer, shows the final value at once. The animated copy is `aria-hidden`; a visually hidden copy carries the final value, so assistive technology never hears intermediate frames. Receipts, tables and invoice lines are never animated.

## Navigation on phone and tablet

Bottom bar: five destinations, POS in the middle as a wine capsule that stays inside the bar line. One shared indicator moves between items (280 ms); "More" owns it when you are on a route outside the four, or while the drawer is open. The bar hides while a field has the keyboard (touch devices). Tablet landscape (900 to 1180 px) adds a 64 px icon rail that opens to 232 px in 260 ms, with labels fading in after the width settles; the workspace moves over rather than being covered. Everything else opens the same left drawer.

## Rules

- Only grouped sections animate, never individual cells or rows.
- No skeleton: data is local, so there is no loading state to represent. When the API adapter lands, add skeletons only around real fetches.
- `MotionConfig reducedMotion="user"` removes transforms; the CSS media query shortens every transition. Content is fully visible at once (tested).
- Route changes keep the header. New routes start at the top; back/forward return to the saved scroll position of that history entry.
- Loading: there is no skeleton anywhere (the component and its CSS were removed). Data is local; add one only around a real fetch.
- POS: tile flashes when added, line enters with a height reveal, quantity and total do a 150 ms nudge, steps slide 260 ms, receipt fades up. Controls are never disabled for an animation.
- Connectors only where two things really relate: PO lifecycle steps (draw when reached), stock adjustment before → event → after, SiBorg mark → proposal card.

## SiBorg states

2D mark ring and 3D character share one state machine: `idle` (still), `listening` (input focused or typing; gentle pulse), `thinking` (while an answer is prepared; spinner ring / inward pose), `insight` (settles when the answer arrives), `recommend` (dashed ring, fine connector to the proposal card, 3D turns toward it), `error` (grey, stable, for requests it cannot do). The persistent assistant drawer enters from the right and is independent of the mark's own movement.

## Sound (`src/lib/sound.ts`)

Synthesised with WebAudio, so no downloaded assets. **Off by default.** Turning it on (top-bar speaker button or Settings → Appearance and sound) is the deliberate gesture that creates the audio context. Cues: scan ≈110 ms, add-to-cart ≈80 ms, checkout ≈300 ms two-part (a fifth), receipt very soft, one restrained alert cue only when a sale pushes a new critical/high alert. Master gain ≈ −22 dB at full volume. No sound for navigation, tabs, hover, load, or failed checkout. Quick mute in the header. See `SOUND_DESIGN.md` for the palette, measurements and rules; the preference is kept in this browser.
