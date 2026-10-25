import { lockScroll } from '@/lib/scrollLock';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Contact, Package, Receipt, Search, ShoppingCart, Users } from 'lucide-react';
import { flatNav } from '@/app/nav';
import { canAccess } from '@/app/permissions';
import { dur, ease } from '@/animations/motion';
import { useIms } from '@/services';
import { orderTotal } from '@/services/selectors';
import { fmtShort } from '@/lib/money';
import type { LucideIcon } from 'lucide-react';

interface Hit { key: string; label: string; hint: string; to: string; icon: LucideIcon; group: string }

export function CommandSearch({ open, onClose, returnFocusTo }: { open: boolean; onClose: () => void; returnFocusTo: React.RefObject<HTMLElement | null> }) {
  const s = useIms();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);

  useEffect(() => { if (open) { setQ(''); setI(0); } }, [open]);

  const hits = useMemo<Hit[]>(() => {
    const n = q.trim().toLowerCase();
    const pages: Hit[] = flatNav().filter((p) => canAccess(s.role, p.to)).map((p) => ({ key: 'p' + p.to, label: p.label, hint: 'Go to page', to: p.to, icon: p.icon, group: 'Pages' }));
    if (!n) return pages.slice(0, 8);
    const prods: Hit[] = s.products.map((p) => ({ key: 'sku' + p.sku, label: p.name, hint: p.sku, to: '/products/' + p.sku, icon: Package, group: 'Products' }));
    const sup: Hit[] = s.suppliers.map((x) => ({ key: x.id, label: x.name, hint: 'Supplier', to: '/suppliers', icon: Users, group: 'Suppliers' }));
    const cus: Hit[] = s.customers.filter((c) => c.id !== 'CUS-000').map((c) => ({ key: c.id, label: c.name, hint: 'Customer', to: '/customers', icon: Contact, group: 'Customers' }));
    const ord: Hit[] = s.orders.slice(-60).map((o) => ({ key: 'o' + o.no, label: 'Order ' + o.no, hint: fmtShort(orderTotal(o)), to: '/orders/' + encodeURIComponent(o.no), icon: ShoppingCart, group: 'Orders' }));
    const pos: Hit[] = s.purchaseOrders.map((p) => ({ key: p.no, label: p.no, hint: p.status, to: '/purchase-orders/' + p.no, icon: Receipt, group: 'Purchase orders' }));
    return [...pages, ...prods, ...sup, ...cus, ...pos, ...ord].filter((h) => (h.label + ' ' + h.hint).toLowerCase().includes(n)).slice(0, 9);
  }, [q, s]);

  useEffect(() => setI(0), [q]);

  useEffect(() => {
    if (!open) return;
    const unlock = lockScroll();
    const rf = returnFocusTo.current;
    return () => { unlock(); rf?.focus?.({ preventScroll: true }); };
  }, [open, returnFocusTo]);

  const go = (h: Hit) => { onClose(); nav(h.to); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(hits.length - 1, x + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
    else if (e.key === 'Enter' && hits[i]) { e.preventDefault(); go(hits[i]); }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="s" className="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: dur.menu }} />
          <motion.div key="d" className="dialog cmd" role="dialog" aria-modal="true" aria-label="Search" onKeyDown={onKey}
            initial={{ opacity: 0, y: -8, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: dur.menu, ease }}>
            <div className="cmd-in"><Search aria-hidden /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products, orders, suppliers, pages" aria-label="Search" role="combobox" aria-expanded aria-controls="cmd-list" /></div>
            <div className="cmd-list" id="cmd-list" role="listbox">
              {hits.length === 0 && <div className="empty" style={{ padding: 28 }}>Nothing found for “{q}”.</div>}
              {hits.map((h, idx) => {
                const showHead = idx === 0 || hits[idx - 1].group !== h.group;
                return (
                  <div key={h.key}>
                    {showHead && <div className="menu-label">{h.group}</div>}
                    <button type="button" role="option" className="cmd-row" aria-selected={idx === i} onMouseEnter={() => setI(idx)} onClick={() => go(h)}>
                      <span className="mi"><h.icon aria-hidden /></span><span>{h.label}</span><small>{h.hint}</small>
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="cmd-foot"><span>↑↓ to move</span><span>Enter to open</span><span>Esc to close</span></div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
