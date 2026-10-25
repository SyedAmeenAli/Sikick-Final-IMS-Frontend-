/**
 * Morrow Goods — the one fictional workspace behind every screen.
 * Not a Sikick customer; none of these records are real results.
 *
 * Everything with a quantity is derived from the movement and order lists
 * below, so a product has one SKU, one price and one stock figure everywhere.
 * Money is integer paise.
 */
import { rupees } from '@/lib/money';
import { ean13 } from '@/lib/ean';
import type {
  Account, Alert, AuditEntry, Cashier, Customer, Expense, Member, Order, OrderLine,
  Product, Proposal, PurchaseOrder, Quotation, StockLevel, StockMovement, Supplier, SupplierPayment, Terminal,
} from '@/services/contracts/types';

export const WORKSPACE = {
  name: 'Morrow Goods',
  legalName: 'Morrow Goods Retail LLP',
  location: 'Main Store',
  address: '14, Residency Road, Banjara Hills, Hyderabad, Telangana 500034',
  gstin: '36AAHFM4471K1Z8',
  pan: 'AAHFM4471K',
  phone: '+91 98765 43210',
  email: 'accounts@morrowgoods.example',
  till: 'Till 2',
  plan: 'growth' as 'starter' | 'growth' | 'business',
  today: '2026-10-24',
  now: '2026-10-24T11:26:00',
  fyStart: 'April',
};

export const NOW = new Date(WORKSPACE.now);

/* ---------- time helpers ---------- */
const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (daysAgo: number, hh = 12, mm = 0): string => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(hh) + ':' + pad(mm) + ':00';
};
export const dateOnly = (daysAgo: number) => iso(daysAgo).slice(0, 10);

/* ---------- deterministic PRNG so every load looks the same ---------- */
function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- suppliers ---------- */
export const SUPPLIERS: Supplier[] = [
  { id: 'SUP-01', name: 'Aster Wholesale', gstin: '36AAACA2211B1ZP', contact: 'Rohit Nair', phone: '+91 98480 11020', city: 'Hyderabad', terms: 'Net 30', balance: 0, status: 'active' },
  { id: 'SUP-02', name: 'Kaveri Textiles', gstin: '29AABCK7782D1Z4', contact: 'Lakshmi Gowda', phone: '+91 98450 70231', city: 'Bengaluru', terms: 'Net 21', balance: 0, status: 'active' },
  { id: 'SUP-03', name: 'Northline Electronics', gstin: '07AAECN3390F1ZB', contact: 'Imran Qureshi', phone: '+91 98110 45678', city: 'New Delhi', terms: 'Net 15', balance: 0, status: 'active' },
  { id: 'SUP-04', name: 'Paperlane Stationers', gstin: '27AAGFP9904C1Z1', contact: 'Sneha Kulkarni', phone: '+91 98200 33145', city: 'Pune', terms: 'Net 30', balance: 0, status: 'active' },
  { id: 'SUP-05', name: 'Hearth & Co.', gstin: '33AAJCH1187E1ZV', contact: 'Arvind Pillai', phone: '+91 98400 55672', city: 'Chennai', terms: 'Net 45', balance: 0, status: 'active' },
];
/** Carried forward from last financial year, before any order in this dataset. */
export const OPENING_BALANCE: Record<string, number> = {
  'SUP-01': rupees(18400), 'SUP-02': 0, 'SUP-03': rupees(9200), 'SUP-04': 0, 'SUP-05': rupees(26750),
};
export const MIN_LINE_QTY: Record<string, number> = { 'SUP-01': 30 };

