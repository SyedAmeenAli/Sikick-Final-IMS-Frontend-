import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Check, PackageCheck, Send } from 'lucide-react';
import { Block, Button, Chip, Input, KV, Notice, Page, PageHeader, Panel, StatusChip } from '@/components/ui/primitives';
import { Dialog, useToast } from '@/components/ui/Overlay';
import { fmt, lineTotals } from '@/lib/money';
import { fmtDate } from '@/lib/format';
import { dur, ease } from '@/animations/motion';
import { useCommands, useIms } from '@/services';
import { poOverdueDays, poTotals, product, stockTotal, supplierBalance, supplierOf } from '@/services/selectors';
import type { PoStatus } from '@/services/contracts/types';
import NotFoundPage from './NotFoundPage';

const STEPS: PoStatus[] = ['Draft', 'Ordered', 'Received'];
const STEP_COPY: Record<PoStatus, string> = { Draft: 'Items and prices are being agreed.', Ordered: 'Placed with the supplier. Stock is not counted yet.', Received: 'Goods checked in. Stock and the supplier balance are updated.' };

function Lifecycle({ status }: { status: PoStatus }) {
  const idx = STEPS.indexOf(status);
  return (
    <ol className="timeline" aria-label="Order progress">
      {STEPS.map((st, i) => (
        <li key={st} className="tl" data-state={i < idx ? 'done' : i === idx ? 'now' : 'todo'}>
          <span className="dot">{i < idx || (i === idx && st === 'Received') ? <Check /> : null}</span>
          <div><div className="tt">{st}</div><div className="dd">{STEP_COPY[st]}</div></div>
        </li>
      ))}
    </ol>
  );
}

