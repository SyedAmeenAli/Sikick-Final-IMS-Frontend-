import {
  LayoutDashboard, Package, Boxes, ShoppingCart, Receipt, Users, Contact, Landmark, LineChart, Sparkles, Store,
  FolderTree, Tags, Search, Barcode, Bell, ScanLine, FilePlus2, CreditCard, Banknote, FileText, BookOpen, Scale, FileSpreadsheet,
  Sun, Megaphone, Activity, CheckCircle2, FileSearch, Settings, Blocks, Upload, KeyRound, Smartphone, ClipboardList, HelpCircle, Palette,
  SlidersHorizontal, Coins, Radio, ReceiptText, type LucideIcon,
} from 'lucide-react';

export interface NavLeaf { to: string; label: string; desc?: string; icon: LucideIcon }
export interface NavGroup { label: string; items: NavLeaf[] }
export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** a plain link when there is no menu */
  to?: string;
  groups?: NavGroup[];
  /** path prefixes that mark this item active */
  match: string[];
  emphasis?: boolean;
}

export const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard', match: ['/dashboard'] },
  {
    id: 'catalogue', label: 'Catalogue', icon: Package, match: ['/products', '/variants', '/categories', '/product-types', '/catalog', '/barcodes'],
    groups: [
      { label: 'Products', items: [
        { to: '/products', label: 'Products', desc: 'SKUs, variants, prices', icon: Package },
        { to: '/categories', label: 'Categories', desc: 'How the catalogue is organised', icon: FolderTree },
        { to: '/product-types', label: 'Product types', desc: 'Attribute sets and units', icon: Tags },
        { to: '/catalog/search', label: 'Catalogue search', desc: 'Find by name, SKU or look', icon: Search },
      ] },
      { label: 'Labels', items: [{ to: '/barcodes', label: 'Barcode Center', desc: 'Generate, queue and print labels', icon: Barcode }] },
    ],
  },
  {
    id: 'inventory', label: 'Inventory', icon: Boxes, match: ['/inventory', '/alerts', '/warranty'],
    groups: [{ label: 'Stock', items: [
      { to: '/inventory', label: 'Inventory', desc: 'On hand, reserved, damaged', icon: Boxes },
      { to: '/alerts', label: 'Alerts', desc: 'Stockouts, low stock, expiry', icon: Bell },
      { to: '/warranty', label: 'Warranty lookup', desc: 'Find a sale from a serial', icon: ScanLine },
    ] }],
  },
  { id: 'pos', label: 'POS', icon: Store, to: '/pos', match: ['/pos'], emphasis: true },
  {
    id: 'purchasing', label: 'Purchasing', icon: Receipt, match: ['/purchase-orders', '/supplier-payments'],
    groups: [{ label: 'Buying', items: [
      { to: '/purchase-orders', label: 'Purchase orders', desc: 'Raise, place and receive', icon: Receipt },
      { to: '/purchase-orders/new', label: 'New purchase order', desc: 'Start a draft', icon: FilePlus2 },
      { to: '/supplier-payments', label: 'Supplier payments', desc: 'What was paid and when', icon: CreditCard },
    ] }],
  },
  {
    id: 'sales', label: 'Sales', icon: ShoppingCart, match: ['/orders', '/quotations'],
    groups: [{ label: 'Selling', items: [
      { to: '/orders', label: 'Orders', desc: 'Lifecycle from draft to delivered', icon: ShoppingCart },
      { to: '/orders/new', label: 'New order', desc: 'Counter or phone order', icon: FilePlus2 },
      { to: '/quotations', label: 'Quotations', desc: 'Send, accept, convert', icon: FileText },
    ] }],
  },
  { id: 'customers', label: 'Customers', icon: Contact, to: '/customers', match: ['/customers'] },
  { id: 'suppliers', label: 'Suppliers', icon: Users, to: '/suppliers', match: ['/suppliers'] },
  {
    id: 'finance', label: 'Finance & GST', icon: Landmark, match: ['/ledger', '/reports', '/gst', '/expenses'],
    groups: [{ label: 'Books', items: [
      { to: '/reports/financial-statements', label: 'Financial statements', desc: 'P&L, balance sheet, cash flow', icon: Scale },
      { to: '/ledger', label: 'Ledger', desc: 'Journal and trial balance', icon: BookOpen },
      { to: '/gst/returns', label: 'GST returns', desc: 'GSTR-1 and GSTR-3B', icon: FileSpreadsheet },
      { to: '/expenses', label: 'Expenses', desc: 'Rent, payroll, utilities', icon: Banknote },
    ] }],
  },
  {
    id: 'insights', label: 'Insights', icon: LineChart, match: ['/analytics', '/briefing', '/action-center', '/campaigns'],
    groups: [
      { label: 'Analytics', items: [
        { to: '/analytics', label: 'Analytics', desc: 'Sales, stock value, turnover', icon: LineChart },
        { to: '/briefing', label: 'Daily briefing', desc: 'What needs attention', icon: Sun },
      ] },
      { label: 'Act', items: [
        { to: '/action-center', label: 'Action Center', desc: 'Work waiting for you', icon: Activity },
        { to: '/campaigns', label: 'Campaigns', desc: 'Offers and outreach', icon: Megaphone },
      ] },
    ],
  },
  {
    id: 'siborg', label: 'SiBorg', icon: Sparkles, match: ['/agent', '/documents'],
    groups: [{ label: 'Assistant', items: [
      { to: '/agent/chat', label: 'Ask SiBorg', desc: 'Questions about your business', icon: Sparkles },
      { to: '/agent/proposals', label: 'Approvals', desc: 'Proposals waiting for a decision', icon: CheckCircle2 },
      { to: '/documents/extract', label: 'Document extraction', desc: 'Read a supplier bill', icon: FileSearch },
    ] }],
  },
  {
    id: 'more', label: 'More', icon: Settings, match: ['/settings', '/import', '/audit-log', '/help', '/design-system'],
    groups: [
      { label: 'Workspace', items: [
        { to: '/settings', label: 'Settings', desc: 'Business, items, team', icon: Settings },
        { to: '/settings/integrations', label: 'Integrations', desc: 'Connected services', icon: Blocks },
        { to: '/import', label: 'Import data', desc: 'Bring products across', icon: Upload },
        { to: '/audit-log', label: 'Audit log', desc: 'Every write, attributed', icon: ClipboardList },
      ] },
      { label: 'Tills & team', items: [
        { to: '/settings/cashiers', label: 'Cashiers', desc: 'PINs and shifts', icon: KeyRound },
        { to: '/settings/terminals', label: 'Terminals', desc: 'Provisioned tills', icon: Smartphone },
        { to: '/settings/billing', label: 'Billing', desc: 'Plan and invoices', icon: Coins },
      ] },
      { label: 'Support', items: [
        { to: '/help', label: 'Help Center', desc: 'Guides and troubleshooting', icon: HelpCircle },
        { to: '/design-system', label: 'Design system', desc: 'Tokens and components', icon: Palette },
      ] },
    ],
  },
];

