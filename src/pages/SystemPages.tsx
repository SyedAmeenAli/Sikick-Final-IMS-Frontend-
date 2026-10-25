import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Download, FileUp, Undo2 } from 'lucide-react';
import { Block, Button, Chip, FilterChips, Input, Metric, Notice, Page, PageHeader, Panel, Select, Segmented } from '@/components/ui/primitives';
import { Tabs } from '@/components/ui/Tabs';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { useToast } from '@/components/ui/Overlay';
import { ArtDoc } from '@/components/illustrations';
import { download, downloadCsv } from '@/lib/csv';
import { rupees } from '@/lib/money';
import { fmtStamp } from '@/lib/format';
import { useCommands, useIms } from '@/services';
import { dur, ease, group, item } from '@/animations/motion';
import { motion } from 'motion/react';
import type { AuditEntry } from '@/services/contracts/types';

/* ---------- import ---------- */
interface Row { line: number; name: string; category: string; price: number; cost: number; stock: number; gst: number; problems: string[] }
const SAMPLE = 'Name,Category,Price,Cost,Stock,GST\nBamboo toothbrush set,Home,249,120,60,12\nSpiral notebook A4,Stationery,129,66,200,12\nCotton T-shirt (M),Apparel,499,285,40,5\nDenim tote,Apparel,0,210,20,12\nCeramic planter,Gardening,599,300,15,12\n';
const MAX = 5000;

function parse(text: string): { head: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const cut = (l: string) => { const out: string[] = []; let cur = ''; let q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur.trim()); cur = ''; } else cur += ch; } out.push(cur.trim()); return out; };
  return { head: cut(lines[0] ?? ''), rows: lines.slice(1).map(cut) };
}
const FIELDS = [['name', 'Name'], ['category', 'Category'], ['price', 'Price'], ['cost', 'Cost'], ['stock', 'Stock'], ['gst', 'GST']] as const;

