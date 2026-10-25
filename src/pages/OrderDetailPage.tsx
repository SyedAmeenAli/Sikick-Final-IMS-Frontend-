import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Block, Button, KV, Notice, Page, PageHeader, Panel, Select, StatusChip } from '@/components/ui/primitives';
import { Confirm, Dialog, useToast } from '@/components/ui/Overlay';
import { ArtTruck } from '@/components/illustrations';
import { fmt, lineTotals, splitGst } from '@/lib/money';
import { fmtStamp } from '@/lib/format';
import { useCommands, useIms } from '@/services';
import { customerOf, lineSum, orderTotal, paid, product } from '@/services/selectors';
import type { OrderStatus, Tender } from '@/services/contracts/types';
import NotFoundPage from './NotFoundPage';

const FLOW: OrderStatus[] = ['Draft', 'Pending', 'Paid', 'Packed', 'Shipped', 'Delivered', 'Completed'];
const COPY: Record<string, string> = { Draft: 'Created. No stock is held.', Pending: 'Confirmed. Stock is reserved.', Paid: 'Payment recorded. Stock is deducted.', Packed: 'Picked and packed.', Shipped: 'With the carrier.', Delivered: 'Reached the customer.', Completed: 'Closed.' };
const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  Draft: { to: 'Pending', label: 'Confirm and reserve stock' }, Paid: { to: 'Packed', label: 'Mark as packed' }, Packed: { to: 'Shipped', label: 'Book shipment' },
  Shipped: { to: 'Delivered', label: 'Mark delivered' }, Delivered: { to: 'Completed', label: 'Complete order' }, Returned: { to: 'Refunded', label: 'Mark refunded' },
};

