/** Operational signals shared by the dashboard, briefing, alerts and SiBorg, so they always quote the same numbers. */
import { fmtShort } from '@/lib/money';
import { fmtDate } from '@/lib/format';
import type { ImsState } from './contracts/service';
import { coverDays, kpis, lastSaleDays, poOverdueDays, product, soldUnits, stockState, stockTotal, stockValue, supplierOf, topProducts } from './selectors';

export interface Insight { id: string; tone: 'bad' | 'warn' | 'info' | 'ok'; title: string; detail: string; to?: string; cta?: string; sku?: string }

export function insights(s: ImsState): Insight[] {
  const out: Insight[] = [];
  const low = s.products.filter((p) => stockState(s, p.sku) !== 'ok').sort((a, b) => (coverDays(s, a.sku) ?? 999) - (coverDays(s, b.sku) ?? 999));
  for (const p of low.slice(0, 2)) {
    const c = coverDays(s, p.sku);
    out.push({ id: 'low-' + p.sku, tone: c !== null && c <= 7 ? 'bad' : 'warn', sku: p.sku, title: p.name + ' will run short' + (c !== null ? ' in about ' + c + ' days' : ''),
      detail: stockTotal(s, p.sku) + ' on hand against a reorder point of ' + p.reorderPoint + '. ' + soldUnits(s, p.sku) + ' sold in 30 days.', to: '/inventory/' + p.sku, cta: 'Open item' });
  }
  for (const po of s.purchaseOrders) {
    const d = poOverdueDays(po);
    if (d > 0) out.push({ id: 'po-' + po.no, tone: 'bad', title: po.no + ' from ' + supplierOf(s, po.supplierId).name + ' is ' + d + ' days late', detail: 'Expected ' + fmtDate(po.expected!) + '. Chase the supplier before the stock runs out.', to: '/purchase-orders/' + po.no, cta: 'Open order' });
  }
  const stagnant = s.products.filter((p) => lastSaleDays(s, p.sku) >= 60 && stockTotal(s, p.sku) > 30);
  if (stagnant.length) {
    const tied = stagnant.reduce((a, p) => a + stockValue(s, p.sku), 0);
    out.push({ id: 'stag', tone: 'info', title: stagnant.length + ' products have not sold in 60 days', detail: stagnant.map((p) => p.name).join(' and ') + ' hold ' + fmtShort(tied) + ' at cost.', to: '/analytics/turnover', cta: 'See turnover' });
  }
  const k = kpis(s);
  if (k.prevWeekSales > 0) {
    const ch = Math.round(((k.weekSales - k.prevWeekSales) / k.prevWeekSales) * 100);
    out.push({ id: 'wk', tone: ch >= 0 ? 'ok' : 'warn', title: 'Sales are ' + (ch >= 0 ? 'up ' : 'down ') + Math.abs(ch) + '% on last week', detail: fmtShort(k.weekSales) + ' over the last 7 days against ' + fmtShort(k.prevWeekSales) + ' the week before.', to: '/analytics/sales-summary', cta: 'See sales' });
  }
  const top = topProducts(s, 30, 1)[0];
  if (top) out.push({ id: 'top', tone: 'info', title: product(s, top.sku).name + ' is the biggest earner', detail: top.units + ' units and ' + fmtShort(top.revenue) + ' before tax in 30 days.', to: '/products/' + top.sku, cta: 'Open product' });
  return out;
}
