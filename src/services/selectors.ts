/** Pure reads over ImsState. Anything derived (stock total, cover, alerts, KPIs) lives here once. */
import { NOW, STATIC_ALERTS, WORKSPACE, OPENING_BALANCE } from '@/data/fixtures/seed';
import { lineTotals, type Paise } from '@/lib/money';
import { fmtDate } from '@/lib/format';
import type { ImsState } from './contracts/service';
import type { Alert, Order, OrderLine, Product, PurchaseOrder, Supplier } from './contracts/types';

export const stockTotal = (s: ImsState, sku: string): number => {
  return s.stock[sku]?.onHand ?? 0;
};
export const stockAvailable = (s: ImsState, sku: string): number => Math.max(0, stockTotal(s, sku) - (s.stock[sku]?.reserved ?? 0));

export const product = (s: ImsState, sku: string): Product => s.products.find((p) => p.sku === sku)!;
export const supplierOf = (s: ImsState, id: string): Supplier => s.suppliers.find((x) => x.id === id)!;
export const customerOf = (s: ImsState, id: string) => s.customers.find((c) => c.id === id)!;

export const countsAsSale = (o: Order) => o.status !== 'Draft' && o.status !== 'Cancelled';
export const lineSum = (lines: OrderLine[]) => lines.reduce((a, l) => { const t = lineTotals(l.unit, l.qty, l.gst, l.discount); return { net: a.net + t.net, tax: a.tax + t.tax, total: a.total + t.total, gross: a.gross + t.gross, discount: a.discount + t.discount }; }, { net: 0, tax: 0, total: 0, gross: 0, discount: 0 });
export const orderTotal = (o: Order): Paise => lineSum(o.lines).total;
export const paid = (o: Order): Paise => o.payments.reduce((a, p) => a + p.amount, 0);

const dayDiff = (iso: string) => Math.floor((NOW.getTime() - new Date(iso).getTime()) / 864e5);
export const daysAgo = dayDiff;
const sameDay = (iso: string, d: string) => iso.slice(0, 10) === d;

export function soldUnits(s: ImsState, sku: string, days = 30): number {
  let n = 0;
  for (const o of s.orders) if (countsAsSale(o) && dayDiff(o.at) < days) for (const l of o.lines) if (l.sku === sku) n += l.qty;
  return n;
}
export function lastSaleDays(s: ImsState, sku: string): number {
  let best = Infinity;
  for (const o of s.orders) if (countsAsSale(o)) for (const l of o.lines) if (l.sku === sku) best = Math.min(best, Math.max(0, dayDiff(o.at)));
  return best === Infinity ? product(s, sku).lastSaleDays : best;
}
export const coverDays = (s: ImsState, sku: string): number | null => {
  const sold = soldUnits(s, sku);
  return sold > 0 ? Math.round(stockTotal(s, sku) / (sold / 30)) : null;
};
export type StockState = 'out' | 'low' | 'ok';
export const stockState = (s: ImsState, sku: string): StockState => {
  const t = stockTotal(s, sku);
  return t <= 0 ? 'out' : t <= product(s, sku).reorderPoint ? 'low' : 'ok';
};
export const stockValue = (s: ImsState, sku: string): Paise => stockTotal(s, sku) * product(s, sku).cost;

export function poTotals(s: ImsState, po: PurchaseOrder, basis: 'ordered' | 'received' = 'ordered') {
  let net = 0, tax = 0;
  for (const l of po.lines) {
    const q = basis === 'ordered' ? l.qty : l.received;
    const t = lineTotals(l.unitCost, q, product(s, l.sku).gst);
    net += t.net; tax += t.tax;
  }
  return { net, tax, total: net + tax };
}
export const poOverdueDays = (po: PurchaseOrder): number => (po.status === 'Ordered' && po.expected ? Math.max(0, -dayDiffTo(po.expected)) : 0);
function dayDiffTo(date: string) { return Math.floor((new Date(date + 'T23:59:00').getTime() - NOW.getTime()) / 864e5); }