export default function OrderDetailPage() {
  const { id = '' } = useParams();
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  const o = s.orders.find((x) => x.no === decodeURIComponent(id));
  const [payOpen, setPayOpen] = useState(false);
  const [tender, setTender] = useState<Tender>('UPI');
  const [retOpen, setRetOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  if (!o) return <NotFoundPage />;
  const t = lineSum(o.lines);
  const total = orderTotal(o);
  const { cgst, sgst } = splitGst(t.tax);
  const cust = customerOf(s, o.customerId);
  const idx = FLOW.indexOf(o.status);
  const next = NEXT[o.status];
  const go = (to: OrderStatus, msg: string) => { const r = cmd.advanceOrder(o.no, to); toast(r.ok ? msg : r.message, r.ok ? 'ok' : 'bad'); };
  const canReturn = (['Paid', 'Packed', 'Shipped', 'Delivered', 'Completed'] as OrderStatus[]).includes(o.status);

  return (
    <Page>
      <PageHeader crumbs={[{ label: 'Orders', to: '/orders' }, { label: o.no }]} title={<span className="row" style={{ gap: 12 }}>Order {o.no}<StatusChip status={o.status} /></span>} sub={fmtStamp(o.at) + ' · ' + o.channel + ' · ' + cust.name}
        actions={<>
          {o.status === 'Pending' && <Button variant="primary" onClick={() => setPayOpen(true)}>Take payment</Button>}
          {next && <Button variant={o.status === 'Pending' ? 'default' : 'primary'} onClick={() => go(next.to, 'Order ' + o.no + ' is now ' + next.to + '.')}>{next.label}</Button>}
          {canReturn && <Button onClick={() => setRetOpen(true)}>Return</Button>}
          {(o.status === 'Draft' || o.status === 'Pending') && <Button variant="danger" onClick={() => setCancelOpen(true)}>Cancel order</Button>}
        </>} />
      <Block className="grid main-side">
        <div className="stack">
          <Panel title="Items" flush>
            <div className="tbl-wrap"><table className="tbl" data-cards aria-label="Order items">
              <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Price</th><th className="num">GST</th><th className="num">Amount</th></tr></thead>
              <tbody>{o.lines.map((l) => { const lt = lineTotals(l.unit, l.qty, l.gst, l.discount); return (
                <tr key={l.sku}><td data-label="Item" data-primary="true"><Link className="link cell-main" to={'/variants/' + l.sku}>{product(s, l.sku).name}</Link><div className="cell-sub mono">{l.sku}</div></td><td data-label="Qty" className="num">{l.qty}</td><td data-label="Price" className="num">{fmt(l.unit)}</td><td data-label="GST" className="num">{l.gst}%</td><td data-label="Amount" className="num">{fmt(lt.total)}</td></tr>); })}</tbody>
            </table></div>
            <div style={{ padding: '14px 18px', display: 'grid', gap: 6, justifyItems: 'end', borderTop: '1px solid var(--line)' }}>
              <div className="stat-line" style={{ width: 280 }}><span className="muted">Subtotal</span><span className="num">{fmt(t.gross)}</span></div>
              {t.discount > 0 && <div className="stat-line" style={{ width: 280 }}><span className="muted">Discount</span><span className="num">−{fmt(t.discount)}</span></div>}
              <div className="stat-line" style={{ width: 280 }}><span className="muted">CGST</span><span className="num">{fmt(cgst)}</span></div>
              <div className="stat-line" style={{ width: 280 }}><span className="muted">SGST</span><span className="num">{fmt(sgst)}</span></div>
              <div className="stat-line" style={{ width: 280 }}><b>Total</b><b className="num" style={{ fontSize: 'var(--fs-xl)' }}>{fmt(total)}</b></div>
            </div>
          </Panel>
          {o.shipment && <Panel title="Shipment" hint="Tracking comes from the carrier connector"><div className="row" style={{ gap: 16, flexWrap: 'nowrap' }}><div style={{ width: 90, color: 'var(--wine)' }}><ArtTruck /></div><KV rows={[['Carrier', o.shipment.carrier], ['AWB', <span key="a" className="mono">{o.shipment.awb}</span>], ['State', o.shipment.state]]} /></div></Panel>}
        </div>
        <div className="stack">
          <Panel title="Progress">
            {['Returned', 'Refunded', 'Cancelled'].includes(o.status) ? <Notice tone="warn" title={o.status}>{o.status === 'Cancelled' ? 'Reserved stock was released.' : 'Stock came back on hand. Refund status follows the payment method.'}</Notice> : (
              <ol className="timeline">{FLOW.map((st, i) => (<li key={st} className="tl" data-state={i < idx ? 'done' : i === idx ? 'now' : 'todo'}><span className="dot">{i < idx || (i === idx && st === 'Completed') ? <Check /> : null}</span><div><div className="tt">{st}</div><div className="dd">{COPY[st]}</div></div></li>))}</ol>)}
          </Panel>
          <Panel title="Customer and payment">
            <KV rows={[['Customer', cust.name], ['Cashier', o.cashier], ['Paid', fmt(paid(o))], ['Balance', fmt(Math.max(0, total - paid(o)))]]} />
            {o.payments.map((p, i) => <div key={i} className="stat-line"><span>{p.tender}</span><b className="num">{fmt(p.amount)}</b></div>)}
          </Panel>
        </div>
      </Block>

      <Dialog open={payOpen} onClose={() => setPayOpen(false)} title={'Take payment for ' + o.no} footer={<><Button onClick={() => setPayOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => { const r = cmd.recordPayment(o.no, { tender, amount: total }); toast(r.ok ? 'Payment recorded. Stock is now deducted.' : r.message, r.ok ? 'ok' : 'bad'); setPayOpen(false); }}>Record {fmt(total)}</Button></>}>
        <div className="stack"><p className="muted">This records a payment that has already been received. It does not charge a card or generate a live UPI request.</p><Select aria-label="Payment method" value={tender} onChange={(e) => setTender(e.target.value as Tender)}><option value="UPI">UPI</option><option value="cash">Cash</option><option value="card">Card</option></Select></div>
      </Dialog>
      <Confirm open={retOpen} onClose={() => setRetOpen(false)} title={'Return ' + o.no} confirmLabel="Return and restock" onConfirm={() => go('Returned', 'Order returned. Stock is back on hand.')}>Every item goes back into stock as a return event, and the order moves to Returned.</Confirm>
      <Confirm open={cancelOpen} onClose={() => setCancelOpen(false)} danger title={'Cancel ' + o.no} confirmLabel="Cancel order" onConfirm={() => go('Cancelled', 'Order cancelled.')}>Any reserved stock is released.</Confirm>
    </Page>
  );
}