/* ---------- products ---------- */
type P = Omit<Product, 'cost' | 'price' | 'status'> & { price: number; cost: number };
const raw: P[] = [
  { sku: 'SKU-1042', name: 'Cotton T-shirt (M)', category: 'Apparel', type: 'Garment', brand: 'Morrow', unit: 'pcs', hsn: '6109', gst: 5, price: 499, cost: 285, reorderPoint: 40, sold30: 96, lastSaleDays: 0, tracking: 'none', barcode: '8901234010428', supplierId: 'SUP-02', kind: 'box' },
  { sku: 'SKU-1043', name: 'Cotton T-shirt (L)', category: 'Apparel', type: 'Garment', brand: 'Morrow', unit: 'pcs', hsn: '6109', gst: 5, price: 499, cost: 285, reorderPoint: 40, sold30: 71, lastSaleDays: 1, tracking: 'none', barcode: '8901234010435', supplierId: 'SUP-02', kind: 'box' },
  { sku: 'SKU-1044', name: 'Cotton T-shirt (XL)', category: 'Apparel', type: 'Garment', brand: 'Morrow', unit: 'pcs', hsn: '6109', gst: 5, price: 499, cost: 285, reorderPoint: 30, sold30: 42, lastSaleDays: 1, tracking: 'none', barcode: '8901234010442', supplierId: 'SUP-02', kind: 'box' },
  { sku: 'SKU-2081', name: 'Wireless earbuds', category: 'Electronics', type: 'Audio', brand: 'Northwave', unit: 'pcs', hsn: '8518', gst: 18, price: 1499, cost: 890, reorderPoint: 15, sold30: 61, lastSaleDays: 0, tracking: 'serial', barcode: '8901234020817', supplierId: 'SUP-01', kind: 'case' },
  { sku: 'SKU-2090', name: 'Bluetooth speaker mini', category: 'Electronics', type: 'Audio', brand: 'Northwave', unit: 'pcs', hsn: '8518', gst: 18, price: 2499, cost: 1480, reorderPoint: 12, sold30: 19, lastSaleDays: 1, tracking: 'none', barcode: '8901234020909', supplierId: 'SUP-03', kind: 'case' },
  { sku: 'SKU-3310', name: 'Ceramic mug', category: 'Home', type: 'Kitchenware', brand: 'Hearth', unit: 'pcs', hsn: '6912', gst: 12, price: 249, cost: 118, reorderPoint: 60, sold30: 0, lastSaleDays: 63, tracking: 'none', barcode: '8901234033100', supplierId: 'SUP-05', kind: 'mug' },
  { sku: 'SKU-3311', name: 'Steel bottle 750ml', category: 'Home', type: 'Kitchenware', brand: 'Hearth', unit: 'pcs', hsn: '7323', gst: 12, price: 649, cost: 365, reorderPoint: 25, sold30: 38, lastSaleDays: 1, tracking: 'none', barcode: '8901234033117', supplierId: 'SUP-05', kind: 'bottle' },
  { sku: 'SKU-3312', name: 'Glass storage jar set', category: 'Home', type: 'Kitchenware', brand: 'Hearth', unit: 'set', hsn: '7013', gst: 12, price: 899, cost: 520, reorderPoint: 15, sold30: 14, lastSaleDays: 3, tracking: 'none', barcode: '8901234033124', supplierId: 'SUP-05', kind: 'box' },
  { sku: 'SKU-4120', name: 'Notebook A5', category: 'Stationery', type: 'Paper goods', brand: 'Paperlane', unit: 'pcs', hsn: '4820', gst: 12, price: 149, cost: 78, reorderPoint: 120, sold30: 210, lastSaleDays: 0, tracking: 'none', barcode: '8901234041208', supplierId: 'SUP-01', kind: 'box' },
  { sku: 'SKU-4121', name: 'Gel pen, pack of 10', category: 'Stationery', type: 'Writing', brand: 'Paperlane', unit: 'pack', hsn: '9608', gst: 12, price: 120, cost: 62, reorderPoint: 150, sold30: 118, lastSaleDays: 0, tracking: 'none', barcode: '8901234041215', supplierId: 'SUP-04', kind: 'box' },
  { sku: 'SKU-5002', name: 'LED desk lamp', category: 'Electronics', type: 'Lighting', brand: 'Lumio', unit: 'pcs', hsn: '9405', gst: 18, price: 1199, cost: 690, reorderPoint: 12, sold30: 24, lastSaleDays: 2, tracking: 'none', barcode: '8901234050020', supplierId: 'SUP-01', kind: 'lamp' },
  { sku: 'SKU-5003', name: 'USB-C cable 1m', category: 'Electronics', type: 'Accessories', brand: 'Northwave', unit: 'pcs', hsn: '8544', gst: 18, price: 299, cost: 179.4, reorderPoint: 50, sold30: 88, lastSaleDays: 0, tracking: 'none', barcode: '8901234050037', supplierId: 'SUP-01', kind: 'case' },
  { sku: 'SKU-5010', name: 'Power bank 10000 mAh', category: 'Electronics', type: 'Accessories', brand: 'Northwave', unit: 'pcs', hsn: '8507', gst: 18, price: 1799, cost: 1050, reorderPoint: 10, sold30: 18, lastSaleDays: 2, tracking: 'serial', barcode: '8901234050105', supplierId: 'SUP-03', kind: 'case' },
  { sku: 'SKU-6001', name: 'Canvas tote bag', category: 'Apparel', type: 'Accessories', brand: 'Morrow', unit: 'pcs', hsn: '4202', gst: 12, price: 399, cost: 210, reorderPoint: 30, sold30: 0, lastSaleDays: 71, tracking: 'none', barcode: '8901234060012', supplierId: 'SUP-02', kind: 'box' },
  { sku: 'SKU-7001', name: 'Herbal tea box', category: 'Grocery', type: 'Packaged food', brand: 'Hearth', unit: 'box', hsn: '0902', gst: 5, price: 349, cost: 190, reorderPoint: 30, sold30: 44, lastSaleDays: 1, tracking: 'batch', barcode: '8901234070011', supplierId: 'SUP-05', kind: 'box' },
];

export const PRODUCTS: Product[] = raw.map((p) => ({ ...p, barcode: ean13(p.barcode), price: rupees(p.price), cost: rupees(p.cost), status: 'active' as const }));
export const productBySku = (sku: string): Product => PRODUCTS.find((p) => p.sku === sku)!;

