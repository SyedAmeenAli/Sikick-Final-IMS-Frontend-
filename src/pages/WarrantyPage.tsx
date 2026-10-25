import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ScanLine, ShieldCheck, ShieldX } from 'lucide-react';
import { Block, Button, Field, Input, KV, Notice, Page, PageHeader, Panel } from '@/components/ui/primitives';
import { NOW } from '@/data/fixtures/seed';
import { fmtDate } from '@/lib/format';
import { useIms } from '@/services';
import { customerOf, product } from '@/services/selectors';

export default function WarrantyPage() {
  const s = useIms();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('serial') ?? '');
  const [done, setDone] = useState(params.get('serial') ?? '');
  const rec = done ? s.serials.find((x) => x.serial.toLowerCase() === done.trim().toLowerCase()) : undefined;
  const p = rec ? product(s, rec.sku) : null;
  const order = rec?.orderNo ? s.orders.find((o) => o.no === rec.orderNo) : undefined;
  let end: Date | null = null;
  if (rec?.soldAt) { end = new Date(rec.soldAt); end.setMonth(end.getMonth() + rec.warrantyMonths); }
  const active = end ? end.getTime() >= NOW.getTime() : false;
  const sample = s.serials.find((x) => x.state === 'sold')?.serial;

  return (
    <Page narrow>
      <PageHeader title="Warranty lookup" sub="Start from the sticker. A serial number finds the sale, the customer and the warranty end date." />
      <Block><Panel>
        <form className="row" style={{ alignItems: 'flex-end', flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); setDone(q); }}>
          <Field label="Serial number" className="grow" help={sample ? 'Try ' + sample : undefined}>{(id) => <Input id={id} value={q} onChange={(e) => setQ(e.target.value)} placeholder="NW-EB-26-01001" autoFocus />}</Field>
          <Button variant="primary" type="submit"><ScanLine />Look up</Button>
        </form>
      </Panel></Block>
      <div style={{ height: 16 }} />
      {done && !rec && <Block><Notice tone="warn" title="No unit with that serial">Check the characters on the sticker. Only serial-tracked products (earbuds and power banks here) have serial numbers.</Notice></Block>}
      {rec && p && (
        <Block><Panel title={p.name} hint={rec.serial}>
          {rec.state === 'in_stock' ? (
            <Notice tone="info" title="This unit has not been sold">It is still in stock, so there is no warranty to claim. <Link className="link" to={'/inventory/' + p.sku}>Open stock</Link>.</Notice>
          ) : (
            <div className="stack">
              <div className="row" style={{ gap: 10, color: active ? 'var(--ok)' : 'var(--bad)', fontWeight: 650, fontSize: 'var(--fs-lg)' }}>{active ? <ShieldCheck /> : <ShieldX />}{active ? 'In warranty until ' + fmtDate(end!.toISOString()) : 'Warranty ended on ' + fmtDate(end!.toISOString())}</div>
              <KV rows={[['Sold on', fmtDate(rec.soldAt!)], ['Sale', <Link key="o" className="link" to={'/orders/' + encodeURIComponent(rec.orderNo!)}>{rec.orderNo}</Link>], ['Customer', order ? customerOf(s, order.customerId).name : '—'], ['Warranty', rec.warrantyMonths + ' months'], ['SKU', p.sku]]} />
            </div>
          )}
        </Panel></Block>
      )}
    </Page>
  );
}
