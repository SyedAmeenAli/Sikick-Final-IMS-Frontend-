import { Link } from 'react-router-dom';
import { Archive, Clock, Download, FileJson, Lock, Receipt } from 'lucide-react';
import { Block, Button, Chip, Notice, Page, PageHeader, Panel } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Overlay';
import { TrialRing, TrialTimeline, tone, trialDate, trialLine } from '@/features/trial/TrialPanel';
import { PHASE_LABEL, RETENTION_DAYS } from '@/services/account';
import { downloadCsv, download } from '@/lib/csv';
import { orderTotal, product, stockTotal, supplierBalance, supplierOf } from '@/services/selectors';
import { fmtDay } from '@/lib/format';
import { useIms, useTrial } from '@/services';
import type { ImsState } from '@/services/contracts/service';

/** Trial, read-only and archive status, one page for every phase so the story is the same wherever you look. */
export default function TrialEndedPage() {
  const s = useIms();
  const t = useTrial();
  const name = s.account.workspace.name;
  const heading = t.paid ? 'Your plan is active' : t.archived ? name + ' is archived' : t.readOnly ? 'Your trial has ended' : 'Your trial is running';
  return (
    <Page narrow>
      <PageHeader title={heading} sub={name + ' · ' + PHASE_LABEL[t.phase]} actions={<Chip tone={tone(t)} plain>{trialLine(t)}</Chip>} />
      <Block>
        <Panel glass>
          <div className="row" style={{ gap: 24, flexWrap: 'nowrap', alignItems: 'center' }}>
            <TrialRing t={t} />
            <div className="stack" style={{ gap: 8 }}>
              {t.paid && <p>A paid plan is active, so nothing is limited. Plan changes are made under Settings, Billing.</p>}
              {!t.paid && !t.readOnly && <p>Everything works until <b>{trialDate(t.endsAt)}</b>. No card is needed. When the trial ends, the workspace turns read-only: you can still look at every record and export all of it for {RETENTION_DAYS} days.</p>}
              {t.readOnly && !t.archived && <p>The trial ended on <b>{trialDate(t.endsAt)}</b>. Adding or changing anything is paused; looking at and exporting everything still works until <b>{trialDate(t.retentionEndsAt!)}</b>, {t.retentionDaysLeft} {t.retentionDaysLeft === 1 ? 'day' : 'days'} from now.</p>}
              {t.archived && <p>The {RETENTION_DAYS}-day read-only period ended on <b>{trialDate(t.retentionEndsAt!)}</b>. The workspace has been archived and is no longer open here.</p>}
              <div className="actions">
                {!t.archived && <Link className="btn btn-primary" to="/settings/billing"><Receipt aria-hidden />Review plans</Link>}
                {!t.archived && <Link className="btn" to="/account/export"><Download aria-hidden />Export your data</Link>}
                {t.archived && <a className="btn btn-primary" href="mailto:support@sikick.example?subject=Archived%20workspace">Contact support</a>}
              </div>
            </div>
          </div>
        </Panel>
      </Block>
      <div style={{ height: 16 }} />
      <Block><Panel title="What happens, and when"><TrialTimeline t={t} /></Panel></Block>
      <div style={{ height: 16 }} />
      <Block className="grid c2">
        <Panel title={<span className="row" style={{ gap: 8 }}><Lock size={16} aria-hidden />While read-only</span>}>
          <ul className="stack" style={{ gap: 8 }}>
            <li>Every list, report, ledger and record can be opened.</li>
            <li>Exports stay available the whole time.</li>
            <li>Anything that adds or changes data is refused, and says so. The till is paused.</li>
          </ul>
        </Panel>
        <Panel title={<span className="row" style={{ gap: 8 }}><Archive size={16} aria-hidden />After {RETENTION_DAYS} days</span>}>
          <p>A workspace that never traded is archived and then deleted. One with stock or sales history is archived and kept for review rather than deleted, because those are real business records. Choosing a plan any time before then restores full access.</p>
        </Panel>
      </Block>
      <div style={{ height: 14 }} />
      <Notice tone="info" title="This prototype">Plans cannot be bought here and nothing is charged or deleted. Use the prototype states panel (add ?dev=1 to the address) to see each phase.</Notice>
    </Page>
  );
}

