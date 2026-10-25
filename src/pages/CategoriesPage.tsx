import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { Block, Button, Chip, Field, Input, Page, PageHeader, Panel } from '@/components/ui/primitives';
import { Confirm, Dialog, useToast } from '@/components/ui/Overlay';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { fmtShort } from '@/lib/money';
import { useCommands, useIms } from '@/services';
import { stockTotal, stockValue } from '@/services/selectors';
import type { CategoryRec, ProductTypeRec } from '@/data/fixtures/seed';

export function CategoriesPage() {
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [del, setDel] = useState<CategoryRec | null>(null);

  const cols: Array<Column<CategoryRec>> = [
    { id: 'n', header: 'Category', primary: true, sort: (c) => c.name, cell: (c) => <div><div className="cell-main">{c.name}</div><div className="cell-sub">{c.note}</div></div> },
    { id: 'p', header: 'Variants', num: true, sort: (c) => s.products.filter((p) => p.category === c.name).length, cell: (c) => s.products.filter((p) => p.category === c.name).length },
    { id: 'u', header: 'Units on hand', num: true, cell: (c) => s.products.filter((p) => p.category === c.name).reduce((a, p) => a + stockTotal(s, p.sku), 0) },
    { id: 'v', header: 'Value at cost', num: true, cell: (c) => fmtShort(s.products.filter((p) => p.category === c.name).reduce((a, p) => a + stockValue(s, p.sku), 0)) },
    { id: 'x', header: '', cell: (c) => <Button size="sm" variant="ghost" icon aria-label={'Delete ' + c.name} onClick={() => setDel(c)}><Trash2 /></Button> },
  ];
  const add = () => { const r = cmd.addCategory(name, note); if (!r.ok) { setErr(r.message); return; } toast('Category “' + name.trim() + '” created.'); setOpen(false); setName(''); setNote(''); setErr(''); };

  return (
    <Page narrow>
      <PageHeader title="Categories" sub="How the catalogue is organised on the till and in reports." actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus />New category</Button>} />
      <Block><Panel flush><DataTable label="Categories" rows={s.categories} rowKey={(c) => c.id} columns={cols} pageSize={8} searchText={(c) => c.name} searchPlaceholder="Search categories" /></Panel></Block>
      <Dialog open={open} onClose={() => setOpen(false)} title="New category" footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={add}>Create</Button></>}>
        <div className="stack"><Field label="Name" error={err}>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoFocus />}</Field><Field label="Note">{(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} />}</Field></div>
      </Dialog>
      <Confirm open={!!del} onClose={() => setDel(null)} danger title={'Delete ' + (del?.name ?? '')} confirmLabel="Delete category" onConfirm={() => { const r = cmd.deleteCategory(del!.id); toast(r.ok ? 'Category deleted.' : r.message, r.ok ? 'ok' : 'bad'); }}>
        A category that still has products cannot be deleted. <Link className="link" to="/products">Review products</Link>.
      </Confirm>
    </Page>
  );
}

export function ProductTypesPage() {
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [attrs, setAttrs] = useState('');
  const cols: Array<Column<ProductTypeRec>> = [
    { id: 'n', header: 'Product type', primary: true, sort: (t) => t.name, cell: (t) => <span className="cell-main">{t.name}</span> },
    { id: 'u', header: 'Default unit', cell: (t) => t.unit },
    { id: 'a', header: 'Attributes', cell: (t) => <span className="row" style={{ gap: 5 }}>{t.attributes.map((a) => <Chip key={a} plain tone="neutral">{a}</Chip>)}</span> },
    { id: 'p', header: 'Variants', num: true, cell: (t) => s.products.filter((p) => p.type === t.name).length },
  ];
  return (
    <Page narrow>
      <PageHeader title="Product types" sub="Each type decides which attributes a variant carries, such as size, material or warranty." actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus />New product type</Button>} />
      <Block><Panel flush><DataTable label="Product types" rows={s.productTypes} rowKey={(t) => t.id} columns={cols} pageSize={10} /></Panel></Block>
      <Dialog open={open} onClose={() => setOpen(false)} title="New product type" footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => { const r = cmd.addProductType(name, attrs.split(',').map((x) => x.trim()).filter(Boolean)); if (!r.ok) { toast(r.message, 'bad'); return; } toast('Product type created.'); setOpen(false); setName(''); setAttrs(''); }}>Create</Button></>}>
        <div className="stack"><Field label="Name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoFocus />}</Field><Field label="Attributes" help="Separate with commas, for example Size, Colour.">{(id) => <Input id={id} value={attrs} onChange={(e) => setAttrs(e.target.value)} />}</Field></div>
      </Dialog>
    </Page>
  );
}
export default CategoriesPage;
