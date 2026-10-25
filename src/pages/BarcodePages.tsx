import { printRegion } from '@/lib/print';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Barcode as BarcodeIcon, FileStack, History, Printer, ScanLine, Tags, Trash2 } from 'lucide-react';
import { Block, Button, Chip, Field, Input, Metric, Notice, Page, PageHeader, Panel, Select } from '@/components/ui/primitives';
import { RouteTabs } from '@/components/ui/Tabs';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { useToast } from '@/components/ui/Overlay';
import { Barcode } from '@/components/Barcode';
import { ArtBarcode } from '@/components/illustrations';
import { fmt } from '@/lib/money';
import { fmtStamp } from '@/lib/format';
import { useCommands, useIms } from '@/services';
import { product } from '@/services/selectors';

export const TEMPLATES = [
  { id: 'Shelf label 50×25', w: 50, h: 25, perSheet: 40, note: 'Name, price and barcode for shelf edges.' },
  { id: 'Hang tag 30×60', w: 30, h: 60, perSheet: 24, note: 'Tall tag for garments, with size and price.' },
  { id: 'Carton label 100×50', w: 100, h: 50, perSheet: 10, note: 'SKU, barcode and batch for cartons.' },
] as const;

const tabs = [
  { to: '/barcodes', label: 'Overview', end: true, icon: <BarcodeIcon size={14} /> },
  { to: '/barcodes/generate', label: 'Single label', icon: <Tags size={14} /> },
  { to: '/barcodes/bulk', label: 'Queue', icon: <FileStack size={14} /> },
  { to: '/barcodes/templates', label: 'Templates' },
  { to: '/barcodes/print', label: 'Print studio', icon: <Printer size={14} /> },
  { to: '/barcodes/scanner-test', label: 'Scanner test', icon: <ScanLine size={14} /> },
  { to: '/barcodes/history', label: 'History', icon: <History size={14} /> },
];
const Shell = ({ title, sub, children, actions }: { title: string; sub: string; children: React.ReactNode; actions?: React.ReactNode }) => (
  <Page><PageHeader title={title} sub={sub} actions={actions} /><Block><div className="sub-nav"><RouteTabs tabs={tabs} label="Barcode Center" /></div></Block>{children}</Page>
);

function Label({ sku, template }: { sku: string; template: string }) {
  const s = useIms();
  const p = product(s, sku);
  const t = TEMPLATES.find((x) => x.id === template) ?? TEMPLATES[0];
  const tall = t.h > t.w;
  return (
    <div className="label-card" style={{ maxWidth: tall ? 190 : 300, aspectRatio: t.w + ' / ' + t.h }} aria-label={'Label preview for ' + p.name}>
      <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>{p.name}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span className="mono">{p.sku}</span><b>{fmt(p.price + Math.round((p.price * p.gst) / 100))}</b></div>
      <Barcode code={p.barcode} width={tall ? 150 : 200} height={tall ? 56 : 40} />
    </div>
  );
}

export function BarcodeOverview() {
  const s = useIms();
  const q = s.barcodeQueue.reduce((a, x) => a + x.copies, 0);
  return (
    <Shell title="Barcode Center" sub="Generate, queue and print scannable labels for any variant.">
      <Block className="grid c4 keep2">
        <Metric label="Labels in queue" value={q} to="/barcodes/bulk" foot={s.barcodeQueue.length + ' variants'} />
        <Metric label="Printed this month" value={s.printHistory.reduce((a, h) => a + h.copies, 0)} to="/barcodes/history" foot="labels" />
        <Metric label="Templates" value={TEMPLATES.length} to="/barcodes/templates" foot="sizes available" />
        <Metric label="Variants with a barcode" value={s.products.length} foot="every SKU" />
      </Block>
      <div style={{ height: 16 }} />
      <Block className="grid c2">
        <Panel title="Print a single label" hint="Pick a variant and see exactly what will print."><div className="empty" style={{ padding: '10px 0' }}><ArtBarcode /><Link className="btn btn-primary" to="/barcodes/generate">Make a label</Link></div></Panel>
        <Panel title="Recent prints" actions={<Link className="link" to="/barcodes/history">History</Link>}>
          {s.printHistory.slice(0, 4).map((h) => <div className="stat-line" key={h.id}><span>{product(s, h.sku).name}<div className="muted">{h.template} · {fmtStamp(h.at)}</div></span><b className="num">{h.copies}</b></div>)}
        </Panel>
      </Block>
    </Shell>
  );
}

