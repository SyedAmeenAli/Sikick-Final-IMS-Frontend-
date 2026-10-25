/**
 * Sikick sound language — original, synthesised with WebAudio (no downloaded files, so nothing to license).
 *
 * Character: warm sine/triangle bodies, one soft filtered-noise "air" transient where a surface moves,
 * lowpassed, short, quiet. Every cue is a pentatonic neighbour of the same root so they sit together.
 *
 * Rules the service enforces:
 *  - silent until the person turns sound on; the audio context is created or resumed only inside a user gesture
 *  - one shared AudioContext, one master chain (gain -> lowpass -> soft limiter)
 *  - muting is immediate (master to zero, context suspended); volume 0 plays nothing
 *  - a cue never plays twice inside its minimum gap, and at most a few voices overlap
 *  - nothing throws: if audio is unavailable the interface carries on silently
 * Callers use the named functions at the bottom; none of them is called from render.
 */
export interface SoundPrefs { enabled: boolean; volume: number }
export type Cue =
  | 'uiConfirm' | 'uiError' | 'navigate' | 'drawerOpen' | 'drawerClose' | 'panelOpen' | 'panelClose'
  | 'cartAdd' | 'cartRemove' | 'scan' | 'checkout'
  | 'siborgListen' | 'siborgInsight' | 'siborgRecommend' | 'siborgUnavailable' | 'warning';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let prefs: SoundPrefs = { enabled: false, volume: 0.4 };
let noiseBuf: AudioBuffer | null = null;
let active = 0;
const lastAt = new Map<Cue, number>();

/** peak output at volume 1 is about -17 dBFS; the default 0.4 is about -25 dBFS */
const MASTER = 0.14;
const level = () => MASTER * prefs.volume * prefs.volume * 1.6;

export const soundState = () => ({ ...prefs });

function Ctor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? null;
}

/** gain -> lowpass -> soft limiter -> output. Shared by live playback and the offline renderer used for auditioning. */
function buildChain(c: BaseAudioContext, gain: number): GainNode {
  const g = c.createGain();
  g.gain.value = gain;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 5200; lp.Q.value = 0.5;
  const lim = c.createDynamicsCompressor();
  lim.threshold.value = -20; lim.knee.value = 12; lim.ratio.value = 6; lim.attack.value = 0.003; lim.release.value = 0.12;
  g.connect(lp); lp.connect(lim); lim.connect(c.destination);
  return g;
}

function ensure(): AudioContext | null {
  try {
    if (ctx) return ctx;
    const AC = Ctor();
    if (!AC) return null;
    ctx = new AC({ latencyHint: 'interactive' });
    const g = buildChain(ctx, prefs.enabled ? level() : 0);
    master = g;
    return ctx;
  } catch {
    ctx = null; master = null;
    return null;
  }
}

/** Called from a pointer/keyboard gesture. Only wakes audio when the person has sound on. */
export function unlockSound() {
  if (!prefs.enabled) return;
  const c = ensure();
  if (c && c.state === 'suspended') void c.resume().catch(() => {});
}

export function configureSound(next: SoundPrefs) {
  const was = prefs.enabled;
  prefs = { enabled: !!next.enabled, volume: Math.min(1, Math.max(0, next.volume)) };
  if (!ctx || !master) return;
  try {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    if (!prefs.enabled) {
      master.gain.setTargetAtTime(0, now, 0.008);          // mute takes effect at once
      window.setTimeout(() => { if (!prefs.enabled && ctx) void ctx.suspend().catch(() => {}); }, 60);
    } else {
      master.gain.setTargetAtTime(level(), now, 0.01);
      if (!was && ctx.state === 'suspended') void ctx.resume().catch(() => {});
    }
  } catch { /* audio is optional */ }
}