/** Current on-hand. Totals match the public site's Morrow dataset. */
const TOTALS: Record<string, { total: number; damaged?: number; reserved?: number }> = {
  'SKU-1042': { total: 128 }, 'SKU-1043': { total: 96 }, 'SKU-1044': { total: 54 },
  'SKU-2081': { total: 14, reserved: 2 }, 'SKU-2090': { total: 31 },
  'SKU-3310': { total: 212 }, 'SKU-3311': { total: 63 }, 'SKU-3312': { total: 40 },
  'SKU-4120': { total: 340 }, 'SKU-4121': { total: 410 },
  'SKU-5002': { total: 9 }, 'SKU-5003': { total: 150, damaged: 2 }, 'SKU-5010': { total: 6 },
  'SKU-6001': { total: 77 }, 'SKU-7001': { total: 88 },
};
export const SEED_STOCK: Record<string, StockLevel> = Object.fromEntries(
  Object.entries(TOTALS).map(([sku, t]) => [sku, { onHand: t.total, damaged: t.damaged ?? 0, reserved: t.reserved ?? 0 }]),
);

/* ---------- customers ---------- */
export const CUSTOMERS: Customer[] = [
  { id: 'CUS-000', name: 'Walk-in customer', phone: '', kind: 'retail', outstanding: 0, lifetime: 0, lastOrder: dateOnly(0), city: 'Hyderabad' },
  { id: 'CUS-014', name: 'Ananya Rao', phone: '+91 98660 21874', kind: 'retail', outstanding: 0, lifetime: 0, lastOrder: dateOnly(4), city: 'Hyderabad' },
  { id: 'CUS-021', name: 'Kiran Mehta', phone: '+91 99890 44120', kind: 'retail', outstanding: 0, lifetime: 0, lastOrder: dateOnly(9), city: 'Secunderabad' },
  { id: 'CUS-033', name: 'Brightside Café', phone: '+91 40 2355 7781', kind: 'business', gstin: '36AAMFB5521J1Z2', outstanding: rupees(6840), lifetime: 0, lastOrder: dateOnly(2), city: 'Hyderabad' },
  { id: 'CUS-037', name: 'Lotus Stationers', phone: '+91 98490 66127', kind: 'business', gstin: '36AADFL0912P1ZK', outstanding: 0, lifetime: 0, lastOrder: dateOnly(6), city: 'Warangal' },
  { id: 'CUS-041', name: 'Harbour Hotel Supplies', phone: '+91 91000 38820', kind: 'business', gstin: '36AAECH7733M1Z6', outstanding: rupees(21500), lifetime: 0, lastOrder: dateOnly(5), city: 'Hyderabad' },
  { id: 'CUS-052', name: 'Meera Iyer', phone: '+91 97012 55903', kind: 'retail', outstanding: 0, lifetime: 0, lastOrder: dateOnly(12), city: 'Vijayawada' },
  { id: 'CUS-058', name: 'Farhan Sheikh', phone: '+91 98850 12766', kind: 'retail', outstanding: 0, lifetime: 0, lastOrder: dateOnly(15), city: 'Hyderabad' },
];

/* ---------- orders: generated so product sold30 and last-sale days hold exactly ---------- */
const line = (sku: string, q: number): OrderLine => {
  const p = productBySku(sku);
  return { sku, qty: q, unit: p.price, gst: p.gst, discount: 0 };
};
const orderTotal = (lines: OrderLine[]) =>
  lines.reduce((s, l) => { const net = l.unit * l.qty - l.discount; return s + net + Math.round((net * l.gst) / 100); }, 0);

type Draft = { at: string; lines: OrderLine[]; customerId?: string };
const TODAY_ORDERS: Array<{ no: number; hh: number; mm: number; lines: Array<[string, number]>; tender: 'cash' | 'UPI' | 'card' }> = [
  { no: 4816, hh: 8, mm: 41, lines: [['SKU-4120', 6]], tender: 'cash' },
  { no: 4817, hh: 9, mm: 5, lines: [['SKU-1042', 2]], tender: 'UPI' },
  { no: 4818, hh: 9, mm: 20, lines: [['SKU-5003', 3]], tender: 'cash' },
  { no: 4819, hh: 9, mm: 48, lines: [['SKU-2081', 1]], tender: 'UPI' },
  { no: 4820, hh: 10, mm: 2, lines: [['SKU-4120', 2], ['SKU-4121', 2]], tender: 'card' },
  { no: 4821, hh: 10, mm: 31, lines: [['SKU-2081', 2]], tender: 'UPI' },
];

