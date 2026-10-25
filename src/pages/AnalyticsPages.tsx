import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Boxes, LineChart as LineIcon, Repeat, Users, Wallet } from 'lucide-react';
import { Block, Chip, FilterChips, Metric, Page, PageHeader, Panel, Segmented } from '@/components/ui/primitives';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { BarChart, Donut, LineChart } from '@/components/ui/Charts';
import { fmt, fmtCompact, fmtShort } from '@/lib/money';
import { useIms } from '@/services';
import { alerts, coverDays, kpis, lastSaleDays, orderTotal, product, salesByDay, soldUnits, stockTotal, stockValue, supplierBalance, topProducts, countsAsSale } from '@/services/selectors';
import type { Product } from '@/services/contracts/types';

const CRUMB = [{ label: 'Analytics', to: '/analytics' }];

export function AnalyticsLanding() {
  const s = useIms();
  const k = kpis(s);
  const a = alerts(s).filter((x) => !x.acknowledged);
  const cards = [
    { to: '/analytics/sales-summary', icon: LineIcon, t: 'Sales summary', d: 'Daily sales, orders and best sellers.', v: fmtCompact(k.weekSales) + ' this week' },
    { to: '/analytics/inventory-value', icon: Boxes, t: 'Inventory value', d: 'What your stock is worth, by category.', v: fmtCompact(k.inventoryValue) + ' at cost' },
    { to: '/analytics/turnover', icon: Repeat, t: 'Stock turnover', d: 'Which products move and which sit.', v: s.products.filter((p) => lastSaleDays(s, p.sku) >= 60).length + ' stagnant' },
    { to: '/analytics/alerts-summary', icon: Bell, t: 'Alerts summary', d: 'Open alerts by type and severity.', v: a.length + ' open' },
    { to: '/analytics/supplier-balance', icon: Users, t: 'Supplier balances', d: 'What you owe each supplier.', v: fmtCompact(k.payable) + ' owed' },
  ];
  return (
    <Page>
      <PageHeader title="Analytics" sub="Five reports, all drawn from the same orders, stock and supplier records as the rest of the workspace." />
      <Block className="hub-grid">{cards.map((c) => <Link key={c.to} to={c.to} className="panel card-link"><div className="ic"><c.icon /></div><h3>{c.t}</h3><p>{c.d}</p><p style={{ marginTop: 10, color: 'var(--wine)', fontWeight: 650 }}>{c.v}</p></Link>)}
        <Link to="/reports/financial-statements" className="panel card-link"><div className="ic"><Wallet /></div><h3>Financial statements</h3><p>Profit and loss, balance sheet and cash flow.</p></Link></Block>
    </Page>
  );
}

export function SalesSummary() {
  const s = useIms();
  const [days, setDays] = useState<'7' | '14' | '30'>('30');
  const series = useMemo(() => salesByDay(s, Number(days)), [s, days]);
  const total = series.reduce((a, d) => a + d.total, 0);
  const orders = series.reduce((a, d) => a + d.orders, 0);
  const best = series.reduce((m, d) => (d.total > m.total ? d : m), series[0]);
  const top = topProducts(s, Number(days), 6);
  const chan = ['POS', 'Counter', 'Online', 'Wholesale'].map((c) => ({ label: c, value: s.orders.filter((o) => countsAsSale(o) && o.status !== 'Returned' && o.channel === c && (series.some((d) => d.date === o.at.slice(0, 10)))).reduce((a, o) => a + orderTotal(o), 0), color: '' }));
  const colors = ['var(--wine)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'];
  return (
    <Page>
      <PageHeader crumbs={CRUMB} title="Sales summary" sub="Including GST. Returned orders are left out." actions={<Segmented label="Range" value={days} onChange={setDays} options={[{ value: '7', label: '7 days' }, { value: '14', label: '14 days' }, { value: '30', label: '30 days' }]} />} />
      <Block className="grid c4 keep2">
        <Metric label="Sales" num={{ value: total, format: { kind: 'compact' } }} foot={days + ' days'} />
        <Metric label="Orders" num={{ value: orders, format: { kind: 'int' } }} foot={'avg ' + fmtShort(orders ? Math.round(total / orders) : 0) + ' each'} />
        <Metric label="Best day" value={best ? best.label : '—'} foot={best ? fmtShort(best.total) : ''} />
        <Metric label="Units sold" num={{ value: series.reduce((a, d) => a + d.units, 0), format: { kind: 'int' } }} />
      </Block>
      <div style={{ height: 16 }} />
      <Block className="grid main-side">
        <Panel title="Daily sales" hint="Hover or move along the line for a day's figure"><LineChart ariaLabel="Daily sales" data={series.map((d) => ({ label: d.label, value: d.total }))} format={fmtCompact} height={260} /></Panel>
        <Panel title="By channel"><div className="row donut-row"><Donut ariaLabel="Sales by channel" size={150} data={chan.map((c, i) => ({ ...c, color: colors[i] })).filter((c) => c.value > 0)} centre={{ top: fmtCompact(chan.reduce((a, c) => a + c.value, 0)), bottom: 'total' }} />
          <div className="legend" style={{ flexDirection: 'column', gap: 8, flex: '1 1 140px', minWidth: 0 }}>{chan.map((c, i) => <span key={c.label}><i style={{ background: colors[i] }} />{c.label} · {fmtCompact(c.value)}</span>)}</div></div></Panel>
      </Block>
      <div style={{ height: 16 }} />
      <Block><Panel title="Top products" hint="By revenue before GST" flush>
        <div className="tbl-wrap"><table className="tbl" data-cards aria-label="Top products"><thead><tr><th>Product</th><th className="num">Units</th><th className="num">Revenue</th></tr></thead>
          <tbody>{top.map((t) => <tr key={t.sku}><td data-label="Product" data-primary="true"><Link className="link" to={'/variants/' + t.sku}>{product(s, t.sku).name}</Link></td><td data-label="Units" className="num">{t.units}</td><td data-label="Revenue" className="num">{fmt(t.revenue)}</td></tr>)}</tbody></table></div></Panel></Block>
    </Page>
  );
}

