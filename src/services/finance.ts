/**
 * The books, derived from the same orders, receipts, payments and expenses the rest of the
 * app shows. Every journal balances by construction, so the trial balance always agrees.
 * Money is integer paise throughout.
 */
import { ACCOUNTS, NOW, OPENING_BALANCE } from '@/data/fixtures/seed';
import type { ImsState } from './contracts/service';
import type { LedgerEntry } from './contracts/types';
import { countsAsSale, daysAgo, lineSum, paid, poTotals, product, stockValue } from './selectors';
import { lineTotals, type Paise } from '@/lib/money';

export const WINDOW_DAYS = 30;
const BANK_OPENING = 50_000_000; // ₹5,00,000 in the current account at the start of the window

export interface Journal { id: string; date: string; ref: string; memo: string; lines: Array<{ account: string; debit: Paise; credit: Paise }> }

const expenseAccount = (cat: string) => (cat === 'Rent' ? '6000' : cat === 'Salaries' ? '6100' : '6200');
const day = (iso: string) => iso.slice(0, 10);

export function journals(s: ImsState): Journal[] {
  const out: Journal[] = [];
  let n = 1;
  const add = (date: string, ref: string, memo: string, lines: Journal['lines']) => out.push({ id: 'JV-' + String(n++).padStart(4, '0'), date, ref, memo, lines: lines.filter((l) => l.debit || l.credit) });

  // opening balances so the balance sheet has something to stand on
  const invNow = s.products.reduce((a, p) => a + stockValue(s, p.sku), 0);
  let purchasesCost = 0, cogs = 0;
  const inWin = (iso: string) => daysAgo(iso) < WINDOW_DAYS;

  for (const o of s.orders) {
    if (!countsAsSale(o) || o.status === 'Pending' || o.status === 'Returned' || !inWin(o.at)) continue;
    const t = lineSum(o.lines);
    const cash = o.payments.filter((p) => p.tender === 'cash').reduce((a, p) => a + p.amount, 0);
    const bank = o.payments.filter((p) => p.tender !== 'cash').reduce((a, p) => a + p.amount, 0);
    const ar = Math.max(0, t.total - paid(o));
    const cost = o.lines.reduce((a, l) => a + l.qty * product(s, l.sku).cost, 0);
    cogs += cost;
    add(day(o.at), 'Sale ' + o.no, o.channel + ' sale', [
      { account: '1000', debit: Math.min(cash, t.total), credit: 0 }, { account: '1010', debit: Math.min(bank, t.total - Math.min(cash, t.total)), credit: 0 }, { account: '1100', debit: ar, credit: 0 },
      { account: '4000', debit: 0, credit: t.net }, { account: '2100', debit: 0, credit: t.tax },
    ]);
    add(day(o.at), 'Sale ' + o.no, 'Cost of goods sold', [{ account: '5000', debit: cost, credit: 0 }, { account: '1200', debit: 0, credit: cost }]);
  }
  for (const po of s.purchaseOrders) {
    if (po.status !== 'Received') continue;
    const date = po.expected ?? po.date;
    if (daysAgo(date + 'T12:00:00') >= WINDOW_DAYS) continue;
    const t = poTotals(s, po, 'received');
    purchasesCost += t.net;
    add(date, po.no, 'Goods received', [{ account: '1200', debit: t.net, credit: 0 }, { account: '1300', debit: t.tax, credit: 0 }, { account: '2000', debit: 0, credit: t.total }]);
  }
  for (const p of s.supplierPayments) {
    if (daysAgo(p.date + 'T12:00:00') >= WINDOW_DAYS) continue;
    add(p.date, p.ref, 'Supplier payment', [{ account: '2000', debit: p.amount, credit: 0 }, { account: p.mode === 'cash' ? '1000' : '1010', debit: 0, credit: p.amount }]);
  }
  for (const e of s.expenses) {
    if (daysAgo(e.date + 'T12:00:00') >= WINDOW_DAYS) continue;
    add(e.date, e.id, e.category + ': ' + e.payee, [{ account: expenseAccount(e.category), debit: e.amount, credit: 0 }, { account: e.mode === 'cash' ? '1000' : '1010', debit: 0, credit: e.amount }]);
  }

  const apOpen = Object.values(OPENING_BALANCE).reduce((a, b) => a + b, 0);
  const invOpen = invNow - purchasesCost + cogs;
  const capital = invOpen + BANK_OPENING - apOpen;
  const startDate = new Date(NOW); startDate.setDate(startDate.getDate() - WINDOW_DAYS);
  const d0 = startDate.getFullYear() + '-' + String(startDate.getMonth() + 1).padStart(2, '0') + '-' + String(startDate.getDate()).padStart(2, '0');
  out.unshift({ id: 'JV-0000', date: d0, ref: 'Opening', memo: 'Opening balances', lines: [
    { account: '1200', debit: invOpen, credit: 0 }, { account: '1010', debit: BANK_OPENING, credit: 0 },
    { account: '2000', debit: 0, credit: apOpen }, { account: '3000', debit: 0, credit: capital },
  ] });
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function ledgerRows(s: ImsState): LedgerEntry[] {
  return journals(s).flatMap((j) => j.lines.map((l, i) => ({ id: j.id + '-' + i, date: j.date, account: l.account, ref: j.ref, memo: j.memo, debit: l.debit, credit: l.credit })));
}

export function trialBalance(s: ImsState) {
  const rows = ledgerRows(s);
  const bal = ACCOUNTS.map((a) => {
    const dr = rows.filter((r) => r.account === a.code).reduce((x, r) => x + r.debit, 0);
    const cr = rows.filter((r) => r.account === a.code).reduce((x, r) => x + r.credit, 0);
    return { ...a, debit: dr, credit: cr, net: dr - cr };
  });
  return { rows: bal, totalDebit: bal.reduce((a, r) => a + r.debit, 0), totalCredit: bal.reduce((a, r) => a + r.credit, 0) };
}

export function statements(s: ImsState) {
  const tb = trialBalance(s).rows;
  const get = (code: string) => tb.find((r) => r.code === code)!;
  const revenue = -get('4000').net;
  const cogs = get('5000').net;
  const exp = { Rent: get('6000').net, Salaries: get('6100').net, 'Utilities and other': get('6200').net };
  const opex = exp.Rent + exp.Salaries + exp['Utilities and other'];
  const profit = revenue - cogs - opex;
  const assets = { cash: get('1000').net, bank: get('1010').net, receivable: get('1100').net, inventory: get('1200').net, gstInput: get('1300').net };
  const liab = { payable: -get('2000').net, gstOutput: -get('2100').net };
  const equity = { capital: -get('3000').net, profit };
  const totalAssets = Object.values(assets).reduce((a, b) => a + b, 0);
  const totalLE = liab.payable + liab.gstOutput + equity.capital + equity.profit;
  return { revenue, cogs, gross: revenue - cogs, exp, opex, profit, assets, liab, equity, totalAssets, totalLE };
}

export function gstSummary(s: ImsState) {
  const byRate = new Map<number, { taxable: Paise; tax: Paise; count: number }>();
  const byHsn = new Map<string, { hsn: string; name: string; qty: number; taxable: Paise; tax: Paise }>();
  let outTax = 0, outTaxable = 0, invoices = 0;
  for (const o of s.orders) {
    if (!countsAsSale(o) || o.status === 'Pending' || o.status === 'Returned' || daysAgo(o.at) >= WINDOW_DAYS) continue;
    invoices++;
    for (const l of o.lines) {
      const t = lineTotals(l.unit, l.qty, l.gst, l.discount);
      const r = byRate.get(l.gst) ?? { taxable: 0, tax: 0, count: 0 };
      r.taxable += t.net; r.tax += t.tax; r.count += 1; byRate.set(l.gst, r);
      const p = product(s, l.sku);
      const h = byHsn.get(p.hsn) ?? { hsn: p.hsn, name: p.type, qty: 0, taxable: 0, tax: 0 };
      h.qty += l.qty; h.taxable += t.net; h.tax += t.tax; byHsn.set(p.hsn, h);
      outTax += t.tax; outTaxable += t.net;
    }
  }
  let inTax = 0;
  for (const po of s.purchaseOrders) if (po.status === 'Received' && daysAgo((po.expected ?? po.date) + 'T12:00:00') < WINDOW_DAYS) inTax += poTotals(s, po, 'received').tax;
  return { rates: [...byRate.entries()].sort((a, b) => a[0] - b[0]).map(([rate, v]) => ({ rate, ...v })), hsn: [...byHsn.values()].sort((a, b) => b.taxable - a.taxable), outTax, outTaxable, inTax, payable: outTax - inTax, invoices };
}

export function cashflow(s: ImsState) {
  const js = journals(s);
  const cashOf = (j: Journal, side: 'debit' | 'credit') => j.lines.filter((l) => l.account === '1000' || l.account === '1010').reduce((a, l) => a + l[side], 0);
  const sales = js.filter((j) => j.ref.startsWith('Sale') && j.memo.endsWith('sale')).reduce((a, j) => a + cashOf(j, 'debit'), 0);
  const suppliers = js.filter((j) => j.memo === 'Supplier payment').reduce((a, j) => a + cashOf(j, 'credit'), 0);
  const expenses = js.filter((j) => j.ref.startsWith('EX-')).reduce((a, j) => a + cashOf(j, 'credit'), 0);
  const opening = BANK_OPENING;
  return { opening, sales, suppliers, expenses, net: sales - suppliers - expenses, closing: opening + sales - suppliers - expenses };
}
