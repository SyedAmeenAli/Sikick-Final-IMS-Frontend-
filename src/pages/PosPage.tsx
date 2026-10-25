import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Banknote, Barcode, CreditCard, Minus, Plus, QrCode, Search, Trash2, User, Wifi, WifiOff, X } from 'lucide-react';
import { Button, Chip, Field, FilterChips, Input, Select, Segmented } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Overlay';
import { ReceiptView } from '@/features/pos/Receipt';
import { usePosCart } from '@/features/pos/usePosCart';
import { ArtPos } from '@/components/illustrations';
import { fmt, fmtShort } from '@/lib/money';
import { dur, ease } from '@/animations/motion';
import { WORKSPACE } from '@/data/fixtures/seed';
import { useCommands, useIms } from '@/services';
import { product, stockAvailable, stockState } from '@/services/selectors';
import { playBarcodeConfirm, playCartAdd, playCartRemove, playCheckoutComplete } from '@/lib/sound';
import type { SaleReceipt } from '@/services/contracts/service';
import type { Tender } from '@/services/contracts/types';

type Step = 'cart' | 'pay' | 'receipt';
const TENDERS: Array<{ id: Tender; label: string; icon: typeof Banknote }> = [{ id: 'cash', label: 'Cash', icon: Banknote }, { id: 'UPI', label: 'UPI', icon: QrCode }, { id: 'card', label: 'Card', icon: CreditCard }];
const toPaise = (v: string) => { const n = parseFloat(v); return isFinite(n) && n > 0 ? Math.round(n * 100) : 0; };

function FakeQr() {
  // a deterministic pattern standing in for the order's payment QR (POST /orders/:id/generate-payment-qr)
  const cells = useMemo(() => Array.from({ length: 169 }, (_, i) => { const x = i % 13, y = Math.floor(i / 13); const finder = (x < 4 && y < 4) || (x > 8 && y < 4) || (x < 4 && y > 8); return finder ? ((x % 3 === 0 || y % 3 === 0 || (x === 1 || y === 1)) && true) : ((x * 7 + y * 13 + x * y) % 5 < 2); }), []);
  return <svg viewBox="0 0 13 13" width="112" height="112" role="img" aria-label="Sample payment QR" shapeRendering="crispEdges">{cells.map((on, i) => on && <rect key={i} x={i % 13} y={Math.floor(i / 13)} width="1" height="1" fill="currentColor" />)}</svg>;
}