function noise(c: BaseAudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const b = c.createBuffer(1, Math.floor(c.sampleRate * 0.4), c.sampleRate);
  const d = b.getChannelData(0);
  let seed = 12345;                                   // fixed seed: the same texture every time
  for (let i = 0; i < d.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = (seed / 0xffffffff) * 2 - 1; }
  return (noiseBuf = b);
}

interface Tone { f: number; at: number; d: number; to?: number; g?: number; type?: OscillatorType; a?: number }
/** air: a short band-passed noise swell; f0->f1 is the filter sweep (opening sweeps up, closing sweeps down) */
interface Air { at: number; d: number; f0: number; f1: number; g: number; q?: number }
interface Voice { tones?: Tone[]; air?: Air[]; gap: number; max: number }

const D = {
  // 60 ms soft confirmation
  uiConfirm: { gap: 60, max: 0.12, tones: [{ f: 660, to: 600, at: 0, d: 0.11, g: 0.8, a: 0.004 }, { f: 1320, at: 0, d: 0.05, g: 0.12, a: 0.003 }] },
  // quiet, low, neutral: "not that"
  uiError: { gap: 300, max: 0.14, tones: [{ f: 330, to: 277, at: 0, d: 0.16, g: 0.5, type: 'triangle' as OscillatorType, a: 0.006 }] },
  // 90 ms understated step forward
  navigate: { gap: 160, max: 0.1, tones: [{ f: 494, to: 587, at: 0, d: 0.17, g: 0.5, a: 0.006 }], air: [{ at: 0, d: 0.15, f0: 900, f1: 1500, g: 0.1 }] },
  // 150 ms: air sweeps up under a short rising pair, ends as the panel settles
  drawerOpen: { gap: 220, max: 0.17, tones: [{ f: 392, to: 523, at: 0.01, d: 0.22, g: 0.42, a: 0.01 }], air: [{ at: 0, d: 0.24, f0: 500, f1: 1700, g: 0.2, q: 0.9 }] },
  drawerClose: { gap: 220, max: 0.15, tones: [{ f: 523, to: 370, at: 0, d: 0.2, g: 0.4, a: 0.008 }], air: [{ at: 0, d: 0.21, f0: 1500, f1: 480, g: 0.18, q: 0.9 }] },
  // smaller sibling for the assistant and other panels
  panelOpen: { gap: 220, max: 0.13, tones: [{ f: 440, to: 554, at: 0, d: 0.16, g: 0.38, a: 0.008 }], air: [{ at: 0, d: 0.18, f0: 700, f1: 1600, g: 0.15, q: 0.9 }] },
  panelClose: { gap: 220, max: 0.12, tones: [{ f: 554, to: 415, at: 0, d: 0.15, g: 0.32, a: 0.008 }], air: [{ at: 0, d: 0.16, f0: 1500, f1: 600, g: 0.12, q: 0.9 }] },
  // 80 ms warm tap, a touch of body underneath
  cartAdd: { gap: 55, max: 0.14, tones: [{ f: 587, to: 523, at: 0, d: 0.12, g: 0.75, a: 0.004 }, { f: 294, at: 0, d: 0.11, g: 0.35, a: 0.004 }, { f: 1174, at: 0, d: 0.05, g: 0.1, a: 0.003 }] },
  cartRemove: { gap: 55, max: 0.07, tones: [{ f: 392, to: 311, at: 0, d: 0.1, g: 0.55, a: 0.004 }, { f: 196, at: 0, d: 0.09, g: 0.25, a: 0.004 }] },
  // 160 ms: a tiny read blip, then a gentle resolving pair
  scan: { gap: 180, max: 0.18, tones: [{ f: 988, at: 0, d: 0.04, g: 0.45, a: 0.003 }, { f: 1319, at: 0.06, d: 0.11, g: 0.55, a: 0.005 }, { f: 659, at: 0.06, d: 0.1, g: 0.2, a: 0.005 }], air: [{ at: 0, d: 0.03, f0: 3200, f1: 3200, g: 0.08, q: 3 }] },
  // 300 ms two-part confirmation that resolves upward and is allowed to die away
  checkout: { gap: 600, max: 0.34, tones: [{ f: 523, at: 0, d: 0.15, g: 0.7, a: 0.006 }, { f: 262, at: 0, d: 0.15, g: 0.25, a: 0.006 }, { f: 784, at: 0.1, d: 0.27, g: 0.7, a: 0.008 }, { f: 1568, at: 0.1, d: 0.18, g: 0.09, a: 0.008 }, { f: 392, at: 0.1, d: 0.27, g: 0.22, a: 0.008 }] },
  // SiBorg: a single soft signal, a warm two-note insight, a more defined three-note recommendation
  siborgListen: { gap: 900, max: 0.06, tones: [{ f: 740, at: 0, d: 0.08, g: 0.35, a: 0.006 }] },
  siborgInsight: { gap: 700, max: 0.26, tones: [{ f: 659, at: 0, d: 0.14, g: 0.55, a: 0.008 }, { f: 880, at: 0.09, d: 0.17, g: 0.55, a: 0.01 }, { f: 1760, at: 0.09, d: 0.1, g: 0.06, a: 0.01 }] },
  siborgRecommend: { gap: 900, max: 0.3, tones: [{ f: 659, at: 0, d: 0.1, g: 0.5, a: 0.008 }, { f: 784, at: 0.08, d: 0.1, g: 0.55, a: 0.008 }, { f: 988, at: 0.16, d: 0.15, g: 0.62, a: 0.01 }, { f: 494, at: 0.16, d: 0.15, g: 0.2, a: 0.01 }] },
  siborgUnavailable: { gap: 600, max: 0.14, tones: [{ f: 349, to: 330, at: 0, d: 0.12, g: 0.3, a: 0.01 }] },
  // restrained two-note nudge: lower and softer than a notification ding, never repeated within 20 s
  warning: { gap: 20000, max: 0.32, tones: [{ f: 659, at: 0, d: 0.16, g: 0.5, type: 'triangle' as OscillatorType, a: 0.01 }, { f: 494, at: 0.16, d: 0.18, g: 0.5, type: 'triangle' as OscillatorType, a: 0.01 }] },
} satisfies Record<Cue, Voice>;

