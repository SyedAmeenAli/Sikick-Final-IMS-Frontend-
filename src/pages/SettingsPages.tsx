import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ThemePicker } from '@/components/ThemePicker';
import { Copy, KeyRound, Plus, RotateCcw, Smartphone, Volume2 } from 'lucide-react';
import { Block, Button, Chip, Field, Input, Metric, Notice, Page, PageHeader, Panel, Select, SettingRow, StatusChip, Toggle, Avatar } from '@/components/ui/primitives';
import { RouteTabs } from '@/components/ui/Tabs';
import { Confirm, Dialog, useToast } from '@/components/ui/Overlay';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { SETTINGS_TABS } from '@/app/nav';
import { ROLE_LABEL, canAccess } from '@/app/permissions';
import { configureSound, PALETTE, previewCue } from '@/lib/sound';
import { fmt } from '@/lib/money';
import { fmtDate } from '@/lib/format';
import { useCommands, useIms, useTrial } from '@/services';
import { TrialRing, TrialTimeline, tone, trialDate, trialLine } from '@/features/trial/TrialPanel';
import { PHASE_LABEL } from '@/services/account';
import type { BusinessSettings, ItemSettings } from '@/services/contracts/service';
import type { Cashier, Member, Role, Terminal } from '@/services/contracts/types';

export const SettingsShell = ({ title, sub, children, actions }: { title: string; sub: string; children: ReactNode; actions?: ReactNode }) => (
  <Page>
    <PageHeader title={title} sub={sub} actions={actions} />
    <Block><div className="sub-nav"><RouteTabs tabs={SETTINGS_TABS.map((t) => ({ to: t.to, label: t.label, end: t.end }))} label="Settings sections" /></div></Block>
    {children}
  </Page>
);

/** Local form state with dirty tracking and a reset, so every settings page saves and discards the same way. */
/** A number field that keeps what you type (including an empty box or a trailing dot) and reports NaN until it is a real number. */
function NumInput({ id, value, onChange, decimal }: { id: string; value: number; onChange: (n: number) => void; decimal?: boolean }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft((d) => (Number(d) === value || (d === '' && Number.isNaN(value)) ? d : String(value))); }, [value]);
  return <Input id={id} inputMode={decimal ? 'decimal' : 'numeric'} value={draft} onChange={(e) => { const raw = e.target.value.replace(decimal ? /[^0-9.]/g : /[^0-9]/g, ''); setDraft(raw); onChange(raw === '' ? NaN : Number(raw)); }} />;
}

function useForm<T>(initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [base, setBase] = useState<T>(initial);
  const dirty = JSON.stringify(value) !== JSON.stringify(base);
  useEffect(() => { setValue(initial); setBase(initial);   }, [JSON.stringify(initial)]);
  return { value, set: (patch: Partial<T>) => setValue((v) => ({ ...v, ...patch })), dirty, reset: () => setValue(base), commit: () => setBase(value) };
}
const FormFoot = ({ dirty, onReset, onSave, saved }: { dirty: boolean; onReset: () => void; onSave: () => void; saved?: boolean }) => (
  <div className="form-foot">{dirty ? <span className="dirty-note">● Unsaved changes</span> : <span className="muted">{saved ? 'Saved' : 'No changes'}</span>}<span className="actions"><Button disabled={!dirty} onClick={onReset}><RotateCcw />Reset</Button><Button variant="primary" disabled={!dirty} onClick={onSave}>Save changes</Button></span></div>
);

