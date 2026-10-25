import { useMemo, useState } from 'react';
import { priceCart, type Discount } from '@/lib/pricing';
import { useIms } from '@/services';
import { product, stockAvailable } from '@/services/selectors';

export interface CartLine { sku: string; qty: number }

/** Local cart for the till. Pricing always flows through priceCart so the screen, the receipt and the order agree. */
export function usePosCart() {
  const s = useIms();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [discKind, setDiscKind] = useState<'percent' | 'flat'>('percent');
  const [discVal, setDiscVal] = useState('');
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  const discount: Discount | null = useMemo(() => {
    const n = parseFloat(discVal);
    if (!isFinite(n) || n <= 0) return null;
    return { kind: discKind, value: discKind === 'flat' ? Math.round(n * 100) : n };
  }, [discKind, discVal]);

  const totals = useMemo(
    () => priceCart(lines.map((l) => { const p = product(s, l.sku); return { sku: l.sku, unit: p.price, qty: l.qty, gst: p.gst }; }), discount),
    [lines, discount, s],
  );

  const add = (sku: string): 'ok' | 'max' | 'out' => {
    const avail = stockAvailable(s, sku);
    const have = lines.find((l) => l.sku === sku)?.qty ?? 0;
    if (avail <= 0) return 'out';
    if (have >= avail) return 'max';
    setLines((x) => (have ? x.map((l) => (l.sku === sku ? { ...l, qty: l.qty + 1 } : l)) : [...x, { sku, qty: 1 }]));
    setLastAdded(sku);
    return 'ok';
  };
  const setQty = (sku: string, qty: number) => {
    const avail = stockAvailable(s, sku);
    if (qty <= 0) return setLines((x) => x.filter((l) => l.sku !== sku));
    setLines((x) => x.map((l) => (l.sku === sku ? { ...l, qty: Math.min(qty, avail) } : l)));
  };
  const remove = (sku: string) => setLines((x) => x.filter((l) => l.sku !== sku));
  const clear = () => { setLines([]); setDiscVal(''); setLastAdded(null); };

  return { lines, totals, discount, discKind, setDiscKind, discVal, setDiscVal, add, setQty, remove, clear, lastAdded };
}
