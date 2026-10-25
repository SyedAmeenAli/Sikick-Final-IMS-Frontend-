import { printRegion } from '@/lib/print';
import { CheckCircle2, Mail, Printer, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Overlay';
import { fmt, splitGst } from '@/lib/money';
import { fmtStamp } from '@/lib/format';
import { WORKSPACE } from '@/data/fixtures/seed';
import { dur, ease } from '@/animations/motion';
import { useIms } from '@/services';
import { customerOf, product } from '@/services/selectors';
import type { SaleReceipt } from '@/services/contracts/service';

export function ReceiptView({ receipt, onNew }: { receipt: SaleReceipt; onNew: () => void }) {
  const s = useIms();
  const toast = useToast();
  const { order } = receipt;
  const cust = customerOf(s, order.customerId);
  const { cgst, sgst } = splitGst(receipt.tax);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: dur.panel, ease }} className="stack" style={{ gap: 14 }}>
      <div className="notice" data-tone="ok"><CheckCircle2 aria-hidden /><div><strong>Sale {order.no} recorded locally.</strong> Stock has been updated in this prototype. No payment was taken and nothing was sent to a server.</div></div>
      <article className="receipt" aria-label={'Receipt for sale ' + order.no}>
        <header>
          <b>{s.account.workspace.name}</b>
          <span>{WORKSPACE.location} · {WORKSPACE.till}</span>
          <span>GSTIN {WORKSPACE.gstin}</span>
          <span className="mono">Tax invoice {order.no} · {fmtStamp(order.at)}</span>
          {cust.id !== 'CUS-000' && <span>Billed to {cust.name}</span>}
        </header>
        <table>
          <tbody>
            {receipt.order.lines.map((l) => (
              <tr key={l.sku}>
                <td><div>{product(s, l.sku).name}</div><small>{l.qty} × {fmt(l.unit)} · GST {l.gst}%{l.discount > 0 ? ' · discount −' + fmt(l.discount) : ''}</small></td>
                <td className="num">{fmt(l.unit * l.qty - l.discount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl>
          <div><dt>Subtotal</dt><dd className="num">{fmt(receipt.subtotal)}</dd></div>
          {receipt.discount > 0 && <div><dt>Discount</dt><dd className="num">−{fmt(receipt.discount)}</dd></div>}
          <div><dt>CGST</dt><dd className="num">{fmt(cgst)}</dd></div>
          <div><dt>SGST</dt><dd className="num">{fmt(sgst)}</dd></div>
          <div className="tot"><dt>Total</dt><dd className="num">{fmt(receipt.total)}</dd></div>
          {order.payments.map((p, i) => <div key={i}><dt>Paid by {p.tender}</dt><dd className="num">{fmt(p.amount)}</dd></div>)}
          {receipt.change > 0 && <div><dt>Change returned</dt><dd className="num">{fmt(receipt.change)}</dd></div>}
        </dl>
        {receipt.serials.length > 0 && <p className="serials">Serial numbers: {receipt.serials.map((x) => x.serial).join(', ')}</p>}
        <footer>Thank you for shopping at {s.account.workspace.name}.</footer>
      </article>
      <div className="actions" style={{ justifyContent: 'space-between' }}>
        <div className="actions">
          <Button onClick={() => printRegion('receipt')}><Printer />Print</Button>
          <Button disabled={cust.id === 'CUS-000'} title={cust.id === 'CUS-000' ? 'Choose a customer with an email to send a receipt' : undefined} onClick={() => toast('Email receipt is not connected in this prototype.')}><Mail />Email</Button>
        </div>
        <Button variant="primary" data-autofocus onClick={onNew}><Plus />New sale</Button>
      </div>
    </motion.div>
  );
}
