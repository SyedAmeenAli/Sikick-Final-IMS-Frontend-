import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Megaphone, Plus } from 'lucide-react';
import { Block, Button, Chip, Field, Input, Metric, Page, PageHeader, Panel, Select, StatusChip, Toggle } from '@/components/ui/primitives';
import { Dialog, useToast } from '@/components/ui/Overlay';
import { SiBorgIcon } from '@/components/brand';
import { fmt, fmtShort } from '@/lib/money';
import { useIms } from '@/services';
import { alerts, customerOf, kpis, orderTotal, poOverdueDays, supplierOf, salesByDay, lineSum } from '@/services/selectors';
import { insights } from '@/services/insights';

export function BriefingPage() {
  const s = useIms();
  const k = kpis(s);
  const list = insights(s);
  const open = alerts(s).filter((a) => !a.acknowledged);
  const yday = salesByDay(s, 2)[0];
  return (
    <Page narrow>
      <PageHeader title="Daily briefing" sub="Saturday 24 October, 11:26. What changed overnight and what needs you first." />
      <Block><Panel>
        <div className="row" style={{ gap: 16, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <SiBorgIcon size={44} mood="insight" />
          <div className="stack" style={{ gap: 8 }}>
            <p style={{ fontSize: 'var(--fs-lg)', lineHeight: 1.6 }}>Morrow Goods took <b>{fmtShort(yday.total)}</b> yesterday across <b>{yday.orders}</b> orders. So far today it is <b>{fmtShort(k.todaySales)}</b> from <b>{k.todayOrders}</b> orders. There {open.length === 1 ? 'is' : 'are'} <b>{open.length}</b> open alert{open.length === 1 ? '' : 's'}, and {k.overduePos} purchase order{k.overduePos === 1 ? ' is' : 's are'} overdue.</p>
            <p className="muted">SiBorg reads your orders, stock and purchase orders. It proposes; you decide.</p>
          </div>
        </div>
      </Panel></Block>
      <div style={{ height: 16 }} />
      <Block><Panel title="Worth your attention" flush>
        {list.map((b) => (
          <div key={b.id} className="list-row" style={{ padding: '14px 18px', alignItems: 'flex-start' }}>
            <span style={{ width: 9, height: 9, borderRadius: 5, marginTop: 7, flex: 'none', background: b.tone === 'bad' ? 'var(--bad)' : b.tone === 'warn' ? 'var(--warn)' : b.tone === 'ok' ? 'var(--ok)' : 'var(--info)' }} />
            <div className="grow"><div className="t">{b.title}</div><div className="d">{b.detail}</div></div>
            {b.to && <Link to={b.to} className="btn btn-sm">{b.cta}<ArrowRight /></Link>}
          </div>
        ))}
      </Panel></Block>
    </Page>
  );
}

export function ActionCenterPage() {
  const s = useIms();
  const items: Array<{ id: string; kind: string; title: string; detail: string; to: string; cta: string; tone: 'bad' | 'warn' | 'info' | 'wine' }> = [];
  for (const p of s.proposals.filter((x) => x.state === 'proposed')) items.push({ id: p.id, kind: 'SiBorg', title: p.title, detail: p.actions.length + ' proposed action' + (p.actions.length > 1 ? 's' : '') + ' waiting for approval.', to: '/agent/proposals/' + p.sessionId, cta: 'Review', tone: 'wine' });
  for (const po of s.purchaseOrders) {
    if (po.status === 'Draft') items.push({ id: po.no, kind: 'Purchasing', title: po.no + ' is still a draft', detail: 'For ' + supplierOf(s, po.supplierId).name + '. Place it to start the clock.', to: '/purchase-orders/' + po.no, cta: 'Open', tone: 'warn' });
    if (poOverdueDays(po) > 0) items.push({ id: po.no + 'late', kind: 'Purchasing', title: po.no + ' is ' + poOverdueDays(po) + ' days late', detail: supplierOf(s, po.supplierId).name + ' has not delivered.', to: '/purchase-orders/' + po.no, cta: 'Chase', tone: 'bad' });
  }
  for (const o of s.orders.filter((x) => x.status === 'Pending' || x.status === 'Draft')) items.push({ id: o.no, kind: 'Sales', title: 'Order ' + o.no + ' is ' + o.status.toLowerCase(), detail: customerOf(s, o.customerId).name + ' · ' + fmt(orderTotal(o)), to: '/orders/' + encodeURIComponent(o.no), cta: 'Open', tone: 'info' });
  for (const q of s.quotations.filter((x) => x.status === 'accepted')) items.push({ id: q.no, kind: 'Sales', title: q.no + ' was accepted', detail: customerOf(s, q.customerId).name + ' · ' + fmt(lineSum(q.lines).total) + '. Convert it into an order.', to: '/quotations/' + q.no, cta: 'Convert', tone: 'info' });
  for (const a of alerts(s).filter((x) => !x.acknowledged && (x.severity === 'critical' || x.severity === 'high') && x.kind !== 'overdue_po')) items.push({ id: a.id, kind: 'Stock', title: a.title, detail: a.detail, to: a.sku ? '/inventory/' + a.sku : '/alerts', cta: 'Open', tone: 'bad' });
  return (
    <Page narrow>
      <PageHeader title="Action Center" sub="Everything waiting on a person, in one place. Items clear themselves once the cause is dealt with." />
      <Block className="grid c3"><Metric label="Waiting" value={items.length} /><Metric label="Need approval" value={items.filter((i) => i.kind === 'SiBorg').length} foot="SiBorg proposals" /><Metric label="Urgent" value={items.filter((i) => i.tone === 'bad').length} foot="late or out of stock" /></Block>
      <div style={{ height: 16 }} />
      <Block><Panel flush>
        {items.length === 0 && <div className="empty"><h3>Nothing is waiting</h3><p>You are up to date.</p></div>}
        {items.map((i) => (
          <div key={i.id} className="list-row" style={{ padding: '14px 18px' }}>
            <Chip tone={i.tone}>{i.kind}</Chip>
            <div className="grow"><div className="t">{i.title}</div><div className="d">{i.detail}</div></div>
            <Link to={i.to} className="btn btn-sm">{i.cta}</Link>
          </div>))}
      </Panel></Block>
    </Page>
  );
}

interface Campaign { id: string; name: string; audience: string; offer: string; status: 'active' | 'draft'; ends: string }
export function CampaignsPage() {
  const toast = useToast();
  const [list, setList] = useState<Campaign[]>([
    { id: 'CMP-3', name: 'Festive stationery bundle', audience: 'Business customers', offer: '10% off notebooks and pens above 50 units', status: 'active', ends: '5 Nov' },
    { id: 'CMP-2', name: 'Mug clearance', audience: 'Everyone', offer: '20% off Ceramic mug', status: 'draft', ends: '15 Nov' },
  ]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', audience: 'Everyone', offer: '' });
  const [err, setErr] = useState('');
  return (
    <Page narrow>
      <PageHeader title="Campaigns" sub="Offers and outreach. Turning one on here does not send anything to customers in this prototype." actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus />New campaign</Button>} />
      <Block><Panel flush>
        {list.map((c) => (
          <div key={c.id} className="list-row" style={{ padding: '14px 18px' }}>
            <span className="avatar"><Megaphone size={15} /></span>
            <div className="grow"><div className="t">{c.name}</div><div className="d">{c.audience} · {c.offer} · ends {c.ends}</div></div>
            <StatusChip status={c.status} />
            <Toggle label={'Activate ' + c.name} checked={c.status === 'active'} onChange={(v) => { setList((x) => x.map((y) => (y.id === c.id ? { ...y, status: v ? 'active' : 'draft' } : y))); toast(c.name + (v ? ' is active.' : ' is back to draft.')); }} />
          </div>))}
      </Panel></Block>
      <Dialog open={open} onClose={() => setOpen(false)} title="New campaign" footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => { if (!f.name.trim() || !f.offer.trim()) { setErr('Give the campaign a name and an offer.'); return; } setList((x) => [{ id: 'CMP-' + (x.length + 4), name: f.name, audience: f.audience, offer: f.offer, status: 'draft', ends: '30 Nov' }, ...x]); setOpen(false); setF({ name: '', audience: 'Everyone', offer: '' }); setErr(''); toast('Campaign saved as a draft.'); }}>Save draft</Button></>}>
        <div className="stack"><Field label="Name" error={err}>{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />}</Field>
          <Field label="Audience">{(id) => <Select id={id} value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}><option>Everyone</option><option>Business customers</option><option>Retail customers</option></Select>}</Field>
          <Field label="Offer">{(id) => <Input id={id} value={f.offer} onChange={(e) => setF({ ...f, offer: e.target.value })} placeholder="For example: 15% off Steel bottle 750ml" />}</Field></div>
      </Dialog>
    </Page>
  );
}
