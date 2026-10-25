import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Wallet } from 'lucide-react';
import { Block, Button, Chip, Field, FilterChips, Input, KV, Metric, Page, PageHeader, Panel, Select, StatusChip } from '@/components/ui/primitives';
import { Dialog, SidePanel, useToast } from '@/components/ui/Overlay';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { fmt, fmtCompact, rupees } from '@/lib/money';
import { fmtDate } from '@/lib/format';
import { OPENING_BALANCE } from '@/data/fixtures/seed';
import { useCommands, useIms } from '@/services';
import { poTotals, supplierBalance, supplierOf } from '@/services/selectors';
import type { Supplier, SupplierPayment } from '@/services/contracts/types';
import NotFoundPage from './NotFoundPage';

function PayDialog({ open, onClose, supplierId }: { open: boolean; onClose: () => void; supplierId: string }) {
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<SupplierPayment['mode']>('bank');
  const [ref, setRef] = useState('');
  const [sid, setSid] = useState(supplierId);
  const [err, setErr] = useState('');
  const owed = supplierBalance(s, sid);
  const submit = () => {
    const r = cmd.recordSupplierPayment(sid, rupees(parseFloat(amount) || 0), mode, ref.trim() || 'Manual entry');
    if (!r.ok) { setErr(r.message); return; }
    toast('Payment recorded against ' + supplierOf(s, sid).name + '. No money moved: this only updates your books.'); setAmount(''); setRef(''); setErr(''); onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} title="Record a supplier payment" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={submit}>Record payment</Button></>}>
      <div className="stack">
        <p className="muted">This logs a payment you have already made. It does not move money.</p>
        <Field label="Supplier">{(id) => <Select id={id} value={sid} onChange={(e) => setSid(e.target.value)}>{s.suppliers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>}</Field>
        <div className="form-grid">
          <Field label="Amount (₹)" help={'Currently owed: ' + fmt(owed)} error={err}>{(id) => <Input id={id} inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setErr(''); }} autoFocus />}</Field>
          <Field label="Mode">{(id) => <Select id={id} value={mode} onChange={(e) => setMode(e.target.value as SupplierPayment['mode'])}><option value="bank">Bank transfer</option><option value="UPI">UPI</option><option value="cash">Cash</option></Select>}</Field>
          <Field label="Reference" className="span2">{(id) => <Input id={id} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Transaction or cheque number" />}</Field>
        </div>
      </div>
    </Dialog>
  );
}