/* ---------- hub ---------- */
export function SettingsHub() {
  const s = useIms();
  const groups = [
    { t: 'Business and tax', d: 'GSTIN, state code, tax rate, e-invoicing and audit retention.', to: '/settings/business' },
    { t: 'Team and roles', d: 'Invite people and set what each role can open.', to: '/settings/users' },
    { t: 'Item fields', d: 'Which fields a product carries: serial, batch, expiry, size, custom labels.', to: '/settings/items' },
    { t: 'Metal rates', d: 'Daily gold, silver and platinum rates for jewellery billing.', to: '/settings/metal-rates' },
    { t: 'Sales channels', d: 'API keys and inbound orders from online channels.', to: '/settings/channels' },
    { t: 'Cashiers', d: 'PINs, shifts and activity for people on the till.', to: '/settings/cashiers' },
    { t: 'Terminals', d: 'Provision, monitor and revoke tills.', to: '/settings/terminals' },
    { t: 'Integrations', d: 'Payments, shipping, messaging and accounting connections.', to: '/settings/integrations' },
    { t: 'Notifications', d: 'Who hears about alerts, and how.', to: '/settings/notifications' },
    { t: 'Billing', d: 'Your plan, usage and invoices.', to: '/settings/billing' },
    { t: 'Import data', d: 'Bring products across from a spreadsheet.', to: '/import' },
    { t: 'Audit log', d: 'Every write, attributed to a person.', to: '/audit-log' },
    { t: 'Appearance and sound', d: 'Light or dark, and optional sound cues.', to: '/settings/appearance' },
  ].filter((g) => canAccess(s.role, g.to) || g.to === '/settings/appearance');
  return (
    <SettingsShell title="Settings" sub={'Everything about ' + s.account.workspace.name + ' in one place. Pick a section, or jump straight from the bar above.'}>
      <Block className="hub-grid">{groups.map((g) => <Link key={g.to} to={g.to} className="panel card-link"><h3>{g.t}</h3><p>{g.d}</p></Link>)}</Block>
    </SettingsShell>
  );
}

/* ---------- business and tax ---------- */
export function BusinessSettingsPage() {
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  const f = useForm<BusinessSettings>(s.business);
  const [err, setErr] = useState<Record<string, string>>({});
  const v = f.value;
  const save = () => {
    const e: Record<string, string> = {};
    if (v.sellerGstin && v.sellerGstin.length !== 15) e.gstin = 'A GSTIN is exactly 15 characters.';
    if (!/^[0-9]{2}$/.test(v.sellerStateCode)) e.state = 'Use the two-digit GST state code, for example 36.';
    if (!(v.taxRatePercent >= 0 && v.taxRatePercent <= 100)) e.tax = 'Enter a number between 0 and 100.';
    if (!(v.ewayBillThreshold >= 0)) e.eway = 'Enter an amount, 0 or more.';
    if (!(v.auditLogRetentionMonths >= 1 && v.auditLogRetentionMonths <= 120)) e.audit = 'Enter a whole number between 1 and 120 months.';
    setErr(e);
    if (Object.keys(e).length) return;
    const r = cmd.saveBusinessSettings(v);
    if (!r.ok) { toast(r.message, 'bad'); return; }
    f.commit(); toast('Business settings saved.');
  };
  return (
    <SettingsShell title="Business and tax" sub="The fields the system actually stores for your business, taxes and invoices.">
      <Block><Panel>
        <div className="form-grid">
          <Field label="Seller GSTIN" error={err.gstin} help="Printed on every tax invoice.">{(id) => <Input id={id} className="mono" value={v.sellerGstin} maxLength={15} onChange={(e) => f.set({ sellerGstin: e.target.value.toUpperCase() })} />}</Field>
          <Field label="State code" error={err.state} help="First two digits of the GSTIN.">{(id) => <Input id={id} inputMode="numeric" maxLength={2} value={v.sellerStateCode} onChange={(e) => f.set({ sellerStateCode: e.target.value })} />}</Field>
          <Field label="Default tax rate (%)" error={err.tax}>{(id) => <NumInput id={id} decimal value={v.taxRatePercent} onChange={(n) => f.set({ taxRatePercent: n })} />}</Field>
          <Field label="E-way bill threshold (₹)" help="Shipments above this value need an e-way bill." error={err.eway}>{(id) => <NumInput id={id} value={v.ewayBillThreshold} onChange={(n) => f.set({ ewayBillThreshold: n })} />}</Field>
          <Field label="Audit log retention (months)" error={err.audit}>{(id) => <NumInput id={id} value={v.auditLogRetentionMonths} onChange={(n) => f.set({ auditLogRetentionMonths: n })} />}</Field>
          <Field label="Drug licence number" help="Only if you sell regulated medicines.">{(id) => <Input id={id} value={v.drugLicenceNumber} onChange={(e) => f.set({ drugLicenceNumber: e.target.value })} />}</Field>
        </div>
        <hr className="divider" />
        <SettingRow title="E-invoicing applies to my business" desc="Switch on if your turnover requires invoices to be registered."><Toggle label="E-invoicing applicable" checked={v.eInvoiceApplicable} onChange={(b) => f.set({ eInvoiceApplicable: b })} /></SettingRow>
        <SettingRow title="Annual turnover above ₹10 crore" desc="Changes which e-invoice rules apply."><Toggle label="Turnover above 10 crore" checked={v.eInvoiceAatoAbove10Cr} onChange={(b) => f.set({ eInvoiceAatoAbove10Cr: b })} /></SettingRow>
        <FormFoot dirty={f.dirty} onReset={() => { f.reset(); setErr({}); }} onSave={save} />
      </Panel></Block>
    </SettingsShell>
  );
}

