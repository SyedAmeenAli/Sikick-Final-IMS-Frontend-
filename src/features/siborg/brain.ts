/**
 * SiBorg's local answers. Everything quoted comes from the same state the rest of the app reads,
 * so a figure here always matches the page it points to. Anything that would change the business
 * is returned as a proposal for a person to approve; nothing is executed here.
 */
import { fmtShort } from '@/lib/money';
import { fmtDate } from '@/lib/format';
import type { ImsState } from '@/services/contracts/service';
import type { ProposalEffect } from '@/services/contracts/types';
import { MIN_LINE_QTY } from '@/data/fixtures/seed';
import { alerts, coverDays, kpis, lastSaleDays, poOverdueDays, product, salesByDay, soldUnits, stockState, stockTotal, stockValue, supplierBalance, supplierOf, topProducts } from '@/services/selectors';

export interface Reply {
  text: string;
  unsupported?: boolean;
  bullets?: string[];
  links?: Array<{ label: string; to: string }>;
  proposal?: { title: string; reasoning: string; basis: string[]; actions: Array<{ label: string; detail: string }>; effect: ProposalEffect };
}

export const PROMPTS = ['What should I reorder?', 'How are sales today?', 'What is not selling?', 'What do I owe suppliers?', 'Anything expiring soon?'];

export function answer(s: ImsState, q: string): Reply {
  const t = q.toLowerCase();
  if (/(book|send|email|whatsapp|message|delete|refund|pay\b|pay the)/.test(t) && !/reorder/.test(t)) {
    return { text: 'I cannot do that from here. I can read your stock, orders and suppliers, explain what I see, and draft a recommendation for you to approve. Booking shipments, sending messages and moving money stay with you.', unsupported: true, links: [{ label: 'Open approvals', to: '/agent/proposals' }] };
  }
  if (/(reorder|re-order|low|running out|restock|short)/.test(t)) {
    const low = s.products.filter((p) => stockState(s, p.sku) !== 'ok').sort((a, b) => (coverDays(s, a.sku) ?? 999) - (coverDays(s, b.sku) ?? 999));
    if (!low.length) return { text: 'Every product is above its reorder point right now.' };
    const lines = low.map((p) => {
      const min = MIN_LINE_QTY[p.supplierId] ?? 1;
      return { sku: p.sku, qty: Math.max(min, Math.ceil(soldUnits(s, p.sku) - stockTotal(s, p.sku))) };
    });
    const supplierId = low[0].supplierId;
    const same = lines.filter((l) => product(s, l.sku).supplierId === supplierId);
    return {
      text: low.length + ' product' + (low.length > 1 ? 's are' : ' is') + ' at or below its reorder point.',
      bullets: low.map((p) => p.name + ': ' + stockTotal(s, p.sku) + ' on hand, reorder at ' + p.reorderPoint + (coverDays(s, p.sku) !== null ? ', about ' + coverDays(s, p.sku) + ' days of cover' : '')),
      proposal: {
        title: 'Draft a reorder from ' + supplierOf(s, supplierId).name,
        reasoning: 'These are the items from ' + supplierOf(s, supplierId).name + ' that will not last the month at the current sales rate. Quantities cover the 30-day rate and respect the supplier minimum.',
        basis: same.map((l) => product(s, l.sku).name + ' on hand ' + stockTotal(s, l.sku) + ', sold ' + soldUnits(s, l.sku) + ' in 30 days'),
        actions: [{ label: 'Create a draft purchase order', detail: same.map((l) => l.qty + ' × ' + product(s, l.sku).name).join(', ') + '. It stays a draft until a manager places it.' }],
        effect: { kind: 'createPo', supplierId, lines: same },
      },
    };
  }
  if (/(sales|sold|today|revenue|how are)/.test(t)) {
    const k = kpis(s);
    const y = salesByDay(s, 2)[0];
    const top = topProducts(s, 7, 3);
    return {
      text: 'Today so far: ' + fmtShort(k.todaySales) + ' from ' + k.todayOrders + ' orders. Yesterday closed at ' + fmtShort(y.total) + '. The last 7 days total ' + fmtShort(k.weekSales) + (k.prevWeekSales ? ', against ' + fmtShort(k.prevWeekSales) + ' the week before.' : '.'),
      bullets: top.map((x) => 'Selling well: ' + product(s, x.sku).name + ', ' + x.units + ' units this week'),
      links: [{ label: 'Sales summary', to: '/analytics/sales-summary' }],
    };
  }
  if (/(not selling|slow|stagnant|dead|sit|idle)/.test(t)) {
    const st = s.products.filter((p) => lastSaleDays(s, p.sku) >= 60 && stockTotal(s, p.sku) > 30);
    if (!st.length) return { text: 'Nothing has gone 60 days without a sale.' };
    return {
      text: st.length + ' products have not sold for 60 days or more and together tie up ' + fmtShort(st.reduce((a, p) => a + stockValue(s, p.sku), 0)) + ' at cost.',
      bullets: st.map((p) => p.name + ': ' + stockTotal(s, p.sku) + ' units, last sold ' + lastSaleDays(s, p.sku) + ' days ago'),
      links: [{ label: 'Stock turnover', to: '/analytics/turnover' }],
      proposal: {
        title: 'Mark down slow stock for a limited time', reasoning: 'A short markdown would free shelf space before the festive restock. This is a suggestion about price only.',
        basis: st.map((p) => p.name + ' unsold for ' + lastSaleDays(s, p.sku) + ' days'),
        actions: [{ label: 'Note the markdown for the team', detail: 'No prices change automatically. A manager sets the new price on each variant.' }], effect: { kind: 'none' },
      },
    };
  }
  if (/(owe|supplier|payable|balance|bill)/.test(t)) {
    const rows = s.suppliers.map((x) => ({ x, b: supplierBalance(s, x.id) })).filter((r) => r.b > 0).sort((a, b) => b.b - a.b);
    return { text: 'You owe ' + fmtShort(rows.reduce((a, r) => a + r.b, 0)) + ' across ' + rows.length + ' suppliers.', bullets: rows.map((r) => r.x.name + ': ' + fmtShort(r.b)), links: [{ label: 'Supplier balances', to: '/analytics/supplier-balance' }] };
  }
  if (/(expir|batch|shelf life)/.test(t)) {
    const b = s.batches.filter((x) => x.qty > 0).sort((a, c) => a.expiry.localeCompare(c.expiry));
    return { text: b.length ? 'The earliest batch is ' + b[0].batch + ', expiring ' + fmtDate(b[0].expiry) + '.' : 'No batches are tracked.', bullets: b.map((x) => x.batch + ': ' + x.qty + ' units of ' + product(s, x.sku).name + ', expires ' + fmtDate(x.expiry)), links: [{ label: 'Alerts', to: '/alerts' }] };
  }
  if (/(late|overdue|delay|purchase order|po\b)/.test(t)) {
    const late = s.purchaseOrders.filter((p) => poOverdueDays(p) > 0);
    return { text: late.length ? late.map((p) => p.no + ' from ' + supplierOf(s, p.supplierId).name + ' is ' + poOverdueDays(p) + ' days late').join('. ') + '.' : 'No purchase order is overdue.', links: [{ label: 'Purchase orders', to: '/purchase-orders' }] };
  }
  const open = alerts(s).filter((a) => !a.acknowledged).length;
  return { text: 'I can help with stock, sales, suppliers and expiry. There ' + (open === 1 ? 'is' : 'are') + ' ' + open + ' open alerts right now. Try one of the questions below.' };
}
