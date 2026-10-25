/**
 * Future API adapter boundary. NOT connected: the redesign ships on the local
 * fixture adapter and makes no network request.
 *
 * To integrate, implement ImsService here. Reads become a cache that is filled
 * from the endpoints below and calls `listeners` on change; each command maps to
 * one endpoint. Legacy identifiers (AxBrain, AX Inventory) stay on the wire and
 * are renamed at this boundary only. Verify every row against the current route
 * file before wiring (see docs/API_INTEGRATION_MAP.md).
 */
import type { ImsService } from '../contracts/service';

export const COMMAND_ENDPOINTS = {
  ringSale: ['POST /orders', 'PATCH /orders/:id/confirm', 'PATCH /orders/:id/pay'],
  advanceOrder: ['PATCH /orders/:id/ship', 'PATCH /orders/:id/deliver', 'PATCH /orders/:id/return', 'PATCH /orders/:id/cancel'],
  adjustStock: ['POST /inventory/adjust'],
  createPurchaseOrder: ['POST /purchase-orders'],
  receivePurchaseOrder: ['PATCH /purchase-orders/:id/receive'],
  saveBusinessSettings: ['PATCH /settings/business'],
  saveItemSettings: ['PATCH /settings/items'],
  decideProposal: ['POST /agent/proposals/:id/approve', 'POST /agent/proposals/:id/reject'],
  recordSupplierPayment: ['POST /supplier-payments'],
  addExpense: ['POST /expenses'],
  convertQuotation: ['POST /quotations/:id/convert'],
  acknowledgeAlert: ['PATCH /alerts/:id/acknowledge'],
} as const;

export function createApiService(_baseUrl: string): ImsService {
  throw new Error('The API adapter is not connected. The redesign runs on the local fixture adapter.');
}