export function BarcodeGenerate() {
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  const [sku, setSku] = useState(s.products[0].sku);
  const [tpl, setTpl] = useState<string>(TEMPLATES[0].id);
  const [copies, setCopies] = useState('10');
  return (
    <Shell title="Single label" sub="Choose a variant and a template. The barcode is a real EAN-13.">
      <Block className="grid side-main">
        <Panel title="Label settings"><div className="stack">
          <Field label="Variant">{(id) => <Select id={id} value={sku} onChange={(e) => setSku(e.target.value)}>{s.products.map((p) => <option key={p.sku} value={p.sku}>{p.name} · {p.sku}</option>)}</Select>}</Field>
          <Field label="Template">{(id) => <Select id={id} value={tpl} onChange={(e) => setTpl(e.target.value)}>{TEMPLATES.map((t) => <option key={t.id}>{t.id}</option>)}</Select>}</Field>
          <Field label="Copies">{(id) => <Input id={id} inputMode="numeric" value={copies} onChange={(e) => setCopies(e.target.value)} />}</Field>
          <Button variant="primary" onClick={() => { const n = Math.max(1, parseInt(copies) || 1); cmd.queueLabels(sku, n); toast(n + ' × ' + product(s, sku).name + ' added to the print queue.'); }}>Add to queue</Button>
        </div></Panel>
        <Panel title="Preview" hint="Actual proportions of the selected template"><div className="stack" style={{ alignItems: 'center', padding: '14px 0' }}><Label sku={sku} template={tpl} /></div></Panel>
      </Block>
    </Shell>
  );
}

export function BarcodeBulk() {
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  const q = s.barcodeQueue;
  const cols: Array<Column<(typeof q)[number]>> = [
    { id: 'p', header: 'Variant', primary: true, cell: (r) => <div><div className="cell-main">{product(s, r.sku).name}</div><div className="cell-sub mono">{r.sku}</div></div> },
    { id: 'b', header: 'Barcode', cell: (r) => <span className="mono">{product(s, r.sku).barcode}</span> },
    { id: 'c', header: 'Copies', num: true, cell: (r) => r.copies },
  ];
  return (
    <Shell title="Label queue" sub="Everything waiting to print. Add variants from a single label, then print them together." actions={<><Button disabled={!q.length} onClick={() => { cmd.clearLabelQueue(); toast('Queue cleared.'); }}><Trash2 />Clear</Button><Link className="btn btn-primary" to="/barcodes/print"><Printer />Open print studio</Link></>}>
      <Block><Panel flush><DataTable label="Label queue" rows={q} rowKey={(r) => r.sku} columns={cols} empty={{ title: 'The queue is empty', body: 'Make a single label and add it to the queue.', art: <ArtBarcode /> }} /></Panel></Block>
    </Shell>
  );
}

