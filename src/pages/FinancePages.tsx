import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Plus } from 'lucide-react';
import { Block, Button, Chip, Field, FilterChips, Input, Metric, Notice, Page, PageHeader, Panel, Select } from '@/components/ui/primitives';
import { Tabs } from '@/components/ui/Tabs';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog, useToast } from '@/components/ui/Overlay';
import { BarChart } from '@/components/ui/Charts';
import { download, downloadCsv } from '@/lib/csv';
import { fmt, fmtCompact, rupees } from '@/lib/money';
import { fmtDate } from '@/lib/format';
import { ACCOUNTS } from '@/data/fixtures/seed';
import { useCommands, useIms } from '@/services';
import { cashflow, gstSummary, ledgerRows, statements, trialBalance, WINDOW_DAYS } from '@/services/finance';
import type { Expense, LedgerEntry } from '@/services/contracts/types';

const PERIOD = 'Last ' + WINDOW_DAYS + ' days to 24 Oct 2026';

export function ExpensesPage() {
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  const [cat, setCat] = useState('all');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ category: 'Utilities', payee: '', amount: '', mode: 'bank', note: '' });
  const [err, setErr] = useState('');
  const cats = Array.from(new Set(s.expenses.map((e) => e.category)));
  const rows = s.expenses.filter((e) => cat === 'all' || e.category === cat);
  const total = s.expenses.reduce((a, e) => a + e.amount, 0);
  const cols: Array<Column<Expense>> = [
    { id: 'd', header: 'Date', primary: true, sort: (e) => e.date, cell: (e) => fmtDate(e.date) },
    { id: 'c', header: 'Category', cell: (e) => <Chip tone="neutral" plain>{e.category}</Chip> },
    { id: 'p', header: 'Paid to', cell: (e) => <div><div className="cell-main">{e.payee}</div><div className="cell-sub">{e.note}</div></div> },
    { id: 'm', header: 'Mode', cell: (e) => e.mode },
    { id: 'a', header: 'Amount', num: true, sort: (e) => e.amount, cell: (e) => <b>{fmt(e.amount)}</b> },
  ];
  const by = cats.map((c) => ({ label: c, value: s.expenses.filter((e) => e.category === c).reduce((a, e) => a + e.amount, 0) }));
  const save = () => {
    const amt = parseFloat(f.amount);
    if (!f.payee.trim()) { setErr('Say who was paid.'); return; }
    if (!(amt > 0)) { setErr('Enter an amount above zero.'); return; }
    const r = cmd.addExpense({ date: '2026-10-24', category: f.category, payee: f.payee, amount: rupees(amt), mode: f.mode, note: f.note });
    if (!r.ok) { setErr(r.message); return; }
    toast('Expense recorded.'); setOpen(false); setF({ category: 'Utilities', payee: '', amount: '', mode: 'bank', note: '' }); setErr('');
  };
  return (
    <Page>
      <PageHeader title="Expenses" sub="Running costs outside of stock. They flow straight into the profit and loss." actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus />Record expense</Button>} />
      <Block className="grid c3">
        <Metric label="Spent, recorded" value={fmt(total)} foot={s.expenses.length + ' entries'} />
        <Metric label="Largest category" value={by.sort((a, b) => b.value - a.value)[0]?.label ?? '—'} foot={fmt(by[0]?.value ?? 0)} />
        <Metric label="Profit and loss" value="Open" to="/reports/financial-statements" foot="see the effect" />
      </Block>
      <div style={{ height: 16 }} />
      <Block className="grid main-side">
        <Panel flush><DataTable label="Expenses" rows={rows} rowKey={(e) => e.id} columns={cols} searchText={(e) => e.payee + ' ' + e.note + ' ' + e.category} searchPlaceholder="Search expenses" filters={<FilterChips label="Category" value={cat} onChange={setCat} options={[{ value: 'all', label: 'All' }, ...cats.map((c) => ({ value: c, label: c }))]} />} /></Panel>
        <Panel title="By category"><BarChart ariaLabel="Expenses by category" data={by} format={fmtCompact} height={210} /></Panel>
      </Block>
      <Dialog open={open} onClose={() => setOpen(false)} title="Record an expense" footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={save}>Record expense</Button></>}>
        <div className="form-grid">
          <Field label="Category">{(id) => <Select id={id} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{['Rent', 'Salaries', 'Utilities', 'Packaging', 'Marketing', 'Repairs', 'Other'].map((c) => <option key={c}>{c}</option>)}</Select>}</Field>
          <Field label="Mode">{(id) => <Select id={id} value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}><option value="bank">Bank</option><option value="UPI">UPI</option><option value="cash">Cash</option><option value="card">Card</option></Select>}</Field>
          <Field label="Paid to" className="span2" error={err}>{(id) => <Input id={id} value={f.payee} onChange={(e) => { setF({ ...f, payee: e.target.value }); setErr(''); }} autoFocus />}</Field>
          <Field label="Amount (₹)">{(id) => <Input id={id} inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />}</Field>
          <Field label="Note">{(id) => <Input id={id} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />}</Field>
        </div>
      </Dialog>
    </Page>
  );
}

