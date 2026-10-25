import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Search } from 'lucide-react';
import { Block, Button, Chip, Input, Page, PageHeader, Panel } from '@/components/ui/primitives';
import { Thumb } from '@/components/Barcode';
import { RecogniseDialog } from '@/features/catalog/RecogniseDialog';
import { ArtBox } from '@/components/illustrations';
import { fmt } from '@/lib/money';
import { useIms } from '@/services';
import { stockAvailable, stockState } from '@/services/selectors';

export default function CatalogSearchPage() {
  const s = useIms();
  const [q, setQ] = useState('');
  const [photo, setPhoto] = useState(false);
  const n = q.trim().toLowerCase();
  const hits = n ? s.products.filter((p) => (p.name + ' ' + p.sku + ' ' + p.barcode + ' ' + p.brand + ' ' + p.category + ' ' + p.type).toLowerCase().includes(n)) : [];
  return (
    <Page narrow>
      <PageHeader title="Catalogue search" sub="Find any variant by name, SKU, barcode, brand or category." actions={<Button onClick={() => setPhoto(true)}><Camera />Search by photo</Button>} />
      <Block><div className="input-icon"><Search aria-hidden /><Input className="" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try “earbuds”, “SKU-4120” or “stationery”" aria-label="Search the catalogue" autoFocus style={{ minHeight: 48, fontSize: 'var(--fs-lg)' }} /></div></Block>
      <div style={{ height: 16 }} />
      <Block><Panel flush>
        {!n && <div className="empty"><ArtBox /><h3>Start typing to search</h3><p>Results show price and what is available right now.</p></div>}
        {n && hits.length === 0 && <div className="empty"><ArtBox /><h3>No match for “{q}”</h3><p>Try fewer letters, or search by photo.</p></div>}
        {hits.map((p) => { const st = stockState(s, p.sku); return (
          <Link key={p.sku} to={'/variants/' + p.sku} className="list-row" style={{ padding: '12px 18px' }}>
            <Thumb product={p} /><div className="grow"><div className="t">{p.name}</div><div className="d"><span className="mono">{p.sku}</span> · {p.category} · {p.brand}</div></div>
            <div style={{ textAlign: 'right' }}><div className="t num">{fmt(p.price)}</div><Chip tone={st === 'out' ? 'bad' : st === 'low' ? 'warn' : 'ok'} plain>{stockAvailable(s, p.sku)} available</Chip></div>
          </Link>); })}
      </Panel></Block>
      <RecogniseDialog open={photo} onClose={() => setPhoto(false)} onUse={() => setPhoto(false)} />
    </Page>
  );
}
