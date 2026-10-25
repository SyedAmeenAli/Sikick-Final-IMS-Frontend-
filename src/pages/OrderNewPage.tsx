import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { Block, Button, Field, Input, Notice, Page, PageHeader, Panel, Segmented, Select } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Overlay';
import { fmt } from '@/lib/money';
import { priceCart, type Discount } from '@/lib/pricing';
import { useCommands, useIms } from '@/services';
import { product, stockAvailable } from '@/services/selectors';
import type { Order } from '@/services/contracts/types';

export default function OrderNewPage() {
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  const nav = useNavigate();
  const [customerId, setCustomerId] = useState('CUS-033');
  const [channel, setChannel] = useState<Order['channel']>('Wholesale');
  const [lines, setLines] = useState<Array<{ sku: string; qty: string }>>([]);
  const [dk, setDk] = useState<'percent' | 'flat'>('percent');
  const [dv, setDv] = useState('');
  const [err, setErr] = useState('');
  const n = parseFloat(dv);
  const discount: Discount | null = isFinite(n) && n > 0 ? { kind: dk, value: dk === 'flat' ? Math.round(n * 100) : n } : null;
  const valid = lines.filter((l) => (parseInt(l.qty) || 0) > 0);
  const totals = priceCart(valid.map((l) => { const p = product(s, l.sku); return { sku: l.sku, unit: p.price, qty: parseInt(l.qty), gst: p.gst }; }), discount);

  const save = () => {
    const over = valid.find((l) => parseInt(l.qty) > stockAvailable(s, l.sku));
    if (over) { setErr(product(s, over.sku).name + ': only ' + stockAvailable(s, over.sku) + ' available.'); return; }
    const r = cmd.createOrder({ customerId, channel, lines: valid.map((l) => ({ sku: l.sku, qty: parseInt(l.qty) })), discount });
    if (!r.ok) { setErr(r.message); return; }
    toast('Draft order ' + r.value + ' created. Confirm it to reserve stock.'); nav('/orders/' + encodeURIComponent(r.value));
  };

  return (
    <Page>
      <PageHeader crumbs={[{ label: 'Orders', to: '/orders' }, { label: 'New' }]} title="New order" sub="For counter, phone and wholesale orders. It starts as a draft: stock is only reserved when you confirm it." />
      <Block className="grid main-side">
        <Panel title="Items"><div className="stack">
          <div className="form-grid">
            <Field label="Customer">{(id) => <Select id={id} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>{s.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>}</Field>
            <Field label="Channel">{(id) => <Select id={id} value={channel} onChange={(e) => setChannel(e.target.value as Order['channel'])}>{['Counter', 'Wholesale', 'Online'].map((c) => <option key={c}>{c}</option>)}</Select>}</Field>
          </div>
          <div>
            {lines.map((l, i) => { const p = product(s, l.sku); return (
              <div key={l.sku} className="list-row">
                <div className="grow"><div className="t">{p.name}</div><div className="d"><span className="mono">{l.sku}</span> · {fmt(p.price)} · {stockAvailable(s, l.sku)} available</div></div>
                <Input aria-label={'Quantity of ' + p.name} inputMode="numeric" style={{ width: 84 }} value={l.qty} onChange={(e) => setLines((x) => x.map((y, j) => (j === i ? { ...y, qty: e.target.value } : y)))} />
                <Button variant="ghost" size="sm" icon aria-label={'Remove ' + p.name} onClick={() => setLines((x) => x.filter((_, j) => j !== i))}><Trash2 /></Button>
              </div>); })}
            {!lines.length && <p className="muted" style={{ padding: '12px 0' }}>Choose a product to add.</p>}
          </div>
          <Select aria-label="Add an item" value="" onChange={(e) => { const v = e.target.value; if (v && !lines.some((l) => l.sku === v)) setLines((x) => [...x, { sku: v, qty: '1' }]); }} style={{ maxWidth: 320 }}>
            <option value="">Add an item…</option>{s.products.filter((p) => !lines.some((l) => l.sku === p.sku)).map((p) => <option key={p.sku} value={p.sku}>{p.name} · {p.sku}</option>)}
          </Select>
        </div></Panel>
        <Panel title="Summary"><div className="stack">
          <div className="row"><Segmented label="Discount type" value={dk} onChange={setDk} options={[{ value: 'percent', label: '%' }, { value: 'flat', label: '₹' }]} /><Input aria-label="Discount" inputMode="decimal" value={dv} onChange={(e) => setDv(e.target.value)} placeholder="Discount" style={{ flex: 1 }} /></div>
          <div className="stat-line"><span className="muted">Subtotal</span><span className="num">{fmt(totals.subtotal)}</span></div>
          {totals.discount > 0 && <div className="stat-line"><span className="muted">Discount</span><span className="num">−{fmt(totals.discount)}</span></div>}
          <div className="stat-line"><span className="muted">GST</span><span className="num">{fmt(totals.tax)}</span></div>
          <div className="stat-line"><b>Total</b><b className="num" style={{ fontSize: 'var(--fs-xl)' }}>{fmt(totals.total)}</b></div>
          {err && <Notice tone="bad">{err}</Notice>}
          <Button variant="primary" disabled={!valid.length} onClick={save}>Create draft order</Button>
        </div></Panel>
      </Block>
    </Page>
  );
}