export function ImportPage() {
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  const [file, setFile] = useState<{ name: string; head: string[]; rows: string[][] } | null>(null);
  const [map, setMap] = useState<Record<string, number>>({});
  const [step, setStep] = useState<'pick' | 'map' | 'check' | 'done'>('pick');
  const [runs, setRuns] = useState<Array<{ id: string; at: string; file: string; skus: string[]; undone: boolean }>>([]);

  const load = (name: string, text: string) => {
    const p = parse(text);
    const m: Record<string, number> = {};
    FIELDS.forEach(([k, label]) => { m[k] = p.head.findIndex((h) => h.toLowerCase() === label.toLowerCase()); });
    setFile({ name, ...p }); setMap(m); setStep('map');
  };
  const checked = useMemo<Row[]>(() => {
    if (!file) return [];
    const names = new Set(s.products.map((p) => p.name.toLowerCase()));
    const seen = new Set<string>();
    return file.rows.slice(0, MAX).map((r, i) => {
      const g = (k: string) => (map[k] >= 0 ? r[map[k]] ?? '' : '');
      const row: Row = { line: i + 2, name: g('name'), category: g('category'), price: parseFloat(g('price')), cost: parseFloat(g('cost')) || 0, stock: parseInt(g('stock')) || 0, gst: parseInt(g('gst')) || 12, problems: [] };
      if (!row.name) row.problems.push('Name is missing');
      if (names.has(row.name.toLowerCase())) row.problems.push('Already in the catalogue');
      if (seen.has(row.name.toLowerCase())) row.problems.push('Repeated in this file');
      seen.add(row.name.toLowerCase());
      if (!(row.price > 0)) row.problems.push('Price must be above zero');
      if (!s.categories.some((c) => c.name.toLowerCase() === row.category.toLowerCase())) row.problems.push('Unknown category “' + row.category + '”');
      return row;
    });
  }, [file, map, s.products, s.categories]);
  const good = checked.filter((r) => !r.problems.length);

  const commit = () => {
    const skus: string[] = [];
    for (const r of good) {
      const cat = s.categories.find((c) => c.name.toLowerCase() === r.category.toLowerCase())!.name;
      const res = cmd.createProduct({ name: r.name, category: cat, type: s.productTypes[0].name, brand: 'Morrow', unit: 'pcs', hsn: '', gst: r.gst, price: rupees(r.price), cost: rupees(r.cost), reorderPoint: 10, tracking: 'none', openingStock: r.stock });
      if (res.ok) skus.push(res.value);
    }
    setRuns((x) => [{ id: 'IMP-' + (x.length + 1), at: 'Just now', file: file!.name, skus, undone: false }, ...x]);
    toast(skus.length + ' products imported in one go.'); setStep('done');
  };
  const cols: Array<Column<Row>> = [
    { id: 'l', header: 'Line', num: true, cell: (r) => r.line },
    { id: 'n', header: 'Name', primary: true, cell: (r) => <b>{r.name || '—'}</b> },
    { id: 'c', header: 'Category', cell: (r) => r.category },
    { id: 'p', header: 'Price', num: true, cell: (r) => (isFinite(r.price) ? r.price : '—') },
    { id: 's', header: 'Stock', num: true, cell: (r) => r.stock },
    { id: 'x', header: 'Result', cell: (r) => (r.problems.length ? <span style={{ color: 'var(--bad)' }}>{r.problems.join(', ')}</span> : <Chip tone="ok">Ready</Chip>) },
  ];
  return (
    <Page narrow>
      <PageHeader title="Import products" sub={'Check first, then add everything in one step. Up to ' + MAX.toLocaleString('en-IN') + ' rows a file, and a recent import can be undone.'} actions={<Button onClick={() => download('morrow-sample.csv', 'text/csv', SAMPLE)}><Download />Sample file</Button>} />
      <Block><div className="steps" aria-label="Import steps">{['Choose file', 'Match columns', 'Check', 'Done'].map((t, i) => { const at = ['pick', 'map', 'check', 'done'].indexOf(step); return <span key={t} style={{ display: 'contents' }}>{i > 0 && <span className="step-link" data-done={i <= at} />}<span className="step" data-state={i < at ? 'done' : i === at ? 'now' : 'todo'}><span className="dot">{i < at ? '✓' : i + 1}</span>{t}</span></span>; })}</div></Block>
      <div style={{ height: 16 }} />
      {step === 'pick' && <Block><Panel><label className="drop" style={{ cursor: 'pointer', display: 'block' }}><ArtDoc /><div style={{ fontWeight: 600, marginTop: 6 }}>Choose a CSV file</div><div className="muted">Spreadsheets and Tally exports are read by the live importer. This prototype reads CSV.</div><input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void f.text().then((t) => load(f.name, t)); }} /></label>
        <div className="row" style={{ marginTop: 12 }}><span className="muted">No file handy?</span><Button size="sm" onClick={() => load('morrow-sample.csv', SAMPLE)}>Use the sample file</Button></div></Panel></Block>}
      {step === 'map' && file && <Block><Panel title="Match columns" hint={file.name + ' · ' + file.rows.length + ' rows'}>
        <div className="form-grid">{FIELDS.map(([k, label]) => <div key={k} className="field"><label htmlFor={'m-' + k}>{label}{k === 'name' || k === 'price' ? ' *' : ''}</label><Select id={'m-' + k} value={map[k]} onChange={(e) => setMap({ ...map, [k]: Number(e.target.value) })}><option value={-1}>Not in the file</option>{file.head.map((h, i) => <option key={h + i} value={i}>{h}</option>)}</Select></div>)}</div>
        <div className="form-foot"><Button onClick={() => { setFile(null); setStep('pick'); }}>Start over</Button><Button variant="primary" disabled={map.name < 0 || map.price < 0} onClick={() => setStep('check')}>Check the file</Button></div></Panel></Block>}
      {step === 'check' && file && <Block className="stack">
        <div className="grid c3"><Metric label="Ready to add" value={good.length} /><Metric label="Need fixing" value={checked.length - good.length} foot="skipped on import" /><Metric label="Rows read" value={checked.length} /></div>
        <Notice tone="info" title="This check changes nothing">Nothing is written until you press Import. Rows with a problem are left out.</Notice>
        <Panel flush><DataTable label="Import check" rows={checked} rowKey={(r) => String(r.line)} columns={cols} pageSize={8} /></Panel>
        <div className="actions"><Button onClick={() => setStep('map')}>Back</Button><Button variant="primary" disabled={!good.length} onClick={commit}><FileUp />Import {good.length} products</Button></div></Block>}
      {step === 'done' && <Block><Panel><div className="empty"><Check size={28} color="var(--ok)" /><h3>Imported</h3><p>The new products are in the catalogue with their opening stock recorded as stock events.</p><div className="actions"><Link className="btn btn-primary" to="/products">Open products</Link><Button onClick={() => { setFile(null); setStep('pick'); }}>Import another file</Button></div></div></Panel></Block>}
      {runs.length > 0 && <><div style={{ height: 16 }} /><Block><Panel title="Recent imports" flush>{runs.map((r) => <div key={r.id} className="list-row" style={{ padding: '12px 18px' }}><div className="grow"><div className="t">{r.file}</div><div className="d">{r.skus.length} products · {r.at}</div></div>{r.undone ? <Chip tone="neutral">Undone</Chip> : <Button size="sm" onClick={() => { const x = cmd.removeProducts(r.skus); if (x.ok) { setRuns((all) => all.map((y) => (y.id === r.id ? { ...y, undone: true } : y))); toast('Import undone.'); } else toast(x.message, 'bad'); }}><Undo2 />Undo</Button>}</div>)}</Panel></Block></>}
    </Page>
  );
}