/* ---------- item fields ---------- */
export function ItemSettingsPage() {
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  const f = useForm<ItemSettings>(s.items);
  const [label, setLabel] = useState('');
  const v = f.value;
  const toggles: Array<[keyof ItemSettings, string, string]> = [['serial_no', 'Serial numbers', 'Track each unit individually, with warranty.'], ['batch_no', 'Batch numbers', 'Group units by batch.'], ['expiry_date', 'Expiry date', 'Needed for food, medicine and cosmetics.'], ['model_no', 'Model number', 'A free field for the maker’s model.'], ['size', 'Size', 'Garments, shoes and anything sold by size.'], ['units_enabled', 'Units of measure', 'Sell by weight, length or pack.']];
  return (
    <SettingsShell title="Item fields" sub="Choose the fields a product carries. These are the switches the system supports.">
      <Block><Panel>
        {toggles.map(([k, t, d]) => <SettingRow key={k} title={t} desc={d}><Toggle label={t} checked={v[k] as boolean} onChange={(b) => f.set({ [k]: b } as Partial<ItemSettings>)} /></SettingRow>)}
        <hr className="divider" />
        <Field label="Image recognition profile" help="Tunes what the photo tool looks for.">{(id) => <Select id={id} value={v.visionProfile} onChange={(e) => f.set({ visionProfile: e.target.value as ItemSettings['visionProfile'] })}>{['general', 'apparel', 'electronics', 'grocery'].map((p) => <option key={p}>{p}</option>)}</Select>}</Field>
        <div style={{ height: 14 }} />
        <div className="eyebrow">Custom field labels ({v.customFieldLabels.length} of 20)</div>
        <div className="row" style={{ margin: '8px 0' }}>{v.customFieldLabels.map((c) => <Chip key={c.label} tone="neutral" plain>{c.label}<button type="button" aria-label={'Remove ' + c.label} style={{ marginLeft: 6 }} onClick={() => f.set({ customFieldLabels: v.customFieldLabels.filter((x) => x.label !== c.label) })}>×</button></Chip>)}</div>
        <form className="row" style={{ flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); const t = label.trim(); if (t && v.customFieldLabels.length < 20 && !v.customFieldLabels.some((c) => c.label === t)) { f.set({ customFieldLabels: [...v.customFieldLabels, { label: t.slice(0, 40), scannable: false }] }); setLabel(''); } }}><Input aria-label="New custom field" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="For example: Season" style={{ maxWidth: 260 }} /><Button type="submit"><Plus />Add field</Button></form>
        <FormFoot dirty={f.dirty} onReset={f.reset} onSave={() => { cmd.saveItemSettings(v); f.commit(); toast('Item fields saved.'); }} />
      </Panel></Block>
    </SettingsShell>
  );
}

