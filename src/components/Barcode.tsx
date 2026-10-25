import { eanBars } from '@/lib/ean';
import { Package, Lamp, Headphones, CupSoda, Shirt, Notebook, Coffee } from 'lucide-react';
import type { Product } from '@/services/contracts/types';

export function Barcode({ code, width = 190, height = 64 }: { code: string; width?: number; height?: number }) {
  const bars = eanBars(code);
  const m = width / 113; // 95 modules plus quiet zones
  const runs: Array<{ x: number; w: number }> = [];
  for (let i = 0; i < bars.length; ) {
    if (bars[i] === '1') { let j = i; while (bars[j] === '1') j++; runs.push({ x: i, w: j - i }); i = j; } else i++;
  }
  const guard = (i: number) => i < 3 || (i >= 45 && i < 50) || i >= 92;
  return (
    <svg className="barcode-svg" width={width} height={height + 16} viewBox={'0 0 ' + width + ' ' + (height + 16)} role="img" aria-label={'EAN-13 barcode ' + code}>
      <g transform={'translate(' + 9 * m + ' 0)'}>
        {runs.map((r) => <rect key={r.x} x={r.x * m} y={0} width={r.w * m} height={guard(r.x) ? height : height - 8} fill="#20181b" />)}
      </g>
      <text x={width / 2} y={height + 12} textAnchor="middle" style={{ font: '600 11px ui-monospace, monospace', fill: '#20181b', letterSpacing: '0.08em' }}>{code}</text>
    </svg>
  );
}

const ICON = { box: Package, case: Headphones, mug: CupSoda, bottle: CupSoda, lamp: Lamp } as const;
/** Stand-in for a product photo until one is uploaded: a hairline icon on a category tint. */
export function Thumb({ product, size = 40 }: { product: Pick<Product, 'kind' | 'category'>; size?: number }) {
  const Icon = product.category === 'Apparel' ? Shirt : product.category === 'Stationery' ? Notebook : product.category === 'Grocery' ? Coffee : ICON[product.kind];
  return <span aria-hidden style={{ width: size, height: size, borderRadius: 10, background: 'var(--wine-soft)', color: 'var(--wine)', display: 'inline-grid', placeItems: 'center', flex: 'none' }}><Icon size={size * 0.46} strokeWidth={1.5} /></span>;
}
