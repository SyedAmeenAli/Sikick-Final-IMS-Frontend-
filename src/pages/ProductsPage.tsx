import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, Plus, Upload } from 'lucide-react';
import { Block, Button, Chip, FilterChips, Metric, Page, PageHeader, Panel } from '@/components/ui/primitives';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Thumb } from '@/components/Barcode';
import { NewProductDialog } from '@/features/catalog/NewProductDialog';
import { RecogniseDialog } from '@/features/catalog/RecogniseDialog';
import { ArtBox } from '@/components/illustrations';
import { fmtShort } from '@/lib/money';
import { useIms } from '@/services';
import { families, stockState, stockTotal, type Family } from '@/services/selectors';

export default function ProductsPage() {
  const s = useIms();
  const nav = useNavigate();
  const [cat, setCat] = useState('All');
  const [creating, setCreating] = useState(false);
  const [recognise, setRecognise] = useState(false);
  const all = families(s);
  const rows = all.filter((f) => cat === 'All' || f.category === cat);
  const stock = (f: Family) => f.variants.reduce((a, v) => a + stockTotal(s, v.sku), 0);
  const range = (f: Family) => { const p = f.variants.map((v) => v.price); const a = Math.min(...p), b = Math.max(...p); return a === b ? fmtShort(a) : fmtShort(a) + ' – ' + fmtShort(b); };
  const status = (f: Family) => (f.variants.some((v) => stockState(s, v.sku) === 'out') ? 'out' : f.variants.some((v) => stockState(s, v.sku) === 'low') ? 'low' : 'ok');

  const cols: Array<Column<Family>> = [
    { id: 'n', header: 'Product', primary: true, sort: (f) => f.name, cell: (f) => <span className="row" style={{ gap: 11, flexWrap: 'nowrap' }}><Thumb product={f.variants[0]} /><span><div className="cell-main">{f.name}</div><div className="cell-sub">{f.variants.length > 1 ? f.variants.length + ' variants' : <span className="mono">{f.variants[0].sku}</span>} · {f.brand}</div></span></span> },
    { id: 'c', header: 'Category', sort: (f) => f.category, cell: (f) => f.category },
    { id: 't', header: 'Type', cell: (f) => f.type },
    { id: 'p', header: 'Price', num: true, sort: (f) => Math.min(...f.variants.map((v) => v.price)), cell: (f) => range(f) },
    { id: 'q', header: 'On hand', num: true, sort: stock, cell: (f) => stock(f) },
    { id: 's', header: 'Status', cell: (f) => { const st = status(f); return <Chip tone={st === 'out' ? 'bad' : st === 'low' ? 'warn' : 'ok'}>{st === 'out' ? 'Out of stock' : st === 'low' ? 'Low stock' : 'In stock'}</Chip>; } },
  ];

  return (
    <Page>
      <PageHeader title="Products" sub="Everything you sell, grouped by product with a SKU for each variant."
        actions={<><Link to="/import" className="btn"><Upload />Import</Link><Button onClick={() => setRecognise(true)}><Camera />Recognise from photo</Button><Button variant="primary" onClick={() => setCreating(true)}><Plus />New product</Button></>} />
      <Block className="grid c4 keep2" >
        <Metric label="Products" value={all.length} foot={s.products.length + ' variants (SKUs)'} />
        <Metric label="Categories" value={s.categories.length} to="/categories" foot="Open categories" />
        <Metric label="Low or out of stock" value={s.products.filter((p) => stockState(s, p.sku) !== 'ok').length} to="/alerts" foot="Variants" />
        <Metric label="Tracked units" value={s.products.filter((p) => p.tracking !== 'none').length} foot="Serial or batch" />
      </Block>
      <div style={{ height: 16 }} />
      <Block>
        <Panel flush>
          <DataTable label="Products" rows={rows} rowKey={(f) => f.id} columns={cols} searchText={(f) => f.name + ' ' + f.variants.map((v) => v.sku + ' ' + v.barcode).join(' ') + ' ' + f.brand} searchPlaceholder="Search by name, SKU or barcode"
            onRowClick={(f) => nav('/products/' + f.id)} empty={{ title: 'No products here', body: 'Create a product or import a catalogue.', art: <ArtBox /> }}
            filters={<FilterChips label="Category" value={cat} onChange={setCat} options={['All', ...s.categories.map((c) => c.name)].map((c) => ({ value: c, label: c }))} />} />
        </Panel>
      </Block>
      <NewProductDialog open={creating} onClose={() => setCreating(false)} />
      <RecogniseDialog open={recognise} onClose={() => { setRecognise(false); }} onUse={() => { setRecognise(false); setCreating(true); }} />
    </Page>
  );
}