function buildOrders(): Order[] {
  const todayUnits: Record<string, number> = {};
  TODAY_ORDERS.forEach((o) => o.lines.forEach(([s, q]) => { todayUnits[s] = (todayUnits[s] ?? 0) + q; }));

  // spread each product's remaining 30-day units across the days its last sale allows
  const perDay: Array<Record<string, number>> = Array.from({ length: 30 }, () => ({}));
  perDay[0] = { ...todayUnits };
  PRODUCTS.forEach((p) => {
    let left = p.sold30 - (todayUnits[p.sku] ?? 0);
    if (left <= 0) return;
    const r = rng(p.sku);
    const first = Math.max(p.lastSaleDays, todayUnits[p.sku] ? 1 : 0);
    const days: number[] = [];
    for (let d = first; d < 30; d++) days.push(d);
    if (p.lastSaleDays >= 1 && left > 0) { perDay[p.lastSaleDays][p.sku] = (perDay[p.lastSaleDays][p.sku] ?? 0) + 1; left -= 1; }
    while (left > 0) {
      // recent days are a little busier, which gives the charts a believable slope
      const d = days[Math.floor(Math.pow(r(), 1.35) * days.length)];
      const chunk = Math.min(left, 1 + Math.floor(r() * 3));
      perDay[d][p.sku] = (perDay[d][p.sku] ?? 0) + chunk;
      left -= chunk;
    }
  });

  const drafts: Draft[] = [];
  for (let d = 29; d >= 1; d--) {
    const r = rng('day' + d);
    const entries = Object.entries(perDay[d]).flatMap(([sku, q]) => Array.from({ length: q }, () => sku));
    // shuffle, then bundle into baskets of one to three lines
    for (let i = entries.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [entries[i], entries[j]] = [entries[j], entries[i]]; }
    let minute = 9 * 60 + 5;
    while (entries.length) {
      const take = Math.min(entries.length, 1 + Math.floor(r() * 3));
      const basket = entries.splice(0, take);
      const merged: Record<string, number> = {};
      basket.forEach((s) => { merged[s] = (merged[s] ?? 0) + 1; });
      minute += 14 + Math.floor(r() * 55);
      drafts.push({ at: iso(d, Math.min(20, Math.floor(minute / 60)), minute % 60), lines: Object.entries(merged).map(([s, q]) => line(s, q)) });
    }
  }
  drafts.sort((a, b) => a.at.localeCompare(b.at));

  const first = 4816 - drafts.length;
  const tenders: Array<'cash' | 'UPI' | 'card'> = ['UPI', 'cash', 'UPI', 'card', 'UPI', 'cash'];
  const named = CUSTOMERS.slice(1);
  const out: Order[] = drafts.map((d, i) => {
    const r = rng('o' + i);
    const total = orderTotal(d.lines);
    const bulk = d.lines.some((l) => l.qty >= 5);
    const customerId = bulk ? named.filter((c) => c.kind === 'business')[Math.floor(r() * 3)].id : r() < 0.2 ? named.filter((c) => c.kind === 'retail')[Math.floor(r() * 4)].id : 'CUS-000';
    const online = customerId !== 'CUS-000' && !bulk && r() < 0.5;
    const age = (NOW.getTime() - new Date(d.at).getTime()) / 864e5;
    const channel: Order['channel'] = bulk ? 'Wholesale' : online ? 'Online' : 'POS';
    let status: Order['status'] = 'Completed';
    let shipment: Order['shipment'];
    if (online) {
      status = age < 1.5 ? 'Paid' : age < 3 ? 'Packed' : age < 5 ? 'Shipped' : 'Delivered';
      if (status === 'Shipped' || status === 'Delivered') shipment = { carrier: 'Shiprocket', awb: 'DL' + (7041000 + i * 37), state: status === 'Shipped' ? 'In transit' : 'Delivered' };
    }
    if (!online && !bulk && i % 31 === 7) status = 'Returned';
    const tender = tenders[i % tenders.length];
    const onAccount = bulk && customerId === 'CUS-041' && age < 8;
    return {
      no: '#' + (first + i), at: d.at, customerId, channel, status, lines: d.lines,
      payments: onAccount ? [] : [{ tender: bulk ? 'UPI' : tender, amount: total }],
      cashier: ['Priya S.', 'Rahul M.', 'Priya S.', 'Dev K.'][i % 4], shipment,
    };
  });

  TODAY_ORDERS.forEach((o) => {
    const lines = o.lines.map(([s, q]) => line(s, q));
    out.push({
      no: '#' + o.no, at: iso(0, o.hh, o.mm), customerId: 'CUS-000', channel: 'POS', status: 'Completed', lines,
      payments: [{ tender: o.tender, amount: orderTotal(lines) }], cashier: 'Priya S.',
    });
  });
  return out;
}
export const ORDERS: Order[] = buildOrders();
export const FIRST_NEW_SALE = 4822;

