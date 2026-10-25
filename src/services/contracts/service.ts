import type { Paise } from '@/lib/money';
import type { AccountState, AuthService, OnboardingDraft } from './account';
import type { Scenario } from '../account';
import type {
  AuditEntry, Cashier, Customer, Expense, Member, Order, OrderLine, OrderStatus, Payment, Product,
  Proposal, ProposalEffect, PurchaseOrder, Quotation, Role, StockLevel, StockMovement, Supplier, SupplierPayment, Tender, Terminal,
} from './types';
import type { BatchRec, CategoryRec, ProductTypeRec, SerialRec } from '@/data/fixtures/seed';

/** Business settings, field-for-field from PATCH /settings/business. */
export interface BusinessSettings {
  auditLogRetentionMonths: number;
  taxRatePercent: number;
  sellerGstin: string;
  sellerStateCode: string;
  eInvoiceApplicable: boolean;
  eInvoiceAatoAbove10Cr: boolean;
  ewayBillThreshold: number;
  drugLicenceNumber: string;
}
/** Item-field settings, field-for-field from PATCH /settings/items. */
export interface ItemSettings {
  serial_no: boolean; batch_no: boolean; expiry_date: boolean; model_no: boolean; size: boolean; units_enabled: boolean;
  customFieldLabels: Array<{ label: string; scannable: boolean }>;
  visionProfile: 'general' | 'apparel' | 'electronics' | 'grocery';
}

export interface ImsState {
  version: number;
  role: Role;
  /** the theme in force (a 'system' preference resolves to one of these) */
  theme: 'light' | 'dark';
  themePref: 'light' | 'dark' | 'system';
  products: Product[];
  stock: Record<string, StockLevel>;
  movements: StockMovement[];
  orders: Order[];
  nextSale: number;
  suppliers: Supplier[];
  supplierPayments: SupplierPayment[];
  purchaseOrders: PurchaseOrder[];
  customers: Customer[];
  quotations: Quotation[];
  expenses: Expense[];
  ackedAlerts: string[];
  proposals: Proposal[];
  audit: AuditEntry[];
  members: Member[];
  cashiers: Cashier[];
  terminals: Terminal[];
  serials: SerialRec[];
  batches: BatchRec[];
  business: BusinessSettings;
  items: ItemSettings;
  categories: CategoryRec[];
  productTypes: ProductTypeRec[];
  barcodeQueue: Array<{ sku: string; copies: number }>;
  printHistory: Array<{ id: string; at: string; sku: string; copies: number; template: string; by: string }>;
  offline: { online: boolean; queued: number };
  /** Off by default. Held only for this session. */
  sound: { enabled: boolean; volume: number };
  assistantOpen: boolean;
  /** session, workspace, billing and trial: the single source every screen reads (see services/account.ts) */
  account: AccountState;
  /** bumped when a write is refused because the workspace is read-only, so the shell can say so once */
  blocked: { n: number; message: string };
}

export type Result<T = void> = { ok: true; value: T } | { ok: false; code: string; message: string };

export interface NewProduct { name: string; category: string; type: string; brand: string; unit: Product['unit']; hsn: string; gst: number; price: Paise; cost: Paise; reorderPoint: number; tracking: Product['tracking']; openingStock: number }
export interface CartLineInput { sku: string; qty: number }
export interface SaleInput {
  lines: CartLineInput[];
  discount: { kind: 'flat' | 'percent'; value: number } | null;
  customerId: string;
  tenders: Array<{ tender: Tender; amount: Paise }>;
  channel?: Order['channel'];
}
export interface SaleReceipt {
  order: Order;
  subtotal: Paise;
  discount: Paise;
  tax: Paise;
  total: Paise;
  tendered: Paise;
  change: Paise;
  serials: Array<{ sku: string; serial: string }>;
}

/**
 * Everything the UI may do. The local adapter mutates in-memory fixtures; the
 * future API adapter maps each command to the endpoint named in
 * docs/API_INTEGRATION_MAP.md. No component imports business rules directly.
 */
