import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { Block, Button, Field, Input, Notice, Page, PageHeader, Panel, Select } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Overlay';
import { lineTotals, fmt } from '@/lib/money';
import { MIN_LINE_QTY } from '@/data/fixtures/seed';
import { useCommands, useIms } from '@/services';
import { product, supplierOf } from '@/services/selectors';

export default function PurchaseOrderNewPage() {
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const pre = params.get('sku');
  const [supplierId, setSupplierId] = useState(pre ? product(s, pre)?.supplierId ?? 'SUP-01' : 'SUP-01');
  const [lines, setLines] = useState<Array<{ sku: string; qty: string }>>(pre ? [{ sku: pre, qty: '30' }] : []);
  const [adding, setAdding] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const min = MIN_LINE_QTY[supplierId] ?? 1;
  const sup = supplierOf(s, supplierId);

  const priced = lines.map((l) => { const p = product(s, l.sku); return { ...l, p, t: lineTotals(p.cost, Math.max(0, parseInt(l.qty) || 0), p.gst) }; });
  const total = priced.reduce((a, l) => a + l.t.total, 0);
  const tax = priced.reduce((a, l) => a + l.t.tax, 0);
  const bad = priced.filter((l) => (parseInt(l.qty) || 0) < min);

  const save = () => {
    if (!lines.length) { setErr('Add at least one line.'); return; }
    if (bad.length) { setErr(sup.name + ' needs at least ' + min + ' per line. Check ' + bad.map((b) => b.p.name).join(', ') + '.'); return; }
    const r = cmd.createPurchaseOrder(supplierId, lines.map((l) => ({ sku: l.sku, qty: parseInt(l.qty) })), note || undefined);
    if (!r.ok) { setErr(r.message); return; }
    toast('Draft ' + r.value + ' saved. It has not been sent to ' + sup.name + '.'); nav('/purchase-orders/' + r.value);
  };

  return (
    <Page>
      <PageHeader crumbs={[{ label: 'Purchase orders', to: '/purchase-orders' }, { label: 'New' }]} title="New purchase order" sub="Saved as a draft. Nothing reaches the supplier until a manager places it." />
      <Block className="grid main-side">
        <Panel title="Items">
          <div className="stack">
            <Field label="Supplier">{(id) => <Select id={id} value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setLines([]); }}>{s.suppliers.filter((x) => x.status === 'active').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>}</Field>
            {min > 1 && <Notice tone="info">{sup.name} accepts a minimum of {min} units per line.</Notice>}
            <div>
              {priced.map((l, i) => (
                <div key={l.sku} className="list-row" style={{ flexWrap: 'wrap' }}>
                  <div className="grow"><div className="t">{l.p.name}</div><div className="d"><span className="mono">{l.sku}</span> · cost {fmt(l.p.cost)} + GST {l.p.gst}%</div></div>
                  <Input aria-label={'Quantity of ' + l.p.name} inputMode="numeric" value={l.qty} onChange={(e) => setLines((x) => x.map((y, j) => (j === i ? { ...y, qty: e.target.value } : y)))} style={{ width: 90 }} data-invalid={(parseInt(l.qty) || 0) < min} />
                  <b className="num" style={{ minWidth: 96, textAlign: 'right' }}>{fmt(l.t.total)}</b>
                  <Button variant="ghost" size="sm" icon aria-label={'Remove ' + l.p.name} onClick={() => setLines((x) => x.filter((_, j) => j !== i))}><Trash2 /></Button>
                </div>
              ))}
              {!lines.length && <p className="muted" style={{ padding: '14px 0' }}>No items yet.</p>}
            </div>
            <div className="row">
              <Select aria-label="Add an item" value={adding} onChange={(e) => { const v = e.target.value; if (v && !lines.some((l) => l.sku === v)) setLines((x) => [...x, { sku: v, qty: String(Math.max(min, 30)) }]); setAdding(''); }} style={{ maxWidth: 320 }}>
                <option value="">Add an item…</option>
                {s.products.filter((p) => !lines.some((l) => l.sku === p.sku)).map((p) => <option key={p.sku} value={p.sku}>{p.name} · {p.sku}</option>)}
              </Select><Plus size={16} color="var(--ink-3)" aria-hidden />
            </div>
          </div>
        </Panel>
        <Panel title="Summary">
          <div className="stack">
            <div className="stat-line"><span className="muted">Items</span><b className="num">{priced.reduce((a, l) => a + (parseInt(l.qty) || 0), 0)}</b></div>
            <div className="stat-line"><span className="muted">Subtotal</span><b className="num">{fmt(total - tax)}</b></div>
            <div className="stat-line"><span className="muted">GST</span><b className="num">{fmt(tax)}</b></div>
            <div className="stat-line"><b>Total</b><b className="num" style={{ fontSize: 'var(--fs-xl)' }}>{fmt(total)}</b></div>
            <Field label="Note for the supplier">{(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
            {err && <p role="alert" style={{ color: 'var(--bad)', fontWeight: 600 }}>{err}</p>}
            <Button variant="primary" onClick={save}>Save as draft</Button>
          </div>
        </Panel>
      </Block>
    </Page>
  );
}
