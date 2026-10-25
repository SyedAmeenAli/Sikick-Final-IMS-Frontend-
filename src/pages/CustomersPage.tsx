import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Block, Chip, FilterChips, KV, Metric, Page, PageHeader, Panel, StatusChip } from '@/components/ui/primitives';
import { SidePanel } from '@/components/ui/Overlay';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Avatar } from '@/components/ui/primitives';
import { fmt, fmtCompact } from '@/lib/money';
import { fmtStamp } from '@/lib/format';
import { useIms } from '@/services';
import { customerLifetime, customerOutstanding, orderTotal } from '@/services/selectors';
import type { Customer } from '@/services/contracts/types';

export default function CustomersPage() {
  const s = useIms();
  const [kind, setKind] = useState<'all' | 'retail' | 'business'>('all');
  const [sel, setSel] = useState<Customer | null>(null);
  const rows = s.customers.filter((c) => c.id !== 'CUS-000' && (kind === 'all' || c.kind === kind));
  const cols: Array<Column<Customer>> = [
    { id: 'n', header: 'Customer', primary: true, sort: (c) => c.name, cell: (c) => <span className="row" style={{ gap: 10, flexWrap: 'nowrap' }}><Avatar name={c.name} /><span><div className="cell-main">{c.name}</div><div className="cell-sub">{c.phone || 'No phone'} · {c.city}</div></span></span> },
    { id: 'k', header: 'Type', cell: (c) => <Chip tone={c.kind === 'business' ? 'wine' : 'neutral'} plain>{c.kind}</Chip> },
    { id: 'o', header: 'Orders', num: true, cell: (c) => s.orders.filter((o) => o.customerId === c.id).length },
    { id: 'l', header: 'Lifetime spend', num: true, sort: (c) => customerLifetime(s, c.id), cell: (c) => fmt(customerLifetime(s, c.id)) },
    { id: 'b', header: 'Outstanding', num: true, sort: (c) => customerOutstanding(s, c.id), cell: (c) => (customerOutstanding(s, c.id) ? <b style={{ color: 'var(--warn)' }}>{fmt(customerOutstanding(s, c.id))}</b> : '—') },
  ];
  const mine = sel ? s.orders.filter((o) => o.customerId === sel.id).slice(-6).reverse() : [];
  return (
    <Page>
      <PageHeader title="Customers" sub="People and businesses you sell to, with what they have bought and what they owe." />
      <Block className="grid c3">
        <Metric label="Customers" value={s.customers.length - 1} foot="excluding walk-ins" />
        <Metric label="Business accounts" value={s.customers.filter((c) => c.kind === 'business').length} foot="with GSTIN" />
        <Metric label="Receivable" value={fmtCompact(s.customers.reduce((a, c) => a + customerOutstanding(s, c.id), 0))} foot="owed by customers" />
      </Block>
      <div style={{ height: 16 }} />
      <Block><Panel flush><DataTable label="Customers" rows={rows} rowKey={(c) => c.id} columns={cols} onRowClick={setSel} selectedKey={sel?.id} searchText={(c) => c.name + ' ' + c.phone + ' ' + c.city} searchPlaceholder="Search customers"
        filters={<FilterChips label="Customer type" value={kind} onChange={setKind} options={[{ value: 'all', label: 'All' }, { value: 'retail', label: 'Retail' }, { value: 'business', label: 'Business' }]} />} /></Panel></Block>
      <SidePanel open={!!sel} onClose={() => setSel(null)} title={sel?.name ?? ''} sub={sel?.city}>
        {sel && <div className="stack">
          <KV rows={[['Type', sel.kind], ['Phone', sel.phone || '—'], ['GSTIN', sel.gstin ? <span key="g" className="mono">{sel.gstin}</span> : '—'], ['Lifetime spend', <b key="l">{fmt(customerLifetime(s, sel.id))}</b>], ['Outstanding', fmt(customerOutstanding(s, sel.id))]]} />
          <hr className="divider" /><div className="eyebrow">Recent orders</div>
          {mine.length === 0 && <p className="muted">No orders yet.</p>}
          {mine.map((o) => <Link key={o.no} to={'/orders/' + encodeURIComponent(o.no)} className="stat-line"><span><span className="mono">{o.no}</span> <span className="muted">{fmtStamp(o.at)}</span></span><span><StatusChip status={o.status} /> <b className="num">{fmt(orderTotal(o))}</b></span></Link>)}
        </div>}
      </SidePanel>
    </Page>
  );
}
