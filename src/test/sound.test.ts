import { describe, expect, it, beforeEach } from 'vitest';
import { configureSound, cue, playCartAdd, playCheckoutComplete, previewCue, soundState, PALETTE } from '@/lib/sound';

/** The test environment has no AudioContext: the service must stay silent, keep its state, and never throw. */
describe('sound service', () => {
  beforeEach(() => {
    (globalThis as { __cues?: string[] }).__cues = [];
    configureSound({ enabled: false, volume: 0.4 });
  });

  it('is off by default and clamps volume', () => {
    configureSound({ enabled: true, volume: 7 });
    expect(soundState()).toEqual({ enabled: true, volume: 1 });
    configureSound({ enabled: false, volume: -1 });
    expect(soundState()).toEqual({ enabled: false, volume: 0 });
  });

  it('never throws when audio is unavailable, enabled or not', () => {
    expect(() => { cue('scan'); playCartAdd(); playCheckoutComplete(); previewCue('warning'); }).not.toThrow();
    configureSound({ enabled: true, volume: 0.5 });
    expect(() => { cue('scan'); playCartAdd(); playCheckoutComplete(); previewCue('warning'); }).not.toThrow();
  });

  it('plays nothing while muted', () => {
    cue('checkout'); cue('cartAdd');
    expect((globalThis as { __cues?: string[] }).__cues).toEqual([]);
  });

  it('the settings palette covers real cues only, once each', () => {
    const names = PALETTE.map((p) => p.cue);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('checkout');
  });
});
