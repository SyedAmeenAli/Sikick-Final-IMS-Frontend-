import { fmt, fmtCompact, fmtShort, qty } from './money';

/**
 * One formatting layer for every animated figure. The animation interpolates the NUMBER (integer paise,
 * integer counts or a fixed number of decimals) and this layer formats each frame, so Indian digit grouping
 * and the currency sign are correct on every frame and never assembled by joining digit strings.
 */
export type NumFormat =
  | { kind: 'inr' }                       // paise -> ₹1,24,500.00
  | { kind: 'inrShort' }                  // paise -> ₹1,24,500
  | { kind: 'compact' }                   // paise -> ₹1.2L
  | { kind: 'int'; unit?: string }        // 1,24,500 [unit]
  | { kind: 'dec'; digits: number; unit?: string }
  | { kind: 'pct'; digits?: number };

const grouped = (x: number, digits: number) => Math.abs(x).toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Rounds an in-flight value to what the format can show, so the animation only ever passes through displayable numbers. */
export function snap(f: NumFormat, v: number): number {
  switch (f.kind) {
    case 'inr': case 'inrShort': case 'compact': case 'int': return Math.round(v);
    case 'dec': { const m = Math.pow(10, f.digits); return Math.round(v * m) / m; }
    case 'pct': { const m = Math.pow(10, f.digits ?? 0); return Math.round(v * m) / m; }
  }
}

export function formatNumber(f: NumFormat, v: number): string {
  const x = snap(f, v);
  const neg = x < 0 ? '−' : '';
  switch (f.kind) {
    case 'inr': return fmt(x);
    case 'inrShort': return fmtShort(x);
    case 'compact': return fmtCompact(x);
    case 'int': return neg + qty(Math.abs(x)) + (f.unit ? ' ' + f.unit : '');
    case 'dec': return neg + grouped(x, f.digits) + (f.unit ? ' ' + f.unit : '');
    case 'pct': return neg + grouped(x, f.digits ?? 0) + '%';
  }
}
