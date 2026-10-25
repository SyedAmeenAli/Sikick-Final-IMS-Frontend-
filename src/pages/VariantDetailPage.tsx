import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Block, Button, Chip, Field, Input, Metric, Page, PageHeader, Panel, Select } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Overlay';
import { Barcode, Thumb } from '@/components/Barcode';
import { fmt, rupees } from '@/lib/money';
import { fmtDate, fmtStamp } from '@/lib/format';
import { useCommands, useIms } from '@/services';
import { coverDays, familyName, soldUnits, stockState, stockTotal, variantLabel } from '@/services/selectors';
import NotFoundPage from './NotFoundPage';

export default function VariantDetailPage() {
  const { variantId = '' } = useParams();
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  const p = s.products.find((x) => x.sku === variantId);
  const [f, setF] = useState<{ price: string; cost: string; reorder: string; gst: string; hsn: string } | null>(null);
  if (!p) return <NotFoundPage />;
  const form = f ?? { price: String(p.price / 100), cost: String(p.cost / 100), reorder: String(p.reorderPoint), gst: String(p.gst), hsn: p.hsn };
  const dirty = f !== null && (f.price !== String(p.price / 100) || f.cost !== String(p.cost / 100) || f.reorder !== String(p.reorderPoint) || f.gst !== String(p.gst) || f.hsn !== p.hsn);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...form, [k]: e.target.value });
  const st = stockState(s, p.sku);
  const serials = s.serials.filter((x) => x.sku === p.sku);
  const batches = s.batches.filter((b) => b.sku === p.sku);
  const moves = s.movements.filter((m) => m.sku === p.sku).slice(-8).reverse();

  const save = () => {
    const r = cmd.updateProduct(p.sku, { price: rupees(parseFloat(form.price)), cost: rupees(parseFloat(form.cost) || 0), reorderPoint: Number(form.reorder), gst: Number(form.gst), hsn: form.hsn });
    if (!r.ok) { toast(r.message, 'bad'); return; }
    toast('Saved ' + p.sku + '.'); setF(null);
  };

  return (
    <Page>
      <PageHeader crumbs={[{ label: 'Products', to: '/products' }, { label: familyName(p), to: '/products/' + p.sku }, { label: variantLabel(p) }]} title={<span className="row" style={{ gap: 12, flexWrap: 'nowrap' }}><Thumb product={p} size={44} />{p.name}</span>}
        sub={<><span className="mono">{p.sku}</span> · {p.category} · <Chip tone={st === 'out' ? 'bad' : st === 'low' ? 'warn' : 'ok'}>{st === 'out' ? 'Out of stock' : st === 'low' ? 'Low stock' : 'In stock'}</Chip></>}
        actions={<Link className="btn btn-primary" to={'/inventory/' + p.sku}>Open stock</Link>} />
      <Block className="grid c4 keep2">
        <Metric label="On hand" value={stockTotal(s, p.sku)} foot={'reorder at ' + p.reorderPoint} />
        <Metric label="Sold, 30 days" value={soldUnits(s, p.sku)} foot="units" />
        <Metric label="Cover" value={coverDays(s, p.sku) === null ? '—' : coverDays(s, p.sku) + ' d'} foot="at 30-day rate" />
        <Metric label="Price" value={fmt(p.price)} foot={'+ GST ' + p.gst + '%'} />
      </Block>
      <div style={{ height: 16 }} />
      <Block className="grid main-side">
        <Panel title="Variant details" hint="Quantities are not editable here. Change them with a reasoned stock adjustment.">
          <div className="form-grid">
            <Field label="Selling price (₹)">{(id) => <Input id={id} inputMode="decimal" value={form.price} onChange={set('price')} />}</Field>
            <Field label="Cost price (₹)">{(id) => <Input id={id} inputMode="decimal" value={form.cost} onChange={set('cost')} />}</Field>
            <Field label="Reorder point">{(id) => <Input id={id} inputMode="numeric" value={form.reorder} onChange={set('reorder')} />}</Field>
            <Field label="GST rate">{(id) => <Select id={id} value={form.gst} onChange={set('gst')}>{[0, 5, 12, 18, 28].map((g) => <option key={g} value={g}>{g}%</option>)}</Select>}</Field>
            <Field label="HSN code">{(id) => <Input id={id} value={form.hsn} onChange={set('hsn')} />}</Field>
            <Field label="Unit">{(id) => <Input id={id} value={p.unit} readOnly />}</Field>
          </div>
          <div className="form-foot">{dirty ? <span className="dirty-note">● Unsaved changes</span> : <span className="muted">Nothing changed</span>}<span className="actions"><Button disabled={!dirty} onClick={() => setF(null)}>Discard</Button><Button variant="primary" disabled={!dirty} onClick={save}>Save changes</Button></span></div>
        </Panel>
        <Panel title="Barcode"><div className="stack" style={{ alignItems: 'center' }}><Barcode code={p.barcode} /><span className="muted">EAN-13 · prints from the Barcode Center</span><Link className="btn btn-sm" to="/barcodes/generate">Make a label</Link></div></Panel>
      </Block>
      <div style={{ height: 16 }} />
      <Block className="grid c2">
        {p.tracking === 'serial' && (
          <Panel title="Serial numbers" hint={serials.filter((x) => x.state === 'in_stock').length + ' in stock · ' + serials.filter((x) => x.state === 'sold').length + ' sold'}>
            {serials.slice(-6).reverse().map((x) => <div key={x.serial} className="stat-line"><span className="mono">{x.serial}</span><span>{x.state === 'sold' ? <>Sold on {x.orderNo} · <Link className="link" to={'/warranty?serial=' + x.serial}>warranty</Link></> : <Chip tone="ok">In stock</Chip>}</span></div>)}
          </Panel>
        )}
        {p.tracking === 'batch' && (
          <Panel title="Batches and expiry" hint="Sold first-expiry-first-out">
            {batches.map((b) => <div key={b.batch} className="stat-line"><span><b className="mono">{b.batch}</b> <span className="muted">expires {fmtDate(b.expiry)}</span></span><b className="num">{b.qty}</b></div>)}
          </Panel>
        )}
        <Panel title="Recent stock events" actions={<Link className="link" to={'/inventory/' + p.sku}>All events</Link>}>
          {moves.map((m) => <div key={m.id} className="stat-line"><span>{fmtStamp(m.at)} · <span style={{ textTransform: 'capitalize' }}>{m.type}</span> <span className="muted">{m.ref}</span></span><b className="num" style={{ color: m.delta < 0 ? 'var(--bad)' : 'var(--ok)' }}>{m.delta > 0 ? '+' : ''}{m.delta}</b></div>)}
        </Panel>
      </Block>
    </Page>
  );
}