export function SuppliersPage() {
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  const nav = useNavigate();
  const [sel, setSel] = useState<Supplier | null>(null);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', contact: '', phone: '', city: '', terms: 'Net 30', gstin: '' });
  const [err, setErr] = useState('');
  const owedTotal = s.suppliers.reduce((a, x) => a + supplierBalance(s, x.id), 0);
  const cols: Array<Column<Supplier>> = [
    { id: 'n', header: 'Supplier', primary: true, sort: (x) => x.name, cell: (x) => <div><div className="cell-main">{x.name}</div><div className="cell-sub">{x.contact} · {x.city}</div></div> },
    { id: 't', header: 'Terms', cell: (x) => x.terms },
    { id: 'o', header: 'Open orders', num: true, cell: (x) => s.purchaseOrders.filter((p) => p.supplierId === x.id && p.status !== 'Received').length || '—' },
    { id: 'b', header: 'We owe', num: true, sort: (x) => supplierBalance(s, x.id), cell: (x) => <b>{fmt(supplierBalance(s, x.id))}</b> },
    { id: 's', header: 'Status', cell: (x) => <StatusChip status={x.status} /> },
  ];
  const add = () => { const r = cmd.addSupplier(f); if (!r.ok) { setErr(r.message); return; } toast('Supplier added.'); setAdding(false); setF({ name: '', contact: '', phone: '', city: '', terms: 'Net 30', gstin: '' }); setErr(''); };
  const setK = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Page>
      <PageHeader title="Suppliers" sub="Who you buy from, what you owe them and what is on order." actions={<><Link className="btn" to="/supplier-payments"><Wallet />Payments</Link><Button variant="primary" onClick={() => setAdding(true)}><Plus />New supplier</Button></>} />
      <Block className="grid c3">
        <Metric label="Suppliers" value={s.suppliers.length} foot="active" />
        <Metric label="Total owed" value={fmtCompact(owedTotal)} to="/analytics/supplier-balance" foot="across all suppliers" />
        <Metric label="Open orders" value={s.purchaseOrders.filter((p) => p.status !== 'Received').length} to="/purchase-orders" foot="awaiting stock" />
      </Block>
      <div style={{ height: 16 }} />
      <Block><Panel flush><DataTable label="Suppliers" rows={s.suppliers} rowKey={(x) => x.id} columns={cols} onRowClick={setSel} selectedKey={sel?.id} searchText={(x) => x.name + ' ' + x.contact + ' ' + x.city} searchPlaceholder="Search suppliers" /></Panel></Block>
      <SidePanel open={!!sel} onClose={() => setSel(null)} title={sel?.name ?? ''} sub={sel && sel.city}>
        {sel && (
          <div className="stack">
            <KV rows={[['Contact', sel.contact], ['Phone', sel.phone], ['GSTIN', <span key="g" className="mono">{sel.gstin}</span>], ['Terms', sel.terms], ['We owe', <b key="b">{fmt(supplierBalance(s, sel.id))}</b>]]} />
            <div className="actions"><Button variant="primary" onClick={() => nav('/suppliers/' + sel.id + '/balance')}>Balance and statement</Button><Link className="btn" to="/purchase-orders/new">New order</Link></div>
            <hr className="divider" />
            <div className="eyebrow">Orders</div>
            {s.purchaseOrders.filter((p) => p.supplierId === sel.id).map((p) => <Link key={p.no} to={'/purchase-orders/' + p.no} className="stat-line"><span className="mono">{p.no}</span><span><StatusChip status={p.status} /> <span className="num">{fmt(poTotals(s, p).total)}</span></span></Link>)}
          </div>
        )}
      </SidePanel>
      <Dialog open={adding} onClose={() => setAdding(false)} title="New supplier" footer={<><Button onClick={() => setAdding(false)}>Cancel</Button><Button variant="primary" onClick={add}>Add supplier</Button></>}>
        <div className="form-grid">
          <Field label="Name" error={err} className="span2">{(id) => <Input id={id} value={f.name} onChange={setK('name')} autoFocus />}</Field>
          <Field label="Contact person">{(id) => <Input id={id} value={f.contact} onChange={setK('contact')} />}</Field>
          <Field label="Phone">{(id) => <Input id={id} value={f.phone} onChange={setK('phone')} />}</Field>
          <Field label="City">{(id) => <Input id={id} value={f.city} onChange={setK('city')} />}</Field>
          <Field label="Payment terms">{(id) => <Input id={id} value={f.terms} onChange={setK('terms')} />}</Field>
          <Field label="GSTIN" className="span2">{(id) => <Input id={id} value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} maxLength={15} />}</Field>
        </div>
      </Dialog>
    </Page>
  );
}

