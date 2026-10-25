import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ClipboardEdit, PackagePlus } from 'lucide-react';
import { Block, Button, Chip, Field, Input, Metric, Notice, Page, PageHeader, Panel, Select, FilterChips } from '@/components/ui/primitives';
import { Dialog, useToast } from '@/components/ui/Overlay';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Thumb } from '@/components/Barcode';
import { fmtDate, fmtStamp } from '@/lib/format';
import { MIN_LINE_QTY } from '@/data/fixtures/seed';
import { dur, ease } from '@/animations/motion';
import { useCommands, useIms } from '@/services';
import { coverDays, soldUnits, stockAvailable, stockState, stockTotal, supplierOf } from '@/services/selectors';
import type { StockMovement } from '@/services/contracts/types';
import NotFoundPage from './NotFoundPage';

type Kind = 'ADJUSTMENT' | 'DAMAGE' | 'RETURN';
const KINDS: Array<{ id: Kind; label: string; hint: string; sign: 1 | -1 | 0 }> = [
  { id: 'ADJUSTMENT', label: 'Count correction', hint: 'Use a plus or minus number after a recount.', sign: 0 },
  { id: 'DAMAGE', label: 'Damaged or broken', hint: 'Removes units from on hand and holds them as damaged.', sign: -1 },
  { id: 'RETURN', label: 'Customer return', hint: 'Adds units back to on hand.', sign: 1 },
];

/** Before, event, after: the connector draws once when the dialog shows the proposed change. */
function Flow({ before, delta, after }: { before: number; delta: number; after: number }) {
  return (
    <div className="flow" aria-label={'On hand goes from ' + before + ' to ' + after}>
      <div className="flow-node"><small>On hand now</small><b className="num">{before}</b></div>
      <div className="flow-edge"><svg viewBox="0 0 46 20"><motion.path d="M2 10 H44" stroke="var(--wine)" strokeWidth="1.6" fill="none" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: dur.chart / 1.6, ease }} key={delta} /><path d="M38 5 L44 10 L38 15" stroke="var(--wine)" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
      <div className="flow-node" style={{ borderColor: delta === 0 ? 'var(--line-strong)' : 'var(--wine-line)', background: 'var(--wine-soft)' }}><small>Stock event</small><b className="num" style={{ color: delta < 0 ? 'var(--bad)' : 'var(--ok)' }}>{delta > 0 ? '+' : ''}{delta}</b></div>
      <div className="flow-edge"><svg viewBox="0 0 46 20"><motion.path d="M2 10 H44" stroke="var(--wine)" strokeWidth="1.6" fill="none" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: dur.chart / 1.6, ease, delay: 0.25 }} key={'b' + delta} /><path d="M38 5 L44 10 L38 15" stroke="var(--wine)" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
      <div className="flow-node"><small>On hand after</small><b className="num">{after}</b></div>
    </div>
  );
}

