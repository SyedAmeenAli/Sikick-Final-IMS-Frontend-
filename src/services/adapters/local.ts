/**
 * Local-fixture adapter. Holds Morrow Goods in memory and applies the same
 * business rules the backend enforces (reasoned adjustments, oversell
 * protection, receive-then-stock). Nothing here touches a network or storage,
 * so a reload restores the original data.
 */
import { readPref, resolveTheme, savePref } from '@/lib/theme';
import { createAuthService, loadAccount, saveAccount } from './account';
import { DAY, scenarioBilling, trialInfo } from '../account';
import {
  ACCOUNTS as _accounts, AUDIT, CATEGORIES, PRODUCT_TYPES, BATCHES, CASHIERS, CUSTOMERS, EXPENSES, FIRST_NEW_SALE, MEMBERS, MOVEMENTS, ORDERS, PROPOSALS,
  PURCHASE_ORDERS, PRODUCTS, QUOTATIONS, SEED_STOCK, SERIALS, SUPPLIER_PAYMENTS, SUPPLIERS, TERMINALS, NOW, WORKSPACE,
} from '@/data/fixtures/seed';
import { priceCart } from '@/lib/pricing';
import { ean13 } from '@/lib/ean';
import type { ImsCommands, ImsService, ImsState, Result, SaleInput, SaleReceipt } from '../contracts/service';
import type { Order, OrderStatus, StockLevel, StockMovement } from '../contracts/types';
import { alerts as deriveAlerts, orderTotal, poTotals, product, stockAvailable, stockTotal } from '../selectors';

void _accounts;

