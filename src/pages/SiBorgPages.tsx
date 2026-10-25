import { Suspense, lazy, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { Block, Button, Chip, KV, Metric, Notice, Page, PageHeader, Panel, StatusChip } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Overlay';
import { SiBorgArt, SiBorgIcon, type SiBorgMood } from '@/components/brand';
import { ArtDoc } from '@/components/illustrations';
import { SiBorgChat } from '@/features/siborg/SiBorgChat';
import { fmt, fmtShort, lineTotals } from '@/lib/money';
import { fmtStamp } from '@/lib/format';
import { useCommands, useIms } from '@/services';
import { insights } from '@/services/insights';
import { kpis, product, supplierOf } from '@/services/selectors';
import { ROLE_LABEL } from '@/app/permissions';

const Stage3D = lazy(() => import('@/features/siborg/SiBorgObject3D').then((m) => ({ default: m.SiBorgObject3D })));

export function SiBorgPage() {
  const [mood, setMood] = useState<SiBorgMood>('idle');
  const s = useIms();
  const k = kpis(s);
  const brief = insights(s).slice(0, 3);
  const pending = s.proposals.filter((p) => p.state === 'proposed').length;
  return (
    <Page>
      <PageHeader title="SiBorg" sub="Ask about your own stock, sales and suppliers. SiBorg explains and recommends. You approve, and only then does anything change." />
      <Block glass className="grid main-side">
        <Panel glass><SiBorgChat onMood={setMood} /></Panel>
        <div className="stack">
          <div className="siborg-stage" aria-label={'SiBorg is ' + mood}><Suspense fallback={<div className="empty"><SiBorgArt width={120} /></div>}><Stage3D state={mood} /></Suspense><span className="caption">{mood === 'recommend' ? 'Proposing, awaiting your approval' : mood === 'error' ? 'Cannot do that' : mood}</span></div>
          <Panel><div className="siborg-hero"><SiBorgArt width={130} /><div><div className="eyebrow">What it can see</div><p style={{ marginTop: 6 }}>Products, stock events, orders, purchase orders and supplier balances for Morrow Goods. It cannot book shipments, send messages or move money.</p></div></div></Panel>
          <Panel title="Business context">
            <KV rows={[['Sales today', fmtShort(k.todaySales)], ['Below reorder', k.lowStock + ' products'], ['Overdue orders', String(k.overduePos)], ['Owed to suppliers', fmtShort(k.payable)], ['You are', ROLE_LABEL[s.role]]]} />
          </Panel>
          <Panel glass title="Needs your decision" actions={<Link className="link" to="/agent/proposals">Approvals</Link>}>
            <div className="row" style={{ gap: 10 }}><Chip tone={pending ? 'wine' : 'ok'}>{pending} waiting</Chip><span className="muted">Proposals stay proposals until approved.</span></div>
            <hr className="divider" />
            {brief.map((b) => <div key={b.id} className="stat-line" style={{ display: 'block' }}><b>{b.title}</b></div>)}
          </Panel>
        </div>
      </Block>
    </Page>
  );
}

export function ProposalsPage() {
  const { sessionId } = useParams();
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  const nav = useNavigate();
  const [tab, setTab] = useState<'proposed' | 'history'>('proposed');
  const canDecide = s.role === 'admin' || s.role === 'manager';
  const list = sessionId ? s.proposals.filter((p) => p.sessionId === sessionId) : s.proposals.filter((p) => (tab === 'proposed' ? p.state === 'proposed' : p.state !== 'proposed'));
  const decide = (id: string, d: 'approved' | 'rejected') => { const r = cmd.decideProposal(id, d); toast(r.ok ? (d === 'approved' ? 'Approved. The change was applied locally.' : 'Rejected. Nothing changed.') : r.message, r.ok ? 'ok' : 'bad'); };
  return (
    <Page narrow>
      <PageHeader title="Approvals" sub="Each recommendation from SiBorg appears here with its reasoning. Approve to act, reject to leave things as they are." actions={sessionId ? <Button onClick={() => nav('/agent/proposals')}>All approvals</Button> : undefined} />
      {!sessionId && <Block className="grid c3"><Metric label="Waiting" value={s.proposals.filter((p) => p.state === 'proposed').length} /><Metric label="Approved" value={s.proposals.filter((p) => p.state === 'approved').length} /><Metric label="Rejected" value={s.proposals.filter((p) => p.state === 'rejected').length} /></Block>}
      {!sessionId && <><div style={{ height: 14 }} /><div className="seg" role="group" aria-label="Approvals view"><button type="button" aria-pressed={tab === 'proposed'} onClick={() => setTab('proposed')}>Waiting</button><button type="button" aria-pressed={tab === 'history'} onClick={() => setTab('history')}>History</button></div></>}
      {!canDecide && <><div style={{ height: 14 }} /><Notice tone="warn" title="View only">Managers and admins decide on proposals. You can read them as {ROLE_LABEL[s.role]}.</Notice></>}
      <div style={{ height: 14 }} />
      <div className="stack">
        {list.length === 0 && <Panel><div className="empty"><SiBorgIcon size={40} /><h3>Nothing waiting</h3><p>Ask SiBorg for a recommendation and it will appear here.</p></div></Panel>}
        {list.map((p) => (
          <Panel glass key={p.id} title={<span className="row" style={{ gap: 10 }}><SiBorgIcon size={26} mood={p.state === 'proposed' ? 'insight' : 'idle'} />{p.title}</span>} hint={p.id + ' · session ' + p.sessionId} actions={<StatusChip status={p.state} />}>
            <div className="stack">
              <p>{p.reasoning}</p>
              <div><div className="eyebrow">Based on</div><ul style={{ margin: '6px 0 0', paddingLeft: 18, listStyle: 'disc' }}>{p.basis.map((b) => <li key={b}>{b}</li>)}</ul></div>
              <div><div className="eyebrow">If approved</div>{p.actions.map((a) => <div key={a.id} className="stat-line" style={{ display: 'block' }}><b>{a.label}</b><div className="muted">{a.detail}</div></div>)}</div>
              {p.state === 'proposed' ? (
                <div className="actions"><Button variant="primary" disabled={!canDecide} onClick={() => decide(p.id, 'approved')}><Check />Approve</Button><Button disabled={!canDecide} onClick={() => decide(p.id, 'rejected')}><X />Reject</Button></div>
              ) : <p className="muted">{p.state === 'approved' ? 'Approved' : 'Rejected'} by {p.decidedBy} on {p.decidedAt && fmtStamp(p.decidedAt)}.</p>}
            </div>
          </Panel>
        ))}
      </div>
    </Page>
  );
}

export function DocumentExtractPage() {
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  const nav = useNavigate();
  const [file, setFile] = useState<string | null>(null);
  const [phase, setPhase] = useState<'pick' | 'reading' | 'done'>('pick');
  const lines = [{ sku: 'SKU-4120', qty: 200 }, { sku: 'SKU-4121', qty: 150 }];
  const sup = supplierOf(s, 'SUP-01');
  const read = (name: string) => { setFile(name); setPhase('reading'); window.setTimeout(() => setPhase('done'), 1200); };
  const total = lines.reduce((a, l) => a + lineTotals(product(s, l.sku).cost, l.qty, product(s, l.sku).gst).total, 0);
  return (
    <Page narrow>
      <PageHeader title="Document extraction" sub="Drop in a supplier bill and SiBorg reads the lines so you can check them against a purchase order." />
      <Block><Notice tone="wine" title="Prototype">The file stays in your browser and the result is an example for review. The live system sends the document to the extraction endpoint.</Notice></Block>
      <div style={{ height: 14 }} />
      <Block><Panel>
        {phase === 'pick' ? (
          <label className="drop" style={{ cursor: 'pointer', display: 'block' }}><ArtDoc /><div style={{ fontWeight: 600, marginTop: 6 }}>Choose a supplier bill</div><div className="muted">PDF or image</div><input type="file" accept="application/pdf,image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f.name); }} /></label>
        ) : (
          <div className="stack">
            <div className="row" style={{ gap: 10 }}><SiBorgIcon size={28} mood={phase === 'reading' ? 'thinking' : 'insight'} /><b>{phase === 'reading' ? 'Reading ' + file + '…' : 'Read ' + file}</b></div>
            {phase === 'done' && <>
              <KV rows={[['Supplier', sup.name], ['Bill number', 'AW/26/10431'], ['Bill date', '22 Oct 2026']]} />
              <div className="tbl-wrap"><table className="tbl" aria-label="Extracted lines"><thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Amount incl. GST</th></tr></thead>
                <tbody>{lines.map((l) => { const p = product(s, l.sku); return <tr key={l.sku}><td><div className="cell-main">{p.name}</div><div className="cell-sub mono">{p.sku}</div></td><td className="num">{l.qty}</td><td className="num">{fmt(p.cost)}</td><td className="num">{fmt(lineTotals(p.cost, l.qty, p.gst).total)}</td></tr>; })}</tbody></table></div>
              <div className="stat-line"><b>Bill total</b><b className="num">{fmt(total)}</b></div>
              <div className="actions"><Button variant="primary" onClick={() => { const r = cmd.createPurchaseOrder('SUP-01', lines, 'Matched from bill AW/26/10431'); if (r.ok) { toast('Draft ' + r.value + ' created from the bill.'); nav('/purchase-orders/' + r.value); } }}>Create a draft purchase order</Button><Button onClick={() => { setPhase('pick'); setFile(null); }}>Start over</Button></div>
            </>}
          </div>
        )}
      </Panel></Block>
    </Page>
  );
}