/* ---------- metal rates ---------- */
export function MetalRatesPage() {
  const toast = useToast();
  const [rates, setRates] = useState([{ metal: 'Gold', purity: '22K', rate: 7240 }, { metal: 'Gold', purity: '24K', rate: 7895 }, { metal: 'Silver', purity: '999', rate: 96 }, { metal: 'Platinum', purity: '950', rate: 3180 }]);
  const [edit, setEdit] = useState<number | null>(null);
  const [val, setVal] = useState('');
  return (
    <SettingsShell title="Metal rates" sub="Set the day’s rate per gram before billing jewellery. Managers can do this as well as admins.">
      <Block><Notice tone="info">Morrow Goods does not sell jewellery, so these rates are an example of the screen. They affect nothing else in this workspace.</Notice></Block>
      <div style={{ height: 14 }} />
      <Block><Panel flush>
        <div className="tbl-wrap"><table className="tbl" data-cards aria-label="Metal rates"><thead><tr><th>Metal</th><th>Purity</th><th className="num">Rate per gram</th><th>Effective</th><th /></tr></thead>
          <tbody>{rates.map((r, i) => <tr key={r.metal + r.purity}><td data-label="Metal" data-primary="true"><b>{r.metal}</b></td><td data-label="Purity">{r.purity}</td><td data-label="Rate per gram" className="num">{edit === i ? <Input aria-label="Rate per gram" value={val} onChange={(e) => setVal(e.target.value)} style={{ width: 120, textAlign: 'right' }} autoFocus /> : '₹' + r.rate.toLocaleString('en-IN')}</td><td data-label="Effective">24 Oct, 09:00</td>
            <td>{edit === i ? <Button size="sm" variant="primary" onClick={() => { const n = parseFloat(val); if (n > 0) { setRates((x) => x.map((y, j) => (j === i ? { ...y, rate: n } : y))); toast(r.metal + ' ' + r.purity + ' updated.'); setEdit(null); } }}>Save</Button> : <Button size="sm" onClick={() => { setEdit(i); setVal(String(r.rate)); }}>Update</Button>}</td></tr>)}</tbody></table></div>
      </Panel></Block>
    </SettingsShell>
  );
}

/* ---------- sales channels ---------- */
export function ChannelsPage() {
  const toast = useToast();
  const [keys, setKeys] = useState([{ id: 'k1', name: 'Online store sync', scopes: 'orders:write', created: '12 Sep 2026', last: '2 hours ago' }]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [secret, setSecret] = useState<string | null>(null);
  return (
    <SettingsShell title="Sales channels" sub="Online channels push orders in with an API key. The key is shown once." actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus />New API key</Button>}>
      <Block><Panel flush><div className="tbl-wrap"><table className="tbl" data-cards aria-label="API keys"><thead><tr><th>Name</th><th>Scope</th><th>Created</th><th>Last used</th><th /></tr></thead>
        <tbody>{keys.map((k) => <tr key={k.id}><td data-label="Name" data-primary="true"><b>{k.name}</b></td><td data-label="Scope" className="mono">{k.scopes}</td><td data-label="Created">{k.created}</td><td data-label="Last used">{k.last}</td><td><Button size="sm" variant="danger" onClick={() => { setKeys((x) => x.filter((y) => y.id !== k.id)); toast('Key revoked.'); }}>Revoke</Button></td></tr>)}</tbody></table></div></Panel></Block>
      <div style={{ height: 14 }} />
      <Block><Panel title="Rejected orders" hint="Inbound orders that failed validation can be replayed once fixed."><p className="muted">None. Every inbound order was accepted.</p></Panel></Block>
      <Dialog open={open} onClose={() => { setOpen(false); setSecret(null); }} title="New API key" footer={secret ? <Button variant="primary" onClick={() => { setOpen(false); setSecret(null); }}>Done</Button> : <><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => { if (!name.trim()) return; setKeys((x) => [...x, { id: 'k' + (x.length + 2), name, scopes: 'orders:write', created: '24 Oct 2026', last: 'Never' }]); setSecret('sk_demo_' + Math.random().toString(36).slice(2, 14)); setName(''); }}>Create key</Button></>}>
        {secret ? <div className="stack"><Notice tone="warn" title="Copy it now">This demo key is shown once and does nothing. A live key would be hidden after this.</Notice><div className="row"><code className="mono" style={{ padding: '8px 10px', background: 'var(--surface-3)', borderRadius: 8 }}>{secret}</code><Button size="sm" onClick={() => { void navigator.clipboard?.writeText(secret); toast('Copied.'); }}><Copy />Copy</Button></div></div> : <Field label="Key name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="For example: Marketplace sync" />}</Field>}
      </Dialog>
    </SettingsShell>
  );
}