export default function InventoryDetailPage() {
  const { variantId = '' } = useParams();
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  const nav = useNavigate();
  const p = s.products.find((x) => x.sku === variantId);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>('ADJUSTMENT');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [type, setType] = useState<'all' | 'sale' | 'receipt' | 'adjustment' | 'return'>('all');
  if (!p) return <NotFoundPage />;
  const lv = s.stock[p.sku];
  const total = stockTotal(s, p.sku);
  const st = stockState(s, p.sku);
  const cover = coverDays(s, p.sku);
  const sup = supplierOf(s, p.supplierId);

  const n = parseFloat(qty);
  const kd = KINDS.find((x) => x.id === kind)!;
  const delta = isFinite(n) ? (kd.sign === 0 ? Math.round(n) : kd.sign * Math.abs(Math.round(n))) : 0;
  const after = total + delta;
  const all = s.movements.filter((m) => m.sku === p.sku);
  const rows = all.filter((m) => type === 'all' || m.type === type).slice().reverse();
  const suggested = Math.max(MIN_LINE_QTY[p.supplierId] ?? 1, Math.ceil(soldUnits(s, p.sku) - total));
  const openPo = s.purchaseOrders.find((o) => o.status !== 'Received' && o.lines.some((l) => l.sku === p.sku));

  const submit = () => {
    if (!delta) { setErr('Enter a quantity other than zero.'); return; }
    if (!reason.trim()) { setErr('A reason is required for every stock change.'); return; }
    const r = cmd.adjustStock(p.sku, delta, reason.trim(), kind);
    if (!r.ok) { setErr(r.message); return; }
    toast('Stock event recorded. ' + p.name + ' is now ' + after + ' on hand.');
    setOpen(false); setQty(''); setReason(''); setErr('');
  };
  const draftReorder = () => {
    const r = cmd.createPurchaseOrder(p.supplierId, [{ sku: p.sku, qty: suggested }], 'Reorder drafted from ' + p.sku);
    if (!r.ok) { toast(r.message, 'bad'); return; }
    toast('Draft ' + r.value + ' created for ' + sup.name + '.'); nav('/purchase-orders/' + r.value);
  };

  const cols: Array<Column<StockMovement>> = [
    { id: 'w', header: 'When', primary: true, sort: (m) => m.at, cell: (m) => fmtStamp(m.at) },
    { id: 't', header: 'Event', cell: (m) => <span style={{ textTransform: 'capitalize' }}>{m.type}</span> },
    { id: 'r', header: 'Reference', cell: (m) => <div>{m.ref}{m.reason && <div className="cell-sub">{m.reason}</div>}</div> },
    { id: 'b', header: 'By', cell: (m) => m.by },
    { id: 'd', header: 'Change', num: true, sort: (m) => m.delta, cell: (m) => <b style={{ color: m.delta < 0 ? 'var(--bad)' : 'var(--ok)' }}>{m.delta > 0 ? '+' : ''}{m.delta}</b> },
  ];

  return (
    <Page>
      <PageHeader crumbs={[{ label: 'Inventory', to: '/inventory' }, { label: p.sku }]} title={<span className="row" style={{ gap: 12, flexWrap: 'nowrap' }}><Thumb product={p} size={44} />{p.name}</span>}
        sub={<><span className="mono">{p.sku}</span> · <Chip tone={st === 'out' ? 'bad' : st === 'low' ? 'warn' : 'ok'}>{st === 'out' ? 'Out of stock' : st === 'low' ? 'Below reorder point' : 'Healthy'}</Chip></>}
        actions={<><Link className="btn" to={'/variants/' + p.sku}>Product details</Link><Button onClick={() => setOpen(true)}><ClipboardEdit />Adjust stock</Button><Button variant="primary" onClick={draftReorder} disabled={!!openPo} title={openPo ? openPo.no + ' already covers this item' : undefined}><PackagePlus />Draft reorder</Button></>} />
      {openPo && <Block><Notice tone="info" title={openPo.no + ' is ' + openPo.status.toLowerCase()}>It already includes this item, so a new reorder is not offered. <Link className="link" to={'/purchase-orders/' + openPo.no}>Open the order</Link>.</Notice><div style={{ height: 14 }} /></Block>}
      <Block className="grid c4 keep2">
        <Metric label="On hand" value={total} foot={'reorder at ' + p.reorderPoint} />
        <Metric label="Available" value={stockAvailable(s, p.sku)} foot={lv.reserved + ' reserved'} />
        <Metric label="Damaged" value={lv.damaged} foot="held back from sale" />
        <Metric label="Cover" value={cover === null ? '—' : cover + ' d'} foot={soldUnits(s, p.sku) + ' sold in 30 days'} />
      </Block>
      {st !== 'ok' && <><div style={{ height: 14 }} /><Block><Notice tone="warn" title="SiBorg suggests a reorder">Order {suggested} from {sup.name}{MIN_LINE_QTY[p.supplierId] ? ' (their minimum is ' + MIN_LINE_QTY[p.supplierId] + ' per line)' : ''}. That covers the 30-day sales rate. Nothing is ordered until a manager places the draft.</Notice></Block></>}
      <div style={{ height: 16 }} />
      {p.tracking === 'batch' && <Block><Panel title="Batches" hint="Sold first-expiry-first-out"><div className="grid c3">{s.batches.filter((b) => b.sku === p.sku).map((b) => <div key={b.batch} className="stat-line" style={{ display: 'block' }}><b className="mono">{b.batch}</b><div className="muted">Expires {fmtDate(b.expiry)}</div><b className="num">{b.qty} units</b></div>)}</div></Panel><div style={{ height: 16 }} /></Block>}
      <Block>
        <Panel title="Stock events" hint="Append-only history behind the figure above" flush>
          <DataTable label="Stock events" rows={rows} rowKey={(m) => m.id} columns={cols} pageSize={10} filters={<FilterChips label="Event type" value={type} onChange={setType} options={[{ value: 'all', label: 'All' }, { value: 'sale', label: 'Sales' }, { value: 'receipt', label: 'Receipts' }, { value: 'adjustment', label: 'Adjustments' }, { value: 'return', label: 'Returns' }]} />} />
        </Panel>
      </Block>

      <Dialog open={open} onClose={() => setOpen(false)} wide title={'Adjust ' + p.name} footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={submit}>Record stock event</Button></>}>
        <div className="stack">
          <Notice tone="info">Quantities are never typed straight into a field. This creates a stock event with a reason, who made it and when.</Notice>
          <div className="form-grid">
            <Field label="Event type" help={kd.hint}>{(id) => <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>{KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</Select>}</Field>
            <Field label={kd.sign === 0 ? 'Change (use − to remove)' : 'Units'} error={err && !delta ? err : undefined}>{(id) => <Input id={id} inputMode="numeric" value={qty} onChange={(e) => { setQty(e.target.value); setErr(''); }} autoFocus />}</Field>
            <Field label="Reason" error={err && delta ? err : undefined} className="span2">{(id) => <Input id={id} value={reason} onChange={(e) => { setReason(e.target.value); setErr(''); }} placeholder="For example: recount after stocktake" />}</Field>
          </div>
          <Flow before={total} delta={delta} after={after} />
          {after < 0 && <p style={{ color: 'var(--bad)', fontWeight: 600 }} role="alert">This would take on hand below zero.</p>}
        </div>
      </Dialog>
    </Page>
  );
}