export function SupplierBalancePage() {
  const { id = '' } = useParams();
  const s = useIms();
  const [pay, setPay] = useState(false);
  const sup = s.suppliers.find((x) => x.id === id);
  if (!sup) return <NotFoundPage />;
  type Row = { at: string; what: string; ref: string; bill: number; paid: number };
  const bills: Row[] = s.purchaseOrders.filter((p) => p.supplierId === id && p.status === 'Received').map((p) => ({ at: p.expected ?? p.date, what: 'Goods received', ref: p.no, bill: poTotals(s, p, 'received').total, paid: 0 }));
  const pays: Row[] = s.supplierPayments.filter((p) => p.supplierId === id).map((p) => ({ at: p.date, what: 'Payment, ' + p.mode, ref: p.ref, bill: 0, paid: p.amount }));
  const rows = [...bills, ...pays].sort((a, b) => a.at.localeCompare(b.at));
  let run = OPENING_BALANCE[id] ?? 0;
  const withRun = rows.map((r) => { run += r.bill - r.paid; return { ...r, run }; });
  return (
    <Page narrow>
      <PageHeader crumbs={[{ label: 'Suppliers', to: '/suppliers' }, { label: sup.name }]} title={sup.name + ': balance'} sub={sup.terms + ' · ' + sup.contact} actions={<Button variant="primary" onClick={() => setPay(true)}><Wallet />Record payment</Button>} />
      <Block className="grid c3">
        <Metric label="We owe" value={fmt(supplierBalance(s, id))} />
        <Metric label="Brought forward" value={fmt(OPENING_BALANCE[id] ?? 0)} foot="from last year" />
        <Metric label="Paid this period" value={fmt(pays.reduce((a, p) => a + p.paid, 0))} />
      </Block>
      <div style={{ height: 16 }} />
      <Block><Panel title="Statement" flush>
        <div className="tbl-wrap"><table className="tbl" data-cards aria-label="Supplier statement">
          <thead><tr><th>Date</th><th>Entry</th><th>Reference</th><th className="num">Billed</th><th className="num">Paid</th><th className="num">Balance</th></tr></thead>
          <tbody>
            <tr><td data-label="Date" data-primary="true">—</td><td data-label="Entry">Brought forward</td><td data-label="Reference">—</td><td className="num" data-label="Billed" /><td className="num" data-label="Paid" /><td className="num" data-label="Balance">{fmt(OPENING_BALANCE[id] ?? 0)}</td></tr>
            {withRun.map((r, i) => <tr key={i}><td data-label="Date" data-primary="true">{fmtDate(r.at)}</td><td data-label="Entry">{r.what}</td><td data-label="Reference" className="mono">{r.ref}</td><td data-label="Billed" className="num">{r.bill ? fmt(r.bill) : ''}</td><td data-label="Paid" className="num">{r.paid ? fmt(r.paid) : ''}</td><td data-label="Balance" className="num"><b>{fmt(r.run)}</b></td></tr>)}
          </tbody></table></div>
      </Panel></Block>
      <PayDialog open={pay} onClose={() => setPay(false)} supplierId={id} />
    </Page>
  );
}

export function SupplierPaymentsPage() {
  const s = useIms();
  const [sid, setSid] = useState('all');
  const [pay, setPay] = useState(false);
  const rows = s.supplierPayments.filter((p) => sid === 'all' || p.supplierId === sid).slice().reverse();
  const cols: Array<Column<SupplierPayment>> = [
    { id: 'd', header: 'Date', primary: true, sort: (p) => p.date, cell: (p) => fmtDate(p.date) },
    { id: 's', header: 'Supplier', cell: (p) => <Link className="link" to={'/suppliers/' + p.supplierId + '/balance'}>{supplierOf(s, p.supplierId).name}</Link> },
    { id: 'm', header: 'Mode', cell: (p) => <Chip tone="neutral" plain>{p.mode}</Chip> },
    { id: 'r', header: 'Reference', cell: (p) => <span className="mono">{p.ref}</span> },
    { id: 'p', header: 'Order', cell: (p) => p.poNo ?? '—' },
    { id: 'a', header: 'Amount', num: true, sort: (p) => p.amount, cell: (p) => <b>{fmt(p.amount)}</b> },
  ];
  return (
    <Page narrow>
      <PageHeader title="Supplier payments" sub="Payments you have recorded against supplier balances." actions={<Button variant="primary" onClick={() => setPay(true)}><Plus />Record payment</Button>} />
      <Block><Panel flush>
        <DataTable label="Supplier payments" rows={rows} rowKey={(p) => p.id} columns={cols} filters={<FilterChips label="Supplier" value={sid} onChange={setSid} options={[{ value: 'all', label: 'All' }, ...s.suppliers.filter((x) => s.supplierPayments.some((p) => p.supplierId === x.id)).map((x) => ({ value: x.id, label: x.name }))]} />} footer={<b className="num">Total {fmt(rows.reduce((a, p) => a + p.amount, 0))}</b>} />
      </Panel></Block>
      <PayDialog open={pay} onClose={() => setPay(false)} supplierId="SUP-01" />
    </Page>
  );
}
export default SuppliersPage;