export function supplierBalance(s: ImsState, id: string): Paise {
  const billed = s.purchaseOrders.filter((p) => p.supplierId === id && p.status === 'Received').reduce((a, p) => a + poTotals(s, p, 'received').total, 0);
  const paidOut = s.supplierPayments.filter((p) => p.supplierId === id).reduce((a, p) => a + p.amount, 0);
  return (OPENING_BALANCE[id] ?? 0) + billed - paidOut;
}

/** What a customer still owes, from orders that were booked but not fully paid. */
export function customerOutstanding(s: ImsState, id: string): Paise {
  return s.orders.filter((o) => o.customerId === id && countsAsSale(o) && o.status !== 'Returned' && o.status !== 'Pending').reduce((a, o) => a + Math.max(0, orderTotal(o) - paid(o)), 0);
}

export function customerLifetime(s: ImsState, id: string): Paise {
  return s.orders.filter((o) => o.customerId === id && countsAsSale(o) && o.status !== 'Returned').reduce((a, o) => a + orderTotal(o), 0);
}

/* ---------- alerts ---------- */
export function alerts(s: ImsState): Alert[] {
  const out: Alert[] = [];
  for (const p of s.products) {
    const t = stockTotal(s, p.sku);
    const cover = coverDays(s, p.sku);
    if (t <= 0) out.push({ id: 'AL-OUT-' + p.sku, kind: 'stockout', severity: 'critical', title: p.name + ' is out of stock', detail: 'No units on the shop floor, shelf or bin. ' + soldUnits(s, p.sku) + ' sold in the last 30 days.', sku: p.sku, at: WORKSPACE.now, acknowledged: false });
    else if (t <= p.reorderPoint) out.push({ id: 'AL-LOW-' + p.sku, kind: 'low_stock', severity: cover !== null && cover <= 7 ? 'high' : 'medium', title: p.name + ' is below its reorder point', detail: t + ' on hand against a reorder point of ' + p.reorderPoint + (cover !== null ? '. At the 30-day rate that is about ' + cover + ' days of cover.' : '.'), sku: p.sku, at: WORKSPACE.now, acknowledged: false });
    if (lastSaleDays(s, p.sku) >= 60 && t > 30) out.push({ id: 'AL-STAG-' + p.sku, kind: 'stagnant', severity: 'low', title: p.name + ' has not sold in ' + lastSaleDays(s, p.sku) + ' days', detail: t + ' units are tied up, about ' + Math.round((t * p.cost) / 100).toLocaleString('en-IN') + ' rupees at cost.', sku: p.sku, at: WORKSPACE.now, acknowledged: false });
  }
  for (const po of s.purchaseOrders) {
    const late = poOverdueDays(po);
    if (late > 0) out.push({ id: 'AL-PO-' + po.no, kind: 'overdue_po', severity: 'high', title: po.no + ' is ' + late + ' days overdue', detail: supplierOf(s, po.supplierId).name + ' was due ' + fmtDate(po.expected!) + '. ' + (po.note ?? ''), ref: po.no, sku: po.lines[0].sku, at: WORKSPACE.now, acknowledged: false });
  }
  for (const b of s.batches) {
    const days = Math.floor((new Date(b.expiry).getTime() - NOW.getTime()) / 864e5);
    if (days <= 60 && b.qty > 0) out.push({ id: 'AL-EXP-' + b.batch, kind: 'expiry', severity: days <= 30 ? 'high' : 'medium', title: 'Batch ' + b.batch + ' expires in ' + days + ' days', detail: b.qty + ' units of ' + product(s, b.sku).name + ' expire on ' + fmtDate(b.expiry) + '. Sell this batch first or return it to the supplier.', sku: b.sku, at: WORKSPACE.now, acknowledged: false });
  }
  for (const a of STATIC_ALERTS) if (a.kind === 'rto' || a.kind === 'broken_assortment') out.push(a);
  const rank = { critical: 0, high: 1, medium: 2, low: 3 };
  return out.map((a) => ({ ...a, acknowledged: a.acknowledged || s.ackedAlerts.includes(a.id) })).sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/* ---------- sales analytics ---------- */
export function salesByDay(s: ImsState, days: number): Array<{ date: string; label: string; total: Paise; orders: number; units: number }> {
  const out = [];
  for (let d = days - 1; d >= 0; d--) {
    const dt = new Date(NOW); dt.setDate(dt.getDate() - d);
    const key = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
    const os = s.orders.filter((o) => countsAsSale(o) && o.status !== 'Returned' && sameDay(o.at, key));
    out.push({ date: key, label: dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), total: os.reduce((a, o) => a + orderTotal(o), 0), orders: os.length, units: os.reduce((a, o) => a + o.lines.reduce((x, l) => x + l.qty, 0), 0) });
  }
  return out;
}

