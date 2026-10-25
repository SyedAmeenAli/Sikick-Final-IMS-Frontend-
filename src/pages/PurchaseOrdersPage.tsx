import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Block, Chip, Metric, Page, PageHeader, Panel, StatusChip } from '@/components/ui/primitives';
import { Tabs } from '@/components/ui/Tabs';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ArtTruck } from '@/components/illustrations';
import { fmt, fmtCompact } from '@/lib/money';
import { fmtDate } from '@/lib/format';
import { useIms } from '@/services';
import { poOverdueDays, poTotals, supplierOf } from '@/services/selectors';
import type { PurchaseOrder } from '@/services/contracts/types';

type T = 'all' | 'Draft' | 'Ordered' | 'overdue' | 'Received';

export default function PurchaseOrdersPage() {
  const s = useIms();
  const nav = useNavigate();
  const [tab, setTab] = useState<T>('all');
  const match = (p: PurchaseOrder, t: T) => (t === 'all' ? true : t === 'overdue' ? poOverdueDays(p) > 0 : p.status === t);
  const rows = [...s.purchaseOrders].filter((p) => match(p, tab)).sort((a, b) => b.date.localeCompare(a.date));
  const count = (t: T) => s.purchaseOrders.filter((p) => match(p, t)).length;
  const open = s.purchaseOrders.filter((p) => p.status !== 'Received').reduce((a, p) => a + poTotals(s, p).total, 0);

  const cols: Array<Column<PurchaseOrder>> = [
    { id: 'n', header: 'Order', primary: true, sort: (p) => p.no, cell: (p) => <span className="cell-main mono">{p.no}</span> },
    { id: 's', header: 'Supplier', sort: (p) => supplierOf(s, p.supplierId).name, cell: (p) => supplierOf(s, p.supplierId).name },
    { id: 'd', header: 'Raised', sort: (p) => p.date, cell: (p) => fmtDate(p.date) },
    { id: 'e', header: 'Expected', cell: (p) => { const late = poOverdueDays(p); return p.expected ? <span>{fmtDate(p.expected)}{late > 0 && <Chip tone="bad" plain> {late}d late</Chip>}</span> : '—'; } },
    { id: 'l', header: 'Lines', num: true, cell: (p) => p.lines.length },
    { id: 't', header: 'Total', num: true, sort: (p) => poTotals(s, p).total, cell: (p) => fmt(poTotals(s, p).total) },
    { id: 'x', header: 'Status', cell: (p) => <StatusChip status={p.status} /> },
  ];

  return (
    <Page>
      <PageHeader title="Purchase orders" sub="Raise an order, place it with the supplier, then receive the goods into stock." actions={<Link className="btn btn-primary" to="/purchase-orders/new"><Plus />New purchase order</Link>} />
      <Block className="grid c4 keep2">
        <Metric label="Open orders" num={{ value: count('Draft') + count('Ordered'), format: { kind: 'int' } }} foot={fmtCompact(open) + ' committed'} />
        <Metric label="Waiting for stock" num={{ value: count('Ordered'), format: { kind: 'int' } }} foot="placed with suppliers" />
        <Metric label="Overdue" num={{ value: count('overdue'), format: { kind: 'int' } }} foot="past the expected date" />
        <Metric label="Drafts" num={{ value: count('Draft'), format: { kind: 'int' } }} foot="not yet placed" />
      </Block>
      <div style={{ height: 16 }} />
      <Block><Panel flush>
        <Tabs label="Order status" value={tab} onChange={setTab} tabs={[{ id: 'all', label: 'All', count: count('all') }, { id: 'Draft', label: 'Draft', count: count('Draft') }, { id: 'Ordered', label: 'Ordered', count: count('Ordered') }, { id: 'overdue', label: 'Overdue', count: count('overdue') }, { id: 'Received', label: 'Received', count: count('Received') }]} />
        <DataTable label="Purchase orders" rows={rows} rowKey={(p) => p.no} columns={cols} onRowClick={(p) => nav('/purchase-orders/' + p.no)} searchText={(p) => p.no + ' ' + supplierOf(s, p.supplierId).name} searchPlaceholder="Search orders or suppliers" empty={{ title: 'No orders here', body: 'Nothing matches this status.', art: <ArtTruck /> }} />
      </Panel></Block>
    </Page>
  );
}