export function LedgerPage() {
  const s = useIms();
  const [tab, setTab] = useState<'journal' | 'trial'>('journal');
  const [acc, setAcc] = useState('all');
  const rows = useMemo(() => ledgerRows(s).filter((r) => acc === 'all' || r.account === acc).reverse(), [s, acc]);
  const tb = trialBalance(s);
  const name = (c: string) => ACCOUNTS.find((a) => a.code === c)?.name ?? c;
  const cols: Array<Column<LedgerEntry>> = [
    { id: 'd', header: 'Date', primary: true, sort: (r) => r.date, cell: (r) => fmtDate(r.date) },
    { id: 'a', header: 'Account', cell: (r) => <span><span className="mono">{r.account}</span> {name(r.account)}</span> },
    { id: 'r', header: 'Reference', cell: (r) => <div><div className="cell-main">{r.ref}</div><div className="cell-sub">{r.memo}</div></div> },
    { id: 'dr', header: 'Debit', num: true, cell: (r) => (r.debit ? fmt(r.debit) : '') },
    { id: 'cr', header: 'Credit', num: true, cell: (r) => (r.credit ? fmt(r.credit) : '') },
  ];
  return (
    <Page>
      <PageHeader title="Ledger" sub={PERIOD + '. Every sale, receipt, payment and expense posts a balanced journal.'}
        actions={<Button onClick={() => { downloadCsv('trial-balance.csv', [['Code', 'Account', 'Debit', 'Credit'], ...tb.rows.map((r) => [r.code, r.name, r.debit / 100, r.credit / 100])]); }}><Download />Trial balance CSV</Button>} />
      <Block><Panel flush>
        <Tabs label="Ledger view" value={tab} onChange={setTab} tabs={[{ id: 'journal', label: 'Journal entries' }, { id: 'trial', label: 'Trial balance' }]} />
        {tab === 'journal' ? (
          <DataTable label="Journal" rows={rows} rowKey={(r) => r.id} columns={cols} pageSize={14} searchText={(r) => r.ref + ' ' + r.memo + ' ' + name(r.account)} searchPlaceholder="Search the journal"
            filters={<Select aria-label="Account" value={acc} onChange={(e) => setAcc(e.target.value)} style={{ maxWidth: 240 }}><option value="all">All accounts</option>{ACCOUNTS.map((a) => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}</Select>} />
        ) : (
          <div className="tbl-wrap"><table className="tbl" data-cards aria-label="Trial balance">
            <thead><tr><th>Account</th><th>Type</th><th className="num">Debit</th><th className="num">Credit</th></tr></thead>
            <tbody>{tb.rows.map((r) => <tr key={r.code}><td data-label="Account" data-primary="true"><span className="mono">{r.code}</span> {r.name}</td><td data-label="Type">{r.type}</td><td data-label="Debit" className="num">{r.debit ? fmt(r.debit) : ''}</td><td data-label="Credit" className="num">{r.credit ? fmt(r.credit) : ''}</td></tr>)}
              <tr style={{ fontWeight: 700 }}><td data-label="Account" data-primary="true">Total</td><td /><td data-label="Debit" className="num">{fmt(tb.totalDebit)}</td><td data-label="Credit" className="num">{fmt(tb.totalCredit)}</td></tr></tbody></table></div>
        )}
      </Panel></Block>
      <div style={{ height: 14 }} />
      <Block><Notice tone="info">Manual journal entries and reversals use separate endpoints and are not part of this prototype. Debits equal credits: {fmt(tb.totalDebit)} on both sides.</Notice></Block>
    </Page>
  );
}

export function StatementsPage() {
  const s = useIms();
  const [tab, setTab] = useState<'pnl' | 'bs' | 'cf'>('pnl');
  const st = statements(s);
  const cf = cashflow(s);
  const Line = ({ l, v, b, indent }: { l: string; v: number; b?: boolean; indent?: boolean }) => <div className="stat-line" style={{ fontWeight: b ? 700 : 500, paddingLeft: indent ? 16 : 0 }}><span>{l}</span><span className="num">{fmt(v)}</span></div>;
  const csv = () => {
    if (tab === 'pnl') downloadCsv('profit-and-loss.csv', [['Line', 'Amount'], ['Revenue', st.revenue / 100], ['Cost of goods sold', st.cogs / 100], ['Gross profit', st.gross / 100], ['Rent', st.exp.Rent / 100], ['Salaries', st.exp.Salaries / 100], ['Utilities and other', st.exp['Utilities and other'] / 100], ['Net profit', st.profit / 100]]);
    else if (tab === 'bs') downloadCsv('balance-sheet.csv', [['Line', 'Amount'], ['Cash', st.assets.cash / 100], ['Bank', st.assets.bank / 100], ['Receivables', st.assets.receivable / 100], ['Inventory', st.assets.inventory / 100], ['GST input credit', st.assets.gstInput / 100], ['Total assets', st.totalAssets / 100], ['Payables', st.liab.payable / 100], ['GST payable', st.liab.gstOutput / 100], ['Capital', st.equity.capital / 100], ['Profit for the period', st.profit / 100]]);
    else downloadCsv('cash-flow.csv', [['Line', 'Amount'], ['Opening bank', cf.opening / 100], ['Receipts from sales', cf.sales / 100], ['Paid to suppliers', -cf.suppliers / 100], ['Expenses paid', -cf.expenses / 100], ['Closing cash and bank', cf.closing / 100]]);
  };
  return (
    <Page narrow>
      <PageHeader title="Financial statements" sub={PERIOD + '. Built from the ledger, so each figure traces to a journal entry.'} actions={<><Link className="btn" to="/ledger">Open ledger</Link><Button onClick={csv}><Download />Download CSV</Button></>} />
      <Block className="grid c3">
        <Metric label="Revenue" value={fmtCompact(st.revenue)} foot="before GST" />
        <Metric label="Gross profit" value={fmtCompact(st.gross)} foot={st.revenue ? Math.round((st.gross / st.revenue) * 100) + '% margin' : ''} />
        <Metric label="Net profit" value={fmtCompact(st.profit)} foot="after running costs" />
      </Block>
      <div style={{ height: 16 }} />
      <Block><Panel flush>
        <Tabs label="Statement" value={tab} onChange={setTab} tabs={[{ id: 'pnl', label: 'Profit and loss' }, { id: 'bs', label: 'Balance sheet' }, { id: 'cf', label: 'Cash flow' }]} />
        <div style={{ padding: '14px 18px 18px' }}>
          {tab === 'pnl' && <><Line l="Revenue" v={st.revenue} /><Line l="Cost of goods sold" v={-st.cogs} /><Line l="Gross profit" v={st.gross} b /><div className="eyebrow" style={{ margin: '14px 0 4px' }}>Running costs</div>{Object.entries(st.exp).map(([k, v]) => <Line key={k} l={k} v={-v} indent />)}<Line l="Net profit" v={st.profit} b /></>}
          {tab === 'bs' && <div className="grid c2"><div><div className="eyebrow">Assets</div><Line l="Cash in hand" v={st.assets.cash} /><Line l="Bank" v={st.assets.bank} /><Line l="Receivables" v={st.assets.receivable} /><Line l="Inventory at cost" v={st.assets.inventory} /><Line l="GST input credit" v={st.assets.gstInput} /><Line l="Total assets" v={st.totalAssets} b /></div>
            <div><div className="eyebrow">Liabilities and equity</div><Line l="Payables" v={st.liab.payable} /><Line l="GST payable" v={st.liab.gstOutput} /><Line l="Owner capital" v={st.equity.capital} /><Line l="Profit for the period" v={st.profit} /><Line l="Total" v={st.totalLE} b /></div></div>}
          {tab === 'cf' && <><Line l="Bank at the start" v={cf.opening} /><Line l="Receipts from sales" v={cf.sales} indent /><Line l="Paid to suppliers" v={-cf.suppliers} indent /><Line l="Expenses paid" v={-cf.expenses} indent /><Line l="Cash and bank at the end" v={cf.closing} b /></>}
          {tab === 'bs' && st.totalAssets !== st.totalLE && <p role="alert" style={{ color: 'var(--bad)', fontWeight: 600 }}>Out of balance by {fmt(st.totalAssets - st.totalLE)}.</p>}
        </div>
      </Panel></Block>
    </Page>
  );
}

export function GstReturnsPage() {
  const s = useIms();
  const g = gstSummary(s);
  const [tab, setTab] = useState<'gstr1' | 'gstr3b'>('gstr1');
  const toast = useToast();
  const json = () => { download('gstr-summary.json', 'application/json', JSON.stringify({ gstin: s.business.sellerGstin, period: PERIOD, rates: g.rates.map((r) => ({ rate: r.rate, taxable: r.taxable / 100, tax: r.tax / 100 })), outwardTax: g.outTax / 100, inputTax: g.inTax / 100 }, null, 2)); toast('Downloaded a summary file for review. It is not a filing.'); };
  return (
    <Page narrow>
      <PageHeader title="GST returns" sub={PERIOD + ' · GSTIN ' + s.business.sellerGstin} actions={<><Button onClick={() => downloadCsv('gstr1-hsn.csv', [['HSN', 'Description', 'Qty', 'Taxable value', 'Tax'], ...g.hsn.map((h) => [h.hsn, h.name, h.qty, h.taxable / 100, h.tax / 100])])}><Download />CSV</Button><Button onClick={json}><Download />JSON</Button></>} />
      <Block className="grid c4 keep2">
        <Metric label="Invoices" value={g.invoices} foot="in the period" />
        <Metric label="Taxable sales" value={fmtCompact(g.outTaxable)} />
        <Metric label="GST collected" value={fmtCompact(g.outTax)} />
        <Metric label="Payable after credit" value={fmtCompact(g.payable)} foot={'credit ' + fmtCompact(g.inTax)} />
      </Block>
      <div style={{ height: 16 }} />
      <Block><Notice tone="wine" title="Review only">These figures are generated from your records. Filing happens on the GST portal, and marking a return as filed is not part of this prototype.{s.business.eInvoiceApplicable ? '' : ' E-invoicing is switched off for this business in settings.'}</Notice></Block>
      <div style={{ height: 16 }} />
      <Block><Panel flush>
        <Tabs label="Return" value={tab} onChange={setTab} tabs={[{ id: 'gstr1', label: 'GSTR-1, outward supplies' }, { id: 'gstr3b', label: 'GSTR-3B, summary' }]} />
        {tab === 'gstr1' ? (
          <div className="tbl-wrap"><table className="tbl" data-cards aria-label="HSN summary"><thead><tr><th>HSN</th><th>Goods</th><th className="num">Quantity</th><th className="num">Taxable value</th><th className="num">GST</th></tr></thead>
            <tbody>{g.hsn.map((h) => <tr key={h.hsn}><td data-label="HSN" data-primary="true" className="mono">{h.hsn}</td><td data-label="Goods">{h.name}</td><td data-label="Quantity" className="num">{h.qty}</td><td data-label="Taxable value" className="num">{fmt(h.taxable)}</td><td data-label="GST" className="num">{fmt(h.tax)}</td></tr>)}</tbody></table></div>
        ) : (
          <div style={{ padding: '14px 18px 18px' }}>
            {g.rates.map((r) => <div className="stat-line" key={r.rate}><span>Outward supplies at {r.rate}%</span><span className="num">{fmt(r.taxable)} · tax {fmt(r.tax)}</span></div>)}
            <div className="stat-line"><b>Total tax on outward supplies</b><b className="num">{fmt(g.outTax)}</b></div>
            <div className="stat-line"><span>Input tax credit from purchases</span><span className="num">−{fmt(g.inTax)}</span></div>
            <div className="stat-line"><b>Net GST payable</b><b className="num" style={{ fontSize: 'var(--fs-xl)' }}>{fmt(g.payable)}</b></div>
          </div>
        )}
      </Panel></Block>
    </Page>
  );
}