export interface ImsCommands {
  setRole(role: Role): void;
  setTheme(theme: 'light' | 'dark'): void;
  /** persist=false applies it for this visit only (used by ?theme= review links) */
  setThemePref(pref: 'light' | 'dark' | 'system', persist?: boolean): void;
  setSound(next: Partial<{ enabled: boolean; volume: number }>): void;
  setAssistantOpen(open: boolean): void;
  resetDemo(): void;
  /** PROTOTYPE-ONLY state controls (shown only with ?dev=1) */
  setTrialScenario(name: Scenario): void;
  shiftClock(days: number): void;
  saveOnboardingDraft(patch: Partial<OnboardingDraft>): void;
  /** applies the draft to the workspace through the same commands as Settings, then marks setup done */
  completeOnboarding(): Result;
  setOnline(online: boolean): void;
  /** Pushes sales rung while offline. Returns how many were synced. */
  syncQueued(): Result<number>;

  ringSale(input: SaleInput): Result<SaleReceipt>;
  createOrder(input: { customerId: string; channel: Order['channel']; lines: CartLineInput[]; discount: SaleInput['discount'] }): Result<string>;
  /** Draft to Pending reserves stock, paying deducts it, Returned restocks. Mirrors the backend lifecycle. */
  advanceOrder(no: string, to: OrderStatus): Result;
  recordPayment(no: string, payment: Payment): Result;

  /** eventType follows POST /inventory/adjust: ADJUSTMENT, DAMAGE or RETURN. Damage moves units from on-hand to the damaged bucket. */
  adjustStock(sku: string, delta: number, reason: string, eventType?: 'ADJUSTMENT' | 'DAMAGE' | 'RETURN'): Result;

  createPurchaseOrder(supplierId: string, lines: Array<{ sku: string; qty: number }>, note?: string): Result<string>;
  placePurchaseOrder(no: string): Result;
  receivePurchaseOrder(no: string, lines: Array<{ sku: string; received: number; damaged: number }>): Result;
  addSupplier(s: { name: string; contact: string; phone: string; city: string; terms: string; gstin: string }): Result<string>;
  recordSupplierPayment(supplierId: string, amount: Paise, mode: SupplierPayment['mode'], ref: string): Result;

  createQuotation(customerId: string, lines: OrderLine[]): Result<string>;
  convertQuotation(no: string): Result<string>;
  addExpense(e: Omit<Expense, 'id'>): Result;

  createProduct(input: NewProduct): Result<string>;
  updateProduct(sku: string, patch: Partial<Pick<Product, 'price' | 'cost' | 'reorderPoint' | 'status' | 'name' | 'hsn' | 'gst'>>): Result;
  /** Used by import undo. Refuses if the product has ever been sold or received. */
  removeProducts(skus: string[]): Result<number>;
  addCategory(name: string, note: string): Result;
  deleteCategory(id: string): Result;
  addProductType(name: string, attributes: string[]): Result;

  acknowledgeAlert(id: string): void;
  decideProposal(id: string, decision: 'approved' | 'rejected'): Result;
  /** SiBorg answered with a recommendation. It is stored as a proposal and nothing is executed. */
  proposeFromChat(p: { title: string; reasoning: string; basis: string[]; actions: Array<{ label: string; detail: string }>; effect: ProposalEffect }): Result<string>;

  saveBusinessSettings(next: BusinessSettings): Result;
  saveItemSettings(next: ItemSettings): Result;
  inviteMember(email: string, role: Role): Result;
  setMemberRole(id: string, role: Role): Result;
  setCashierStatus(id: string, status: Cashier['status']): void;
  revokeTerminal(id: string): void;

  queueLabels(sku: string, copies: number): void;
  clearLabelQueue(): void;
  printLabels(template: string): Result<number>;
}

export interface ImsService {
  getState(): ImsState;
  subscribe(listener: () => void): () => void;
  commands: ImsCommands;
  /** sign-in, sign-up, verification and recovery. Separate because the real service is asynchronous and unauthenticated. */
  auth: AuthService;
}
