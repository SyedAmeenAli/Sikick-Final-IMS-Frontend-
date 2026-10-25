# Sound design

Original sounds, synthesised with the Web Audio API in `src/lib/sound.ts`. No audio files are downloaded or bundled, so there is nothing to license. Silent until the person turns sound on.

## Audit of the first version (what was wrong)

| Finding | Fix |
|---|---|
| Five cues only (scan, add, checkout, receipt, alert); nothing for drawers, panels, toggles, SiBorg or errors | 16 cues in one family, each tied to a real state change |
| Scan used two **square** waves at 1.5-2.1 kHz: thin and buzzy | Sine/triangle bodies, lowpassed at 5.2 kHz; under 0.2 % of the energy is above 4 kHz |
| `receipt` and `alert` fired from `setTimeout`s (420 ms / 900 ms) that ran whether or not the UI had reached that state | The checkout cue plays from an effect once the receipt step is showing, once per receipt; alerts come from a watcher on the alert list |
| Preference lived only in memory | Kept in this browser's `localStorage` under `sikick.sound.v1` (never sent anywhere); off by default |
| New gain chain per cue, no overlap guard | One shared `AudioContext`, one master chain (gain, lowpass, soft limiter), a per-cue minimum gap, at most four voices at once |
| Muting only blocked future cues | Mute ramps the master to zero and suspends the context at once |
| Settings: on/off and a 10-step slider | On/off, 0-100 % volume in 5 % steps, a per-cue **palette** to audition, a plain-language current setting |

## Palette

Pentatonic neighbours of one root, so the cues sit together. Lengths are measured offline (time until 40 dB below the cue's own peak); levels are at volume 100 %. The default is 40 %, which is 16 dB quieter again.

| Cue | Plays when | Length | Peak |
|---|---|---|---|
| `uiConfirm` | A settings switch is flipped; sound turned on | 70 ms | -17 dBFS |
| `uiError` | A toast reports a failure (rejected scan, short stock, validation) | 105 ms | -21 |
| `navigate` | A major module is opened from the top bar (not tabs, in-page links, or the current module) | 115 ms | -21 |
| `drawerOpen` / `drawerClose` | Phone and tablet navigation starts to slide in / out. Choosing a destination plays the close cue only | 150 / 145 ms | -19 / -22 |
| `panelOpen` / `panelClose` | The SiBorg assistant opens / closes | 125 / 115 ms | -23 / -25 |
| `cartAdd` | A product is **accepted** into the till cart (including quantity up) | 75 ms | -14 |
| `cartRemove` | A line is removed or a quantity reduced | 65 ms | -19 |
| `scan` | A scan, or Enter on an exact SKU/barcode, resolves to a product | 120 ms | -10 |
| `checkout` | The local sale is recorded and the receipt is on screen | 250 ms | -7 |
| `siborgListen` | The person starts typing to SiBorg | 50 ms | -24 |
| `siborgInsight` | SiBorg changes from thinking to an answer | 180 ms | -11 |
| `siborgRecommend` | The answer carries a proposal to review (replaces the insight cue, never both) | 240 ms | -8 |
| `siborgUnavailable` | SiBorg cannot do what was asked | 80 ms | -25 |
| `warning` | A **new** critical or high stock alert appears; at most once every 20 s | 255 ms | -12 |

Character: warm sine/triangle bodies, one soft band-passed noise "air" sweep where a surface moves (rising when a drawer opens, falling when it closes), no reverb, every cue decays to silence with no abrupt cut-off. Measured spectral centroids sit between 350 and 1,240 Hz.

Never plays: on page load, hover, scrolling, navigation within a module, table updates, re-renders, thinking (no loop), or when the success path failed.

## Reliability rules

- The audio context is created or resumed only inside a user gesture. If sound was left on in an earlier visit, the first press or key wakes it; no cue is queued before that.
- If the browser refuses to resume, the cue is dropped rather than queued.
- Every public function is wrapped: if Web Audio is missing or throws, the interface carries on silently.
- Cue functions are called from event handlers, or from effects guarded by the state transition (previous-state ref, receipt id, known-alert set), so Strict Mode and re-renders cannot fire one twice.
- `__cues` (a test hook on `globalThis`) is inert unless a test installs an array.

## Auditioning

`node sikick-film-tooling/sound-audit.mjs <outdir>` renders every cue offline in headless Chrome at the real master level, prints length, peak, RMS, centroid and high-frequency share, and writes one WAV per cue (+8 dB so the files are audible from disk). The same palette can be auditioned in the app under **Settings, Appearance and sound**.