/* ---------- purchase orders ---------- */
const pol = (sku: string, q: number, received = 0) => ({ sku, qty: q, unitCost: productBySku(sku).cost, received });
export const PURCHASE_ORDERS: PurchaseOrder[] = [
  { no: 'PO-0176', supplierId: 'SUP-02', status: 'Received', date: dateOnly(22), expected: dateOnly(14), lines: [pol('SKU-1042', 120, 120), pol('SKU-1043', 80, 80)] },
  { no: 'PO-0179', supplierId: 'SUP-03', status: 'Ordered', date: dateOnly(15), expected: dateOnly(4), lines: [pol('SKU-5010', 40)], note: 'Supplier confirmed dispatch on the 18th. No tracking received.' },
  { no: 'PO-0182', supplierId: 'SUP-01', status: 'Received', date: dateOnly(10), expected: dateOnly(7), lines: [pol('SKU-5003', 60, 58)], note: '2 units arrived damaged and are held back from stock.' },
  { no: 'PO-0183', supplierId: 'SUP-01', status: 'Ordered', date: dateOnly(4), expected: dateOnly(-4), lines: [pol('SKU-4120', 200)] },
  { no: 'PO-0184', supplierId: 'SUP-01', status: 'Draft', date: dateOnly(0), lines: [pol('SKU-2081', 60), pol('SKU-5002', 36)] },
];
export const SUPPLIER_PAYMENTS: SupplierPayment[] = [
  { id: 'SP-0031', supplierId: 'SUP-01', date: dateOnly(18), amount: rupees(18400), mode: 'bank', ref: 'NEFT 4417082' },
  { id: 'SP-0034', supplierId: 'SUP-02', date: dateOnly(9), amount: rupees(59850), mode: 'bank', ref: 'NEFT 4420931', poNo: 'PO-0176' },
  { id: 'SP-0035', supplierId: 'SUP-01', date: dateOnly(6), amount: rupees(6000), mode: 'UPI', ref: 'UPI 8821907', poNo: 'PO-0182' },
  { id: 'SP-0036', supplierId: 'SUP-05', date: dateOnly(3), amount: rupees(15000), mode: 'bank', ref: 'NEFT 4424456' },
];
export const EXPENSES: Expense[] = [
  { id: 'EX-0211', date: dateOnly(1), category: 'Rent', payee: 'Residency Road Properties', amount: rupees(52000), mode: 'bank', note: 'October rent, Main Store' },
  { id: 'EX-0212', date: dateOnly(2), category: 'Utilities', payee: 'TSSPDCL', amount: rupees(6480), mode: 'UPI', note: 'Electricity, September bill' },
  { id: 'EX-0213', date: dateOnly(4), category: 'Packaging', payee: 'Pack & Co.', amount: rupees(3120), mode: 'cash', note: 'Carry bags and mailer boxes' },
  { id: 'EX-0214', date: dateOnly(7), category: 'Salaries', payee: 'Payroll, 4 staff', amount: rupees(78000), mode: 'bank', note: 'September payroll' },
  { id: 'EX-0215', date: dateOnly(11), category: 'Marketing', payee: 'Meta Ads', amount: rupees(4500), mode: 'card', note: 'Festive offer campaign' },
  { id: 'EX-0216', date: dateOnly(16), category: 'Repairs', payee: 'CoolAir Services', amount: rupees(1850), mode: 'cash', note: 'Store AC service' },
];

export const QUOTATIONS: Quotation[] = [
  { no: 'QT-0041', date: dateOnly(6), validUntil: dateOnly(-8), customerId: 'CUS-033', status: 'sent', lines: [line('SKU-3311', 24), line('SKU-3310', 48)] },
  { no: 'QT-0042', date: dateOnly(3), validUntil: dateOnly(-11), customerId: 'CUS-041', status: 'accepted', lines: [line('SKU-3312', 30), line('SKU-7001', 40)] },
  { no: 'QT-0043', date: dateOnly(1), validUntil: dateOnly(-13), customerId: 'CUS-037', status: 'draft', lines: [line('SKU-4121', 100), line('SKU-4120', 120)] },
  { no: 'QT-0038', date: dateOnly(34), validUntil: dateOnly(20), customerId: 'CUS-037', status: 'expired', lines: [line('SKU-4120', 80)] },
];

