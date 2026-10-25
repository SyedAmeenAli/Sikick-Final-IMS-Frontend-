import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Field, Input, Select } from '@/components/ui/primitives';
import { Dialog, useToast } from '@/components/ui/Overlay';
import { rupees } from '@/lib/money';
import { useCommands, useIms } from '@/services';
import type { Product } from '@/services/contracts/types';

const blank = { name: '', category: 'Home', type: 'Kitchenware', brand: '', unit: 'pcs' as Product['unit'], hsn: '', gst: '12', price: '', cost: '', reorder: '10', tracking: 'none' as Product['tracking'], opening: '0' };

export function NewProductDialog({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: Partial<typeof blank> }) {
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  const nav = useNavigate();
  const [f, setF] = useState({ ...blank, ...preset });
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = () => {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = 'Give the product a name.';
    if (!(parseFloat(f.price) > 0)) e.price = 'Enter a selling price above zero.';
    if (f.hsn && !/^\d{4,8}$/.test(f.hsn)) e.hsn = 'HSN is 4 to 8 digits.';
    setErr(e);
    if (Object.keys(e).length) return;
    const r = cmd.createProduct({ name: f.name, category: f.category, type: f.type, brand: f.brand, unit: f.unit, hsn: f.hsn, gst: Number(f.gst), price: rupees(parseFloat(f.price)), cost: rupees(parseFloat(f.cost) || 0), reorderPoint: Number(f.reorder) || 0, tracking: f.tracking, openingStock: Number(f.opening) || 0 });
    if (!r.ok) { setErr({ name: r.message }); return; }
    toast('Product created as ' + r.value + '.');
    setF({ ...blank });
    onClose();
    nav('/variants/' + r.value);
  };

  return (
    <Dialog open={open} onClose={onClose} title="New product" wide footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>Create product</Button></>}>
      <p className="muted" style={{ marginBottom: 12 }}>The SKU is generated for you. Stock is added through a reasoned opening balance, never typed straight into a quantity field.</p>
      <div className="form-grid">
        <Field label="Product name" error={err.name} className="span2">{(id) => <Input id={id} value={f.name} onChange={set('name')} autoFocus />}</Field>
        <Field label="Category">{(id) => <Select id={id} value={f.category} onChange={set('category')}>{s.categories.map((c) => <option key={c.id}>{c.name}</option>)}</Select>}</Field>
        <Field label="Product type">{(id) => <Select id={id} value={f.type} onChange={set('type')}>{s.productTypes.map((c) => <option key={c.id}>{c.name}</option>)}</Select>}</Field>
        <Field label="Brand">{(id) => <Input id={id} value={f.brand} onChange={set('brand')} placeholder="Morrow" />}</Field>
        <Field label="Unit">{(id) => <Select id={id} value={f.unit} onChange={set('unit')}>{['pcs', 'box', 'set', 'pack'].map((u) => <option key={u}>{u}</option>)}</Select>}</Field>
        <Field label="Selling price (₹, before GST)" error={err.price}>{(id) => <Input id={id} inputMode="decimal" value={f.price} onChange={set('price')} />}</Field>
        <Field label="Cost price (₹)">{(id) => <Input id={id} inputMode="decimal" value={f.cost} onChange={set('cost')} />}</Field>
        <Field label="HSN code" error={err.hsn}>{(id) => <Input id={id} inputMode="numeric" value={f.hsn} onChange={set('hsn')} placeholder="e.g. 6109" />}</Field>
        <Field label="GST rate">{(id) => <Select id={id} value={f.gst} onChange={set('gst')}>{[0, 5, 12, 18, 28].map((g) => <option key={g} value={g}>{g}%</option>)}</Select>}</Field>
        <Field label="Reorder point">{(id) => <Input id={id} inputMode="numeric" value={f.reorder} onChange={set('reorder')} />}</Field>
        <Field label="Tracking" help={f.tracking === 'serial' ? 'Each unit gets a serial number and warranty.' : f.tracking === 'batch' ? 'Units are tracked by batch and expiry.' : undefined}>{(id) => <Select id={id} value={f.tracking} onChange={set('tracking')}><option value="none">None</option><option value="batch">Batch and expiry</option><option value="serial">Serial number</option></Select>}</Field>
        <Field label="Opening stock" help="Recorded as an opening-balance stock event.">{(id) => <Input id={id} inputMode="numeric" value={f.opening} onChange={set('opening')} />}</Field>
      </div>
    </Dialog>
  );
}