/* ---------- cashiers, terminals, users ---------- */
export function CashiersPage() {
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  const cols: Array<Column<Cashier>> = [
    { id: 'n', header: 'Cashier', primary: true, cell: (c) => <span className="row" style={{ gap: 10, flexWrap: 'nowrap' }}><Avatar name={c.name} /><b>{c.name}</b></span> },
    { id: 't', header: 'Till', cell: (c) => c.terminal },
    { id: 'l', header: 'Last shift', cell: (c) => c.lastShift },
    { id: 'p', header: 'PIN', cell: () => <span className="mono">••••</span> },
    { id: 's', header: 'Status', cell: (c) => <StatusChip status={c.status} /> },
    { id: 'a', header: '', cell: (c) => <span className="actions"><Button size="sm" onClick={() => toast('A new PIN would be issued once, to ' + c.name + '. Not connected here.')}>Reset PIN</Button><Button size="sm" onClick={() => cmd.setCashierStatus(c.id, c.status === 'active' ? 'disabled' : 'active')}>{c.status === 'active' ? 'Disable' : 'Enable'}</Button></span> },
  ];
  return <SettingsShell title="Cashiers" sub="People who can sign in to a till with a PIN. PINs are rate-limited per terminal."><Block><Panel flush><DataTable label="Cashiers" rows={s.cashiers} rowKey={(c) => c.id} columns={cols} /></Panel></Block></SettingsShell>;
}

export function TerminalsPage() {
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  const [rev, setRev] = useState<Terminal | null>(null);
  const cols: Array<Column<Terminal>> = [
    { id: 'n', header: 'Terminal', primary: true, cell: (t) => <span className="row" style={{ gap: 10, flexWrap: 'nowrap' }}><span className="avatar"><Smartphone size={14} /></span><span><b>{t.name}</b><div className="cell-sub">{t.location}</div></span></span> },
    { id: 'l', header: 'Last seen', cell: (t) => t.lastSeen },
    { id: 'i', header: 'Issued', cell: (t) => fmtDate(t.issued) },
    { id: 'q', header: 'Offline queue', num: true, cell: (t) => (t.id === 'TRM-2' ? s.offline.queued : t.offlineQueue) },
    { id: 's', header: 'Status', cell: (t) => <StatusChip status={t.status} /> },
    { id: 'a', header: '', cell: (t) => (t.status === 'active' ? <Button size="sm" variant="danger" onClick={() => setRev(t)}>Revoke</Button> : null) },
  ];
  return (
    <SettingsShell title="Terminals" sub="Each till has its own token. Revoke one and it stops working at once, without affecting the others." actions={<Button variant="primary" onClick={() => toast('A provisioning code would be shown once. Not connected in this prototype.')}><KeyRound />Provision a terminal</Button>}>
      <Block><Notice tone="info">The till itself is a separate application. This screen manages which tills may connect to the workspace.</Notice></Block>
      <div style={{ height: 14 }} />
      <Block><Panel flush><DataTable label="Terminals" rows={s.terminals} rowKey={(t) => t.id} columns={cols} /></Panel></Block>
      <Confirm open={!!rev} onClose={() => setRev(null)} danger title={'Revoke ' + (rev?.name ?? '')} confirmLabel="Revoke terminal" onConfirm={() => { cmd.revokeTerminal(rev!.id); toast('Terminal revoked.'); }}>This till will be signed out and cannot sell until it is provisioned again.</Confirm>
    </SettingsShell>
  );
}