/* ---------- audit log ---------- */
export function AuditLogPage() {
  const s = useIms();
  const [ent, setEnt] = useState('all');
  const entities = Array.from(new Set(s.audit.map((a) => a.entity)));
  const rows = s.audit.filter((a) => ent === 'all' || a.entity === ent);
  const cols: Array<Column<AuditEntry>> = [
    { id: 'w', header: 'When', primary: true, sort: (a) => a.at, cell: (a) => fmtStamp(a.at) },
    { id: 'a', header: 'Who', cell: (a) => a.actor },
    { id: 'x', header: 'Action', cell: (a) => <span className="mono">{a.action}</span> },
    { id: 'r', header: 'Record', cell: (a) => <span><b>{a.entity}</b> <span className="mono">{a.ref}</span></span> },
    { id: 'd', header: 'Detail', cell: (a) => a.detail },
  ];
  return (
    <Page>
      <PageHeader title="Audit log" sub={'Every write, by a person or by SiBorg once approved. Kept for ' + s.business.auditLogRetentionMonths + ' months.'} actions={<Button onClick={() => downloadCsv('audit-log.csv', [['When', 'Who', 'Action', 'Entity', 'Reference', 'Detail'], ...rows.map((a) => [a.at, a.actor, a.action, a.entity, a.ref, a.detail])])}><Download />Download CSV</Button>} />
      <Block><Panel flush><DataTable label="Audit log" rows={rows} rowKey={(a) => a.id} columns={cols} pageSize={12} searchText={(a) => a.actor + ' ' + a.action + ' ' + a.ref + ' ' + a.detail} searchPlaceholder="Search the log" filters={<FilterChips label="Record type" value={ent} onChange={setEnt} options={[{ value: 'all', label: 'All' }, ...entities.map((e) => ({ value: e, label: e }))]} />} /></Panel></Block>
    </Page>
  );
}

/* ---------- help ---------- */
const GUIDES: Array<{ q: string; a: string; tag: string }> = [
  { tag: 'Stock', q: 'Why can’t I type a quantity straight into a product?', a: 'Quantities are the sum of stock events. To change one, record an adjustment with a reason, so the history always explains the number.' },
  { tag: 'Stock', q: 'What is the difference between on hand, reserved and damaged?', a: 'On hand is everything physically counted as sellable. Reserved is held for confirmed orders. Damaged is held back from sale.' },
  { tag: 'Buying', q: 'How do I receive a purchase order?', a: 'Open the order, choose Receive stock, enter what arrived and how much was damaged, then confirm. Good units go into stock and the supplier balance rises.' },
  { tag: 'Selling', q: 'How does an order move from draft to delivered?', a: 'Draft, Pending (stock reserved), Paid (stock deducted), Packed, Shipped, Delivered, Completed. Returns put stock back.' },
  { tag: 'Till', q: 'What happens if the till goes offline?', a: 'The till keeps selling from its cached catalogue and queues each sale. Press Sync when the connection returns.' },
  { tag: 'Team', q: 'Why can’t a cashier see Finance?', a: 'Each role opens only what it needs. Finance, settings and the audit log are admin only; analytics and buying are manager and above.' },
  { tag: 'SiBorg', q: 'Can SiBorg place an order for me?', a: 'No. It drafts a recommendation. A manager approves it in Approvals, and only then does anything change.' },
];
export function HelpPage() {
  const [tab, setTab] = useState<'guides' | 'fix' | 'keys'>('guides');
  const [q, setQ] = useState('');
  const list = GUIDES.filter((g) => !q || (g.q + g.a + g.tag).toLowerCase().includes(q.toLowerCase()));
  return (
    <Page narrow>
      <PageHeader title="Help Center" sub="Short answers to the questions people ask most." />
      <Block><Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search help" aria-label="Search help" style={{ minHeight: 44 }} /></Block>
      <div style={{ height: 14 }} />
      <Block><Panel flush>
        <Tabs label="Help sections" value={tab} onChange={setTab} tabs={[{ id: 'guides', label: 'Guides' }, { id: 'fix', label: 'Troubleshooting' }, { id: 'keys', label: 'Shortcuts' }]} />
        <div style={{ padding: '6px 18px 14px' }}>
          {tab === 'guides' && (list.length ? list.map((g) => <details key={g.q} className="faq"><summary><Chip tone="wine" plain>{g.tag}</Chip> {g.q}</summary><p>{g.a}</p></details>) : <p className="muted" style={{ padding: 16 }}>No guide matches “{q}”.</p>)}
          {tab === 'fix' && ['A sale will not go through: check that every item has stock available and that the payments cover the total.', 'A barcode does not scan: open Barcode Center, Scanner test, and scan it there to see whether the catalogue knows the code.', 'A page says it is not open to your role: ask an admin to change your role in Team and roles.', 'A figure looks wrong: open the product, then its stock events. The events explain every change.'].map((t) => <p key={t} className="stat-line" style={{ display: 'block' }}>{t}</p>)}
          {tab === 'keys' && [['Ctrl K', 'Search anywhere'], ['Esc', 'Close a menu, drawer or dialog'], ['Enter in the till search', 'Add the exact SKU or barcode to the cart'], ['Arrow keys in search', 'Move through results']].map(([k, d]) => <div className="stat-line" key={k}><kbd className="mono" style={{ background: 'var(--surface-3)', padding: '2px 8px', borderRadius: 6 }}>{k}</kbd><span>{d}</span></div>)}
        </div>
      </Panel></Block>
    </Page>
  );
}

