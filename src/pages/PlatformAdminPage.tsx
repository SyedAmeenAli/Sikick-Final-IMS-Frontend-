import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button, Chip, Metric, Notice, Segmented, StatusChip } from '@/components/ui/primitives';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Confirm, ToastProvider, useToast } from '@/components/ui/Overlay';
import { SikickLogo } from '@/components/brand';
import { fmt } from '@/lib/money';

interface Tenant { id: string; name: string; plan: 'starter' | 'growth' | 'business'; state: 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled'; disabled: boolean; products: number; storageGb: number; aiScans: number; cost: number }
const TENANTS: Tenant[] = [
  { id: 'T-1001', name: 'Morrow Goods', plan: 'growth', state: 'active', disabled: false, products: 15, storageGb: 0.4, aiScans: 12, cost: 31800 },
  { id: 'T-1002', name: 'Fernwood Pharmacy', plan: 'business', state: 'active', disabled: false, products: 3120, storageGb: 6.8, aiScans: 140, cost: 128400 },
  { id: 'T-1003', name: 'Kestrel Sports', plan: 'starter', state: 'trial', disabled: false, products: 84, storageGb: 0.2, aiScans: 31, cost: 9100 },
  { id: 'T-1004', name: 'Bluebird Bakers', plan: 'growth', state: 'past_due', disabled: false, products: 240, storageGb: 1.1, aiScans: 6, cost: 22700 },
  { id: 'T-1005', name: 'Old Quarter Books', plan: 'starter', state: 'suspended', disabled: true, products: 1900, storageGb: 2.4, aiScans: 0, cost: 0 },
];

/** A separate area with its own sign-in context. It shares no navigation with a tenant workspace. */
function Console() {
  const toast = useToast();
  const [rows, setRows] = useState(TENANTS);
  const [role, setRole] = useState<'admin' | 'viewer'>('admin');
  const [imp, setImp] = useState<Tenant | null>(null);
  const [disable, setDisable] = useState<Tenant | null>(null);
  const cols: Array<Column<Tenant>> = [
    { id: 'n', header: 'Tenant', primary: true, sort: (t) => t.name, cell: (t) => <div><div className="cell-main">{t.name}</div><div className="cell-sub mono">{t.id}</div></div> },
    { id: 'p', header: 'Plan', cell: (t) => <span style={{ textTransform: 'capitalize' }}>{t.plan}</span> },
    { id: 's', header: 'Billing', cell: (t) => <StatusChip status={t.state === 'past_due' ? 'Pending' : t.state === 'active' ? 'active' : t.state === 'trial' ? 'Draft' : 'revoked'} label={t.state.replace('_', ' ')} /> },
    { id: 'u', header: 'Products', num: true, cell: (t) => t.products.toLocaleString('en-IN') },
    { id: 'g', header: 'Storage', num: true, cell: (t) => t.storageGb + ' GB' },
    { id: 'c', header: 'Est. cost', num: true, cell: (t) => fmt(t.cost) },
    { id: 'a', header: '', cell: (t) => <span className="actions"><Button size="sm" disabled={role !== 'admin'} onClick={() => setImp(t)}>Impersonate</Button><Button size="sm" disabled={role !== 'admin'} variant={t.disabled ? 'default' : 'danger'} onClick={() => (t.disabled ? setRows((x) => x.map((y) => (y.id === t.id ? { ...y, disabled: false } : y))) : setDisable(t))}>{t.disabled ? 'Enable' : 'Disable'}</Button></span> },
  ];
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <header className="topbar" data-scrolled="true"><div className="topbar-in"><SikickLogo height={28} /><Chip tone="wine">Platform operations</Chip><span className="tools"><Segmented label="Operator role" value={role} onChange={setRole} options={[{ value: 'admin', label: 'Admin operator' }, { value: 'viewer', label: 'Viewer operator' }]} /><Link className="btn btn-sm" to="/dashboard">Leave</Link></span></div></header>
      <main className="page">
        <div className="page-head"><div><h1>Tenants</h1><p className="sub">Operators only. A tenant sign-in cannot reach this page, and every denial here is audited.</p></div></div>
        <div className="stack">
          <Notice tone="warn" title="Fictional tenants">These are example records. Impersonation in the live system is a 15-minute, fully audited session.</Notice>
          <div className="grid c4 keep2"><Metric label="Tenants" value={rows.length} /><Metric label="Paying" value={rows.filter((t) => t.state === 'active').length} /><Metric label="Past due" value={rows.filter((t) => t.state === 'past_due').length} /><Metric label="Disabled" value={rows.filter((t) => t.disabled).length} /></div>
          {role === 'viewer' && <Notice tone="info">Viewer operators can read everything and change nothing.</Notice>}
          <div className="panel"><DataTable label="Tenants" rows={rows} rowKey={(t) => t.id} columns={cols} searchText={(t) => t.name + ' ' + t.id} searchPlaceholder="Search tenants" /></div>
        </div>
      </main>
      <Confirm open={!!disable} onClose={() => setDisable(null)} danger title={'Disable ' + (disable?.name ?? '')} confirmLabel="Disable tenant" onConfirm={() => { setRows((x) => x.map((y) => (y.id === disable!.id ? { ...y, disabled: true } : y))); toast('Disabled for support reasons. Billing is unaffected.'); }}>They are signed out and cannot work until you enable them again. This is separate from billing status.</Confirm>
      <Confirm open={!!imp} onClose={() => setImp(null)} title={'Impersonate ' + (imp?.name ?? '')} confirmLabel="Start session" onConfirm={() => toast('A 15-minute audited session would start. Not connected in this prototype.')}><span className="row" style={{ gap: 8 }}><ShieldAlert size={16} />You will see exactly what their admin sees, and every action is attributed to you.</span></Confirm>
    </div>
  );
}
export default function PlatformAdminPage() { return <ToastProvider><Console /></ToastProvider>; }
