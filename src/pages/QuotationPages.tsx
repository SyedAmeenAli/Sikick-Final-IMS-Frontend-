import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { Block, Button, Chip, Field, Metric, Page, PageHeader, Panel, Select, Input, StatusChip } from '@/components/ui/primitives';
import { Dialog, useToast } from '@/components/ui/Overlay';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ArtDoc } from '@/components/illustrations';
import { fmt } from '@/lib/money';
import { fmtDate } from '@/lib/format';
import { useCommands, useIms } from '@/services';
import { customerOf, lineSum, product } from '@/services/selectors';
import type { Quotation } from '@/services/contracts/types';
import NotFoundPage from './NotFoundPage';

const qTotal = (q: Quotation) => lineSum(q.lines).total;

export function QuotationsPage() {
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [cid, setCid] = useState('CUS-037');
  const [lines, setLines] = useState<Array<{ sku: string; qty: string }>>([]);
  const cols: Array<Column<Quotation>> = [
    { id: 'n', header: 'Quotation', primary: true, sort: (q) => q.no, cell: (q) => <span className="cell-main mono">{q.no}</span> },
    { id: 'c', header: 'Customer', cell: (q) => customerOf(s, q.customerId).name },
    { id: 'd', header: 'Issued', sort: (q) => q.date, cell: (q) => fmtDate(q.date) },
    { id: 'v', header: 'Valid until', cell: (q) => fmtDate(q.validUntil) },
    { id: 't', header: 'Total', num: true, sort: qTotal, cell: (q) => <b>{fmt(qTotal(q))}</b> },
    { id: 's', header: 'Status', cell: (q) => <StatusChip status={q.status} /> },
  ];
  const create = () => {
    const ls = lines.filter((l) => parseInt(l.qty) > 0).map((l) => { const p = product(s, l.sku); return { sku: l.sku, qty: parseInt(l.qty), unit: p.price, gst: p.gst, discount: 0 }; });
    const r = cmd.createQuotation(cid, ls);
    if (!r.ok) { toast(r.message, 'bad'); return; }
    toast('Draft quotation ' + r.value + ' created.'); setOpen(false); setLines([]); nav('/quotations/' + r.value);
  };
  return (
    <Page>
      <PageHeader title="Quotations" sub="Offer a price, wait for a yes, then turn it into an order." actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus />New quotation</Button>} />
      <Block className="grid c3">
        <Metric label="Out for a decision" value={s.quotations.filter((q) => q.status === 'sent').length} foot="sent to customers" />
        <Metric label="Accepted" value={s.quotations.filter((q) => q.status === 'accepted').length} foot="ready to convert" />
        <Metric label="Quoted value" value={fmt(s.quotations.filter((q) => q.status === 'sent' || q.status === 'accepted').reduce((a, q) => a + qTotal(q), 0))} foot="sent and accepted" />
      </Block>
      <div style={{ height: 16 }} />
      <Block><Panel flush><DataTable label="Quotations" rows={[...s.quotations].reverse()} rowKey={(q) => q.no} columns={cols} onRowClick={(q) => nav('/quotations/' + q.no)} searchText={(q) => q.no + ' ' + customerOf(s, q.customerId).name} empty={{ title: 'No quotations', art: <ArtDoc /> }} /></Panel></Block>
      <Dialog open={open} onClose={() => setOpen(false)} title="New quotation" footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" disabled={!lines.length} onClick={create}>Create draft</Button></>}>
        <div className="stack">
          <Field label="Customer">{(id) => <Select id={id} value={cid} onChange={(e) => setCid(e.target.value)}>{s.customers.filter((c) => c.id !== 'CUS-000').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}</Field>
          {lines.map((l, i) => <div key={l.sku} className="list-row"><div className="grow t">{product(s, l.sku).name}</div><Input aria-label="Quantity" inputMode="numeric" style={{ width: 84 }} value={l.qty} onChange={(e) => setLines((x) => x.map((y, j) => (j === i ? { ...y, qty: e.target.value } : y)))} /><Button variant="ghost" size="sm" icon aria-label="Remove" onClick={() => setLines((x) => x.filter((_, j) => j !== i))}><Trash2 /></Button></div>)}
          <Select aria-label="Add an item" value="" onChange={(e) => { const v = e.target.value; if (v) setLines((x) => [...x, { sku: v, qty: '10' }]); }}><option value="">Add an item…</option>{s.products.filter((p) => !lines.some((l) => l.sku === p.sku)).map((p) => <option key={p.sku} value={p.sku}>{p.name}</option>)}</Select>
        </div>
      </Dialog>
    </Page>
  );
}

export function QuotationDetailPage() {
  const { id = '' } = useParams();
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  const nav = useNavigate();
  const q = s.quotations.find((x) => x.no === id);
  if (!q) return <NotFoundPage />;
  const t = lineSum(q.lines);
  return (
    <Page narrow>
      <PageHeader crumbs={[{ label: 'Quotations', to: '/quotations' }, { label: q.no }]} title={<span className="row" style={{ gap: 12 }}>{q.no}<StatusChip status={q.status} /></span>} sub={customerOf(s, q.customerId).name + ' · valid until ' + fmtDate(q.validUntil)}
        actions={q.status === 'accepted' ? <Button variant="primary" onClick={() => { const r = cmd.convertQuotation(q.no); if (r.ok) { toast('Converted to order ' + r.value + '. Confirm it to reserve stock.'); nav('/orders/' + encodeURIComponent(r.value)); } else toast(r.message, 'bad'); }}>Convert to order</Button> : <Chip tone="neutral">{q.status === 'converted' ? 'Already an order' : 'Cannot convert yet'}</Chip>} />
      <Block><Panel flush>
        <div className="tbl-wrap"><table className="tbl" data-cards aria-label="Quoted items">
          <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Price</th><th className="num">GST</th><th className="num">Amount</th></tr></thead>
          <tbody>{q.lines.map((l) => <tr key={l.sku}><td data-label="Item" data-primary="true"><Link className="link" to={'/variants/' + l.sku}>{product(s, l.sku).name}</Link></td><td data-label="Qty" className="num">{l.qty}</td><td data-label="Price" className="num">{fmt(l.unit)}</td><td data-label="GST" className="num">{l.gst}%</td><td data-label="Amount" className="num">{fmt(l.unit * l.qty + Math.round((l.unit * l.qty * l.gst) / 100))}</td></tr>)}</tbody></table></div>
        <div style={{ padding: '14px 18px', display: 'grid', justifyItems: 'end', gap: 6, borderTop: '1px solid var(--line)' }}><div className="stat-line" style={{ width: 260 }}><span className="muted">GST</span><span className="num">{fmt(t.tax)}</span></div><div className="stat-line" style={{ width: 260 }}><b>Total</b><b className="num">{fmt(t.total)}</b></div></div>
      </Panel></Block>
    </Page>
  );
}
