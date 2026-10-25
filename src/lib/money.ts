/**
 * Money is held as integer paise everywhere in the data layer. Display
 * formatting is the only place rupees appear, and GST is rounded once per line
 * with integer arithmetic, so a cart total always equals the sum of what is shown.
 */
export type Paise = number;

const inrFmt = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inrWhole = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export const rupees = (r: number): Paise => Math.round(r * 100);

const sign = (p: Paise) => (p < 0 ? '−' : '');

/** ₹1,23,456.00 */
export const fmt = (p: Paise): string => sign(p) + '₹' + inrFmt.format(Math.abs(p) / 100);

/** ₹1,23,456 — whole rupees for dense tables and charts */
export const fmtShort = (p: Paise): string => sign(p) + '₹' + inrWhole.format(Math.abs(Math.round(p / 100)));

/** ₹12.4L / ₹3.2Cr for chart axes */
export const fmtCompact = (p: Paise): string => {
  const r = Math.abs(p) / 100;
  if (r >= 1e7) return sign(p) + '₹' + (r / 1e7).toFixed(2) + 'Cr';
  if (r >= 1e5) return sign(p) + '₹' + (r / 1e5).toFixed(1) + 'L';
  if (r >= 1e3) return sign(p) + '₹' + (r / 1e3).toFixed(1) + 'K';
  return sign(p) + '₹' + Math.round(r);
};

export const qty = (n: number): string => inrWhole.format(n);

/** Tax-exclusive line: price × qty − discount, then GST on the discounted amount. */
export function lineTotals(unit: Paise, quantity: number, gstPct: number, discount: Paise = 0) {
  const gross = unit * quantity;
  const net = Math.max(0, gross - discount);
  const tax = Math.round((net * gstPct) / 100);
  return { gross, discount: Math.min(discount, gross), net, tax, total: net + tax };
}

/** Split an intra-state tax figure into CGST + SGST without losing a paisa. */
export const splitGst = (tax: Paise) => {
  const cgst = Math.floor(tax / 2);
  return { cgst, sgst: tax - cgst };
};

export const pct = (n: number, digits = 0) => n.toFixed(digits) + '%';