export function UsersPage() {
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('warehouse_staff');
  const [err, setErr] = useState('');
  const cols: Array<Column<Member>> = [
    { id: 'n', header: 'Person', primary: true, cell: (m) => <span className="row" style={{ gap: 10, flexWrap: 'nowrap' }}><Avatar name={m.name} /><span><b>{m.name}</b><div className="cell-sub">{m.email}</div></span></span> },
    { id: 'r', header: 'Role', cell: (m) => <Select aria-label={'Role for ' + m.name} value={m.role} disabled={m.id === 'U-01'} onChange={(e) => { cmd.setMemberRole(m.id, e.target.value as Role); toast(m.name + ' is now ' + ROLE_LABEL[e.target.value as Role] + '.'); }} style={{ maxWidth: 190 }}>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select> },
    { id: 'a', header: 'Last active', cell: (m) => m.lastActive },
    { id: 's', header: 'Status', cell: (m) => <StatusChip status={m.status} /> },
  ];
  return (
    <SettingsShell title="Team and roles" sub="What each role can open follows the same gates as the live system." actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus />Invite someone</Button>}>
      <Block className="grid c4 keep2">{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <Metric key={r} label={ROLE_LABEL[r]} value={s.members.filter((m) => m.role === r).length} foot={r === 'admin' ? 'everything' : r === 'manager' ? 'ops and money' : r === 'warehouse_staff' ? 'stock and buying' : 'till and sales'} />)}</Block>
      <div style={{ height: 14 }} />
      <Block><Panel flush><DataTable label="Team" rows={s.members} rowKey={(m) => m.id} columns={cols} /></Panel></Block>
      <Dialog open={open} onClose={() => setOpen(false)} title="Invite someone" footer={<><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => { const r = cmd.inviteMember(email, role); if (!r.ok) { setErr(r.message); return; } toast('Invitation recorded. No email was sent from this prototype.'); setOpen(false); setEmail(''); setErr(''); }}>Send invite</Button></>}>
        <div className="stack"><Field label="Email" error={err}>{(id) => <Input id={id} type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(''); }} autoFocus />}</Field><Field label="Role">{(id) => <Select id={id} value={role} onChange={(e) => setRole(e.target.value as Role)}>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select>}</Field></div>
      </Dialog>
    </SettingsShell>
  );
}

/* ---------- integrations, notifications, billing, appearance ---------- */
export function IntegrationsPage() {
  const status = [
    { n: 'Razorpay', d: 'Collects UPI and card payments, and the payment QR on the till.', s: 'connected' },
    { n: 'Shiprocket', d: 'Books and tracks shipments for online orders.', s: 'not_configured' },
    { n: 'Meta (WhatsApp)', d: 'Order updates to customers.', s: 'not_configured' },
    { n: 'Email', d: 'Receipts and alert emails.', s: 'connected' },
  ];
  const connectors = ['Zoho Inventory', 'Katana', 'QuickBooks Online', 'Shopify', 'Cin7 Core', 'NetSuite', 'Odoo', 'Cin7 Omni', 'Unleashed', 'inFlow', 'Sortly', 'Dynamics 365 Business Central', 'SAP Business One'];
  return (
    <SettingsShell title="Integrations" sub="Status comes from the server and never shows a secret. Names alone do not mean a connector is live.">
      <Block className="grid c2">{status.map((x) => <Panel key={x.n} title={x.n} actions={<Chip tone={x.s === 'connected' ? 'ok' : 'neutral'}>{x.s === 'connected' ? 'Connected' : 'Not configured'}</Chip>}><p className="muted">{x.d}</p><p className="muted" style={{ marginTop: 6 }}>Set by the server environment, not from this screen.</p></Panel>)}</Block>
      <div style={{ height: 16 }} />
      <Block><Panel title="Catalogue connectors" hint="Built, but each stays off until its provider is enabled for the platform and tested on a real account.">
        <div className="row" style={{ gap: 8 }}>{connectors.map((c) => <Chip key={c} tone="neutral" plain>{c}</Chip>)}</div>
        <p className="muted" style={{ marginTop: 12 }}>None is live in this prototype. For a one-time move, <Link className="link" to="/import">import a file</Link> instead.</p>
      </Panel></Block>
    </SettingsShell>
  );
}

