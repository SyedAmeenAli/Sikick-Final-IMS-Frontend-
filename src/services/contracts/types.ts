/**
 * Typed data contracts for the redesign. Shapes follow the IMS backend
 * (see docs/API_INTEGRATION_MAP.md); money is integer paise in this layer.
 * Legacy backend identifiers (e.g. "AxBrain") never appear here: the UI says
 * SiBorg, and the future API adapter maps names at this boundary.
 */
import type { Paise } from '@/lib/money';

export type Role = 'admin' | 'manager' | 'warehouse_staff' | 'pos_operator';
export type Tracking = 'none' | 'batch' | 'serial';
export type Tender = 'cash' | 'UPI' | 'card';
export type Unit = 'pcs' | 'box' | 'set' | 'pack';

export interface Product {
  sku: string;
  name: string;
  category: string;
  type: string;
  brand: string;
  unit: Unit;
  hsn: string;
  gst: number;
  price: Paise;
  cost: Paise;
  reorderPoint: number;
  sold30: number;
  lastSaleDays: number;
  tracking: Tracking;
  barcode: string;
  supplierId: string;
  status: 'active' | 'archived';
  kind: 'box' | 'case' | 'mug' | 'bottle' | 'lamp';
}

/** The source keeps one on-hand figure per variant; there is no location, bin or transfer model. */
export interface StockLevel { onHand: number; reserved: number; damaged: number }

export type MovementType = 'sale' | 'receipt' | 'adjustment' | 'return' | 'opening';
export interface StockMovement {
  id: string;
  at: string; // ISO
  sku: string;
  delta: number;
  type: MovementType;
  ref: string;
  by: string;
  reason?: string;
}

export interface Supplier {
  id: string;
  name: string;
  gstin: string;
  contact: string;
  phone: string;
  city: string;
  terms: string;
  balance: Paise; // owed to supplier
  status: 'active' | 'disabled';
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  kind: 'retail' | 'business';
  gstin?: string;
  outstanding: Paise;
  lifetime: Paise;
  lastOrder: string;
  city: string;
}

export type PoStatus = 'Draft' | 'Ordered' | 'Received';
export interface PoLine { sku: string; qty: number; unitCost: Paise; received: number }
export interface PurchaseOrder {
  no: string;
  supplierId: string;
  status: PoStatus;
  date: string;
  expected?: string;
  lines: PoLine[];
  note?: string;
}

/** Backend enum, verified in docs/orders-api-map.md. */
export type OrderStatus = 'Draft' | 'Pending' | 'Paid' | 'Packed' | 'Shipped' | 'Delivered' | 'Completed' | 'Cancelled' | 'Returned' | 'Refunded';
export interface OrderLine { sku: string; qty: number; unit: Paise; gst: number; discount: Paise }
export interface Payment { tender: Tender; amount: Paise; ref?: string }
export interface Order {
  no: string;
  at: string;
  customerId: string;
  channel: 'POS' | 'Counter' | 'Online' | 'Wholesale';
  status: OrderStatus;
  lines: OrderLine[];
  payments: Payment[];
  cashier: string;
  shipment?: { carrier: string; awb: string; state: string };
}

export interface Quotation {
  no: string;
  date: string;
  validUntil: string;
  customerId: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';
  lines: OrderLine[];
}

export interface SupplierPayment { id: string; supplierId: string; date: string; amount: Paise; mode: 'bank' | 'UPI' | 'cash'; ref: string; poNo?: string }
export interface Expense { id: string; date: string; category: string; payee: string; amount: Paise; mode: string; note: string }

export type AlertKind = 'stockout' | 'low_stock' | 'overdue_po' | 'stagnant' | 'expiry' | 'broken_assortment' | 'rto';
export interface Alert {
  id: string;
  kind: AlertKind;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  sku?: string;
  ref?: string;
  at: string;
  acknowledged: boolean;
}

export interface AuditEntry { id: string; at: string; actor: string; action: string; entity: string; ref: string; detail: string }

export interface ProposalAction { id: string; label: string; detail: string }
/** What approving a proposal does. Nothing runs until a person approves. */
export type ProposalEffect = { kind: 'placePo'; no: string } | { kind: 'createPo'; supplierId: string; lines: Array<{ sku: string; qty: number }> } | { kind: 'none' };
export interface Proposal {
  effect?: ProposalEffect;
  id: string;
  sessionId: string;
  title: string;
  reasoning: string;
  basis: string[];
  actions: ProposalAction[];
  state: 'proposed' | 'approved' | 'rejected';
  decidedAt?: string;
  decidedBy?: string;
}

export interface Cashier { id: string; name: string; pin: string; status: 'active' | 'disabled'; lastShift: string; terminal: string }
export interface Terminal { id: string; name: string; location: string; status: 'active' | 'revoked'; lastSeen: string; issued: string; offlineQueue: number }
export interface Member { id: string; name: string; email: string; role: Role; status: 'active' | 'invited' | 'disabled'; lastActive: string }

export interface LedgerEntry { id: string; date: string; account: string; ref: string; memo: string; debit: Paise; credit: Paise }
export interface Account { code: string; name: string; type: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense' }