export default function PosPage() {
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  const cart = usePosCart();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [customerId, setCustomerId] = useState('CUS-000');
  const [step, setStep] = useState<Step>('cart');
  const [tender, setTender] = useState<Tender>('UPI');
  const [split, setSplit] = useState(false);
  const [received, setReceived] = useState('');
  const [rows, setRows] = useState<Array<{ tender: Tender; amount: string }>>([{ tender: 'UPI', amount: '' }, { tender: 'cash', amount: '' }]);
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const search = useRef<HTMLInputElement>(null);

  const cats = ['All', ...Array.from(new Set(s.products.map((p) => p.category)))];
  const shown = s.products.filter((p) => (cat === 'All' || p.category === cat) && (!q.trim() || (p.name + ' ' + p.sku + ' ' + p.barcode).toLowerCase().includes(q.trim().toLowerCase())));
  const total = cart.totals.total;

  useEffect(() => { search.current?.focus(); }, [step]);
  useEffect(() => { if (flash) { const id = window.setTimeout(() => setFlash(null), 1600); return () => window.clearTimeout(id); } }, [flash]);

  // checkout cue: only when the local sale has been recorded and the receipt step is showing, once per receipt
  const cuedReceipt = useRef<string | null>(null);
  useEffect(() => {
    if (step === 'receipt' && receipt && cuedReceipt.current !== receipt.order.no) { cuedReceipt.current = receipt.order.no; playCheckoutComplete(); }
  }, [step, receipt]);

  const addSku = (sku: string, scanned = false) => {
    const r = cart.add(sku);
    if (r === 'out') toast(product(s, sku).name + ' is out of stock.', 'bad');
    else if (r === 'max') toast('All ' + stockAvailable(s, sku) + ' available units of ' + product(s, sku).name + ' are already in the cart.', 'bad');
    else { setFlash(sku); if (scanned) playBarcodeConfirm(); else playCartAdd(); }
  };
  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    const n = q.trim().toLowerCase();
    const exact = s.products.find((p) => p.sku.toLowerCase() === n || p.barcode === n);
    const one = shown.length === 1 ? shown[0] : null;
    const hit = exact ?? one;
    if (hit) { addSku(hit.sku, !!exact); setQ(''); } else if (n) toast('No product matches “' + q + '”.', 'bad');
  };

  // payment maths
  const single = tender === 'cash' ? (toPaise(received) || total) : total;
  const splitSum = rows.reduce((a, r) => a + toPaise(r.amount), 0);
  const splitCash = rows.filter((r) => r.tender === 'cash').reduce((a, r) => a + toPaise(r.amount), 0);
  const tendered = split ? splitSum : single;
  const change = Math.max(0, tendered - total);
  const valid = total > 0 && tendered >= total && (!split || change <= splitCash) && (split || tender === 'cash' || tendered === total);
  const short = Math.max(0, total - tendered);

  const charge = () => {
    const tenders = split ? rows.map((r) => ({ tender: r.tender, amount: toPaise(r.amount) })).filter((r) => r.amount > 0) : [{ tender, amount: single }];
    const res = cmd.ringSale({ lines: cart.lines, discount: cart.discount, customerId, tenders });
    if (!res.ok) { toast(res.message, 'bad'); return; }
    setReceipt(res.value); setStep('receipt'); toast('Sale ' + res.value.order.no + ' recorded.');
    // the completion cue plays from the effect below, once the receipt is the thing on screen
  };
  const reset = () => { cart.clear(); setReceipt(null); setStep('cart'); setReceived(''); setSplit(false); setRows([{ tender: 'UPI', amount: '' }, { tender: 'cash', amount: '' }]); setCustomerId('CUS-000'); setQ(''); };

  const online = s.offline.online;
  return (
    <div className="pos">
      <div className="pos-strip" role="status">
        <span className="row" style={{ gap: 8 }}><b>{WORKSPACE.till}</b><span className="muted">{WORKSPACE.location}</span></span>
        <span className="row" style={{ gap: 8 }}><span className="avatar" style={{ width: 22, height: 22, fontSize: 10 }}>PS</span>Priya S. · shift open since 08:30</span>
        <span className="row" style={{ gap: 8, marginLeft: 'auto' }}>
          {s.offline.queued > 0 && <Chip tone="warn">{s.offline.queued} sale{s.offline.queued > 1 ? 's' : ''} waiting to sync</Chip>}
          <button type="button" className="fchip" aria-pressed={!online} onClick={() => { cmd.setOnline(!online); toast(online ? 'Offline: sales are kept on this till and queued.' : 'Back online.'); }}>
            {online ? <><Wifi size={14} />Online</> : <><WifiOff size={14} />Offline</>}
          </button>
          {online && s.offline.queued > 0 && <Button size="sm" onClick={() => { const r = cmd.syncQueued(); if (r.ok) toast(r.value + ' queued sale' + (r.value > 1 ? 's' : '') + ' synced.'); }}>Sync now</Button>}
        </span>
      </div>

      <div className="pos-body">
        <section className="pos-catalog" aria-label="Products">
          <div className="pos-search">
            <div className="input-icon grow"><Search aria-hidden /><Input ref={search} type="search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onSearchKey} placeholder="Search or scan a barcode" aria-label="Search products or scan barcode" disabled={step === 'receipt'} /></div>
            <span className="muted pos-hint"><Barcode size={14} aria-hidden /> Scanner ready</span>
          </div>
          <FilterChips label="Category" value={cat} onChange={setCat} options={cats.map((c) => ({ value: c, label: c }))} />
          <div className="pos-grid">
            {shown.map((p) => {
              const st = stockState(s, p.sku);
              const avail = stockAvailable(s, p.sku);
              const inCart = cart.lines.find((l) => l.sku === p.sku)?.qty ?? 0;
              return (
                <button key={p.sku} type="button" className="tile" data-flash={flash === p.sku} data-out={avail <= 0} disabled={avail <= 0 || step === 'receipt'} onClick={() => addSku(p.sku)} aria-label={'Add ' + p.name + ', ' + fmtShort(p.price) + ', ' + avail + ' available'}>
                  <span className="tile-top"><span className="mono">{p.sku}</span>{inCart > 0 && <span className="tile-n num">{inCart}</span>}</span>
                  <span className="tile-name">{p.name}</span>
                  <span className="tile-foot"><b className="num">{fmtShort(p.price)}</b><Chip tone={st === 'out' ? 'bad' : st === 'low' ? 'warn' : 'ok'} plain>{avail <= 0 ? 'Out' : avail + ' left'}</Chip></span>
                </button>
              );
            })}
            {shown.length === 0 && <div className="empty" style={{ gridColumn: '1 / -1' }}><ArtPos /><h3>No product matches</h3><p>Try a SKU, barcode or part of the name.</p></div>}
          </div>
        </section>

        <aside className="pos-cart" aria-label="Current sale">
          <AnimatePresence mode="wait" initial={false}>
            {step === 'receipt' && receipt ? (
              <motion.div key="r" className="pos-cart-in" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: dur.panel, ease }}>
                <ReceiptView receipt={receipt} onNew={reset} />
              </motion.div>
            ) : step === 'pay' ? (
              <motion.div key="p" className="pos-cart-in" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: dur.panel, ease }}>
                <div className="pos-cart-head"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep('cart')}><ArrowLeft />Back to cart</button><b>Payment</b></div>
                <div className="pos-due"><span>Amount due</span><b className="num">{fmt(total)}</b></div>
                <div className="row between"><span className="lbl">Payment method</span><Segmented label="Payment mode" value={split ? 'split' : 'single'} onChange={(v) => setSplit(v === 'split')} options={[{ value: 'single', label: 'One method' }, { value: 'split', label: 'Split' }]} /></div>
                {!split ? (
                  <>
                    <div className="tenders" role="radiogroup" aria-label="Payment method">
                      {TENDERS.map((t) => <button key={t.id} type="button" role="radio" aria-checked={tender === t.id} className="tender" onClick={() => setTender(t.id)}><t.icon aria-hidden />{t.label}</button>)}
                    </div>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div key={tender} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: dur.menu, ease }}>
                        {tender === 'cash' && (
                          <div className="stack" style={{ gap: 10 }}>
                            <Field label="Cash received" help="Leave empty for the exact amount.">{(id) => <Input id={id} inputMode="decimal" value={received} onChange={(e) => setReceived(e.target.value)} placeholder={(total / 100).toFixed(2)} />}</Field>
                            <div className="filter-chips">{[total, 50000, 100000, 200000, 500000].filter((v, i, a) => v >= total && a.indexOf(v) === i).slice(0, 4).map((v) => <button key={v} type="button" className="fchip" onClick={() => setReceived(String(v / 100))}>{v === total ? 'Exact' : fmtShort(v)}</button>)}</div>
                            <div className="pos-due sunk"><span>{short > 0 ? 'Still to pay' : 'Change to return'}</span><b className="num" style={{ color: short > 0 ? 'var(--bad)' : 'var(--ok)' }}>{fmt(short > 0 ? short : change)}</b></div>
                          </div>
                        )}
                        {tender === 'UPI' && <div className="qr"><FakeQr /><div><b>Show this QR to the customer</b><p className="muted">In the live till the QR is generated for this order. Press Charge once the payment lands.</p></div></div>}
                        {tender === 'card' && <div className="qr"><CreditCard size={48} strokeWidth={1.2} color="var(--wine)" /><div><b>Use the card machine</b><p className="muted">Enter {fmt(total)} on the terminal, then press Charge when it approves.</p></div></div>}
                      </motion.div>
                    </AnimatePresence>
                  </>
                ) : (
                  <div className="stack" style={{ gap: 10 }}>
                    {rows.map((r, i) => (
                      <div key={i} className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                        <Select aria-label={'Method ' + (i + 1)} value={r.tender} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, tender: e.target.value as Tender } : y)))} style={{ width: 110 }}>{TENDERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</Select>
                        <Input aria-label={'Amount ' + (i + 1)} inputMode="decimal" value={r.amount} placeholder="0.00" onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, amount: e.target.value } : y)))} />
                        <Button size="sm" onClick={() => setRows((x) => x.map((y, j) => (j === i ? { ...y, amount: String(Math.max(0, total - (splitSum - toPaise(y.amount))) / 100) } : y)))}>Rest</Button>
                      </div>
                    ))}
                    <div className="pos-due sunk"><span>{short > 0 ? 'Still to pay' : change > 0 ? 'Change to return' : 'Covered'}</span><b className="num" style={{ color: short > 0 ? 'var(--bad)' : 'var(--ok)' }}>{fmt(short > 0 ? short : change)}</b></div>
                    {change > splitCash && <p className="err" role="alert" style={{ color: 'var(--bad)', fontWeight: 600 }}>Only cash can be over-tendered.</p>}
                  </div>
                )}
                <Button variant="primary" size="lg" className="charge" disabled={!valid} onClick={charge}>Charge {fmt(total)}</Button>
                <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>Prototype: no payment is taken and no request leaves your browser.</p>
              </motion.div>
            ) : (
              <motion.div key="c" className="pos-cart-in" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} transition={{ duration: dur.panel, ease }}>
                <div className="pos-cart-head"><b>Current sale</b>{cart.lines.length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={cart.clear}><X />Clear</button>}</div>
                <div className="input-icon"><User aria-hidden /><Select aria-label="Customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} style={{ paddingLeft: 33 }}>{s.customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.kind === 'business' ? ' (business)' : ''}</option>)}</Select></div>
                <ul className="lines">
                  <AnimatePresence initial={false}>
                    {cart.lines.map((l) => {
                      const p = product(s, l.sku);
                      const pl = cart.totals.lines.find((x) => x.sku === l.sku)!;
                      return (
                        <motion.li key={l.sku} layout initial={{ opacity: 0, height: 0, y: -6 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: dur.menu, ease }} className="line">
                          <div className="line-in">
                            <div className="grow"><div className="t">{p.name}</div><div className="d">{fmt(p.price)} · GST {p.gst}%</div></div>
                            <div className="qty" role="group" aria-label={'Quantity of ' + p.name}>
                              <button type="button" aria-label="Decrease quantity" onClick={() => { cart.setQty(l.sku, l.qty - 1); playCartRemove(); }}><Minus size={14} /></button>
                              <motion.span key={l.qty} className="num" initial={{ y: -4, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: dur.micro }}>{l.qty}</motion.span>
                              <button type="button" aria-label="Increase quantity" onClick={() => addSku(l.sku)}><Plus size={14} /></button>
                            </div>
                            <b className="num line-total">{fmt(pl.gross)}</b>
                            <button type="button" className="icon-btn" aria-label={'Remove ' + p.name} onClick={() => { cart.remove(l.sku); playCartRemove(); }}><Trash2 size={15} /></button>
                          </div>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                  {cart.lines.length === 0 && <li className="empty" style={{ padding: '30px 10px' }}><ArtPos /><h3>The cart is empty</h3><p>Tap a product or scan a barcode to start a sale.</p></li>}
                </ul>
                <div className="pos-disc">
                  <Segmented label="Discount type" value={cart.discKind} onChange={cart.setDiscKind} options={[{ value: 'percent', label: '%' }, { value: 'flat', label: '₹' }]} />
                  <Input aria-label="Discount" inputMode="decimal" placeholder={cart.discKind === 'percent' ? 'Discount %' : 'Discount ₹'} value={cart.discVal} onChange={(e) => cart.setDiscVal(e.target.value)} />
                </div>
                <dl className="sum">
                  <div><dt>Subtotal ({cart.totals.units} items)</dt><dd className="num"><AnimatedNumber value={cart.totals.subtotal} format={{ kind: 'inr' }} change={260} /></dd></div>
                  {cart.totals.discount > 0 && <div><dt>Discount</dt><dd className="num">−<AnimatedNumber value={cart.totals.discount} format={{ kind: 'inr' }} change={260} /></dd></div>}
                  <div><dt>GST</dt><dd className="num"><AnimatedNumber value={cart.totals.tax} format={{ kind: 'inr' }} change={260} /></dd></div>
                  <div className="grand"><dt>Total</dt><dd className="num" aria-live="polite"><AnimatedNumber value={total} format={{ kind: 'inr' }} change={300} /></dd></div>
                </dl>
                <Button variant="primary" size="lg" className="charge" disabled={cart.lines.length === 0} onClick={() => { setStep('pay'); setReceived(''); }}>Take payment</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
      </div>
      {step === 'cart' && cart.lines.length > 0 && (
        <div className="pos-bar">
          <span><b className="num">{cart.totals.units} items</b> · <b className="num"><AnimatedNumber value={total} format={{ kind: 'inr' }} change={300} /></b></span>
          <Button variant="primary" onClick={() => document.querySelector('.pos-cart')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Review sale</Button>
        </div>
      )}
    </div>
  );
}
