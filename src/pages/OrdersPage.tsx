import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Block, Metric, Page, PageHeader, Panel, StatusChip } from '@/components/ui/primitives';
import { Tabs } from '@/components/ui/Tabs';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ArtTruck } from '@/components/illustrations';
import { fmt } from '@/lib/money';
import { fmtStamp } from '@/lib/format';
import { useIms } from '@/services';
import { customerOf, orderTotal } from '@/services/selectors';
import type { Order, OrderStatus } from '@/services/contracts/types';

type T = 'all' | 'open' | 'fulfil' | 'done' | 'returns';
const GROUP: Record<T, OrderStatus[]> = {
  all: [], open: ['Draft', 'Pending'], fulfil: ['Paid', 'Packed', 'Shipped'], done: ['Delivered', 'Completed'], returns: ['Returned', 'Refunded', 'Cancelled'],
};

export default function OrdersPage() {
  const s = useIms();
  const nav = useNavigate();
  const [tab, setTab] = useState<T>('all');
  const inTab = (o: Order, t: T) => t === 'all' || GROUP[t].includes(o.status);
  const rows = [...s.orders].reverse().filter((o) => inTab(o, tab));
  const count = (t: T) => s.orders.filter((o) => inTab(o, t)).length;
  const cols: Array<Column<Order>> = [
    { id: 'n', header: 'Order', primary: true, sort: (o) => Number(o.no.slice(1)), cell: (o) => <span className="cell-main mono">{o.no}</span> },
    { id: 'w', header: 'Placed', sort: (o) => o.at, cell: (o) => fmtStamp(o.at) },
    { id: 'c', header: 'Customer', cell: (o) => customerOf(s, o.customerId).name },
    { id: 'h', header: 'Channel', cell: (o) => o.channel },
    { id: 'i', header: 'Items', num: true, cell: (o) => o.lines.reduce((a, l) => a + l.qty, 0) },
    { id: 't', header: 'Total', num: true, sort: (o) => orderTotal(o), cell: (o) => <b>{fmt(orderTotal(o))}</b> },
    { id: 's', header: 'Status', cell: (o) => <StatusChip status={o.status} /> },
  ];
  return (
    <Page>
      <PageHeader title="Orders" sub="Every sale from the till, the counter and online. An order moves from draft to delivered, and stock follows." actions={<Link className="btn btn-primary" to="/orders/new"><Plus />New order</Link>} />
      <Block className="grid c4 keep2">
        <Metric label="Orders, all time" num={{ value: s.orders.length, format: { kind: 'int' } }} foot="since the history began" />
        <Metric label="Awaiting payment" num={{ value: count('open'), format: { kind: 'int' } }} foot="draft or pending" />
        <Metric label="Being fulfilled" num={{ value: count('fulfil'), format: { kind: 'int' } }} foot="paid, packed or shipped" />
        <Metric label="Value of open orders" num={{ value: s.orders.filter((o) => GROUP.open.includes(o.status)).reduce((a, o) => a + orderTotal(o), 0), format: { kind: 'compact' } }} foot="not yet paid" />
      </Block>
      <div style={{ height: 16 }} />
      <Block><Panel flush>
        <Tabs label="Order stage" value={tab} onChange={setTab} tabs={[{ id: 'all', label: 'All', count: count('all') }, { id: 'open', label: 'Awaiting payment', count: count('open') }, { id: 'fulfil', label: 'Fulfilment', count: count('fulfil') }, { id: 'done', label: 'Completed', count: count('done') }, { id: 'returns', label: 'Returns and cancelled', count: count('returns') }]} />
        <DataTable label="Orders" rows={rows} rowKey={(o) => o.no} columns={cols} onRowClick={(o) => nav('/orders/' + encodeURIComponent(o.no))} searchText={(o) => o.no + ' ' + customerOf(s, o.customerId).name + ' ' + o.channel} searchPlaceholder="Search by number, customer or channel" pageSize={12} empty={{ title: 'No orders in this stage', art: <ArtTruck /> }} />
      </Panel></Block>
    </Page>
  );
}
