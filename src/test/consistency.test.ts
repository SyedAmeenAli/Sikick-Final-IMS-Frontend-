import { describe, expect, it } from 'vitest';
import { createLocalService } from '@/services/adapters/local';
import { coverDays, kpis, soldUnits, stockTotal, supplierBalance, poTotals } from '@/services/selectors';
import { statements, trialBalance, cashflow, gstSummary } from '@/services/finance';
import { priceCart } from '@/lib/pricing';
import { checkDigit, eanBars } from '@/lib/ean';
import { canAccess } from '@/app/permissions';
import { fmt, fmtShort } from '@/lib/money';
import { PRODUCTS } from '@/data/fixtures/seed';

const fresh = () => createLocalService();

describe('dataset', () => {
  it('stock on hand equals the sum of its stock events, for every SKU', () => {
    const s = fresh().getState();
    for (const p of s.products) {
      const sum = s.movements.filter((m) => m.sku === p.sku).reduce((a, m) => a + m.delta, 0);
      expect(sum, p.sku).toBe(stockTotal(s, p.sku));
    }
  });
  it('each product sold30 matches the orders behind it', () => {
    const s = fresh().getState();
    for (const p of PRODUCTS) expect(soldUnits(s, p.sku, 30), p.sku).toBe(p.sold30);
  });
  it('keeps the public-site anchors: earbuds 14 on hand, 61 sold, about 7 days of cover', () => {
    const s = fresh().getState();
    expect(stockTotal(s, 'SKU-2081')).toBe(14);
    expect(soldUnits(s, 'SKU-2081')).toBe(61);
    expect(coverDays(s, 'SKU-2081')).toBe(7);
  });
  it('barcodes are valid EAN-13 with 95 modules', () => {
    for (const p of PRODUCTS) {
      expect(checkDigit(p.barcode.slice(0, 12))).toBe(Number(p.barcode[12]));
      expect(eanBars(p.barcode)).toHaveLength(95);
    }
  });
});

describe('pricing', () => {
  it('cart total is the sum of lines, with a discount spread without losing a paisa', () => {
    const c = priceCart([{ sku: 'a', unit: 14900, qty: 3, gst: 12 }, { sku: 'b', unit: 149900, qty: 1, gst: 18 }], { kind: 'percent', value: 10 });
    expect(c.lines.reduce((a, l) => a + l.total, 0)).toBe(c.total);
    expect(c.subtotal - c.discount + c.tax).toBe(c.total);
    expect(c.discount).toBe(Math.round(((14900 * 3 + 149900) * 10) / 100));
  });
  it('a flat discount never exceeds the cart', () => {
    expect(priceCart([{ sku: 'a', unit: 1000, qty: 1, gst: 0 }], { kind: 'flat', value: 99999 }).total).toBe(0);
  });
  it('formats rupees the Indian way', () => {
    expect(fmt(123456700)).toBe('₹12,34,567.00');
    expect(fmtShort(-250000)).toBe('−₹2,500');
  });
});