export default function PurchaseOrderDetailPage() {
  const { id = '' } = useParams();
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  const po = s.purchaseOrders.find((p) => p.no === id);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [recvOpen, setRecvOpen] = useState(false);
  const [recv, setRecv] = useState<Record<string, { received: string; damaged: string }>>({});
  const [err, setErr] = useState('');
  if (!po) return <NotFoundPage />;
  const sup = supplierOf(s, po.supplierId);
  const t = poTotals(s, po);
  const tr = poTotals(s, po, 'received');
  const late = poOverdueDays(po);

  const openRecv = () => { setRecv(Object.fromEntries(po.lines.map((l) => [l.sku, { received: String(l.qty), damaged: '0' }]))); setErr(''); setRecvOpen(true); };
  const rows = po.lines.map((l) => { const r = recv[l.sku] ?? { received: '0', damaged: '0' }; const arrived = parseInt(r.received) || 0; const dmg = parseInt(r.damaged) || 0; return { l, arrived, dmg, good: arrived - dmg }; });
  const valid = rows.every((r) => r.arrived >= 0 && r.dmg >= 0 && r.dmg <= r.arrived && r.arrived <= r.l.qty);
  const submit = () => {
    if (!valid) { setErr('Damaged units cannot exceed units that arrived, and you cannot receive more than was ordered.'); return; }
    const r = cmd.receivePurchaseOrder(po.no, rows.map((x) => ({ sku: x.l.sku, received: x.arrived, damaged: x.dmg })));
    if (!r.ok) { setErr(r.message); return; }
    toast(po.no + ' received. Stock and the supplier balance are updated.'); setRecvOpen(false);
  };

  return (
    <Page>
      <PageHeader crumbs={[{ label: 'Purchase orders', to: '/purchase-orders' }, { label: po.no }]} title={<span className="row" style={{ gap: 12 }}>{po.no}<StatusChip status={po.status} /></span>}
        sub={sup.name + ' · raised ' + fmtDate(po.date) + (po.expected ? ' · expected ' + fmtDate(po.expected) : '')}
        actions={<>
          {po.status === 'Draft' && <Button variant="primary" onClick={() => setPlaceOpen(true)}><Send />Place order</Button>}
          {po.status === 'Ordered' && <Button variant="primary" onClick={openRecv}><PackageCheck />Receive stock</Button>}
          <Link className="btn" to={'/suppliers/' + sup.id + '/balance'}>Supplier balance</Link></>} />
      {late > 0 && <Block><Notice tone="bad" title={late + ' days overdue'}>{sup.name} was due on {fmtDate(po.expected!)}. {po.note}</Notice><div style={{ height: 14 }} /></Block>}
      <Block className="grid main-side">
        <Panel title="Items" flush>
          <div className="tbl-wrap"><table className="tbl" data-cards aria-label="Order lines">
            <thead><tr><th>Item</th><th className="num">Ordered</th><th className="num">Received</th><th className="num">Unit cost</th><th className="num">Total incl. GST</th></tr></thead>
            <tbody>{po.lines.map((l) => { const p = product(s, l.sku); const lt = lineTotals(l.unitCost, l.qty, p.gst); return (
              <tr key={l.sku}>
                <td data-label="Item" data-primary="true"><Link className="cell-main link" to={'/inventory/' + l.sku}>{p.name}</Link><div className="cell-sub mono">{l.sku}</div></td>
                <td data-label="Ordered" className="num">{l.qty}</td>
                <td data-label="Received" className="num">{po.status === 'Received' ? <span>{l.received}{l.received < l.qty && <Chip tone="warn" plain> short {l.qty - l.received}</Chip>}</span> : '—'}</td>
                <td data-label="Unit cost" className="num">{fmt(l.unitCost)}</td>
                <td data-label="Total incl. GST" className="num">{fmt(lt.total)}</td>
              </tr>); })}</tbody>
          </table></div>
          <div style={{ padding: '14px 18px', display: 'grid', gap: 6, justifyItems: 'end', borderTop: '1px solid var(--line)' }}>
            <div className="stat-line" style={{ width: 260 }}><span className="muted">Subtotal</span><span className="num">{fmt(t.net)}</span></div>
            <div className="stat-line" style={{ width: 260 }}><span className="muted">GST</span><span className="num">{fmt(t.tax)}</span></div>
            <div className="stat-line" style={{ width: 260 }}><b>{po.status === 'Received' ? 'Ordered total' : 'Total'}</b><b className="num">{fmt(t.total)}</b></div>
            {po.status === 'Received' && <div className="stat-line" style={{ width: 260 }}><b>Billed on receipt</b><b className="num">{fmt(tr.total)}</b></div>}
          </div>
        </Panel>
        <div className="stack">
          <Panel title="Progress"><Lifecycle status={po.status} /></Panel>
          <Panel title="Supplier"><KV rows={[['Name', sup.name], ['Contact', sup.contact], ['Terms', sup.terms], ['Balance owed', fmt(supplierBalance(s, sup.id))]]} />{po.note && <p className="muted" style={{ marginTop: 10 }}>{po.note}</p>}</Panel>
        </div>
      </Block>

      <Dialog open={placeOpen} onClose={() => setPlaceOpen(false)} title={'Place ' + po.no} footer={<><Button onClick={() => setPlaceOpen(false)}>Cancel</Button><Button variant="primary" data-autofocus onClick={() => { const r = cmd.placePurchaseOrder(po.no); toast(r.ok ? po.no + ' marked as Ordered. Nothing was emailed to the supplier.' : r.message, r.ok ? 'ok' : 'bad'); setPlaceOpen(false); }}>Mark as ordered</Button></>}>
        <p className="muted">This changes the status to Ordered. In this prototype nothing is sent to {sup.name}, so share the order with them yourself.</p>
      </Dialog>

      <Dialog open={recvOpen} onClose={() => setRecvOpen(false)} wide title={'Receive ' + po.no} footer={<><Button onClick={() => setRecvOpen(false)}>Cancel</Button><Button variant="primary" onClick={submit}><PackageCheck />Confirm receipt</Button></>}>
        <div className="stack">
          <p className="muted">Count what actually arrived. Good units go into stock; damaged units are held back and never counted as sellable.</p>
          <div className="tbl-wrap"><table className="tbl" aria-label="Receipt">
            <thead><tr><th>Item</th><th className="num">Ordered</th><th className="num">Arrived</th><th className="num">Damaged</th><th className="num">On hand after</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.l.sku}>
                <td><div className="cell-main">{product(s, r.l.sku).name}</div><div className="cell-sub mono">{r.l.sku}</div></td>
                <td className="num">{r.l.qty}</td>
                <td className="num"><Input aria-label={'Arrived ' + r.l.sku} inputMode="numeric" style={{ width: 72, textAlign: 'right' }} value={recv[r.l.sku]?.received ?? ''} onChange={(e) => setRecv((x) => ({ ...x, [r.l.sku]: { ...x[r.l.sku], received: e.target.value } }))} /></td>
                <td className="num"><Input aria-label={'Damaged ' + r.l.sku} inputMode="numeric" style={{ width: 72, textAlign: 'right' }} value={recv[r.l.sku]?.damaged ?? ''} onChange={(e) => setRecv((x) => ({ ...x, [r.l.sku]: { ...x[r.l.sku], damaged: e.target.value } }))} /></td>
                <td className="num"><motion.b key={r.good} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} transition={{ duration: dur.micro, ease }}>{stockTotal(s, r.l.sku)} → {stockTotal(s, r.l.sku) + Math.max(0, r.good)}</motion.b></td>
              </tr>))}</tbody>
          </table></div>
          <div className="stat-line"><span>Billed to {sup.name} on receipt</span><b className="num">{fmt(rows.reduce((a, r) => a + lineTotals(r.l.unitCost, Math.max(0, r.good), product(s, r.l.sku).gst).total, 0))}</b></div>
          {err && <p role="alert" style={{ color: 'var(--bad)', fontWeight: 600 }}>{err}</p>}
        </div>
      </Dialog>
    </Page>
  );
}
