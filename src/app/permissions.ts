/**
 * Route gates, mirrored from the source frontend's config/permissions.ts (read-only reference).
 * The backend remains the authority; this only decides what the prototype shows.
 */
import type { Role } from '@/services/contracts/types';

const all: Role[] = ['admin', 'manager', 'warehouse_staff', 'pos_operator'];
const manager: Role[] = ['admin', 'manager'];
const warehouse: Role[] = ['admin', 'manager', 'warehouse_staff'];
const managerPos: Role[] = ['admin', 'manager', 'pos_operator'];
const admin: Role[] = ['admin'];

const rules: Array<{ paths: string[]; roles: Role[] }> = [
  { paths: ['/dashboard', '/help', '/orders', '/orders/:id', '/products', '/products/:id', '/products/:id/variants', '/variants/:id', '/agent/chat', '/briefing', '/warranty', '/settings/appearance'], roles: all },
  { paths: ['/pos', '/orders/new'], roles: managerPos },
  { paths: ['/categories', '/product-types', '/inventory', '/inventory/:id', '/alerts', '/purchase-orders', '/purchase-orders/:id', '/suppliers', '/quotations', '/quotations/:id', '/customers', '/catalog/search', '/barcodes', '/barcodes/generate', '/barcodes/bulk', '/barcodes/templates', '/barcodes/print', '/barcodes/scanner-test', '/barcodes/history', '/analytics/alerts-summary'], roles: warehouse },
  { paths: ['/action-center', '/campaigns', '/analytics', '/analytics/inventory-value', '/analytics/turnover', '/analytics/sales-summary', '/analytics/supplier-balance', '/supplier-payments', '/expenses', '/purchase-orders/new', '/suppliers/:id/balance', '/documents/extract', '/agent/proposals', '/agent/proposals/:id', '/settings/metal-rates'], roles: manager },
  { paths: ['/settings', '/settings/cashiers', '/settings/terminals', '/settings/billing', '/settings/integrations', '/audit-log', '/design-system', '/import', '/settings/items', '/settings/channels', '/settings/business', '/settings/users', '/settings/notifications', '/ledger', '/reports/financial-statements', '/gst/returns'], roles: admin },
];

const match = (pattern: string, path: string) => pattern === path || new RegExp('^' + pattern.replace(/:\w+/g, '[^/]+') + '$').test(path);
/** An exact path wins over a parameter pattern, so /orders/new is not swallowed by /orders/:id. */
export const allowedRoles = (path: string): Role[] =>
  (rules.find((r) => r.paths.includes(path)) ?? rules.find((r) => r.paths.some((p) => match(p, path))))?.roles ?? all;
export const canAccess = (role: Role, path: string) => allowedRoles(path).includes(role);

export const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', manager: 'Manager', warehouse_staff: 'Warehouse staff', pos_operator: 'POS operator' };