export function NotificationsPage() {
  const toast = useToast();
  const f = useForm({ emailEnabled: true, whatsappEnabled: false, severityFloor: 'high', timezone: 'Asia/Kolkata' });
  const v = f.value;
  return (
    <SettingsShell title="Notifications" sub="Who is told about alerts and how urgent something must be first.">
      <Block><Panel>
        <SettingRow title="Email alerts" desc="Sent to the owner’s address."><Toggle label="Email alerts" checked={v.emailEnabled} onChange={(b) => f.set({ emailEnabled: b })} /></SettingRow>
        <SettingRow title="WhatsApp alerts" desc="Needs a verified phone number and the Meta connection."><Toggle label="WhatsApp alerts" checked={v.whatsappEnabled} onChange={(b) => f.set({ whatsappEnabled: b })} /></SettingRow>
        <div style={{ height: 12 }} />
        <div className="form-grid">
          <Field label="Only notify from this severity up">{(id) => <Select id={id} value={v.severityFloor} onChange={(e) => f.set({ severityFloor: e.target.value })}>{['critical', 'high', 'medium', 'low'].map((x) => <option key={x}>{x}</option>)}</Select>}</Field>
          <Field label="Timezone">{(id) => <Select id={id} value={v.timezone} onChange={(e) => f.set({ timezone: e.target.value })}><option>Asia/Kolkata</option><option>Asia/Dubai</option></Select>}</Field>
        </div>
        <FormFoot dirty={f.dirty} onReset={f.reset} onSave={() => { f.commit(); toast('Notification settings kept for this session. Delivery is not connected in the prototype.'); }} />
      </Panel></Block>
    </SettingsShell>
  );
}

export function BillingPage() {
  const s = useIms();
  const t = useTrial();
  const toast = useToast();
  const [cancel, setCancel] = useState(false);
  const cur = s.account.billing.plan;
  const plans = [{ id: 'starter', n: 'Starter', p: 999, d: 'One shop, up to 500 products.' }, { id: 'growth', n: 'Growth', p: 2499, d: 'Multi-user, 5,000 products, analytics.' }, { id: 'business', n: 'Business', p: 5999, d: 'Unlimited products, priority support.' }];
  return (
    <SettingsShell title="Billing" sub="Your plan and what you have used. Card details never touch this system.">
      {!t.paid && (
        <>
          <Block><Panel glass title="Your trial" hint={PHASE_LABEL[t.phase]} actions={<Link className="link" to="/trial-ended">What happens next</Link>}>
            <div className="row" style={{ gap: 24, flexWrap: 'nowrap' }}><TrialRing t={t} /><div style={{ flex: 1, minWidth: 0 }}><TrialTimeline t={t} /></div></div>
          </Panel></Block>
          <div style={{ height: 14 }} />
        </>
      )}
      <Block className="grid c3">{plans.map((p) => <div key={p.id} className="plan" data-current={cur === p.id}><div className="row between"><b>{p.n}</b>{cur === p.id && <Chip tone="wine">{t.paid ? 'Current' : 'Trial plan'}</Chip>}</div><b className="price num">{fmt(p.p * 100)}<span className="muted" style={{ fontSize: 'var(--fs-sm)', fontWeight: 400 }}> / month</span></b><p className="muted">{p.d}</p>{(t.paid ? cur !== p.id : true) && <Button size="sm" variant={!t.paid ? 'primary' : 'default'} onClick={() => toast('Choosing a plan opens the payment provider’s checkout. It is not connected here, so nothing was charged and nothing changed.')}>{t.paid ? 'Switch to ' + p.n : 'Choose ' + p.n}</Button>}</div>)}</Block>
      <div style={{ height: 14 }} />
      <Block className="grid c2">
        <Panel title="Usage"><div className="stack"><div><div className="row between"><span>Products</span><b className="num">{s.products.length} of 5,000</b></div><div className="bar"><i style={{ width: '1%' }} /></div></div><div><div className="row between"><span>Users</span><b className="num">{s.members.length} of 10</b></div><div className="bar"><i style={{ width: s.members.length * 10 + '%' }} /></div></div><div><div className="row between"><span>Photo recognitions this month</span><b className="num">12 of 200</b></div><div className="bar"><i style={{ width: '6%' }} /></div></div></div></Panel>
        <Panel title="Subscription"><div className="stack">
          <div className="row between"><span>Status</span><Chip tone={tone(t)}>{trialLine(t)}</Chip></div>
          {t.paid ? <div className="row between"><span>Renews</span><b>12 Nov 2026</b></div> : <div className="row between"><span>{t.readOnly ? 'Trial ended' : 'Trial ends'}</span><b>{trialDate(t.endsAt)}</b></div>}
          <div className="muted">{t.paid ? 'If a payment lapses there is a 7-day grace period, then the workspace becomes read-only. You can always read and export your data.' : 'No card is on file and none is needed. When the trial ends the workspace turns read-only for 90 days: everything stays viewable and exportable.'}</div>
          {t.paid ? <Button variant="danger" onClick={() => setCancel(true)}>Cancel subscription</Button> : <Link className="btn" to="/account/export">Export your data</Link>}
        </div></Panel>
      </Block>
      <Confirm open={cancel} onClose={() => setCancel(false)} danger title="Cancel subscription" confirmLabel="Cancel plan" onConfirm={() => toast('Not cancelled: this prototype does not touch billing.')}>This would stop renewal at the end of the period.</Confirm>
    </SettingsShell>
  );
}