export function kpis(s: ImsState) {
  const today = WORKSPACE.today;
  const todayOrders = s.orders.filter((o) => countsAsSale(o) && sameDay(o.at, today));
  const week = salesByDay(s, 7), prevWeek = salesByDay(s, 14).slice(0, 7);
  const sum = (a: Array<{ total: Paise }>) => a.reduce((x, d) => x + d.total, 0);
  const inventoryValue = s.products.reduce((a, p) => a + stockValue(s, p.sku), 0);
  const units = s.products.reduce((a, p) => a + stockTotal(s, p.sku), 0);
  return {
    todaySales: todayOrders.reduce((a, o) => a + orderTotal(o), 0),
    todayOrders: todayOrders.length,
    weekSales: sum(week), prevWeekSales: sum(prevWeek),
    inventoryValue, units,
    lowStock: s.products.filter((p) => stockState(s, p.sku) !== 'ok').length,
    openPos: s.purchaseOrders.filter((p) => p.status !== 'Received').length,
    overduePos: s.purchaseOrders.filter((p) => poOverdueDays(p) > 0).length,
    receivable: s.customers.reduce((a, c) => a + customerOutstanding(s, c.id), 0),
    payable: s.suppliers.reduce((a, x) => a + supplierBalance(s, x.id), 0),
  };
}

export function topProducts(s: ImsState, days = 30, n = 5) {
  const m = new Map<string, { units: number; revenue: Paise }>();
  for (const o of s.orders) if (countsAsSale(o) && o.status !== 'Returned' && dayDiff(o.at) < days) for (const l of o.lines) {
    const cur = m.get(l.sku) ?? { units: 0, revenue: 0 };
    cur.units += l.qty; cur.revenue += lineTotals(l.unit, l.qty, l.gst, l.discount).net; m.set(l.sku, cur);
  }
  return [...m.entries()].map(([sku, v]) => ({ sku, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, n);
}

export const money = { inventoryValue: (s: ImsState) => kpis(s).inventoryValue };

/* ---------- product families: a product groups its variants (SKUs) ---------- */
export const familyName = (p: Product) => p.name.replace(/\s*\([^)]*\)$/, '');
export const variantLabel = (p: Product) => p.name.match(/\(([^)]*)\)$/)?.[1] ?? 'Standard';
export const familyId = (p: Product) => familyName(p).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export interface Family { id: string; name: string; category: string; type: string; brand: string; variants: Product[] }
export function families(s: ImsState): Family[] {
  const m = new Map<string, Family>();
  for (const p of s.products) {
    const id = familyId(p);
    const f = m.get(id) ?? { id, name: familyName(p), category: p.category, type: p.type, brand: p.brand, variants: [] };
    f.variants.push(p); m.set(id, f);
  }
  return [...m.values()];
}
export const familyOf = (s: ImsState, idOrSku: string): Family | undefined => {
  const byId = families(s).find((f) => f.id === idOrSku);
  return byId ?? families(s).find((f) => f.variants.some((v) => v.sku === idOrSku));
};