const rupees = (p: number) => (p / 100).toFixed(2);
type Set = { id: string; title: string; note: string; rows: (s: ImsState) => Array<Array<string | number>>; file: string };
const SETS: Set[] = [
  { id: 'products', title: 'Products and prices', note: 'Every SKU with price, cost, GST and reorder point', file: 'products.csv',
    rows: (s) => [['SKU', 'Name', 'Category', 'Price', 'Cost', 'GST %', 'Reorder at', 'On hand'], ...s.products.map((p) => [p.sku, p.name, p.category, rupees(p.price), rupees(p.cost), p.gst, p.reorderPoint, stockTotal(s, p.sku)])] },
  { id: 'stock', title: 'Stock events', note: 'The full movement history that stock is the sum of', file: 'stock-events.csv',
    rows: (s) => [['ID', 'When', 'SKU', 'Product', 'Type', 'Change', 'Reason', 'By'], ...s.movements.map((m) => [m.id, m.at, m.sku, product(s, m.sku).name, m.type, m.delta, m.reason ?? '', m.by])] },
  { id: 'orders', title: 'Orders', note: 'Sales with status and totals', file: 'orders.csv',
    rows: (s) => [['Order', 'When', 'Status', 'Channel', 'Items', 'Total'], ...s.orders.map((o) => [o.no, o.at, o.status, o.channel, o.lines.reduce((a, l) => a + l.qty, 0), rupees(orderTotal(o))])] },
  { id: 'customers', title: 'Customers', note: 'Names and contact details', file: 'customers.csv',
    rows: (s) => [['ID', 'Name', 'Kind', 'Phone', 'City'], ...s.customers.map((c) => [c.id, c.name, c.kind, c.phone ?? '', c.city ?? ''])] },
  { id: 'suppliers', title: 'Suppliers and balances', note: 'Who you buy from and what you owe', file: 'suppliers.csv',
    rows: (s) => [['ID', 'Name', 'Terms', 'We owe'], ...s.suppliers.map((x) => [x.id, x.name, x.terms, rupees(supplierBalance(s, x.id))])] },
  { id: 'pos', title: 'Purchase orders', note: 'Every order to a supplier', file: 'purchase-orders.csv',
    rows: (s) => [['Order', 'Supplier', 'Status', 'Placed', 'Expected'], ...s.purchaseOrders.map((p) => [p.no, supplierOf(s, p.supplierId).name, p.status, fmtDay(p.date), p.expected ? fmtDay(p.expected) : ''])] },
  { id: 'audit', title: 'Audit log', note: 'Every write, by whom, when', file: 'audit-log.csv',
    rows: (s) => [['When', 'Who', 'Action', 'Entity', 'Reference', 'Detail'], ...s.audit.map((a) => [a.at, a.actor, a.action, a.entity, a.ref, a.detail])] },
];

/** Real downloads built from the workspace's own records. Available in every phase, including read-only. */
export function ExportPage() {
  const s = useIms();
  const t = useTrial();
  const toast = useToast();
  const all = () => {
    const out: Record<string, unknown[]> = {};
    for (const x of SETS) { const [head, ...rest] = x.rows(s); out[x.id] = rest.map((r) => Object.fromEntries(head.map((h, i) => [String(h), r[i]]))); }
    download(s.account.workspace.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-export.json', 'application/json', JSON.stringify({ workspace: s.account.workspace.name, exportedAt: new Date().toISOString(), ...out }, null, 2));
    toast('Export file created. Your browser has it now.');
  };
  return (
    <Page narrow>
      <PageHeader title="Export your data" sub={t.readOnly ? 'Read-only workspace: exports stay available until ' + (t.retentionEndsAt ? trialDate(t.retentionEndsAt) : 'the archive date') + '.' : 'Your records are yours. Download them whenever you like.'} actions={<Button variant="primary" onClick={all}><FileJson aria-hidden />Everything as one JSON file</Button>} />
      {t.readOnly && <><Notice tone={t.phase === 'readonly-ending' ? 'warn' : 'info'} title={t.retentionDaysLeft + ' ' + (t.retentionDaysLeft === 1 ? 'day' : 'days') + ' to export'}>After that the workspace is archived. Choosing a plan before then keeps everything open.</Notice><div style={{ height: 14 }} /></>}
      <Block>
        <Panel flush>
          <ul>{SETS.map((x) => (
            <li key={x.id} className="list-row" style={{ padding: '14px 18px' }}>
              <div className="grow"><div className="t">{x.title}</div><div className="d">{x.note} · {x.rows(s).length - 1} rows</div></div>
              <Button size="sm" onClick={() => { downloadCsv(x.file, x.rows(s)); toast(x.file + ' created. Your browser has it now.'); }}><Download aria-hidden />CSV</Button>
            </li>
          ))}</ul>
        </Panel>
      </Block>
      <div style={{ height: 14 }} />
      <p className="muted"><Clock size={13} aria-hidden style={{ display: 'inline', verticalAlign: '-2px' }} /> Files are built in your browser from what is on screen. Nothing is uploaded. <Link className="link" to="/trial-ended">What happens after the trial</Link>.</p>
    </Page>
  );
}