export function BarcodeTemplates() {
  return (
    <Shell title="Label templates" sub="Sizes the print studio can lay out.">
      <Block className="hub-grid">{TEMPLATES.map((t) => (
        <Panel key={t.id} title={t.id} hint={t.note}><div className="row between"><span className="muted">{t.perSheet} per A4 sheet</span><Chip tone="ok">Available</Chip></div>
          <div style={{ marginTop: 14, border: '1px dashed var(--line-strong)', borderRadius: 8, aspectRatio: t.w + ' / ' + t.h, maxHeight: 120, maxWidth: 220, display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>{t.w} × {t.h} mm</div></Panel>))}</Block>
    </Shell>
  );
}

export function BarcodePrint() {
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  const [tpl, setTpl] = useState<string>(TEMPLATES[0].id);
  const q = s.barcodeQueue;
  const [sheet, setSheet] = useState<Array<{ sku: string; copies: number }>>([]);
  const total = q.reduce((a, x) => a + x.copies, 0);
  const t = TEMPLATES.find((x) => x.id === tpl)!;
  return (
    <Shell title="Print studio" sub="Check the sheet, then send it to the printer.">
      <Block className="grid side-main">
        <Panel title="Sheet"><div className="stack">
          <Field label="Template">{(id) => <Select id={id} value={tpl} onChange={(e) => setTpl(e.target.value)}>{TEMPLATES.map((x) => <option key={x.id}>{x.id}</option>)}</Select>}</Field>
          <div className="stat-line"><span>Labels</span><b className="num">{total}</b></div>
          <div className="stat-line"><span>Sheets (A4)</span><b className="num">{Math.ceil(total / t.perSheet)}</b></div>
          <Button variant="primary" disabled={!total} onClick={() => { const r = cmd.printLabels(tpl); if (r.ok) { setSheet(q.map((x) => ({ sku: x.sku, copies: x.copies }))); toast(r.value + ' labels recorded in the print history. Choose a printer in the dialog that opens.'); window.setTimeout(() => printRegion('labels'), 120); } }}><Printer />Print {total || ''} labels</Button>
          <p className="muted">Records the job in the history, then opens your browser's print dialog. No label printer is connected to this prototype.</p>
        </div></Panel>
        <Panel title="Preview" hint="First labels on the sheet">
          {q.length === 0 ? <div className="empty"><ArtBarcode /><h3>Nothing to print</h3><p>Add variants to the queue first.</p><Link className="btn" to="/barcodes/generate">Make a label</Link></div>
            : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>{q.slice(0, 4).map((x) => <Label key={x.sku} sku={x.sku} template={tpl} />)}</div>}
        </Panel>
      </Block>
    <div className="print-sheet" aria-hidden>{sheet.flatMap((x) => Array.from({ length: Math.min(x.copies, 60) }, (_, n) => <Label key={x.sku + n} sku={x.sku} template={tpl} />))}</div>
    </Shell>
  );
}

export function BarcodeScannerTest() {
  const s = useIms();
  const [v, setV] = useState('');
  const [log, setLog] = useState<Array<{ code: string; sku?: string }>>([]);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const scan = () => { const code = v.trim(); if (!code) return; const p = s.products.find((x) => x.barcode === code || x.sku.toLowerCase() === code.toLowerCase()); setLog((l) => [{ code, sku: p?.sku }, ...l].slice(0, 6)); setV(''); };
  return (
    <Shell title="Scanner test" sub="Scan a label, or type a barcode and press Enter, to confirm the scanner and the catalogue agree.">
      <Block className="grid c2">
        <Panel title="Scan here"><div className="stack"><Input ref={ref} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && scan()} placeholder="Click here, then scan" aria-label="Scanner input" /><p className="muted">Try {s.products[0].barcode} or {s.products[3].sku}.</p></div></Panel>
        <Panel title="Results">{log.length === 0 && <p className="muted">Scans appear here.</p>}{log.map((l, i) => <div className="stat-line" key={i}><span className="mono">{l.code}</span>{l.sku ? <span>{product(s, l.sku).name} <Chip tone="ok">Matched</Chip></span> : <Chip tone="bad">No match</Chip>}</div>)}</Panel>
      </Block>
      {log.length > 0 && !log[0].sku && <><div style={{ height: 14 }} /><Block><Notice tone="warn" title="Not in the catalogue">Check the digits, or add the product first.</Notice></Block></>}
    </Shell>
  );
}

export function BarcodeHistory() {
  const s = useIms();
  const cols: Array<Column<(typeof s.printHistory)[number]>> = [
    { id: 'w', header: 'When', primary: true, sort: (h) => h.at, cell: (h) => fmtStamp(h.at) },
    { id: 'p', header: 'Variant', cell: (h) => <div><div className="cell-main">{product(s, h.sku).name}</div><div className="cell-sub mono">{h.sku}</div></div> },
    { id: 't', header: 'Template', cell: (h) => h.template },
    { id: 'c', header: 'Copies', num: true, cell: (h) => h.copies },
    { id: 'b', header: 'By', cell: (h) => h.by },
  ];
  return (
    <Shell title="Print history" sub="Every label job, who ran it and when.">
      <Block><Panel flush><DataTable label="Print history" rows={s.printHistory} rowKey={(h) => h.id} columns={cols} /></Panel></Block>
    </Shell>
  );
}