/* ---------- stock movements: opening + sales + receipts + adjustments, summing to the stock above ---------- */
export function buildMovements(): StockMovement[] {
  const m: StockMovement[] = [];
  let n = 1;
  const add = (x: Omit<StockMovement, 'id'>) => m.push({ id: 'MV-' + String(n++).padStart(4, '0'), ...x });

  ORDERS.forEach((o) => {
    if (o.status === 'Draft' || o.status === 'Cancelled') return;
    o.lines.forEach((l) => add({ at: o.at, sku: l.sku, delta: -l.qty, type: 'sale', ref: 'Sale ' + o.no, by: o.cashier }));
  });
  ORDERS.filter((o) => o.status === 'Returned').forEach((o) => {
    o.lines.forEach((l) => add({ at: o.at.replace(/T.*/, 'T17:10:00'), sku: l.sku, delta: l.qty, type: 'return', ref: 'Return ' + o.no, by: 'Dev K.' }));
  });
  PURCHASE_ORDERS.filter((p) => p.status === 'Received').forEach((p) => {
    p.lines.forEach((l) => add({ at: p.expected ? p.expected + 'T10:15:00' : p.date + 'T10:15:00', sku: l.sku, delta: l.received, type: 'receipt', ref: p.no, by: 'Dev K.' }));
  });
  add({ at: iso(5, 16, 40), sku: 'SKU-3312', delta: -2, type: 'adjustment', ref: 'ADJ-0007', by: 'Rahul M.', reason: 'Broken in display' });
  add({ at: iso(11, 15, 5), sku: 'SKU-1042', delta: 3, type: 'adjustment', ref: 'ADJ-0006', by: 'Rahul M.', reason: 'Count correction after stocktake' });
  add({ at: iso(8, 12, 30), sku: 'SKU-5003', delta: -2, type: 'adjustment', ref: 'ADJ-0005', by: 'Dev K.', reason: 'Damaged on arrival, PO-0182' });

  // opening balance 30+ days back so each SKU's movements sum to the stock on hand today
  const sum: Record<string, number> = {};
  m.forEach((x) => { sum[x.sku] = (sum[x.sku] ?? 0) + x.delta; });
  PRODUCTS.forEach((p) => {
    const t = TOTALS[p.sku].total;
    const opening = t - (sum[p.sku] ?? 0);
    add({ at: iso(60, 8, 0), sku: p.sku, delta: opening, type: 'opening', ref: 'Opening balance', by: 'System' });
  });
  return m.sort((a, b) => a.at.localeCompare(b.at)).map((x, i) => ({ ...x, id: 'MV-' + String(i + 1).padStart(4, '0') }));
}
export const MOVEMENTS: StockMovement[] = buildMovements();

/* ---------- serials and batches ---------- */
export interface SerialRec { serial: string; sku: string; state: 'in_stock' | 'sold'; orderNo?: string; soldAt?: string; warrantyMonths: number }
export interface BatchRec { batch: string; sku: string; expiry: string; qty: number }
export function buildSerials(): SerialRec[] {
  const out: SerialRec[] = [];
  (['SKU-2081', 'SKU-5010'] as const).forEach((sku, si) => {
    const prefix = si === 0 ? 'NW-EB-26' : 'NW-PB-26';
    let k = 1000;
    ORDERS.filter((o) => o.lines.some((l) => l.sku === sku)).forEach((o) => {
      o.lines.filter((l) => l.sku === sku).forEach((l) => {
        for (let i = 0; i < l.qty; i++) out.push({ serial: prefix + '-' + String(++k).padStart(5, '0'), sku, state: 'sold', orderNo: o.no, soldAt: o.at, warrantyMonths: si === 0 ? 12 : 6 });
      });
    });
    const onHand = TOTALS[sku].total;
    for (let i = 0; i < onHand; i++) out.push({ serial: prefix + '-' + String(++k).padStart(5, '0'), sku, state: 'in_stock', warrantyMonths: si === 0 ? 12 : 6 });
  });
  return out;
}
export const SERIALS: SerialRec[] = buildSerials();
export const BATCHES: BatchRec[] = [
  { batch: 'HT2606-A', sku: 'SKU-7001', expiry: '2026-12-12', qty: 20 },
  { batch: 'HT2608-B', sku: 'SKU-7001', expiry: '2027-05-18', qty: 38 },
  { batch: 'HT2610-C', sku: 'SKU-7001', expiry: '2027-09-30', qty: 30 },
];

/* ---------- team, cashiers, terminals ---------- */
export const MEMBERS: Member[] = [
  { id: 'U-01', name: 'Ameen Ali', email: 'ameen@morrowgoods.example', role: 'admin', status: 'active', lastActive: 'Today, 11:20' },
  { id: 'U-02', name: 'Farah Siddiqui', email: 'farah@morrowgoods.example', role: 'manager', status: 'active', lastActive: 'Today, 10:02' },
  { id: 'U-03', name: 'Dev Kumar', email: 'dev@morrowgoods.example', role: 'warehouse_staff', status: 'active', lastActive: 'Yesterday, 18:40' },
  { id: 'U-04', name: 'Priya Sharma', email: 'priya@morrowgoods.example', role: 'pos_operator', status: 'active', lastActive: 'Today, 11:26' },
  { id: 'U-05', name: 'Rahul Menon', email: 'rahul@morrowgoods.example', role: 'pos_operator', status: 'invited', lastActive: 'Never' },
];
export const CASHIERS: Cashier[] = [
  { id: 'CSH-1', name: 'Priya S.', pin: '••••', status: 'active', lastShift: 'Today, from 08:30', terminal: 'Till 2' },
  { id: 'CSH-2', name: 'Rahul M.', pin: '••••', status: 'active', lastShift: 'Yesterday, 14:00 to 21:30', terminal: 'Till 1' },
  { id: 'CSH-3', name: 'Dev K.', pin: '••••', status: 'active', lastShift: '22 Oct, 09:00 to 17:00', terminal: 'Till 1' },
  { id: 'CSH-4', name: 'Isha T.', pin: '••••', status: 'disabled', lastShift: '2 Oct, 10:00 to 18:00', terminal: '—' },
];
export const TERMINALS: Terminal[] = [
  { id: 'TRM-1', name: 'Till 1', location: 'Main Store', status: 'active', lastSeen: '2 min ago', issued: dateOnly(120), offlineQueue: 0 },
  { id: 'TRM-2', name: 'Till 2', location: 'Main Store', status: 'active', lastSeen: 'Live now', issued: dateOnly(120), offlineQueue: 0 },
  { id: 'TRM-3', name: 'Pop-up kiosk', location: 'Main Store', status: 'revoked', lastSeen: '41 days ago', issued: dateOnly(75), offlineQueue: 0 },
];

