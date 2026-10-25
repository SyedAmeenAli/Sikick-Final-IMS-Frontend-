import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Block, Chip, FilterChips, Metric, Page, PageHeader, Panel } from '@/components/ui/primitives';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Thumb } from '@/components/Barcode';
import { ArtBox } from '@/components/illustrations';
import { fmtCompact } from '@/lib/money';
import { useIms } from '@/services';
import { coverDays, kpis, lastSaleDays, stockAvailable, stockState, stockTotal } from '@/services/selectors';
import type { Product } from '@/services/contracts/types';

type F = 'all' | 'low' | 'out' | 'stagnant';

export default function InventoryPage() {
  const s = useIms();
  const nav = useNavigate();
  const [f, setF] = useState<F>('all');
  const k = kpis(s);
  const retail = s.products.reduce((a, p) => a + stockTotal(s, p.sku) * p.price, 0);
  const damaged = Object.values(s.stock).reduce((a, l) => a + l.damaged, 0);
  const stagnant = (p: Product) => lastSaleDays(s, p.sku) >= 60 && stockTotal(s, p.sku) > 30;
  const rows = s.products.filter((p) => (f === 'all' ? true : f === 'stagnant' ? stagnant(p) : f === 'low' ? stockState(s, p.sku) === 'low' : stockState(s, p.sku) === 'out'));
  const count = (g: F) => s.products.filter((p) => (g === 'all' ? true : g === 'stagnant' ? stagnant(p) : g === 'low' ? stockState(s, p.sku) === 'low' : stockState(s, p.sku) === 'out')).length;

  const cols: Array<Column<Product>> = [
    { id: 'p', header: 'Variant', primary: true, sort: (p) => p.name, cell: (p) => <span className="row" style={{ gap: 11, flexWrap: 'nowrap' }}><Thumb product={p} size={34} /><span><div className="cell-main">{p.name}</div><div className="cell-sub mono">{p.sku}</div></span></span> },
    { id: 'h', header: 'On hand', num: true, sort: (p) => stockTotal(s, p.sku), cell: (p) => <b>{stockTotal(s, p.sku)}</b> },
    { id: 'r', header: 'Reserved', num: true, cell: (p) => s.stock[p.sku].reserved || '—' },
    { id: 'd', header: 'Damaged', num: true, cell: (p) => s.stock[p.sku].damaged || '—' },
    { id: 'a', header: 'Available', num: true, sort: (p) => stockAvailable(s, p.sku), cell: (p) => stockAvailable(s, p.sku) },
    { id: 'o', header: 'Reorder at', num: true, cell: (p) => p.reorderPoint },
    { id: 'c', header: f === 'stagnant' ? 'Last sold' : 'Cover', num: true, sort: (p) => coverDays(s, p.sku) ?? 9999, cell: (p) => (f === 'stagnant' ? lastSaleDays(s, p.sku) + ' days ago' : coverDays(s, p.sku) === null ? '—' : coverDays(s, p.sku) + ' days') },
    { id: 's', header: 'Status', cell: (p) => { const st = stockState(s, p.sku); return <Chip tone={st === 'out' ? 'bad' : st === 'low' ? 'warn' : 'ok'}>{st === 'out' ? 'Out' : st === 'low' ? 'Low' : 'Healthy'}</Chip>; } },
  ];

  return (
    <Page>
      <PageHeader title="Inventory" sub="One figure per variant: on hand, reserved and damaged. Every change is a stock event with a reason." />
      <Block className="grid c4 keep2">
        <Metric label="Units on hand" num={{ value: k.units, format: { kind: 'int' } }} foot={s.products.length + ' variants'} />
        <Metric label="Value at cost" num={{ value: k.inventoryValue, format: { kind: 'compact' } }} to="/analytics/inventory-value" foot={'retail ' + fmtCompact(retail)} />
        <Metric label="Needs reordering" num={{ value: count('low') + count('out'), format: { kind: 'int' } }} onClick={() => setF('low')} foot="low or out of stock" />
        <Metric label="Damaged units" num={{ value: damaged, format: { kind: 'int' } }} foot="held back from sale" />
      </Block>
      <div style={{ height: 16 }} />
      <Block>
        <Panel flush>
          <DataTable label="Inventory" rows={rows} rowKey={(p) => p.sku} columns={cols} searchText={(p) => p.name + ' ' + p.sku + ' ' + p.barcode} searchPlaceholder="Search by name, SKU or barcode" onRowClick={(p) => nav('/inventory/' + p.sku)} pageSize={12}
            empty={{ title: 'Nothing in this view', body: 'Every variant is healthy.', art: <ArtBox /> }}
            filters={<FilterChips label="Stock filter" value={f} onChange={setF} options={[{ value: 'all', label: 'All', n: count('all') }, { value: 'low', label: 'Low stock', n: count('low') }, { value: 'out', label: 'Out of stock', n: count('out') }, { value: 'stagnant', label: 'Stagnant, 60+ days', n: count('stagnant') }]} />} />
        </Panel>
      </Block>
    </Page>
  );
}
