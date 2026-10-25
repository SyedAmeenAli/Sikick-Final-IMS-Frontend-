import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { AlertTriangle, ArrowRight, Boxes, IndianRupee, Receipt, Store, TrendingUp } from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Block, Button, Chip, Metric, Page, PageHeader, Panel, Segmented, StatusChip } from '@/components/ui/primitives';
import { SidePanel } from '@/components/ui/Overlay';
import { BarChart, LineChart } from '@/components/ui/Charts';
import { SiBorgIcon } from '@/components/brand';
import { fmt, fmtCompact, fmtShort } from '@/lib/money';
import { ago, fmtDay } from '@/lib/format';
import { dur, ease } from '@/animations/motion';
import { useIms } from '@/services';
import { alerts, coverDays, kpis, orderTotal, poOverdueDays, poTotals, product, salesByDay, stockTotal, supplierOf, topProducts } from '@/services/selectors';
import { insights } from '@/services/insights';
import { WORKSPACE } from '@/data/fixtures/seed';
import type { Alert } from '@/services/contracts/types';

type Range = '7' | '14' | '30';
const PO_STEPS = ['Draft', 'Ordered', 'Received'] as const;

export default function DashboardPage() {
  const s = useIms();
  const nav = useNavigate();
  const [range, setRange] = useState<Range>('14');
  const [alertOpen, setAlertOpen] = useState<Alert | null>(null);
  const k = kpis(s);
  const series = useMemo(() => salesByDay(s, Number(range)), [s, range]);
  const total = series.reduce((a, d) => a + d.total, 0);
  const orders = series.reduce((a, d) => a + d.orders, 0);
  const watch = s.products.filter((p) => stockTotal(s, p.sku) <= p.reorderPoint).sort((a, b) => (coverDays(s, a.sku) ?? 999) - (coverDays(s, b.sku) ?? 999));
  const al = alerts(s).filter((a) => !a.acknowledged);
  const brief = insights(s).slice(0, 3);
  const best = topProducts(s, 30, 5);
  const recent = [...s.orders].slice(-6).reverse();
  const yesterday = salesByDay(s, 2)[0].total;
  const first = { admin: 'Ameen', manager: 'Farah', warehouse_staff: 'Dev', pos_operator: 'Priya' }[s.role];

  return (
    <Page>
      <PageHeader title={'Good morning, ' + first} sub={'Saturday 24 October · ' + s.account.workspace.name + ', ' + WORKSPACE.location + '. Here is what needs you first.'}
        actions={<><Segmented label="Date range" value={range} onChange={setRange} options={[{ value: '7', label: '7 days' }, { value: '14', label: '14 days' }, { value: '30', label: '30 days' }]} /><Button variant="primary" onClick={() => nav('/pos')}><Store />Open POS</Button></>} />

      <Block className="grid c4 keep2">
        <Metric label="Sales today" icon={<IndianRupee />} num={{ value: k.todaySales, format: { kind: 'inrShort' } }} to="/orders" foot={k.todayOrders + ' orders so far · yesterday ' + fmtShort(yesterday)} />
        <Metric label="Inventory at cost" icon={<Boxes />} num={{ value: k.inventoryValue, format: { kind: 'compact' } }} to="/analytics/inventory-value" foot={k.units.toLocaleString('en-IN') + ' units on hand'} />
        <Metric label="Below reorder point" icon={<AlertTriangle />} num={{ value: k.lowStock, format: { kind: 'int' } }} to="/alerts" foot={k.lowStock === 1 ? 'product needs stock' : 'products need stock'} />
        <Metric label="Open purchase orders" icon={<Receipt />} num={{ value: k.openPos, format: { kind: 'int' } }} to="/purchase-orders" foot={k.overduePos > 0 ? k.overduePos + ' overdue' : 'none overdue'} />
      </Block>

      <div style={{ height: 16 }} />
      <Block glass className="grid main-side">
        <Panel glass title="Sales" hint={range + ' days · ' + orders + ' orders · ' + fmtShort(total) + ' including GST'}
          actions={<Link to="/analytics/sales-summary" className="link">Full report</Link>}>
          <div className="row" style={{ gap: 28, marginBottom: 6 }}>
            <div><div className="muted" style={{ fontSize: 'var(--fs-sm)' }}>Sales, {range} days</div><b className="stat-big"><AnimatedNumber id="dash:range-total" value={total} format={{ kind: 'inrShort' }} /></b></div>
            <div><div className="muted" style={{ fontSize: 'var(--fs-sm)' }}>Orders</div><b className="stat-big"><AnimatedNumber id="dash:range-orders" value={orders} format={{ kind: 'int' }} /></b></div>
          </div>
          <LineChart ariaLabel={'Daily sales for the last ' + range + ' days'} data={series.map((d) => ({ label: d.label, value: d.total }))} format={fmtCompact} height={330} />
        </Panel>
        <Panel glass title={<span className="row" style={{ gap: 9 }}><SiBorgIcon size={26} mood="insight" />SiBorg brief</span>} hint="Built from the same stock and order records you see here" actions={<Link className="link" to="/briefing">Full briefing</Link>}>
          <div>
            {brief.map((b, i) => (
              <motion.div key={b.id} className="list-row" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: dur.panel, ease, delay: 0.25 + i * 0.05 }} style={{ alignItems: 'flex-start' }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, marginTop: 7, flex: 'none', background: b.tone === 'bad' ? 'var(--bad)' : b.tone === 'warn' ? 'var(--warn)' : b.tone === 'ok' ? 'var(--ok)' : 'var(--info)' }} />
                <div className="grow"><div className="t">{b.title}</div><div className="d">{b.detail}</div>{b.to && <Link to={b.to} className="link" style={{ fontSize: 'var(--fs-sm)' }}>{b.cta} <ArrowRight size={12} style={{ display: 'inline' }} /></Link>}</div>
              </motion.div>
            ))}
          </div>
        </Panel>
      </Block>

      <div style={{ height: 16 }} />
      <Block className="grid main-side">
        <Panel title="Stock watchlist" hint="Sorted by days of cover at the 30-day sales rate" flush actions={<Link to="/inventory" className="link">All stock</Link>}>
          <div className="tbl-wrap">
            <table className="tbl" data-cards aria-label="Stock watchlist">
              <thead><tr><th>Product</th><th className="num">On hand</th><th className="num">Reorder at</th><th className="num">Cover</th><th /></tr></thead>
              <tbody>
                {watch.map((p) => {
                  const c = coverDays(s, p.sku);
                  return (
                    <tr key={p.sku} data-clickable="true" tabIndex={0} onClick={() => nav('/inventory/' + p.sku)} onKeyDown={(e) => e.key === 'Enter' && nav('/inventory/' + p.sku)}>
                      <td data-label="Product" data-primary="true"><div className="cell-main">{p.name}</div><div className="cell-sub mono">{p.sku}</div></td>
                      <td data-label="On hand" className="num">{stockTotal(s, p.sku)}</td>
                      <td data-label="Reorder at" className="num">{p.reorderPoint}</td>
                      <td data-label="Cover" className="num">{c === null ? '—' : c + ' days'}</td>
                      <td data-label="Status"><Chip tone={c !== null && c <= 7 ? 'bad' : 'warn'}>{c !== null && c <= 7 ? 'Reorder now' : 'Reorder soon'}</Chip></td>
                    </tr>
                  );
                })}
                {watch.length === 0 && <tr><td colSpan={5} className="muted" style={{ padding: 22 }}>Every product is above its reorder point.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Alerts" hint={al.length + ' need a look'} actions={<Link className="link" to="/alerts">Open alerts</Link>}>
          {al.slice(0, 5).map((a) => (
            <button key={a.id} type="button" className="list-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => setAlertOpen(a)}>
              <StatusChip status={a.severity} /><div className="grow"><div className="t" style={{ fontSize: 'var(--fs-md)' }}>{a.title}</div></div><ArrowRight size={14} color="var(--ink-4)" />
            </button>
          ))}
        </Panel>
      </Block>

      <div style={{ height: 16 }} />
      <Block className="grid c3">
        <Panel title="Best sellers" hint="Last 30 days, before tax"><BarChart ariaLabel="Best selling products by revenue" data={best.map((b) => ({ label: product(s, b.sku).name.split(' ').slice(0, 2).join(' '), value: b.revenue }))} format={fmtCompact} height={190} /></Panel>
        <Panel title="Purchase orders" hint="Each order moves Draft, Ordered, Received" actions={<Link className="link" to="/purchase-orders">All orders</Link>}>
          {s.purchaseOrders.filter((p) => p.status !== 'Received').map((p) => {
            const late = poOverdueDays(p);
            const idx = PO_STEPS.indexOf(p.status);
            return (
              <Link key={p.no} to={'/purchase-orders/' + p.no} className="list-row" style={{ alignItems: 'flex-start' }}>
                <div className="grow">
                  <div className="row between"><span className="t">{p.no}</span><span className="t num">{fmtShort(poTotals(s, p).total)}</span></div>
                  <div className="d">{supplierOf(s, p.supplierId).name}{late > 0 ? ' · ' + late + ' days late' : p.expected ? ' · due ' + fmtDay(p.expected) : ''}</div>
                  <div className="steps" style={{ marginTop: 8 }}>
                    {PO_STEPS.map((st, i) => (
                      <span key={st} style={{ display: 'contents' }}>
                        {i > 0 && <span className="step-link" data-done={i <= idx} />}
                        <span className="step" data-state={i < idx ? 'done' : i === idx ? 'now' : 'todo'}><span className="dot">{i < idx ? '✓' : i + 1}</span>{st}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </Panel>
        <Panel title="Latest sales" hint="From every till" actions={<Link className="link" to="/orders">All orders</Link>}>
          {recent.map((o) => (
            <Link key={o.no} to={'/orders/' + encodeURIComponent(o.no)} className="list-row">
              <span className="avatar"><TrendingUp size={14} /></span>
              <div className="grow"><div className="t">Sale {o.no}</div><div className="d">{o.lines.reduce((a, l) => a + l.qty, 0)} items · {ago(o.at)}</div></div>
              <span className="t num">{fmt(orderTotal(o))}</span>
            </Link>
          ))}
        </Panel>
      </Block>

      <SidePanel open={!!alertOpen} onClose={() => setAlertOpen(null)} title={alertOpen?.title ?? ''} sub={alertOpen && <StatusChip status={alertOpen.severity} />}>
        {alertOpen && (
          <div className="stack">
            <p>{alertOpen.detail}</p>
            <div className="actions">
              {alertOpen.sku && <Link className="btn btn-primary" to={'/inventory/' + alertOpen.sku} onClick={() => setAlertOpen(null)}>Open item</Link>}
              {alertOpen.ref && <Link className="btn" to={'/purchase-orders/' + alertOpen.ref} onClick={() => setAlertOpen(null)}>Open order</Link>}
              <Link className="btn" to="/alerts" onClick={() => setAlertOpen(null)}>Manage in alerts</Link>
            </div>
          </div>
        )}
      </SidePanel>
    </Page>
  );
}