function schedule(c: BaseAudioContext, voice: Voice, name: Cue, dest: AudioNode | null = master, live = true) {
  if (!dest) return;
  if (live) (globalThis as { __cues?: string[] }).__cues?.push(name);   // test hook: stays inert unless a test installs the array
  const t0 = c.currentTime + 0.008;
  let end = 0;
  if (live) active += 1;
  for (const t of voice.tones ?? []) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = t.type ?? 'sine';
    o.frequency.setValueAtTime(t.f, t0 + t.at);
    if (t.to) o.frequency.exponentialRampToValueAtTime(t.to, t0 + t.at + t.d);
    const peak = Math.max(0.0002, t.g ?? 0.6);
    g.gain.setValueAtTime(0.0001, t0 + t.at);
    g.gain.exponentialRampToValueAtTime(peak, t0 + t.at + (t.a ?? 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + t.at + t.d);   // always decays to silence: no abrupt cut-off
    o.connect(g); g.connect(dest);
    o.start(t0 + t.at); o.stop(t0 + t.at + t.d + 0.03);
    end = Math.max(end, t.at + t.d + 0.03);
  }
  for (const a of voice.air ?? []) {
    const s = c.createBufferSource();
    s.buffer = noise(c);
    const f = c.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = a.q ?? 0.8;
    f.frequency.setValueAtTime(a.f0, t0 + a.at);
    f.frequency.exponentialRampToValueAtTime(a.f1, t0 + a.at + a.d);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0 + a.at);
    g.gain.exponentialRampToValueAtTime(a.g, t0 + a.at + a.d * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a.at + a.d);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t0 + a.at, 0.05); s.stop(t0 + a.at + a.d + 0.02);
    end = Math.max(end, a.at + a.d + 0.02);
  }
  if (live) window.setTimeout(() => { active = Math.max(0, active - 1); }, (end + 0.05) * 1000);
  return end;
}

