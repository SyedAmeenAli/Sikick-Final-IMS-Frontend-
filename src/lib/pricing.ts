import { lineTotals, type Paise } from './money';

export interface PricedInput { sku: string; unit: Paise; qty: number; gst: number }
export interface PricedLine extends PricedInput { gross: Paise; discount: Paise; net: Paise; tax: Paise; total: Paise }
export interface Discount { kind: 'flat' | 'percent'; value: number }
export interface CartTotals { lines: PricedLine[]; subtotal: Paise; discount: Paise; taxable: Paise; tax: Paise; total: Paise; units: number }

/**
 * Prices a cart. A cart-level discount is spread across lines in proportion to
 * their value (remainder on the last line), and GST is taken once per line on
 * the discounted amount, so the total is always the sum of the lines shown.
 * flat value is in paise; percent is a plain number (10 = 10%).
 */
export function priceCart(inputs: PricedInput[], discount: Discount | null): CartTotals {
  const gross = inputs.reduce((s, l) => s + l.unit * l.qty, 0);
  let off = 0;
  if (discount && gross > 0) {
    off = discount.kind === 'flat' ? Math.min(Math.max(0, Math.round(discount.value)), gross) : Math.round((gross * Math.min(100, Math.max(0, discount.value))) / 100);
  }
  let left = off;
  const lines = inputs.map((l, i) => {
    const lineGross = l.unit * l.qty;
    const share = i === inputs.length - 1 ? left : Math.min(left, Math.round((off * lineGross) / gross));
    left -= share;
    const t = lineTotals(l.unit, l.qty, l.gst, share);
    return { ...l, gross: t.gross, discount: t.discount, net: t.net, tax: t.tax, total: t.total };
  });
  const subtotal = lines.reduce((s, l) => s + l.gross, 0);
  const disc = lines.reduce((s, l) => s + l.discount, 0);
  const tax = lines.reduce((s, l) => s + l.tax, 0);
  return { lines, subtotal, discount: disc, taxable: subtotal - disc, tax, total: subtotal - disc + tax, units: inputs.reduce((s, l) => s + l.qty, 0) };
}