/** Settings sub-navigation, replacing the old vertical sidebar. */
export const SETTINGS_TABS: Array<{ to: string; label: string; icon: LucideIcon; end?: boolean }> = [
  { to: '/settings', label: 'Overview', icon: Settings, end: true },
  { to: '/settings/business', label: 'Business & tax', icon: ReceiptText },
  { to: '/settings/users', label: 'Team & roles', icon: Users },
  { to: '/settings/items', label: 'Item fields', icon: SlidersHorizontal },
  { to: '/settings/metal-rates', label: 'Metal rates', icon: Coins },
  { to: '/settings/channels', label: 'Sales channels', icon: Radio },
  { to: '/settings/cashiers', label: 'Cashiers', icon: KeyRound },
  { to: '/settings/terminals', label: 'Terminals', icon: Smartphone },
  { to: '/settings/integrations', label: 'Integrations', icon: Blocks },
  { to: '/settings/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings/billing', label: 'Billing', icon: Coins },
  { to: '/settings/appearance', label: 'Appearance & sound', icon: Palette },
];

export const flatNav = (): NavLeaf[] => NAV.flatMap((n) => (n.groups ? n.groups.flatMap((g) => g.items) : n.to ? [{ to: n.to, label: n.label, icon: n.icon }] : []));
export const isActive = (item: NavItem, path: string) => item.match.some((m) => path === m || path.startsWith(m + '/'));