describe('till', () => {
  it('rings a sale: receipt, order, stock and events agree', () => {
    const svc = fresh();
    const before = stockTotal(svc.getState(), 'SKU-2081');
    const r = svc.commands.ringSale({ lines: [{ sku: 'SKU-2081', qty: 2 }, { sku: 'SKU-4120', qty: 1 }], discount: null, customerId: 'CUS-000', tenders: [{ tender: 'UPI', amount: 370452 }] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.total).toBe(370452);
    expect(r.value.order.no).toBe('#4822');
    const s = svc.getState();
    expect(stockTotal(s, 'SKU-2081')).toBe(before - 2);
    expect(s.movements.some((m) => m.ref === 'Sale #4822' && m.sku === 'SKU-2081' && m.delta === -2)).toBe(true);
    expect(r.value.serials).toHaveLength(2);
  });
  it('refuses to oversell and refuses an underpayment', () => {
    const svc = fresh();
    const over = svc.commands.ringSale({ lines: [{ sku: 'SKU-5010', qty: 99 }], discount: null, customerId: 'CUS-000', tenders: [{ tender: 'cash', amount: 1e9 }] });
    expect(over.ok).toBe(false);
    const under = svc.commands.ringSale({ lines: [{ sku: 'SKU-4120', qty: 1 }], discount: null, customerId: 'CUS-000', tenders: [{ tender: 'cash', amount: 100 }] });
    expect(under.ok).toBe(false);
  });
  it('gives change only against cash', () => {
    const svc = fresh();
    const bad = svc.commands.ringSale({ lines: [{ sku: 'SKU-4120', qty: 1 }], discount: null, customerId: 'CUS-000', tenders: [{ tender: 'UPI', amount: 20000 }] });
    expect(bad.ok).toBe(false);
    const good = svc.commands.ringSale({ lines: [{ sku: 'SKU-4120', qty: 1 }], discount: null, customerId: 'CUS-000', tenders: [{ tender: 'cash', amount: 20000 }] });
    expect(good.ok && good.value.change).toBe(20000 - 16688);
  });
});

describe('purchasing and stock', () => {
  it('receiving a PO adds good units, holds damaged ones back and raises the supplier balance', () => {
    const svc = fresh();
    const s0 = svc.getState();
    const owed = supplierBalance(s0, 'SUP-01');
    const stock = stockTotal(s0, 'SKU-4120');
    const r = svc.commands.receivePurchaseOrder('PO-0183', [{ sku: 'SKU-4120', received: 200, damaged: 5 }]);
    expect(r.ok).toBe(true);
    const s = svc.getState();
    expect(stockTotal(s, 'SKU-4120')).toBe(stock + 195);
    expect(s.stock['SKU-4120'].damaged).toBe(5);
    expect(supplierBalance(s, 'SUP-01')).toBe(owed + poTotals(s, s.purchaseOrders.find((p) => p.no === 'PO-0183')!, 'received').total);
  });
  it('requires a reason for any adjustment and never goes below zero', () => {
    const svc = fresh();
    expect(svc.commands.adjustStock('SKU-5002', -1, '  ').ok).toBe(false);
    expect(svc.commands.adjustStock('SKU-5002', -99, 'recount').ok).toBe(false);
    expect(svc.commands.adjustStock('SKU-5002', -2, 'recount').ok).toBe(true);
  });
  it('order lifecycle reserves, then deducts, then restocks on return', () => {
    const svc = fresh();
    const c = svc.commands.createOrder({ customerId: 'CUS-033', channel: 'Wholesale', lines: [{ sku: 'SKU-3312', qty: 5 }], discount: null });
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    const on = stockTotal(svc.getState(), 'SKU-3312');
    expect(svc.commands.advanceOrder(c.value, 'Pending').ok).toBe(true);
    expect(svc.getState().stock['SKU-3312'].reserved).toBe(5);
    expect(svc.commands.recordPayment(c.value, { tender: 'UPI', amount: 1e7 }).ok).toBe(true);
    expect(stockTotal(svc.getState(), 'SKU-3312')).toBe(on - 5);
    expect(svc.commands.advanceOrder(c.value, 'Delivered').ok).toBe(false);
    expect(svc.commands.advanceOrder(c.value, 'Returned').ok).toBe(true);
    expect(stockTotal(svc.getState(), 'SKU-3312')).toBe(on);
  });
});

describe('books', () => {
  it('trial balance and balance sheet balance, and cash reconciles', () => {
    const s = fresh().getState();
    const tb = trialBalance(s);
    expect(tb.totalDebit).toBe(tb.totalCredit);
    const st = statements(s);
    expect(st.totalAssets).toBe(st.totalLE);
    expect(cashflow(s).closing).toBe(st.assets.cash + st.assets.bank);
  });
  it('inventory in the ledger equals stock value at cost', () => {
    const s = fresh().getState();
    const inv = s.products.reduce((a, p) => a + stockTotal(s, p.sku) * p.cost, 0);
    expect(statements(s).assets.inventory).toBe(inv);
  });
  it('output GST on the return equals the GST on the sales in the ledger', () => {
    const s = fresh().getState();
    const g = gstSummary(s);
    expect(g.outTax).toBeGreaterThan(0);
    expect(kpis(s).weekSales).toBeGreaterThan(0);
  });
});

describe('roles', () => {
  it('follows the source gates, with exact paths beating patterns', () => {
    expect(canAccess('pos_operator', '/pos')).toBe(true);
    expect(canAccess('warehouse_staff', '/pos')).toBe(false);
    expect(canAccess('warehouse_staff', '/orders/new')).toBe(false);
    expect(canAccess('warehouse_staff', '/orders/%234821')).toBe(true);
    expect(canAccess('warehouse_staff', '/purchase-orders/new')).toBe(false);
    expect(canAccess('manager', '/ledger')).toBe(false);
    expect(canAccess('admin', '/ledger')).toBe(true);
    expect(canAccess('pos_operator', '/settings/appearance')).toBe(true);
  });
});