const clone = <T,>(x: T): T => structuredClone(x);
const fail = (code: string, message: string): Result<never> => ({ ok: false, code, message });
const ok = <T,>(value: T): Result<T> => ({ ok: true, value });
const clockNow = () => {
  // the prototype's "now" advances a minute per action from 11:26 so receipts have increasing times
  clockNow.tick += 1;
  const d = new Date(NOW.getTime() + clockNow.tick * 60_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':00';
};
clockNow.tick = 0;

function initial(): ImsState {
  return {
    version: 0,
    role: 'admin',
    theme: resolveTheme(readPref()),
    themePref: readPref(),
    products: clone(PRODUCTS),
    stock: clone(SEED_STOCK),
    movements: clone(MOVEMENTS),
    orders: clone(ORDERS),
    nextSale: FIRST_NEW_SALE,
    suppliers: clone(SUPPLIERS),
    supplierPayments: clone(SUPPLIER_PAYMENTS),
    purchaseOrders: clone(PURCHASE_ORDERS),
    customers: clone(CUSTOMERS),
    quotations: clone(QUOTATIONS),
    expenses: clone(EXPENSES),
    ackedAlerts: ['AL-BRK-TSHIRT'],
    proposals: clone(PROPOSALS),
    audit: clone(AUDIT),
    members: clone(MEMBERS),
    cashiers: clone(CASHIERS),
    terminals: clone(TERMINALS),
    serials: clone(SERIALS),
    batches: clone(BATCHES),
    business: {
      auditLogRetentionMonths: 24, taxRatePercent: 18, sellerGstin: WORKSPACE.gstin, sellerStateCode: '36',
      eInvoiceApplicable: false, eInvoiceAatoAbove10Cr: false, ewayBillThreshold: 50000, drugLicenceNumber: '',
    },
    items: {
      serial_no: true, batch_no: true, expiry_date: true, model_no: false, size: true, units_enabled: true,
      customFieldLabels: [{ label: 'Warranty (months)', scannable: false }, { label: 'Season', scannable: false }],
      visionProfile: 'general',
    },
    categories: clone(CATEGORIES),
    productTypes: clone(PRODUCT_TYPES),
    barcodeQueue: [],
    printHistory: [
      { id: 'PR-0112', at: '2026-10-22T16:10:00', sku: 'SKU-5003', copies: 60, template: 'Shelf label 50×25', by: 'Dev K.' },
      { id: 'PR-0111', at: '2026-10-18T11:40:00', sku: 'SKU-1042', copies: 40, template: 'Hang tag 30×60', by: 'Rahul M.' },
    ],
    offline: { online: true, queued: 0 },
    sound: loadSound(),
    assistantOpen: false,
    account: loadAccount(),
    blocked: { n: 0, message: '' },
  };
}

const SOUND_KEY = 'sikick.sound.v1';
/** Sound preference lives in this browser only (never sent anywhere). Off by default; storage may be unavailable. */
function loadSound(): { enabled: boolean; volume: number } {
  try {
    const raw = window.localStorage.getItem(SOUND_KEY);
    if (raw) { const p = JSON.parse(raw) as { enabled?: unknown; volume?: unknown }; return { enabled: p.enabled === true, volume: typeof p.volume === 'number' ? Math.min(1, Math.max(0, p.volume)) : 0.4 }; }
  } catch { /* private window or blocked storage */ }
  return { enabled: false, volume: 0.4 };
}
function saveSound(v: { enabled: boolean; volume: number }) { try { window.localStorage.setItem(SOUND_KEY, JSON.stringify(v)); } catch { /* ignore */ } }

export function createLocalService(): ImsService {
  let state = initial();
  // a 'system' preference follows the operating system while the app is open
  if (typeof window !== 'undefined' && window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (state.themePref === 'system') commands.setThemePref('system', false); });
  }
  const listeners = new Set<() => void>();
  let mv = state.movements.length;
  let au = 9052;

  const set = (fn: (s: ImsState) => void, audit?: { action: string; entity: string; ref: string; detail: string }) => {
    const next = { ...state } as ImsState;
    fn(next);
    if (next.account !== state.account) saveAccount(next.account);
    if (audit) next.audit = [{ id: 'AU-' + au++, at: clockNow(), actor: actorName(next), ...audit }, ...next.audit];
    next.version = state.version + 1;
    state = next;
    listeners.forEach((l) => l());
  };
  const actorName = (s: ImsState) => ({ admin: 'Ameen Ali', manager: 'Farah Siddiqui', warehouse_staff: 'Dev Kumar', pos_operator: 'Priya Sharma' }[s.role]);
  const move = (s: ImsState, m: Omit<StockMovement, 'id' | 'by' | 'at'> & { at?: string }) => {
    s.movements = [...s.movements, { id: 'MV-' + String(++mv).padStart(4, '0'), at: m.at ?? clockNow(), by: actorName(s), ...m }];
  };
  const level = (s: ImsState, sku: string): StockLevel => { s.stock = { ...s.stock, [sku]: { ...s.stock[sku] } }; return s.stock[sku]; };

  /** copies the account before changing it, so the store sees a new object and the change is saved */
  const editAccount = (fn: (a: ImsState['account']) => void) => set((s) => { s.account = JSON.parse(JSON.stringify(s.account)); fn(s.account); });
  const auth = createAuthService({ get: () => state.account, edit: editAccount, setWorkspaceName: () => undefined });

  const commands: ImsCommands = {
    setTrialScenario: (name) => editAccount((a) => { a.billing = scenarioBilling(name); a.clockShiftMs = 0; }),
    shiftClock: (days) => editAccount((a) => { a.clockShiftMs += days * DAY; }),
    saveOnboardingDraft: (patch) => editAccount((a) => { a.onboarding.draft = { ...a.onboarding.draft, ...patch }; }),
    completeOnboarding() {
      const d = state.account.onboarding.draft;
      if (!d.businessName.trim()) return fail('VALIDATION', 'Tell us your business name.');
      if (d.gstin && d.gstin.length !== 15) return fail('VALIDATION', 'A GSTIN is exactly 15 characters.');
      if (!/^[0-9]{2}$/.test(d.stateCode)) return fail('VALIDATION', 'Use the two-digit GST state code, for example 36.');
      const rate = Number(d.taxRate);
      if (!(rate >= 0 && rate <= 100)) return fail('VALIDATION', 'Enter a tax rate between 0 and 100.');
      commands.saveBusinessSettings({ ...state.business, sellerGstin: d.gstin.toUpperCase(), sellerStateCode: d.stateCode, taxRatePercent: rate });
      commands.saveItemSettings({ ...state.items, visionProfile: d.sells });
      for (const i of d.invites) commands.inviteMember(i.email, i.role);
      editAccount((a) => { a.workspace.name = d.businessName.trim(); a.onboarding.done = true; });
      return ok(undefined);
    },
    setRole: (role) => set((s) => { s.role = role; }),
    setTheme: (theme) => commands.setThemePref(theme),
    setThemePref: (pref, persist = true) => { if (persist) savePref(pref); set((s) => { s.themePref = pref; s.theme = resolveTheme(pref); }); },
    setSound: (next) => set((s) => { s.sound = { ...s.sound, ...next }; saveSound(s.sound); }),
    setAssistantOpen: (open) => set((s) => { s.assistantOpen = open; }),
    resetDemo: () => { const keep = { role: state.role, theme: state.theme, themePref: state.themePref, sound: state.sound, account: state.account }; state = { ...initial(), ...keep, version: state.version + 1 }; mv = state.movements.length; listeners.forEach((l) => l()); },
    setOnline: (online) => set((s) => { s.offline = { ...s.offline, online }; }),
    syncQueued() {
      const n = state.offline.queued;
      set((s) => { s.offline = { ...s.offline, queued: 0 }; }, n ? { action: 'sync.flush', entity: 'orders', ref: 'offline-queue', detail: n + ' offline sales synced' } : undefined);
      return ok(n);
    },

    ringSale(input: SaleInput) {
      const s0 = state;
      if (input.lines.length === 0) return fail('EMPTY_CART', 'Add at least one item before charging.');
      for (const l of input.lines) {
        if (l.qty <= 0) return fail('BAD_QTY', 'Quantities must be at least 1.');
        const avail = stockTotal(s0, l.sku) - (s0.stock[l.sku]?.reserved ?? 0);
        if (l.qty > avail) return fail('INSUFFICIENT_STOCK', product(s0, l.sku).name + ': only ' + Math.max(0, avail) + ' available.');
      }
      const priced = priceCart(input.lines.map((l) => { const p = product(s0, l.sku); return { sku: l.sku, unit: p.price, qty: l.qty, gst: p.gst }; }), input.discount);
      const applied = input.tenders.reduce((a, t) => a + t.amount, 0);
      if (applied < priced.total) return fail('UNDERPAID', 'Payments cover ' + applied + ' of ' + priced.total + ' paise.');
      const cashPart = input.tenders.filter((t) => t.tender === 'cash').reduce((a, t) => a + t.amount, 0);
      const change = applied - priced.total;
      if (change > cashPart) return fail('OVERPAID', 'Only cash can be over-tendered.');

      let receipt!: SaleReceipt;
      const no = '#' + s0.nextSale;
      const at = clockNow();
      const serialsOut: Array<{ sku: string; serial: string }> = [];
      set((s) => {
        // payments are stored as applied, so cash change never inflates the order
        let remaining = priced.total;
        const payments = input.tenders.map((t) => { const a = Math.min(t.amount, remaining); remaining -= a; return { tender: t.tender, amount: a }; }).filter((p) => p.amount > 0);
        const order: Order = {
          no, at, customerId: input.customerId, channel: input.channel ?? 'POS', status: 'Completed',
          lines: priced.lines.map((l) => ({ sku: l.sku, qty: l.qty, unit: l.unit, gst: l.gst, discount: l.discount })),
          payments, cashier: actorName(s),
        };
        s.orders = [...s.orders, order];
        s.nextSale = s.nextSale + 1;
        if (!s.offline.online) s.offline = { ...s.offline, queued: s.offline.queued + 1 };
        s.serials = s.serials.map((x) => ({ ...x }));
        for (const l of order.lines) {
          const lv = level(s, l.sku);
          lv.onHand -= l.qty;
          move(s, { sku: l.sku, delta: -l.qty, type: 'sale', ref: 'Sale ' + no, at });
          const p = product(s, l.sku);
          if (p.tracking === 'serial') {
            let need = l.qty;
            for (const x of s.serials) if (need > 0 && x.sku === l.sku && x.state === 'in_stock') { x.state = 'sold'; x.orderNo = no; x.soldAt = at; serialsOut.push({ sku: l.sku, serial: x.serial }); need--; }
          }
          if (p.tracking === 'batch') {
            let need = l.qty;
            s.batches = s.batches.map((b) => ({ ...b })).sort((a, b) => a.expiry.localeCompare(b.expiry));
            for (const b of s.batches) if (need > 0 && b.sku === l.sku && b.qty > 0) { const t = Math.min(b.qty, need); b.qty -= t; need -= t; }
          }
        }
        receipt = { order, subtotal: priced.subtotal, discount: priced.discount, tax: priced.tax, total: priced.total, tendered: applied, change, serials: serialsOut };
      }, { action: 'order.pay', entity: 'order', ref: no, detail: input.tenders.map((t) => t.tender).join(' + ') + ' payment recorded' });
      return ok(receipt);
    },

    createOrder(input) {
      if (!input.lines.length) return fail('EMPTY_CART', 'Add at least one item.');
      const priced = priceCart(input.lines.map((l) => { const p = product(state, l.sku); return { sku: l.sku, unit: p.price, qty: l.qty, gst: p.gst }; }), input.discount);
      const no = '#' + state.nextSale;
      set((s) => {
        s.orders = [...s.orders, { no, at: clockNow(), customerId: input.customerId, channel: input.channel, status: 'Draft', lines: priced.lines.map((l) => ({ sku: l.sku, qty: l.qty, unit: l.unit, gst: l.gst, discount: l.discount })), payments: [], cashier: actorName(s) }];
        s.nextSale += 1;
      }, { action: 'order.create', entity: 'order', ref: no, detail: 'Draft order created' });
      return ok(no);
    },

    advanceOrder(no, to) {
      const o = state.orders.find((x) => x.no === no);
      if (!o) return fail('NOT_FOUND', 'Order not found.');
      const allowed: Record<string, OrderStatus[]> = {
        Draft: ['Pending', 'Cancelled'], Pending: ['Cancelled'], Paid: ['Packed', 'Returned'], Packed: ['Shipped', 'Returned'], Shipped: ['Delivered', 'Returned'],
        Delivered: ['Completed', 'Returned'], Completed: ['Returned'], Returned: ['Refunded'],
      };
      if (!(allowed[o.status] ?? []).includes(to)) return fail('BAD_TRANSITION', 'An order that is ' + o.status + ' cannot move to ' + to + '.');
      if (to === 'Pending') {
        for (const l of o.lines) if (stockAvailable(state, l.sku) < l.qty) return fail('INSUFFICIENT_STOCK', product(state, l.sku).name + ': only ' + stockAvailable(state, l.sku) + ' available to reserve.');
      }
      set((s) => {
        s.orders = s.orders.map((x) => (x.no === no ? { ...x, status: to, shipment: to === 'Shipped' && !x.shipment ? { carrier: 'Shiprocket', awb: 'DL' + (7050000 + s.orders.length), state: 'In transit' } : to === 'Delivered' && x.shipment ? { ...x.shipment, state: 'Delivered' } : x.shipment } : x));
        if (to === 'Pending') for (const l of o.lines) level(s, l.sku).reserved += l.qty;
        if (to === 'Cancelled' && o.status === 'Pending') for (const l of o.lines) level(s, l.sku).reserved -= l.qty;
        if (to === 'Returned') for (const l of o.lines) { level(s, l.sku).onHand += l.qty; move(s, { sku: l.sku, delta: l.qty, type: 'return', ref: 'Return ' + no }); }
      }, { action: 'order.' + to.toLowerCase(), entity: 'order', ref: no, detail: 'Status changed to ' + to });
      return ok(undefined);
    },

    recordPayment(no, payment) {
      const o = state.orders.find((x) => x.no === no);
      if (!o) return fail('NOT_FOUND', 'Order not found.');
      if (o.status !== 'Pending') return fail('BAD_STATE', o.status === 'Draft' ? 'Confirm the order first. That reserves the stock.' : 'This order is already ' + o.status + '.');
      const due = o.lines.reduce((a, l) => { const net = l.unit * l.qty - l.discount; return a + net + Math.round((net * l.gst) / 100); }, 0);
      if (payment.amount < due) return fail('UNDERPAID', 'The payment must cover the full amount of ' + due + ' paise.');
      set((s) => {
        s.orders = s.orders.map((x) => (x.no === no ? { ...x, payments: [...x.payments, { ...payment, amount: due }], status: 'Paid' } : x));
        for (const l of o.lines) { const lv = level(s, l.sku); lv.reserved -= l.qty; lv.onHand -= l.qty; move(s, { sku: l.sku, delta: -l.qty, type: 'sale', ref: 'Sale ' + no }); }
      }, { action: 'order.pay', entity: 'order', ref: no, detail: payment.tender + ' payment recorded' });
      return ok(undefined);
    },

    adjustStock(sku, delta, reason, eventType = 'ADJUSTMENT') {
      if (!reason.trim()) return fail('REASON_REQUIRED', 'Every adjustment needs a reason.');
      if (delta === 0) return fail('NO_CHANGE', 'Enter a quantity other than zero.');
      const lv0 = state.stock[sku];
      if (!lv0) return fail('NOT_FOUND', 'Unknown SKU.');
      if (eventType === 'DAMAGE' && delta > 0) return fail('INVALID', 'Damage removes units. Enter a negative number.');
      if (lv0.onHand + delta < 0) return fail('NEGATIVE', 'That would take on-hand below zero.');
      set((s) => { const lv = level(s, sku); lv.onHand += delta; if (eventType === 'DAMAGE') lv.damaged += -delta; move(s, { sku, delta, type: eventType === 'RETURN' ? 'return' : 'adjustment', ref: 'ADJ-' + String(8 + (s.movements.length % 90)).padStart(4, '0'), reason: (eventType === 'DAMAGE' ? 'Damaged: ' : '') + reason }); },
        { action: 'stock.adjust', entity: 'variant', ref: sku, detail: 'Reason: ' + reason + ' (' + (delta > 0 ? '+' : '') + delta + ')' });
      return ok(undefined);
    },

    createPurchaseOrder(supplierId, lines, note) {
      if (lines.length === 0) return fail('EMPTY', 'Add at least one line.');
      const no = 'PO-' + String(185 + state.purchaseOrders.filter((p) => Number(p.no.slice(3)) >= 185).length).padStart(4, '0');
      set((s) => {
        s.purchaseOrders = [...s.purchaseOrders, { no, supplierId, status: 'Draft', date: WORKSPACE.today, note, lines: lines.map((l) => ({ sku: l.sku, qty: l.qty, unitCost: product(s, l.sku).cost, received: 0 })) }];
      }, { action: 'po.create', entity: 'purchase_order', ref: no, detail: 'Draft with ' + lines.length + ' lines' });
      return ok(no);
    },
    placePurchaseOrder(no) {
      const po = state.purchaseOrders.find((p) => p.no === no);
      if (!po || po.status !== 'Draft') return fail('BAD_STATE', 'Only a draft can be placed.');
      set((s) => { s.purchaseOrders = s.purchaseOrders.map((p) => (p.no === no ? { ...p, status: 'Ordered', expected: '2026-11-03' } : p)); },
        { action: 'po.place', entity: 'purchase_order', ref: no, detail: 'Status changed to Ordered' });
      return ok(undefined);
    },
    receivePurchaseOrder(no, recv) {
      const po = state.purchaseOrders.find((p) => p.no === no);
      if (!po || po.status !== 'Ordered') return fail('BAD_STATE', 'Only an ordered PO can be received.');
      for (const r of recv) {
        const l = po.lines.find((x) => x.sku === r.sku);
        if (!l) return fail('BAD_LINE', 'Unknown line.');
        if (r.received < 0 || r.damaged < 0 || r.damaged > r.received) return fail('BAD_QTY', 'Damaged units cannot exceed units received.');
        if (r.received > l.qty) return fail('OVER_RECEIPT', 'Cannot receive more than ordered on ' + r.sku + '.');
      }
      set((s) => {
        s.purchaseOrders = s.purchaseOrders.map((p) => (p.no !== no ? p : { ...p, status: 'Received', lines: p.lines.map((l) => { const r = recv.find((x) => x.sku === l.sku); return { ...l, received: r ? r.received - r.damaged : l.received }; }) }));
        for (const r of recv) {
          const good = r.received - r.damaged;
          const lv = level(s, r.sku);
          lv.onHand += good; lv.damaged += r.damaged;
          move(s, { sku: r.sku, delta: good, type: 'receipt', ref: no });
          const prod = product(s, r.sku);
          if (prod.tracking === 'serial' && good > 0) {
            const tag = r.sku === 'SKU-2081' ? 'NW-EB-26-' : 'NW-PB-26-';
            const base = 2000 + s.serials.filter((x) => x.sku === r.sku).length;
            s.serials = [...s.serials, ...Array.from({ length: good }, (_, i) => ({ serial: tag + String(base + i).padStart(5, '0'), sku: r.sku, state: 'in_stock' as const, warrantyMonths: r.sku === 'SKU-2081' ? 12 : 6 }))];
          }
          if (prod.tracking === 'batch' && good > 0) s.batches = [...s.batches, { batch: 'HT2610-R' + (s.batches.length + 1), sku: r.sku, expiry: '2027-10-31', qty: good }];
        }
      }, { action: 'po.receive', entity: 'purchase_order', ref: no, detail: recv.reduce((a, r) => a + r.received, 0) + ' units received, stock updated' });
      return ok(undefined);
    },
    addSupplier(i) {
      if (!i.name.trim()) return fail('INVALID', 'Enter the supplier name.');
      if (i.gstin && !/^[0-9A-Z]{15}$/.test(i.gstin)) return fail('INVALID', 'GSTIN must be 15 letters and digits.');
      if (state.suppliers.some((x) => x.name.toLowerCase() === i.name.trim().toLowerCase())) return fail('DUPLICATE', 'That supplier already exists.');
      const id = 'SUP-' + String(state.suppliers.length + 1).padStart(2, '0');
      set((s) => { s.suppliers = [...s.suppliers, { id, name: i.name.trim(), gstin: i.gstin, contact: i.contact, phone: i.phone, city: i.city, terms: i.terms, balance: 0, status: 'active' }]; }, { action: 'supplier.create', entity: 'supplier', ref: id, detail: i.name });
      return ok(id);
    },
    recordSupplierPayment(supplierId, amount, mode, ref) {
      if (amount <= 0) return fail('BAD_AMOUNT', 'Enter an amount above zero.');
      set((s) => { s.supplierPayments = [...s.supplierPayments, { id: 'SP-' + String(37 + s.supplierPayments.length - 4).padStart(4, '0'), supplierId, date: WORKSPACE.today, amount, mode, ref }]; },
        { action: 'supplier.payment', entity: 'supplier', ref: supplierId, detail: 'Payment recorded' });
      return ok(undefined);
    },

    createQuotation(customerId, lines) {
      const no = 'QT-' + String(44 + state.quotations.length - 4).padStart(4, '0');
      set((s) => { s.quotations = [...s.quotations, { no, date: WORKSPACE.today, validUntil: '2026-11-07', customerId, status: 'draft', lines }]; }, { action: 'quotation.create', entity: 'quotation', ref: no, detail: 'Draft quotation' });
      return ok(no);
    },
    convertQuotation(no) {
      const q = state.quotations.find((x) => x.no === no);
      if (!q || q.status !== 'accepted') return fail('BAD_STATE', 'Only an accepted quotation can be converted.');
      const ono = '#' + state.nextSale;
      set((s) => {
        s.quotations = s.quotations.map((x) => (x.no === no ? { ...x, status: 'converted' } : x));
        s.orders = [...s.orders, { no: ono, at: clockNow(), customerId: q.customerId, channel: 'Wholesale', status: 'Pending', lines: q.lines, payments: [], cashier: actorName(s) }];
        s.nextSale += 1;
      }, { action: 'quotation.convert', entity: 'quotation', ref: no, detail: 'Converted to order ' + ono });
      return ok(ono);
    },
    addExpense(e) {
      set((s) => { s.expenses = [{ ...e, id: 'EX-' + String(217 + s.expenses.length - 6).padStart(4, '0') }, ...s.expenses]; }, { action: 'expense.create', entity: 'expense', ref: e.category, detail: e.payee });
      return ok(undefined);
    },

    createProduct(i) {
      if (!i.name.trim()) return fail('INVALID', 'Give the product a name.');
      if (i.price <= 0) return fail('INVALID', 'Enter a selling price above zero.');
      if (state.products.some((p) => p.name.toLowerCase() === i.name.trim().toLowerCase())) return fail('DUPLICATE', 'A product with this name already exists.');
      const next = Math.max(...state.products.map((p) => Number(p.sku.slice(4)))) + 1;
      const sku = 'SKU-' + next;
      set((s) => {
        s.products = [...s.products, { sku, name: i.name.trim(), category: i.category, type: i.type, brand: i.brand || 'Morrow', unit: i.unit, hsn: i.hsn, gst: i.gst, price: i.price, cost: i.cost, reorderPoint: i.reorderPoint, sold30: 0, lastSaleDays: 99, tracking: i.tracking, barcode: ean13('8901234' + String(next).padStart(5, '0')), supplierId: 'SUP-01', status: 'active', kind: 'box' }];
        s.stock = { ...s.stock, [sku]: { onHand: i.openingStock, reserved: 0, damaged: 0 } };
        if (i.openingStock) move(s, { sku, delta: i.openingStock, type: 'opening', ref: 'Opening balance' });
      }, { action: 'product.create', entity: 'product', ref: sku, detail: i.name });
      return ok(sku);
    },
    updateProduct(sku, patch) {
      if (patch.price !== undefined && patch.price <= 0) return fail('INVALID', 'Price must be above zero.');
      set((s) => { s.products = s.products.map((p) => (p.sku === sku ? { ...p, ...patch } : p)); }, { action: 'product.update', entity: 'product', ref: sku, detail: Object.keys(patch).join(', ') + ' updated' });
      return ok(undefined);
    },
    removeProducts(skus) {
      const used = skus.filter((k) => state.orders.some((o) => o.lines.some((l) => l.sku === k)) || state.purchaseOrders.some((p) => p.lines.some((l) => l.sku === k)));
      if (used.length) return fail('IN_USE', used.join(', ') + ' already has sales or orders, so it cannot be undone.');
      set((s) => { s.products = s.products.filter((p) => !skus.includes(p.sku)); const st = { ...s.stock }; skus.forEach((k) => delete st[k]); s.stock = st; s.movements = s.movements.filter((m) => !skus.includes(m.sku)); }, { action: 'import.undo', entity: 'import', ref: skus.length + ' products', detail: 'Import undone' });
      return ok(skus.length);
    },
    addCategory(name, note) {
      if (!name.trim()) return fail('INVALID', 'Name the category.');
      if (state.categories.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) return fail('DUPLICATE', 'That category already exists.');
      set((s) => { s.categories = [...s.categories, { id: 'CAT-' + (s.categories.length + 1), name: name.trim(), note }]; }, { action: 'category.create', entity: 'category', ref: name, detail: 'Category created' });
      return ok(undefined);
    },
    deleteCategory(id) {
      const c = state.categories.find((x) => x.id === id);
      if (!c) return fail('NOT_FOUND', 'Category not found.');
      if (state.products.some((p) => p.category === c.name)) return fail('IN_USE', 'Move its products to another category first.');
      set((s) => { s.categories = s.categories.filter((x) => x.id !== id); }, { action: 'category.delete', entity: 'category', ref: c.name, detail: 'Category deleted' });
      return ok(undefined);
    },
    addProductType(name, attributes) {
      if (!name.trim()) return fail('INVALID', 'Name the product type.');
      set((s) => { s.productTypes = [...s.productTypes, { id: 'PT-' + (s.productTypes.length + 1), name: name.trim(), unit: 'pcs', attributes }]; }, { action: 'product_type.create', entity: 'product_type', ref: name, detail: 'Product type created' });
      return ok(undefined);
    },
    acknowledgeAlert: (id) => set((s) => { s.ackedAlerts = [...s.ackedAlerts, id]; }),
    decideProposal(id, decision) {
      const p = state.proposals.find((x) => x.id === id);
      if (!p || p.state !== 'proposed') return fail('BAD_STATE', 'This proposal has already been decided.');
      if (state.role !== 'admin' && state.role !== 'manager') return fail('FORBIDDEN', 'Only a manager or admin can approve SiBorg proposals.');
      if (decision === 'approved' && p.effect?.kind === 'placePo') {
        const r = commands.placePurchaseOrder(p.effect.no);
        if (!r.ok && !/Only a draft/.test(r.message)) return r;
      }
      if (decision === 'approved' && p.effect?.kind === 'createPo') {
        const r = commands.createPurchaseOrder(p.effect.supplierId, p.effect.lines, 'Drafted from an approved SiBorg proposal');
        if (!r.ok) return r;
      }
      set((s) => { s.proposals = s.proposals.map((x) => (x.id === id ? { ...x, state: decision, decidedAt: clockNow(), decidedBy: actorName(s) } : x)); },
        { action: 'proposal.' + (decision === 'approved' ? 'approve' : 'reject'), entity: 'agent_proposal', ref: id, detail: p.title });
      return ok(undefined);
    },

    proposeFromChat(p) {
      const dup = state.proposals.find((x) => x.title === p.title && x.state === 'proposed');
      if (dup) return ok(dup.id);
      const id = 'PRP-' + (122 + state.proposals.length - 3);
      set((s) => { s.proposals = [{ id, sessionId: 'sess-' + id.toLowerCase(), title: p.title, reasoning: p.reasoning, basis: p.basis, actions: p.actions.map((a, i) => ({ id: 'a' + (i + 1), ...a })), state: 'proposed', effect: p.effect }, ...s.proposals]; }, { action: 'proposal.create', entity: 'agent_proposal', ref: id, detail: p.title });
      return ok(id);
    },
    saveBusinessSettings(next) {
      if (next.sellerGstin && next.sellerGstin.length !== 15) return fail('INVALID', 'GSTIN must be 15 characters.');
      if (!/^[0-9]{2}$/.test(next.sellerStateCode)) return fail('INVALID', 'State code must be two digits.');
      if (next.taxRatePercent < 0 || next.taxRatePercent > 100) return fail('INVALID', 'Tax rate must be between 0 and 100.');
      set((s) => { s.business = next; }, { action: 'settings.update', entity: 'settings', ref: 'business', detail: 'Business settings saved' });
      return ok(undefined);
    },
    saveItemSettings(next) { set((s) => { s.items = next; }, { action: 'settings.update', entity: 'settings', ref: 'items', detail: 'Item fields saved' }); return ok(undefined); },
    inviteMember(email, role) {
      if (!/^\S+@\S+\.\S+$/.test(email)) return fail('INVALID', 'Enter a valid email address.');
      set((s) => { s.members = [...s.members, { id: 'U-' + String(s.members.length + 1).padStart(2, '0'), name: email.split('@')[0], email, role, status: 'invited', lastActive: 'Never' }]; }, { action: 'user.invite', entity: 'user', ref: email, detail: 'Invited as ' + role });
      return ok(undefined);
    },
    setMemberRole(id, role) { set((s) => { s.members = s.members.map((m) => (m.id === id ? { ...m, role } : m)); }, { action: 'user.role', entity: 'user', ref: id, detail: 'Role set to ' + role }); return ok(undefined); },
    setCashierStatus: (id, status) => set((s) => { s.cashiers = s.cashiers.map((c) => (c.id === id ? { ...c, status } : c)); }, { action: 'cashier.' + status, entity: 'cashier', ref: id, detail: 'Cashier ' + status }),
    revokeTerminal: (id) => set((s) => { s.terminals = s.terminals.map((t) => (t.id === id ? { ...t, status: 'revoked' } : t)); }, { action: 'terminal.revoke', entity: 'terminal', ref: id, detail: 'Terminal token revoked' }),

    queueLabels: (sku, copies) => set((s) => { const ex = s.barcodeQueue.find((q) => q.sku === sku); s.barcodeQueue = ex ? s.barcodeQueue.map((q) => (q.sku === sku ? { ...q, copies: q.copies + copies } : q)) : [...s.barcodeQueue, { sku, copies }]; }),
    clearLabelQueue: () => set((s) => { s.barcodeQueue = []; }),
    printLabels(template) {
      if (state.barcodeQueue.length === 0) return fail('EMPTY', 'The queue is empty.');
      const total = state.barcodeQueue.reduce((a, q) => a + q.copies, 0);
      set((s) => { s.printHistory = [...s.barcodeQueue.map((q, i) => ({ id: 'PR-' + String(113 + s.printHistory.length - 2 + i).padStart(4, '0'), at: clockNow(), sku: q.sku, copies: q.copies, template, by: actorName(s) })), ...s.printHistory]; s.barcodeQueue = []; });
      return ok(total);
    },
  };

  /**
   * Mirrors the real subscription gate: once the trial has ended every write is refused with
   * SUBSCRIPTION_INACTIVE (HTTP 402) while every read keeps working. The shell is told once, so a refused
   * action is never silent.
   */
  const OPEN = new Set(['setRole', 'setTheme', 'setThemePref', 'setSound', 'setAssistantOpen', 'resetDemo', 'setOnline', 'setTrialScenario', 'shiftClock', 'saveOnboardingDraft', 'completeOnboarding']);
  const REFUSAL = 'This workspace is read-only. You can still view and export everything; choose a plan to make changes again.';
  const guarded = Object.fromEntries(Object.entries(commands).map(([name, fn]) => [name, OPEN.has(name) ? fn : (...args: unknown[]) => {
    if (!trialInfo(state.account).canWrite) { set((s) => { s.blocked = { n: s.blocked.n + 1, message: REFUSAL }; }); return fail('SUBSCRIPTION_INACTIVE', REFUSAL); }
    return (fn as (...a: unknown[]) => unknown)(...args);
  }])) as unknown as ImsCommands;

  return {
    getState: () => state,
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
    commands: guarded,
    auth,
  };
}

export { deriveAlerts, orderTotal, poTotals };
