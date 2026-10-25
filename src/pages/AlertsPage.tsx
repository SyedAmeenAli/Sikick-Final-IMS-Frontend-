import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Block, Button, Chip, FilterChips, Metric, Page, PageHeader, Panel, StatusChip } from '@/components/ui/primitives';
import { SidePanel, useToast } from '@/components/ui/Overlay';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { ArtBox } from '@/components/illustrations';
import { ago } from '@/lib/format';
import { useCommands, useIms } from '@/services';
import { alerts } from '@/services/selectors';
import type { Alert, AlertKind } from '@/services/contracts/types';

const KIND: Record<AlertKind, string> = { stockout: 'Stockout', low_stock: 'Low stock', overdue_po: 'Overdue order', stagnant: 'Stagnant', expiry: 'Expiry', broken_assortment: 'Broken range', rto: 'Return to origin' };

export default function AlertsPage() {
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  const [kind, setKind] = useState<'all' | AlertKind>('all');
  const [showDone, setShowDone] = useState(false);
  const [open, setOpen] = useState<Alert | null>(null);
  const all = alerts(s);
  const live = all.filter((a) => !a.acknowledged);
  const rows = all.filter((a) => (showDone || !a.acknowledged) && (kind === 'all' || a.kind === kind));
  const kinds = Array.from(new Set(all.map((a) => a.kind)));
  const ack = (a: Alert) => { cmd.acknowledgeAlert(a.id); toast('Acknowledged. It stays in the log until the cause is fixed.'); setOpen(null); };

  const cols: Array<Column<Alert>> = [
    { id: 's', header: 'Severity', sort: (a) => ['critical', 'high', 'medium', 'low'].indexOf(a.severity), cell: (a) => <StatusChip status={a.severity} /> },
    { id: 't', header: 'Alert', primary: true, cell: (a) => <div><div className="cell-main">{a.title}</div><div className="cell-sub">{a.detail.length > 110 ? a.detail.slice(0, 110) + '…' : a.detail}</div></div> },
    { id: 'k', header: 'Type', cell: (a) => KIND[a.kind] },
    { id: 'w', header: 'Raised', cell: (a) => ago(a.at) },
    { id: 'a', header: '', cell: (a) => a.acknowledged ? <Chip tone="ok" plain>Acknowledged</Chip> : <Button size="sm" onClick={(e) => { e.stopPropagation(); ack(a); }}><Check />Acknowledge</Button> },
  ];

  return (
    <Page>
      <PageHeader title="Alerts" sub="Stock, purchasing and shipment signals, recalculated from live records." actions={<label className="row" style={{ gap: 8 }}><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />Show acknowledged</label>} />
      <Block className="grid c4 keep2">
        <Metric label="Open alerts" num={{ value: live.length, format: { kind: 'int' } }} foot={live.filter((a) => a.severity === 'critical' || a.severity === 'high').length + ' urgent'} />
        <Metric label="Low stock" num={{ value: live.filter((a) => a.kind === 'low_stock' || a.kind === 'stockout').length, format: { kind: 'int' } }} onClick={() => setKind('low_stock')} foot="variants" />
        <Metric label="Overdue orders" num={{ value: live.filter((a) => a.kind === 'overdue_po').length, format: { kind: 'int' } }} onClick={() => setKind('overdue_po')} foot="purchase orders" />
        <Metric label="Expiring batches" num={{ value: live.filter((a) => a.kind === 'expiry').length, format: { kind: 'int' } }} onClick={() => setKind('expiry')} foot="within 60 days" />
      </Block>
      <div style={{ height: 16 }} />
      <Block><Panel flush>
        <DataTable label="Alerts" rows={rows} rowKey={(a) => a.id} columns={cols} onRowClick={setOpen} selectedKey={open?.id} searchText={(a) => a.title + ' ' + a.detail} searchPlaceholder="Search alerts"
          empty={{ title: 'All clear', body: 'Nothing needs attention in this view.', art: <ArtBox /> }}
          filters={<FilterChips label="Alert type" value={kind} onChange={setKind} options={[{ value: 'all', label: 'All' }, ...kinds.map((k) => ({ value: k, label: KIND[k] }))]} />} />
      </Panel></Block>
      <SidePanel open={!!open} onClose={() => setOpen(null)} title={open?.title ?? ''} sub={open && <span className="row" style={{ gap: 8 }}><StatusChip status={open.severity} /><span>{KIND[open.kind]} · {ago(open.at)}</span></span>}>
        {open && <div className="stack">
          <p>{open.detail}</p>
          <div className="actions">
            {open.sku && <Link className="btn btn-primary" to={'/inventory/' + open.sku}>Open item</Link>}
            {open.ref && <Link className="btn" to={'/purchase-orders/' + open.ref}>Open order</Link>}
            {!open.acknowledged && <Button onClick={() => ack(open)}><Check />Acknowledge</Button>}
          </div>
          <p className="muted">Acknowledging records that you have seen the alert. It does not resolve the cause, and in the live system it calls the alerts acknowledge endpoint.</p>
        </div>}
      </SidePanel>
    </Page>
  );
}