/* ---------- ledger ---------- */
export const ACCOUNTS: Account[] = [
  { code: '1000', name: 'Cash in hand', type: 'Asset' },
  { code: '1010', name: 'Bank, HDFC current account', type: 'Asset' },
  { code: '1100', name: 'Accounts receivable', type: 'Asset' },
  { code: '1200', name: 'Inventory', type: 'Asset' },
  { code: '1300', name: 'GST input credit', type: 'Asset' },
  { code: '2000', name: 'Accounts payable', type: 'Liability' },
  { code: '2100', name: 'GST output payable', type: 'Liability' },
  { code: '3000', name: 'Owner capital', type: 'Equity' },
  { code: '4000', name: 'Sales', type: 'Income' },
  { code: '5000', name: 'Cost of goods sold', type: 'Expense' },
  { code: '6000', name: 'Rent', type: 'Expense' },
  { code: '6100', name: 'Salaries', type: 'Expense' },
  { code: '6200', name: 'Utilities and other', type: 'Expense' },
];

/* ---------- audit trail ---------- */
export const AUDIT: AuditEntry[] = [
  { id: 'AU-9051', at: iso(0, 11, 20), actor: 'Ameen Ali', action: 'login', entity: 'session', ref: 'web', detail: 'Signed in from Hyderabad' },
  { id: 'AU-9050', at: iso(0, 10, 31), actor: 'Priya S.', action: 'order.pay', entity: 'order', ref: '#4821', detail: 'UPI payment recorded' },
  { id: 'AU-9049', at: iso(0, 9, 48), actor: 'Priya S.', action: 'order.pay', entity: 'order', ref: '#4819', detail: 'UPI payment recorded' },
  { id: 'AU-9048', at: iso(1, 18, 5), actor: 'Dev K.', action: 'stock.adjust', entity: 'variant', ref: 'SKU-3312', detail: 'Reason: Broken in display (−2)' },
  { id: 'AU-9047', at: iso(1, 12, 14), actor: 'Farah Siddiqui', action: 'po.create', entity: 'purchase_order', ref: 'PO-0184', detail: 'Draft with 2 lines, Aster Wholesale' },
  { id: 'AU-9046', at: iso(2, 16, 2), actor: 'Ameen Ali', action: 'user.invite', entity: 'user', ref: 'rahul@morrowgoods.example', detail: 'Invited as pos_operator' },
  { id: 'AU-9045', at: iso(3, 10, 40), actor: 'Farah Siddiqui', action: 'supplier.payment', entity: 'supplier', ref: 'SUP-05', detail: 'Payment of ₹15,000 recorded' },
  { id: 'AU-9044', at: iso(4, 14, 10), actor: 'Ameen Ali', action: 'settings.update', entity: 'settings', ref: 'taxes', detail: 'Default GST slab changed to 18%' },
  { id: 'AU-9043', at: iso(6, 9, 3), actor: 'SiBorg (approved by Farah Siddiqui)', action: 'proposal.approve', entity: 'agent_proposal', ref: 'PRP-117', detail: 'Reorder draft created for Aster Wholesale' },
  { id: 'AU-9042', at: iso(8, 12, 30), actor: 'Dev K.', action: 'stock.adjust', entity: 'variant', ref: 'SKU-5003', detail: 'Reason: Damaged on arrival (−2)' },
];