export function cue(name: Cue) {
  try {
    if (!prefs.enabled || prefs.volume <= 0.001) return;
    const voice: Voice = D[name];
    const now = performance.now();
    if (now - (lastAt.get(name) ?? -1e9) < voice.gap) return;      // no double-fire, no machine-gun
    if (active >= 4) return;                                        // never a pile-up
    const c = ensure();
    if (!c) return;
    lastAt.set(name, now);
    if (c.state === 'running') { schedule(c, voice, name); return; }
    // inside a gesture the context resumes at once; if the browser refuses, drop the cue rather than queue it
    void c.resume().then(() => { if (c.state === 'running' && performance.now() - now < 250) schedule(c, voice, name); }).catch(() => {});
  } catch { /* sound is never a prerequisite */ }
}

/* ---- named semantic actions: the only API the interface uses ---- */
export const playUiConfirm = () => cue('uiConfirm');
export const playUiError = () => cue('uiError');
export const playNavigate = () => cue('navigate');
export const playDrawerOpen = () => cue('drawerOpen');
export const playDrawerClose = () => cue('drawerClose');
export const playPanelOpen = () => cue('panelOpen');
export const playPanelClose = () => cue('panelClose');
export const playCartAdd = () => cue('cartAdd');
export const playCartRemove = () => cue('cartRemove');
export const playBarcodeConfirm = () => cue('scan');
export const playCheckoutComplete = () => cue('checkout');
export const playSiborgListening = () => cue('siborgListen');
export const playSiborgInsight = () => cue('siborgInsight');
export const playSiborgRecommend = () => cue('siborgRecommend');
export const playSiborgUnavailable = () => cue('siborgUnavailable');
export const playOperationalWarning = () => cue('warning');

/** Renders one cue offline at the real master level (volume 1), for measuring loudness and length. Not used in the UI. */
export async function renderCueOffline(name: Cue, sampleRate = 44100): Promise<Float32Array> {
  const c = new OfflineAudioContext(1, Math.ceil(sampleRate * 0.8), sampleRate);
  const chain = buildChain(c, MASTER * 1.6);
  schedule(c, D[name], name, chain, false);
  const buf = await c.startRendering();
  return buf.getChannelData(0);
}

/** Settings preview: bypasses the per-cue gap so each sample can be auditioned back to back. */
export function previewCue(name: Cue) {
  lastAt.delete(name);
  cue(name);
}

export const PALETTE: Array<{ cue: Cue; label: string; use: string }> = [
  { cue: 'uiConfirm', label: 'Confirm', use: 'Switching a setting on or off' },
  { cue: 'navigate', label: 'Module', use: 'Opening a major module from the top bar' },
  { cue: 'drawerOpen', label: 'Drawer open', use: 'Phone and tablet navigation, as it slides in' },
  { cue: 'drawerClose', label: 'Drawer close', use: 'The same drawer sliding away' },
  { cue: 'panelOpen', label: 'Assistant', use: 'SiBorg assistant opening and closing' },
  { cue: 'cartAdd', label: 'Add to cart', use: 'An item accepted into the till cart' },
  { cue: 'cartRemove', label: 'Remove', use: 'A line removed or a quantity reduced' },
  { cue: 'scan', label: 'Barcode', use: 'A scan resolving to a product' },
  { cue: 'checkout', label: 'Checkout', use: 'A sale completed locally, receipt showing' },
  { cue: 'siborgInsight', label: 'SiBorg insight', use: 'An answer is ready' },
  { cue: 'siborgRecommend', label: 'SiBorg proposal', use: 'A proposed action is ready to review' },
  { cue: 'warning', label: 'Alert', use: 'A new critical stock alert' },
  { cue: 'uiError', label: 'Not allowed', use: 'A failed check, quietly' },
];
