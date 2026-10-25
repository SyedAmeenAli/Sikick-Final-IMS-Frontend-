import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Empty } from './primitives';

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** value used for sorting; omit to disable sorting on this column */
  sort?: (row: T) => string | number;
  num?: boolean;
  primary?: boolean;
  hideCards?: boolean;
}

interface Props<T> {
  rows: T[];
  columns: Array<Column<T>>;
  rowKey: (row: T) => string;
  label: string;
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  filters?: ReactNode;
  toolbarEnd?: ReactNode;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  pageSize?: number;
  empty?: { title: string; body?: string; art?: ReactNode };
  footer?: ReactNode;
}

/** One table for every list: search, sort, pagination, selection, and a card layout under 720px. */
export function DataTable<T>({ rows, columns, rowKey, label, searchText, searchPlaceholder = 'Search', filters, toolbarEnd, onRowClick, selectedKey, pageSize = 10, empty, footer }: Props<T>) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ id: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);

  const view = useMemo(() => {
    let out = rows;
    if (q.trim() && searchText) { const n = q.trim().toLowerCase(); out = out.filter((r) => searchText(r).toLowerCase().includes(n)); }
    if (sort) {
      const col = columns.find((c) => c.id === sort.id);
      if (col?.sort) { const f = col.sort; out = [...out].sort((a, b) => { const x = f(a), y = f(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; }); }
    }
    return out;
  }, [rows, q, sort, columns, searchText]);

  const pages = Math.max(1, Math.ceil(view.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const slice = view.slice(cur * pageSize, cur * pageSize + pageSize);

  return (
    <div>
      {(searchText || filters || toolbarEnd) && (
        <div className="toolbar">
          {searchText && (
            <div className="input-icon grow" style={{ maxWidth: 340 }}>
              <Search aria-hidden />
              <input className="input" type="search" value={q} placeholder={searchPlaceholder} aria-label={searchPlaceholder} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
            </div>
          )}
          {filters}
          {toolbarEnd && <div style={{ marginLeft: 'auto' }} className="row">{toolbarEnd}</div>}
        </div>
      )}
      {view.length === 0 ? (
        <Empty title={empty?.title ?? 'Nothing matches'} art={empty?.art}>{empty?.body ?? 'Try clearing the search or a filter.'}</Empty>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl" data-cards aria-label={label}>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.id} className={(c.num ? 'num ' : '') + (c.sort ? 'sortable' : '')} aria-sort={sort?.id === c.id ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}
                    onClick={c.sort ? () => setSort((s) => (s?.id === c.id ? (s.dir === 1 ? { id: c.id, dir: -1 } : null) : { id: c.id, dir: 1 })) : undefined}>
                    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>{c.header}{sort?.id === c.id && (sort.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slice.map((r) => {
                const k = rowKey(r);
                return (
                  <tr key={k} data-clickable={onRowClick ? 'true' : undefined} aria-selected={selectedKey === k || undefined} tabIndex={onRowClick ? 0 : undefined}
                    onClick={onRowClick ? () => onRowClick(r) : undefined}
                    onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(r); } } : undefined}>
                    {columns.map((c) => <td key={c.id} className={c.num ? 'num' : ''} data-label={c.header} data-primary={c.primary ? 'true' : undefined}>{c.cell(r)}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="tbl-foot">
        <span>{view.length === 0 ? 'No rows' : 'Showing ' + (cur * pageSize + 1) + '–' + Math.min(view.length, cur * pageSize + pageSize) + ' of ' + view.length}</span>
        {footer}
        {pages > 1 && (
          <span className="row" style={{ gap: 6 }}>
            <button className="btn btn-sm btn-icon" aria-label="Previous page" disabled={cur === 0} onClick={() => setPage(cur - 1)}><ChevronLeft /></button>
            <span className="num">{cur + 1} / {pages}</span>
            <button className="btn btn-sm btn-icon" aria-label="Next page" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}><ChevronRight /></button>
          </span>
        )}
      </div>
    </div>
  );
}
