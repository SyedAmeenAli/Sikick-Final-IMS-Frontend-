import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ImagePlus, Pencil } from 'lucide-react';
import { Block, Button, Chip, Field, Input, Metric, Page, PageHeader, Panel } from '@/components/ui/primitives';
import { Tabs } from '@/components/ui/Tabs';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog, useToast } from '@/components/ui/Overlay';
import { Thumb } from '@/components/Barcode';
import { fmt, fmtShort, rupees } from '@/lib/money';
import { fmtStamp } from '@/lib/format';
import { useCommands, useIms } from '@/services';
import { coverDays, familyOf, soldUnits, stockState, stockTotal, variantLabel } from '@/services/selectors';
import type { Product } from '@/services/contracts/types';
import NotFoundPage from './NotFoundPage';

type Tab = 'overview' | 'variants' | 'pricing' | 'activity';

export default function ProductDetailPage({ tab: initial = 'overview' }: { tab?: Tab }) {
  const { productId = '' } = useParams();
  const s = useIms();
  const nav = useNavigate();
  const cmd = useCommands();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>(initial);
  const [edit, setEdit] = useState<Product | null>(null);
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const fam = familyOf(s, productId);
  if (!fam) return <NotFoundPage />;

  const stock = fam.variants.reduce((a, v) => a + stockTotal(s, v.sku), 0);
  const sold = fam.variants.reduce((a, v) => a + soldUnits(s, v.sku), 0);
  const skus = new Set(fam.variants.map((v) => v.sku));
  const moves = s.movements.filter((m) => skus.has(m.sku) && m.type !== 'opening').slice(-12).reverse();

  const varCols: Array<Column<Product>> = [
    { id: 'v', header: 'Variant', primary: true, cell: (v) => <div><div className="cell-main">{variantLabel(v)}</div><div className="cell-sub mono">{v.sku}</div></div> },
    { id: 'b', header: 'Barcode', cell: (v) => <span className="mono">{v.barcode}</span> },
    { id: 'p', header: 'Price', num: true, sort: (v) => v.price, cell: (v) => fmt(v.price) },
    { id: 'q', header: 'On hand', num: true, sort: (v) => stockTotal(s, v.sku), cell: (v) => stockTotal(s, v.sku) },
    { id: 'c', header: 'Cover', num: true, cell: (v) => { const c = coverDays(s, v.sku); return c === null ? '—' : c + ' days'; } },
    { id: 's', header: 'Status', cell: (v) => { const st = stockState(s, v.sku); return <Chip tone={st === 'out' ? 'bad' : st === 'low' ? 'warn' : 'ok'}>{st === 'out' ? 'Out' : st === 'low' ? 'Low' : 'In stock'}</Chip>; } },
  ];

  const savePrice = () => {
    if (!edit) return;
    const p = parseFloat(price);
    const r = cmd.updateProduct(edit.sku, { price: rupees(p), cost: rupees(parseFloat(cost) || 0) });
    if (!r.ok) { toast(r.message, 'bad'); return; }
    toast('Price updated for ' + edit.sku + '.'); setEdit(null);
  };

  return (
    <Page>
      <PageHeader crumbs={[{ label: 'Products', to: '/products' }, { label: fam.name }]} title={fam.name}
        sub={fam.category + ' · ' + fam.type + ' · ' + fam.brand + ' · ' + fam.variants.length + (fam.variants.length === 1 ? ' variant' : ' variants')}
        actions={<><Link className="btn" to={'/products/' + fam.id + '/variants'}>Manage variants</Link><Link className="btn btn-primary" to={'/inventory/' + fam.variants[0].sku}>Open stock</Link></>} />
      <Block className="grid c4 keep2">
        <Metric label="On hand" value={stock} foot={'across ' + fam.variants.length + (fam.variants.length === 1 ? ' variant' : ' variants')} />
        <Metric label="Sold, 30 days" value={sold} foot="units" />
        <Metric label="Price" value={fam.variants.length === 1 ? fmtShort(fam.variants[0].price) : fmtShort(Math.min(...fam.variants.map((v) => v.price))) + '+'} foot="before GST" />
        <Metric label="Margin" value={Math.round(((fam.variants[0].price - fam.variants[0].cost) / fam.variants[0].price) * 100) + '%'} foot="on first variant" />
      </Block>
      <div style={{ height: 16 }} />
      <Block><Tabs label="Product sections" value={tab} onChange={setTab} tabs={[{ id: 'overview', label: 'Overview' }, { id: 'variants', label: 'Variants', count: fam.variants.length }, { id: 'pricing', label: 'Pricing' }, { id: 'activity', label: 'Movement' }]} /></Block>
      <div style={{ height: 16 }} />
      {tab === 'overview' && (
        <Block className="grid main-side">
          <Panel title="Details">
            <dl className="kv">
              <dt>Category</dt><dd>{fam.category}</dd><dt>Product type</dt><dd>{fam.type}</dd><dt>Brand</dt><dd>{fam.brand}</dd>
              <dt>HSN / GST</dt><dd>{fam.variants[0].hsn} · {fam.variants[0].gst}%</dd><dt>Unit</dt><dd>{fam.variants[0].unit}</dd>
              <dt>Tracking</dt><dd>{fam.variants[0].tracking === 'none' ? 'Not tracked' : fam.variants[0].tracking === 'serial' ? 'Serial numbers with warranty' : 'Batch and expiry'}</dd>
              <dt>Usual supplier</dt><dd><Link className="link" to="/suppliers">{s.suppliers.find((x) => x.id === fam.variants[0].supplierId)?.name}</Link></dd>
            </dl>
          </Panel>
          <Panel title="Photo" hint="Kept in this browser only">
            <div className="stack" style={{ alignItems: 'center' }}>
              {photo ? <img src={photo} alt={fam.name} style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12 }} /> : <Thumb product={fam.variants[0]} size={120} />}
              <label className="btn btn-sm" style={{ cursor: 'pointer' }}><ImagePlus />Upload photo<input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhoto(URL.createObjectURL(f)); }} /></label>
            </div>
          </Panel>
        </Block>
      )}
      {tab === 'variants' && <Block><Panel flush><DataTable label="Variants" rows={fam.variants} rowKey={(v) => v.sku} columns={varCols} onRowClick={(v) => nav('/variants/' + v.sku)} /></Panel></Block>}
      {tab === 'pricing' && (
        <Block><Panel flush>
          <div className="tbl-wrap"><table className="tbl" data-cards aria-label="Pricing">
            <thead><tr><th>Variant</th><th className="num">Cost</th><th className="num">Price</th><th className="num">GST</th><th className="num">Price with GST</th><th className="num">Margin</th><th /></tr></thead>
            <tbody>{fam.variants.map((v) => (
              <tr key={v.sku}>
                <td data-label="Variant" data-primary="true"><div className="cell-main">{variantLabel(v)}</div><div className="cell-sub mono">{v.sku}</div></td>
                <td data-label="Cost" className="num">{fmt(v.cost)}</td><td data-label="Price" className="num">{fmt(v.price)}</td><td data-label="GST" className="num">{v.gst}%</td>
                <td data-label="Price with GST" className="num">{fmt(v.price + Math.round((v.price * v.gst) / 100))}</td>
                <td data-label="Margin" className="num">{Math.round(((v.price - v.cost) / v.price) * 100)}%</td>
                <td><Button size="sm" onClick={() => { setEdit(v); setPrice(String(v.price / 100)); setCost(String(v.cost / 100)); }}><Pencil />Edit</Button></td>
              </tr>))}</tbody></table></div>
        </Panel></Block>
      )}
      {tab === 'activity' && (
        <Block><Panel title="Stock movement" hint="Quantities only change through these events" flush>
          <div className="tbl-wrap"><table className="tbl" data-cards aria-label="Recent stock events">
            <thead><tr><th>When</th><th>Variant</th><th>Event</th><th>Reference</th><th className="num">Change</th></tr></thead>
            <tbody>{moves.map((m) => (
              <tr key={m.id}><td data-label="When" data-primary="true">{fmtStamp(m.at)}</td><td data-label="Variant" className="mono">{m.sku}</td><td data-label="Event" style={{ textTransform: 'capitalize' }}>{m.type}</td><td data-label="Reference">{m.ref}{m.reason ? ' · ' + m.reason : ''}</td><td data-label="Change" className="num" style={{ color: m.delta < 0 ? 'var(--bad)' : 'var(--ok)' }}>{m.delta > 0 ? '+' : ''}{m.delta}</td></tr>))}</tbody></table></div>
        </Panel></Block>
      )}
      <Dialog open={!!edit} onClose={() => setEdit(null)} title={'Edit price, ' + (edit?.sku ?? '')} footer={<><Button onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" onClick={savePrice}>Save price</Button></>}>
        <div className="form-grid">
          <Field label="Selling price (₹)">{(id) => <Input id={id} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} autoFocus />}</Field>
          <Field label="Cost price (₹)">{(id) => <Input id={id} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />}</Field>
        </div>
      </Dialog>
    </Page>
  );
}