/* ---------- design system ---------- */
export function DesignSystemPage() {
  const [run, setRun] = useState(0);
  const tokens = [['--wine', 'Wine'], ['--wine-soft', 'Blush'], ['--ink', 'Ink'], ['--ink-3', 'Muted'], ['--surface', 'Surface'], ['--bg', 'Workspace'], ['--ok', 'Positive'], ['--warn', 'Caution'], ['--bad', 'Critical'], ['--info', 'Info']];
  const durs = [['Button and icon feedback', 'micro', 0.15], ['Hover and focus', 'hover', 0.17], ['Menus', 'menu', 0.2], ['Route content', 'route', 0.22], ['Panels', 'panel', 0.26], ['Navigation drawer', 'drawer', 0.3], ['Dashboard groups', 'section', 0.44], ['Chart drawing', 'chart', 0.65]] as const;
  return (
    <Page>
      <PageHeader title="Design system" sub="The tokens and parts every screen is built from." />
      <Block><Panel title="Colour"><div className="row" style={{ gap: 14 }}>{tokens.map(([v, n]) => <div key={v} style={{ width: 92 }}><div className="swatch" style={{ background: 'var(' + v + ')', width: '100%' }} /><div style={{ fontWeight: 600, marginTop: 6 }}>{n}</div><div className="mono muted">{v}</div></div>)}</div></Panel></Block>
      <div style={{ height: 16 }} />
      <Block className="grid c2">
        <Panel title="Type"><div className="stack" style={{ gap: 6 }}><div style={{ font: '500 1.75rem/1.2 var(--font-serif)' }}>Page title, Newsreader</div><div style={{ fontWeight: 600, fontSize: 'var(--fs-lg)' }}>Section heading, DM Sans 600</div><div>Body, DM Sans 400 at 13.5px with tabular figures for money: ₹12,34,567.00</div><div className="muted">Secondary text</div><div className="eyebrow">Eyebrow label</div></div></Panel>
        <Panel title="Controls"><div className="stack"><div className="row"><Button variant="primary">Primary</Button><Button>Default</Button><Button variant="ghost">Ghost</Button><Button variant="danger">Danger</Button></div><div className="row"><Chip tone="ok">In stock</Chip><Chip tone="warn">Low</Chip><Chip tone="bad">Out</Chip><Chip tone="info">Ordered</Chip><Chip tone="wine">Proposal</Chip></div><Segmented label="Example" value="a" onChange={() => {}} options={[{ value: 'a', label: 'One' }, { value: 'b', label: 'Two' }]} /></div></Panel>
      </Block>
      <div style={{ height: 16 }} />
      <Block><Panel title="Motion" hint="One easing curve and a short list of durations, everywhere" actions={<Button size="sm" onClick={() => setRun((r) => r + 1)}>Replay</Button>}>
        <motion.div key={run} variants={group} initial="hidden" animate="show" className="stack" style={{ gap: 6 }}>
          {durs.map(([l, , d]) => <motion.div key={l} variants={item} className="hbar" style={{ gridTemplateColumns: '190px 1fr 60px' }}><span>{l}</span><div className="bar"><motion.i initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: d, ease, delay: 0.1 }} /></div><b className="num">{Math.round(d * 1000)} ms</b></motion.div>)}
        </motion.div>
        <p className="muted" style={{ marginTop: 10 }}>Group items follow each other {Math.round(dur.section * 0 + 40)} ms apart. Under reduced motion everything appears at once.</p>
      </Panel></Block>
    </Page>
  );
}