export function InventoryValue() {
  const s = useIms();
  const nav = useNavigate();
  const cats = s.categories.map((c) => ({ label: c.name, value: s.products.filter((p) => p.category === c.name).reduce((a, p) => a + stockValue(s, p.sku), 0) })).filter((c) => c.value > 0);
  const total = cats.reduce((a, c) => a + c.value, 0);
  const retail = s.products.reduce((a, p) => a + stockTotal(s, p.sku) * p.price, 0);
  const cols: Array<Column<Product>> = [
    { id: 'p', header: 'Variant', primary: true, sort: (p) => p.name, cell: (p) => <div><div className="cell-main">{p.name}</div><div className="cell-sub mono">{p.sku}</div></div> },
    { id: 'u', header: 'Units', num: true, sort: (p) => stockTotal(s, p.sku), cell: (p) => stockTotal(s, p.sku) },
    { id: 'c', header: 'Unit cost', num: true, cell: (p) => fmt(p.cost) },
    { id: 'v', header: 'Value at cost', num: true, sort: (p) => stockValue(s, p.sku), cell: (p) => <b>{fmt(stockValue(s, p.sku))}</b> },
    { id: 'r', header: 'Value at price', num: true, cell: (p) => fmt(stockTotal(s, p.sku) * p.price) },
    { id: 'sh', header: 'Share', num: true, cell: (p) => Math.round((stockValue(s, p.sku) / total) * 100) + '%' },
  ];
  return (
    <Page>
      <PageHeader crumbs={CRUMB} title="Inventory value" sub="On-hand units at cost and at selling price, before GST." />
      <Block className="grid c3"><Metric label="At cost" num={{ value: total, format: { kind: 'compact' } }} /><Metric label="At selling price" num={{ value: retail, format: { kind: 'compact' } }} /><Metric label="Potential margin" value={fmtCompact(retail - total)} foot={Math.round(((retail - total) / retail) * 100) + '% of price'} /></Block>
      <div style={{ height: 16 }} />
      <Block className="grid main-side"><Panel title="By category"><BarChart ariaLabel="Inventory value by category" data={cats} format={fmtCompact} height={220} /></Panel>
        <Panel title="Biggest holdings">{[...s.products].sort((a, b) => stockValue(s, b.sku) - stockValue(s, a.sku)).slice(0, 5).map((p) => <div className="hbar" key={p.sku}><span>{p.name.slice(0, 16)}</span><div className="bar"><i style={{ width: (stockValue(s, p.sku) / Math.max(...s.products.map((x) => stockValue(s, x.sku)))) * 100 + '%' }} /></div><b className="num">{fmtCompact(stockValue(s, p.sku))}</b></div>)}</Panel></Block>
      <div style={{ height: 16 }} />
      <Block><Panel flush><DataTable label="Inventory value" rows={s.products} rowKey={(p) => p.sku} columns={cols} onRowClick={(p) => nav('/inventory/' + p.sku)} pageSize={8} /></Panel></Block>
    </Page>
  );
}