export function AppearancePage() {
  const s = useIms();
  const cmd = useCommands();
  const toast = useToast();
  return (
    <SettingsShell title="Appearance and sound" sub="Preferences for this browser session only.">
      <Block><Panel>
        <SettingRow title="Theme" desc={'Every surface, chart and control follows one set of tokens. System follows your device (now ' + s.theme + '). Kept in this browser.'}><ThemePicker /></SettingRow>
        <SettingRow title="Sound" desc={s.sound.enabled ? 'On at ' + Math.round(s.sound.volume * 100) + '%. Drawers, the till, SiBorg and urgent alerts make a short sound; navigation links and hover stay quiet.' : 'Off. Nothing plays until you turn it on here or with the speaker button in the top bar. Your choice is kept in this browser.'}><Toggle label="Sound" checked={s.sound.enabled} onChange={(b) => { configureSound({ ...s.sound, enabled: b }); cmd.setSound({ enabled: b }); }} /></SettingRow>
        <SettingRow title="Volume" desc="Follows your device volume; this only sets Sikick's share of it. Kept low on purpose."><span className="row" style={{ gap: 10, flexWrap: 'nowrap' }}><input type="range" min={0} max={100} step={5} value={Math.round(s.sound.volume * 100)} aria-label="Sound volume" aria-valuetext={Math.round(s.sound.volume * 100) + ' percent'} disabled={!s.sound.enabled} onChange={(e) => { const volume = Number(e.target.value) / 100; configureSound({ ...s.sound, volume }); cmd.setSound({ volume }); }} onPointerUp={() => previewCue('uiConfirm')} onKeyUp={() => previewCue('uiConfirm')} /><span className="num muted" style={{ minWidth: 38, textAlign: 'right' }}>{Math.round(s.sound.volume * 100)}%</span></span></SettingRow>
        <div className="setting-row" style={{ alignItems: 'flex-start', flexDirection: 'column' }}>
          <div><div className="t">Sound palette</div><div className="d">Audition each cue. {s.sound.enabled ? 'They play at your current volume.' : 'Turn sound on to hear them.'}</div></div>
          <div className="filter-chips">{PALETTE.map((p) => <button key={p.cue} type="button" className="fchip" disabled={!s.sound.enabled || s.sound.volume <= 0} title={p.use} onClick={() => previewCue(p.cue)}><Volume2 size={13} aria-hidden />{p.label}</button>)}</div>
        </div>
        <SettingRow title="Reset local data" desc="Puts every record back as it was when the page opened."><Button onClick={() => { cmd.resetDemo(); toast('Local data restored.'); }}><RotateCcw />Reset</Button></SettingRow>
      </Panel></Block>
    </SettingsShell>
  );
}
