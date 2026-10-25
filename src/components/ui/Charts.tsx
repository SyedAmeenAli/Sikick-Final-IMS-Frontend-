import { useEffect, useId, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { dur, ease } from '@/animations/motion';

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const nice = (max: number) => {
  if (max <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
};

interface Pt { label: string; value: number }
interface Common { data: Pt[]; height?: number; format: (n: number) => string; ariaLabel: string }

/** Line + soft area. The line draws once on mount and then stays still. */
export function LineChart({ data, height = 220, format, ariaLabel, color = 'var(--wine)' }: Common & { color?: string }) {
  const [ref, w] = useWidth();
  const gid = useId();
  const [hover, setHover] = useState<number | null>(null);
  const first = useRef(true);
  const sig = data.length + ':' + (data[0]?.label ?? '');
  const pad = { l: 46, r: 12, t: 12, b: 24 };
  const max = nice(Math.max(...data.map((d) => d.value), 1));
  const iw = Math.max(0, w - pad.l - pad.r), ih = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const path = data.map((d, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(d.value).toFixed(1)).join(' ');
  const area = path + ' L' + x(data.length - 1).toFixed(1) + ' ' + (pad.t + ih) + ' L' + x(0).toFixed(1) + ' ' + (pad.t + ih) + ' Z';
  const every = Math.ceil(data.length / Math.max(2, Math.floor(iw / 64)));
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {w > 0 && (
        <svg className="chart" width={w} height={height} role="img" aria-label={ariaLabel}
          onPointerLeave={() => setHover(null)}
          onPointerMove={(e) => { const r = (e.currentTarget as SVGElement).getBoundingClientRect(); const i = Math.round(((e.clientX - r.left - pad.l) / iw) * (data.length - 1)); setHover(Math.min(data.length - 1, Math.max(0, i))); }}>
          <defs><linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.22" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => <g key={f}><line className="grid-line" x1={pad.l} x2={w - pad.r} y1={y(max * f)} y2={y(max * f)} /><text x={pad.l - 8} y={y(max * f) + 3.5} textAnchor="end">{format(max * f)}</text></g>)}
          {data.map((d, i) => (i % every === 0 ? <text key={d.label + i} x={x(i)} y={height - 6} textAnchor="middle">{d.label}</text> : null))}
          {/* keyed by the shape of the dataset: switching 7/14/30 days redraws once, a hover or re-render never does */}
          <motion.path key={'a' + sig} d={area} fill={'url(#' + gid + ')'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: dur.chart * 0.7, ease, delay: first.current ? 0.5 : 0.2 }} />
          <motion.path key={'l' + sig} d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: first.current ? dur.chart : dur.chart * 0.6, ease, delay: first.current ? 0.3 : 0 }} onAnimationComplete={() => { first.current = false; }} />
          {hover !== null && <g><line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="var(--line-strong)" /><circle cx={x(hover)} cy={y(data[hover].value)} r="4.5" fill="var(--surface)" stroke={color} strokeWidth="2" /></g>}
        </svg>
      )}
      {hover !== null && w > 0 && <div className="tip" style={{ left: Math.min(Math.max(x(hover), 60), w - 60), top: y(data[hover].value) }}>{data[hover].label}: {format(data[hover].value)}</div>}
    </div>
  );
}

export function BarChart({ data, height = 200, format, ariaLabel, color = 'var(--wine)', highlight }: Common & { color?: string; highlight?: number }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 46, r: 8, t: 10, b: 24 };
  const max = nice(Math.max(...data.map((d) => d.value), 1));
  const iw = Math.max(0, w - pad.l - pad.r), ih = height - pad.t - pad.b;
  const slot = iw / data.length, bw = Math.min(34, slot * 0.62);
  const every = Math.ceil(data.length / Math.max(2, Math.floor(iw / 52)));
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {w > 0 && (
        <svg className="chart" width={w} height={height} role="img" aria-label={ariaLabel} onPointerLeave={() => setHover(null)}>
          {[0, 0.5, 1].map((f) => <g key={f}><line className="grid-line" x1={pad.l} x2={w - pad.r} y1={pad.t + ih - ih * f} y2={pad.t + ih - ih * f} /><text x={pad.l - 8} y={pad.t + ih - ih * f + 3.5} textAnchor="end">{format(max * f)}</text></g>)}
          {data.map((d, i) => {
            const h = (d.value / max) * ih;
            const cx = pad.l + slot * i + slot / 2;
            return (
              <g key={d.label + i} onPointerEnter={() => setHover(i)}>
                <rect x={cx - slot / 2} y={pad.t} width={slot} height={ih} fill="transparent" />
                <motion.rect x={cx - bw / 2} width={bw} rx={4} fill={highlight === i || hover === i ? 'var(--wine-strong)' : color} opacity={highlight !== undefined && highlight !== i && hover !== i ? 0.45 : 1}
                  initial={{ height: 0, y: pad.t + ih }} animate={{ height: h, y: pad.t + ih - h }} transition={{ duration: dur.chart, ease, delay: i * 0.025 }} />
                {i % every === 0 && <text x={cx} y={height - 6} textAnchor="middle">{d.label}</text>}
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && w > 0 && <div className="tip" style={{ left: pad.l + slot * hover + slot / 2, top: pad.t + ih - (data[hover].value / max) * ih }}>{data[hover].label}: {format(data[hover].value)}</div>}
    </div>
  );
}

export function Donut({ data, size = 160, centre, ariaLabel }: { data: Array<{ label: string; value: number; color: string }>; size?: number; centre?: { top: string; bottom: string }; ariaLabel: string }) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const r = size / 2 - 12, c = 2 * Math.PI * r;
  let off = 0;
  return (
    <svg className="chart" width={size} height={size} role="img" aria-label={ariaLabel} style={{ flex: 'none' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth="16" />
      {data.map((d, i) => {
        const len = (d.value / total) * c;
        const el = <motion.circle key={d.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth="16" strokeDasharray={len + ' ' + (c - len)} strokeDashoffset={-off} transform={'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: dur.section, delay: i * 0.06 }} />;
        off += len;
        return el;
      })}
      {centre && <g textAnchor="middle"><text x={size / 2} y={size / 2 - 1} style={{ font: '600 17px var(--font)', fill: 'var(--ink)' }}>{centre.top}</text><text x={size / 2} y={size / 2 + 15}>{centre.bottom}</text></g>}
    </svg>
  );
}

export function Spark({ values, width = 90, height = 28 }: { values: number[]; width?: number; height?: number }) {
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const pts = values.map((v, i) => (i * width) / Math.max(1, values.length - 1) + ',' + (height - 3 - ((v - min) / (max - min || 1)) * (height - 6)));
  return <svg width={width} height={height} aria-hidden><motion.polyline points={pts.join(' ')} fill="none" stroke="var(--wine)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: dur.chart, ease }} /></svg>;
}
