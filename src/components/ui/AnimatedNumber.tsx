import { useEffect, useLayoutEffect, useRef } from 'react';
import { animate, type AnimationPlaybackControls } from 'motion/react';
import { formatNumber, snap, type NumFormat } from '@/lib/numfmt';
import { observeReveal, prefersReducedMotion } from '@/lib/reveal';

/** Metrics that have already counted up in this page load. A figure counts from zero once, then only ever moves between real values. */
const counted = new Set<string>();

const EASE_OUT = [0.16, 0.84, 0.3, 1] as const;

/**
 * A figure that moves between real values.
 *  - first appearance (once per page load, when it scrolls into view): counts up from zero, 600-900 ms
 *  - later changes (a filter, a stock event, a till line): glides from what was on screen to the new value, 250-450 ms,
 *    replacing any animation still running, so rapid changes never pile up
 *  - reduced motion, or a missing observer: the final value at once
 * The text node is updated directly (no React render per frame). Assistive technology gets the final value only,
 * from a visually hidden copy; the animated copy is hidden from it.
 */
export function AnimatedNumber({ value, format, id, first = 780, change = 340 }: { value: number; format: NumFormat; id?: string; first?: number; change?: number }) {
  const vis = useRef<HTMLSpanElement>(null);
  const shown = useRef<number>(value);
  const run = useRef<AnimationPlaybackControls | null>(null);
  const fmtRef = useRef(format);
  fmtRef.current = format;
  const mounted = useRef(false);
  const latest = useRef(value);
  latest.current = value;
  const final = formatNumber(format, value);

  const paint = (v: number) => { shown.current = v; if (vis.current) vis.current.textContent = formatNumber(fmtRef.current, v); };
  const glide = (from: number, to: number, ms: number) => {
    run.current?.stop();
    if (prefersReducedMotion() || from === to) { paint(to); return; }
    run.current = animate(from, to, { duration: ms / 1000, ease: EASE_OUT, onUpdate: (v) => paint(snap(fmtRef.current, v)), onComplete: () => paint(to) });
  };

  // first appearance: hold at zero until the figure is actually in view, then count up once
  useLayoutEffect(() => {
    const el = vis.current;
    if (!el) return;
    const key = id ?? '';
    if (!id || counted.has(key) || prefersReducedMotion() || value === 0) { counted.add(key); paint(value); mounted.current = true; return; }
    paint(0);
    const off = observeReveal(el, () => { counted.add(key); mounted.current = true; glide(0, latest.current, first); });
    return () => { off(); run.current?.stop(); };
  }, []);

  // later changes: from the value on screen to the new real value
  useEffect(() => {
    if (!mounted.current) return;
    glide(shown.current, value, change);
    return () => run.current?.stop();
  }, [value]);

  return (
    <span className="anim-num">
      <span ref={vis} aria-hidden="true">{final}</span>
      <span className="sr-only">{final}</span>
    </span>
  );
}