/* ---------- SiBorg proposals ---------- */
export const PROPOSALS: Proposal[] = [
  {
    id: 'PRP-121', sessionId: 'sess-4a2', title: 'Reorder Wireless earbuds and LED desk lamp',
    reasoning: 'Earbuds are at 14 units against a reorder point of 15 and sold 61 in 30 days, about 2 a day, so cover is roughly 7 days. The LED desk lamp is at 9 against 12 with 24 sold. Both come from Aster Wholesale, whose draft PO-0184 already exists but has not been placed.',
    basis: ['SKU-2081 on hand 14, reorder point 15', 'SKU-5002 on hand 9, reorder point 12', 'PO-0184 is still a draft', 'Aster Wholesale minimum is 30 per line'],
    actions: [
      { id: 'a1', label: 'Place PO-0184 with Aster Wholesale', detail: '60 × Wireless earbuds, 36 × LED desk lamp. Changes the PO from Draft to Ordered.' },
      { id: 'a2', label: 'Notify Farah Siddiqui', detail: 'Internal reminder to confirm delivery by 31 Oct.' },
    ],
    state: 'proposed',
    effect: { kind: 'placePo', no: 'PO-0184' },
  },
  {
    id: 'PRP-120', sessionId: 'sess-4a1', title: 'Mark down Ceramic mug and Canvas tote bag',
    reasoning: 'Neither product has sold in over 60 days and together they hold about ₹41,000 of stock at cost. A time-limited 20% markdown would free shelf space on A and B before the festive restock.',
    basis: ['SKU-3310 last sold 63 days ago, 212 on hand', 'SKU-6001 last sold 71 days ago, 77 on hand'],
    actions: [{ id: 'a1', label: 'Create a 20% price-list entry for both SKUs', detail: 'Valid until 15 Nov. Prices revert automatically.' }],
    state: 'proposed',
  },
  {
    id: 'PRP-117', sessionId: 'sess-3f9', title: 'Create reorder draft for Aster Wholesale',
    reasoning: 'USB-C cable stock dipped under cover for the festive weekend.',
    basis: ['SKU-5003 sold 88 in 30 days'],
    actions: [{ id: 'a1', label: 'Create draft PO', detail: 'Draft only. Needs a manager to place it.' }],
    state: 'approved', decidedAt: iso(6, 9, 3), decidedBy: 'Farah Siddiqui',
  },
];

/* ---------- alerts: derived from live stock in the store, plus these non-stock ones ---------- */
export const STATIC_ALERTS: Alert[] = [
  { id: 'AL-PO-0179', kind: 'overdue_po', severity: 'high', title: 'PO-0179 is 4 days overdue', detail: 'Northline Electronics promised 40 Power bank 10000 mAh by 20 Oct. No tracking number has been shared.', ref: 'PO-0179', sku: 'SKU-5010', at: iso(0, 7, 0), acknowledged: false },
  { id: 'AL-EXP-HT2606', kind: 'expiry', severity: 'medium', title: 'Herbal tea batch HT2606-A expires 12 Dec', detail: '20 boxes in this batch expire in 49 days. Sell it first or return it to Hearth & Co.', sku: 'SKU-7001', at: iso(0, 7, 0), acknowledged: false },
  { id: 'AL-RTO-DL7041074', kind: 'rto', severity: 'medium', title: 'Shipment DL7041074 is trending to return', detail: 'Two failed delivery attempts. A non-delivery report has been raised with Shiprocket.', at: iso(1, 17, 30), acknowledged: false },
  { id: 'AL-BRK-TSHIRT', kind: 'broken_assortment', severity: 'low', title: 'Cotton T-shirt range is missing a size run', detail: 'M and L are stocked but XL is down to 54 against a sales share of 20%.', sku: 'SKU-1044', at: iso(2, 8, 0), acknowledged: true },
];

export const PRODUCT_CATEGORIES = Array.from(new Set(PRODUCTS.map((p) => p.category)));

export interface CategoryRec { id: string; name: string; note: string }
export interface ProductTypeRec { id: string; name: string; unit: 'pcs' | 'box' | 'set' | 'pack'; attributes: string[] }
export const CATEGORIES: CategoryRec[] = [
  { id: 'CAT-1', name: 'Apparel', note: 'Garments and carry bags' },
  { id: 'CAT-2', name: 'Electronics', note: 'Audio, lighting and accessories' },
  { id: 'CAT-3', name: 'Home', note: 'Kitchen and storage' },
  { id: 'CAT-4', name: 'Stationery', note: 'Paper goods and writing' },
  { id: 'CAT-5', name: 'Grocery', note: 'Packaged food with batch and expiry' },
];
export const PRODUCT_TYPES: ProductTypeRec[] = [
  { id: 'PT-1', name: 'Garment', unit: 'pcs', attributes: ['Size', 'Colour', 'Fabric'] },
  { id: 'PT-2', name: 'Audio', unit: 'pcs', attributes: ['Model', 'Connectivity', 'Warranty (months)'] },
  { id: 'PT-3', name: 'Kitchenware', unit: 'pcs', attributes: ['Material', 'Capacity'] },
  { id: 'PT-4', name: 'Paper goods', unit: 'pcs', attributes: ['Pages', 'Ruling'] },
  { id: 'PT-5', name: 'Writing', unit: 'pack', attributes: ['Ink colour', 'Tip size'] },
  { id: 'PT-6', name: 'Lighting', unit: 'pcs', attributes: ['Wattage', 'Colour temperature'] },
  { id: 'PT-7', name: 'Accessories', unit: 'pcs', attributes: ['Model', 'Length'] },
  { id: 'PT-8', name: 'Packaged food', unit: 'box', attributes: ['Net weight', 'Batch', 'Expiry'] },
];