type Speed = 'fast' | 'steady' | 'slow' | 'stagnant';
export function Turnover() {
  const s = useIms();
  const nav = useNavigate();
  const [f, setF] = useState<'all' | Speed>('all');
  const rate = (p: Product) => { const t = stockTotal(s, p.sku); return t ? (soldUnits(s, p.sku) * 12) / t : 0; };
  const speed = (p: Product): Speed => (lastSaleDays(s, p.sku) >= 60 ? 'stagnant' : rate(p) >= 6 ? 'fast' : rate(p) >= 2 ? 'steady' : 'slow');
  const rows = s.products.filter((p) => f === 'all' || speed(p) === f);
  const tone = { fast: 'ok', steady: 'info', slow: 'warn', stagnant: 'bad' } as const;
  const cols: Array<Column<Product>> = [
    { id: 'p', header: 'Variant', primary: true, sort: (p) => p.name, cell: (p) => <div><div className="cell-main">{p.name}</div><div className="cell-sub mono">{p.sku}</div></div> },
    { id: 's', header: 'Sold, 30 days', num: true, sort: (p) => soldUnits(s, p.sku), cell: (p) => soldUnits(s, p.sku) },
    { id: 'h', header: 'On hand', num: true, cell: (p) => stockTotal(s, p.sku) },
    { id: 't', header: 'Turns a year', num: true, sort: rate, cell: (p) => rate(p).toFixed(1) },
    { id: 'c', header: 'Cover', num: true, cell: (p) => (coverDays(s, p.sku) === null ? '—' : coverDays(s, p.sku) + ' d') },
    { id: 'l', header: 'Last sold', num: true, cell: (p) => lastSaleDays(s, p.sku) + ' d ago' },
    { id: 'x', header: 'Pace', cell: (p) => <Chip tone={tone[speed(p)]}>{speed(p)}</Chip> },
  ];
  const sorted = [...s.products].sort((a, b) => rate(b) - rate(a));
  return (
    <Page>
      <PageHeader crumbs={CRUMB} title="Stock turnover" sub="Turns a year is the 30-day sales rate over current stock. Stagnant means nothing sold for 60 days." />
      <Block className="grid main-side"><Panel title="Turns a year" hint="Higher is faster"><BarChart ariaLabel="Turns a year by product" data={sorted.slice(0, 10).map((p) => ({ label: p.name.split(' ')[0], value: Math.round(rate(p) * 10) / 10 }))} format={(n) => n.toFixed(0)} height={210} /></Panel>
        <Panel title="Needs a decision">{s.products.filter((p) => speed(p) === 'stagnant').map((p) => <div key={p.sku} className="list-row"><div className="grow"><div className="t">{p.name}</div><div className="d">{stockTotal(s, p.sku)} units · {fmtShort(stockValue(s, p.sku))} at cost · {lastSaleDays(s, p.sku)} days unsold</div></div><Link className="btn btn-sm" to={'/inventory/' + p.sku}>Open</Link></div>)}</Panel></Block>
      <div style={{ height: 16 }} />
      <Block><Panel flush><DataTable label="Turnover" rows={rows} rowKey={(p) => p.sku} columns={cols} onRowClick={(p) => nav('/inventory/' + p.sku)} pageSize={10} filters={<FilterChips label="Pace" value={f} onChange={setF} options={[{ value: 'all', label: 'All' }, { value: 'fast', label: 'Fast' }, { value: 'steady', label: 'Steady' }, { value: 'slow', label: 'Slow' }, { value: 'stagnant', label: 'Stagnant' }]} />} /></Panel></Block>
    </Page>
  );
}

export function AlertsSummary() {
  const s = useIms();
  const all = alerts(s);
  const sev = ['critical', 'high', 'medium', 'low'] as const;
  const colour = { critical: 'var(--bad)', high: 'var(--chart-2)', medium: 'var(--warn)', low: 'var(--info)' };
  return (
    <Page narrow>
      <PageHeader crumbs={CRUMB} title="Alerts summary" sub="Where attention is going, by severity and type." actions={<Link className="btn" to="/alerts">Open alerts</Link>} />
      <Block className="grid c2">
        <Panel title="By severity"><div className="row donut-row"><Donut ariaLabel="Alerts by severity" data={sev.map((x) => ({ label: x, value: all.filter((a) => a.severity === x).length, color: colour[x] })).filter((d) => d.value)} centre={{ top: String(all.length), bottom: 'alerts' }} /><div className="legend" style={{ flexDirection: 'column' }}>{sev.map((x) => <span key={x}><i style={{ background: colour[x] }} />{x} · {all.filter((a) => a.severity === x).length}</span>)}</div></div></Panel>
        <Panel title="By type">{Array.from(new Set(all.map((a) => a.kind))).map((k) => <div className="stat-line" key={k}><span style={{ textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</span><b className="num">{all.filter((a) => a.kind === k).length}</b></div>)}</Panel>
      </Block>
    </Page>
  );
}

export function SupplierBalances() {
  const s = useIms();
  const data = s.suppliers.map((x) => ({ label: x.name.split(' ')[0], value: Math.max(0, supplierBalance(s, x.id)) }));
  return (
    <Page narrow>
      <PageHeader crumbs={CRUMB} title="Supplier balances" sub="What you owe each supplier after receipts and payments." />
      <Block className="grid main-side"><Panel title="Owed"><BarChart ariaLabel="Balance owed per supplier" data={data} format={fmtCompact} height={220} /></Panel>
        <Panel title="Statements">{s.suppliers.map((x) => <Link key={x.id} to={'/suppliers/' + x.id + '/balance'} className="stat-line"><span>{x.name}</span><b className="num">{fmt(supplierBalance(s, x.id))}</b></Link>)}</Panel></Block>
    </Page>
  );
}
