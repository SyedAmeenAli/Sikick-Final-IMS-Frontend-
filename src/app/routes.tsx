import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

interface R { path: string; Page: LazyExoticComponent<ComponentType>; preload: () => Promise<unknown> }
type Loader = () => Promise<{ default: ComponentType }>;
/** Each route is its own chunk. preload() lets the shell warm them when idle so a first visit does not wait on the network. */
const r = (path: string, load: Loader): R => { let p: Promise<{ default: ComponentType }> | undefined; const once = () => (p ??= load()); return { path, Page: lazy(once), preload: once }; };
/** For files that export several route components by name. */
const n = <M extends Record<string, unknown>>(path: string, load: () => Promise<M>, name: keyof M): R => r(path, () => load().then((m) => ({ default: m[name] as ComponentType })));

const barcodes = () => import('@/pages/BarcodePages');
const suppliers = () => import('@/pages/SupplierPages');
const quotes = () => import('@/pages/QuotationPages');
const finance = () => import('@/pages/FinancePages');
const analytics = () => import('@/pages/AnalyticsPages');
const insight = () => import('@/pages/InsightPages');
const siborg = () => import('@/pages/SiBorgPages');
const settings = () => import('@/pages/SettingsPages');
const system = () => import('@/pages/SystemPages');
const onboarding = () => import('@/pages/auth/OnboardingPages');
const trial = () => import('@/pages/TrialPages');

/** Same paths as the source app so a future integration can swap pages one for one. See docs/SCREEN_ROUTE_MAP.md. */
export const ROUTES: R[] = [
  r('/dashboard', () => import('@/pages/DashboardPage')),
  r('/trial-ended', () => import('@/pages/TrialPages')),
  n('/account/export', trial, 'ExportPage'),
  r('/pos', () => import('@/pages/PosPage')),

  r('/products', () => import('@/pages/ProductsPage')),
  r('/products/:productId', () => import('@/pages/ProductDetailPage')),
  r('/products/:productId/variants', () => import('@/pages/ProductVariantsPage')),
  r('/variants/:variantId', () => import('@/pages/VariantDetailPage')),
  r('/categories', () => import('@/pages/CategoriesPage')),
  r('/product-types', () => import('@/pages/ProductTypesPage')),
  r('/catalog/search', () => import('@/pages/CatalogSearchPage')),
  n('/barcodes', barcodes, 'BarcodeOverview'),
  n('/barcodes/generate', barcodes, 'BarcodeGenerate'),
  n('/barcodes/bulk', barcodes, 'BarcodeBulk'),
  n('/barcodes/templates', barcodes, 'BarcodeTemplates'),
  n('/barcodes/print', barcodes, 'BarcodePrint'),
  n('/barcodes/scanner-test', barcodes, 'BarcodeScannerTest'),
  n('/barcodes/history', barcodes, 'BarcodeHistory'),

  r('/inventory', () => import('@/pages/InventoryPage')),
  r('/inventory/:variantId', () => import('@/pages/InventoryDetailPage')),
  r('/alerts', () => import('@/pages/AlertsPage')),
  r('/warranty', () => import('@/pages/WarrantyPage')),

  r('/purchase-orders', () => import('@/pages/PurchaseOrdersPage')),
  r('/purchase-orders/new', () => import('@/pages/PurchaseOrderNewPage')),
  r('/purchase-orders/:id', () => import('@/pages/PurchaseOrderDetailPage')),
  r('/suppliers', () => import('@/pages/SupplierPages').then((m) => ({ default: m.SuppliersPage }))),
  n('/suppliers/:id/balance', suppliers, 'SupplierBalancePage'),
  n('/supplier-payments', suppliers, 'SupplierPaymentsPage'),

  r('/orders', () => import('@/pages/OrdersPage')),
  r('/orders/new', () => import('@/pages/OrderNewPage')),
  r('/orders/:id', () => import('@/pages/OrderDetailPage')),
  n('/quotations', quotes, 'QuotationsPage'),
  n('/quotations/:id', quotes, 'QuotationDetailPage'),
  r('/customers', () => import('@/pages/CustomersPage')),

  n('/expenses', finance, 'ExpensesPage'),
  n('/ledger', finance, 'LedgerPage'),
  n('/reports/financial-statements', finance, 'StatementsPage'),
  n('/gst/returns', finance, 'GstReturnsPage'),

  n('/analytics', analytics, 'AnalyticsLanding'),
  n('/analytics/sales-summary', analytics, 'SalesSummary'),
  n('/analytics/inventory-value', analytics, 'InventoryValue'),
  n('/analytics/turnover', analytics, 'Turnover'),
  n('/analytics/alerts-summary', analytics, 'AlertsSummary'),
  n('/analytics/supplier-balance', analytics, 'SupplierBalances'),
  n('/briefing', insight, 'BriefingPage'),
  n('/action-center', insight, 'ActionCenterPage'),
  n('/campaigns', insight, 'CampaignsPage'),

  n('/agent/chat', siborg, 'SiBorgPage'),
  n('/agent/proposals', siborg, 'ProposalsPage'),
  n('/agent/proposals/:sessionId', siborg, 'ProposalsPage'),
  n('/documents/extract', siborg, 'DocumentExtractPage'),

  n('/settings', settings, 'SettingsHub'),
  n('/settings/business', settings, 'BusinessSettingsPage'),
  n('/settings/users', settings, 'UsersPage'),
  n('/settings/items', settings, 'ItemSettingsPage'),
  n('/settings/metal-rates', settings, 'MetalRatesPage'),
  n('/settings/channels', settings, 'ChannelsPage'),
  n('/settings/cashiers', settings, 'CashiersPage'),
  n('/settings/terminals', settings, 'TerminalsPage'),
  n('/settings/integrations', settings, 'IntegrationsPage'),
  n('/settings/notifications', settings, 'NotificationsPage'),
  n('/settings/billing', settings, 'BillingPage'),
  n('/settings/appearance', settings, 'AppearancePage'),
  n('/import', system, 'ImportPage'),
  n('/audit-log', system, 'AuditLogPage'),
  n('/help', system, 'HelpPage'),
  n('/design-system', system, 'DesignSystemPage'),
];

/** Outside the tenant shell: sign-in screens and the operator console. */
export const STANDALONE: R[] = [
  r('/login', () => import('@/pages/auth/LoginPage')),
  r('/signup', () => import('@/pages/auth/SignupPage')),
  r('/verify-email', () => import('@/pages/auth/VerifyEmailPage')),
  r('/reset-password', () => import('@/pages/auth/ResetPasswordPage')),
  n('/onboarding/start', onboarding, 'OnboardingStart'),
  n('/onboarding/business', onboarding, 'OnboardingBusiness'),
  n('/onboarding/sells', onboarding, 'OnboardingSells'),
  n('/onboarding/catalogue', onboarding, 'OnboardingCatalogue'),
  n('/onboarding/team', onboarding, 'OnboardingTeam'),
  n('/onboarding/review', onboarding, 'OnboardingReview'),
  n('/onboarding/done', onboarding, 'OnboardingDone'),
  r('/platform-admin', () => import('@/pages/PlatformAdminPage')),
];
