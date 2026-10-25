import { useState, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Boxes, CheckCircle2, Cpu, Loader2, PartyPopper, Plus, Shirt, ShoppingBasket, Store, Trash2, Upload, Users } from 'lucide-react';
import { Button, Field, Input, Select } from '@/components/ui/primitives';
import { AuthLayout, FormAlert, ProtoNote, StateArt, Stepper } from '@/features/auth/kit';
import { TrialRing, TrialTimeline, trialDate } from '@/features/trial/TrialPanel';
import { ROLE_LABEL } from '@/app/permissions';
import { useCommands, useIms, useTrial } from '@/services';
import type { OnboardingDraft } from '@/services/contracts/account';
import type { Role } from '@/services/contracts/types';

const STEPS = [
  { path: '/onboarding/business', label: 'Business details' },
  { path: '/onboarding/sells', label: 'What you sell' },
  { path: '/onboarding/catalogue', label: 'Your catalogue' },
  { path: '/onboarding/team', label: 'Your team' },
  { path: '/onboarding/review', label: 'Review' },
];

/** Every setup screen needs a session. What is typed is saved in the account record as it is typed, so Back, Forward and a reload keep it. */
function useDraft() {
  const s = useIms();
  const cmd = useCommands();
  return { s, draft: s.account.onboarding.draft, set: (p: Partial<OnboardingDraft>) => cmd.saveOnboardingDraft(p) };
}

function Frame({ step, title, lede, children, back, next, nextLabel = 'Continue', onNext, busy, why }: { step: number; title: string; lede: string; children: ReactNode; back: string; next?: string; nextLabel?: string; onNext?: () => void; busy?: boolean; why: string }) {
  const nav = useNavigate();
  const { s } = useDraft();
  if (!s.account.session.authenticated) return <Navigate to="/login?next=/onboarding/start" replace />;
  return (
    <AuthLayout side={false} topRight={<Link className="btn btn-ghost btn-sm" to="/dashboard">Skip for now</Link>}>
      <Stepper step={step} labels={STEPS.map((x) => x.label)} label={s.account.workspace.name} />
      <div><h1>{title}</h1><p className="lede">{lede}</p></div>
      <div className="stack" style={{ gap: 14 }}>{children}</div>
      <p className="muted" style={{ fontSize: 'var(--fs-sm)' }}>Why we ask: {why}</p>
      <div className="form-actions">
        <Button type="button" onClick={() => nav(back)} disabled={busy}><ArrowLeft aria-hidden />Back</Button>
        <Button variant="primary" size="lg" type="button" disabled={busy} aria-busy={busy} onClick={() => { onNext?.(); if (next) nav(next); }}>{busy ? <><Loader2 className="spin" aria-hidden />Working…</> : <>{nextLabel}{next && <ArrowRight aria-hidden />}</>}</Button>
      </div>
    </AuthLayout>
  );
}

/* ---- 0. trial introduction ---- */
export function OnboardingStart() {
  const s = useIms();
  const t = useTrial();
  const nav = useNavigate();
  const cmd = useCommands();
  if (!s.account.session.authenticated) return <Navigate to="/login?next=/onboarding/start" replace />;
  return (
    <AuthLayout>
      <div className="row" style={{ gap: 18, flexWrap: 'nowrap' }}>
        <TrialRing t={t} />
        <div><h1>Your 14-day trial is running</h1><p className="lede">{s.account.workspace.name} is ready. The trial began when the account was created and ends on {trialDate(t.endsAt)}.</p></div>
      </div>
      <ul className="stack" style={{ gap: 10 }}>
        <li className="row" style={{ gap: 10, flexWrap: 'nowrap', alignItems: 'flex-start' }}><CheckCircle2 size={17} color="var(--ok)" style={{ flex: 'none', marginTop: 2 }} aria-hidden />No payment method is needed to start.</li>
        <li className="row" style={{ gap: 10, flexWrap: 'nowrap', alignItems: 'flex-start' }}><CheckCircle2 size={17} color="var(--ok)" style={{ flex: 'none', marginTop: 2 }} aria-hidden />Everything on the Starter plan works for the full 14 days.</li>
        <li className="row" style={{ gap: 10, flexWrap: 'nowrap', alignItems: 'flex-start' }}><CheckCircle2 size={17} color="var(--ok)" style={{ flex: 'none', marginTop: 2 }} aria-hidden />After that the workspace is read-only for 90 days: you can still look at everything and export it.</li>
      </ul>
      <TrialTimeline t={t} />
      {!s.account.session.emailVerified && <ProtoNote title="Verify your email, when you like"><span>A verification link is sent when you sign up (nothing is sent from this prototype). You can work before you open it. <Link className="link" to="/verify-email">See how it looks</Link>.</span></ProtoNote>}
      <div className="form-actions">
        <Button type="button" onClick={() => { cmd.completeOnboarding(); nav('/dashboard'); }}>Skip setup</Button>
        <Button variant="primary" size="lg" type="button" onClick={() => nav('/onboarding/business')}>Set up my workspace<ArrowRight aria-hidden /></Button>
      </div>
    </AuthLayout>
  );
}

/* ---- 1. business details (fields the service stores in /settings/business) ---- */
export function OnboardingBusiness() {
  const { draft: d, set } = useDraft();
  const [show, setShow] = useState(false);
  const err: Record<string, string> = {};
  if (!d.businessName.trim()) err.name = 'Tell us your business name.';
  if (d.gstin && d.gstin.length !== 15) err.gstin = 'A GSTIN is exactly 15 characters.';
  if (!/^[0-9]{2}$/.test(d.stateCode)) err.state = 'Use the two-digit GST state code, for example 36.';
  if (!(d.taxRate !== '' && Number(d.taxRate) >= 0 && Number(d.taxRate) <= 100)) err.tax = 'Enter a number between 0 and 100.';
  const blocked = Object.keys(err).length > 0;
  return (
    <Frame step={0} title="About the business" lede="These print on every tax invoice and set how GST is worked out." back="/onboarding/start" next={blocked ? undefined : '/onboarding/sells'} onNext={() => setShow(true)} why="invoices need your legal details, and GST needs your state and default rate. You can change all of it later in Settings.">
      <Field label="Business name" error={show ? err.name : undefined}>{(id) => <Input id={id} value={d.businessName} onChange={(e) => set({ businessName: e.target.value })} autoFocus />}</Field>
      <div className="form-grid">
        <Field label="GSTIN (optional)" error={show ? err.gstin : undefined} help="15 characters, if you are registered.">{(id) => <Input id={id} className="mono" maxLength={15} value={d.gstin} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} />}</Field>
        <Field label="State code" error={show ? err.state : undefined} help="First two digits of the GSTIN.">{(id) => <Input id={id} inputMode="numeric" maxLength={2} value={d.stateCode} onChange={(e) => set({ stateCode: e.target.value.replace(/\D/g, '') })} />}</Field>
      </div>
      <Field label="Default tax rate (%)" error={show ? err.tax : undefined}>{(id) => <Input id={id} inputMode="decimal" value={d.taxRate} onChange={(e) => set({ taxRate: e.target.value.replace(/[^0-9.]/g, '') })} />}</Field>
    </Frame>
  );
}

/* ---- 2. industry: sets the photo-recognition profile (itemSettings.visionProfile) ---- */
const SELLS: Array<{ v: OnboardingDraft['sells']; t: string; d: string; I: typeof Store }> = [
  { v: 'general', t: 'General retail', d: 'A bit of everything: gifts, home, stationery.', I: Store },
  { v: 'apparel', t: 'Clothing and footwear', d: 'Sizes, colours and seasons.', I: Shirt },
  { v: 'electronics', t: 'Electronics', d: 'Serial numbers and warranty.', I: Cpu },
  { v: 'grocery', t: 'Grocery and food', d: 'Batches and expiry dates.', I: ShoppingBasket },
];
export function OnboardingSells() {
  const { draft: d, set } = useDraft();
  return (
    <Frame step={1} title="What do you sell?" lede="Pick the closest match. It only tunes what the photo tool looks for." back="/onboarding/business" next="/onboarding/catalogue" why="the product recognition profile starts from your trade. It is one setting and you can switch it at any time.">
      <div className="opt" role="radiogroup" aria-label="What you sell">
        {SELLS.map(({ v, t, d: desc, I }) => <button key={v} type="button" role="radio" aria-checked={d.sells === v} className="opt-card" onClick={() => set({ sells: v })}><I aria-hidden /><span><b>{t}</b><small>{desc}</small></span></button>)}
      </div>
    </Frame>
  );
}

/* ---- 3. how products get in ---- */
export function OnboardingCatalogue() {
  const { draft: d, set } = useDraft();
  return (
    <Frame step={2} title="Your catalogue" lede="Choose how products get into the workspace." back="/onboarding/sells" next="/onboarding/team" why="a catalogue is what the till, stock counts and reports are built on.">
      <div className="opt" role="radiogroup" aria-label="Catalogue">
        <button type="button" role="radio" aria-checked={d.catalogue === 'sample'} className="opt-card" onClick={() => set({ catalogue: 'sample' })}><Boxes aria-hidden /><span><b>Use the sample catalogue</b><small>Fifteen products with stock, orders and suppliers, so every screen has something to show.</small></span></button>
        <button type="button" role="radio" aria-checked={d.catalogue === 'import'} className="opt-card" onClick={() => set({ catalogue: 'import' })}><Upload aria-hidden /><span><b>Import my products from a file</b><small>Opens the import tool when setup finishes. Check first, then add everything in one step.</small></span></button>
        <button type="button" role="radio" aria-checked={false} className="opt-card" disabled><Plus aria-hidden /><span><b>Start empty</b><small>Not available in this prototype: an empty workspace needs the live service.</small></span></button>
      </div>
    </Frame>
  );
}

/* ---- 4. people: the real service creates users with POST /users (admin only); the prototype records them through inviteMember ---- */
export function OnboardingTeam() {
  const { draft: d, set } = useDraft();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('manager');
  const [err, setErr] = useState('');
  const add = () => {
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) { setErr('Enter a valid email address.'); return; }
    if (d.invites.some((i) => i.email === e)) { setErr('That person is already on the list.'); return; }
    set({ invites: [...d.invites, { email: e, role }] }); setEmail(''); setErr('');
  };
  return (
    <Frame step={3} title="Who works with you?" lede="Invite people now or later. Nobody is emailed from this prototype." back="/onboarding/catalogue" next="/onboarding/review" nextLabel={d.invites.length ? 'Continue' : 'Skip for now'} why="each person gets a role, and the role decides which screens they can open. You can always invite from Settings, Team and roles.">
      <div className="form-grid">
        <Field label="Email" error={err}>{(id) => <Input id={id} type="email" inputMode="email" value={email} onChange={(e) => { setEmail(e.target.value); setErr(''); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />}</Field>
        <Field label="Role">{(id) => <Select id={id} value={role} onChange={(e) => setRole(e.target.value as Role)}>{(['manager', 'warehouse_staff', 'pos_operator', 'admin'] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select>}</Field>
      </div>
      <Button type="button" onClick={add}><Users aria-hidden />Add to the list</Button>
      {d.invites.length > 0 && (
        <ul aria-label="People to invite">{d.invites.map((i) => (
          <li key={i.email} className="list-row"><div className="grow"><div className="t">{i.email}</div><div className="d">{ROLE_LABEL[i.role]}</div></div>
            <Button variant="ghost" size="sm" icon aria-label={'Remove ' + i.email} onClick={() => set({ invites: d.invites.filter((x) => x.email !== i.email) })}><Trash2 /></Button></li>
        ))}</ul>
      )}
    </Frame>
  );
}

/* ---- 5. review ---- */
export function OnboardingReview() {
  const { draft: d, s } = useDraft();
  const cmd = useCommands();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const sells = SELLS.find((x) => x.v === d.sells)!.t;
  const finish = async () => {
    setBusy(true); setProblem(null);
    await new Promise((r) => window.setTimeout(r, 550));
    const r = cmd.completeOnboarding();
    setBusy(false);
    if (r.ok) nav('/onboarding/done', { replace: true }); else setProblem(r.message);
  };
  return (
    <Frame step={4} title="Review and finish" lede="This is what will be set up. Change anything with the Edit links." back="/onboarding/team" nextLabel="Finish setup" onNext={finish} busy={busy} why="nothing is saved to the workspace until you finish.">
      {problem && <FormAlert title="Cannot finish">{problem} <Link className="link" to="/onboarding/business">Fix it</Link></FormAlert>}
      <dl className="stack" style={{ gap: 0, margin: 0 }}>
        <div className="review-row"><dt>Business</dt><dd>{d.businessName || '—'} <Link className="link" to="/onboarding/business">Edit</Link></dd></div>
        <div className="review-row"><dt>GSTIN</dt><dd className="mono">{d.gstin || 'Not set'}</dd></div>
        <div className="review-row"><dt>State code · default tax</dt><dd>{d.stateCode} · {d.taxRate}%</dd></div>
        <div className="review-row"><dt>You sell</dt><dd>{sells} <Link className="link" to="/onboarding/sells">Edit</Link></dd></div>
        <div className="review-row"><dt>Catalogue</dt><dd>{d.catalogue === 'sample' ? 'Sample catalogue' : 'Import a file next'} <Link className="link" to="/onboarding/catalogue">Edit</Link></dd></div>
        <div className="review-row"><dt>People to invite</dt><dd>{d.invites.length ? d.invites.length + ' (' + d.invites.map((i) => i.email).join(', ') + ')' : 'None yet'} <Link className="link" to="/onboarding/team">Edit</Link></dd></div>
        <div className="review-row"><dt>Trial</dt><dd>14 days, no card</dd></div>
      </dl>
      {!s.account.session.authenticated && null}
    </Frame>
  );
}

/* ---- done: setup complete and the trial summarised ---- */
export function OnboardingDone() {
  const s = useIms();
  const t = useTrial();
  const nav = useNavigate();
  if (!s.account.session.authenticated) return <Navigate to="/login" replace />;
  const wantsImport = s.account.onboarding.draft.catalogue === 'import';
  return (
    <AuthLayout>
      <StateArt tone="ok" icon={PartyPopper} />
      <div><h1>{s.account.workspace.name} is ready</h1><p className="lede">Setup is saved to this prototype's workspace. Your 14-day trial ends on {trialDate(t.endsAt)}.</p></div>
      <div className="row" style={{ gap: 18, flexWrap: 'nowrap' }}><TrialRing t={t} /><TrialTimeline t={t} /></div>
      <Button variant="primary" size="lg" onClick={() => nav(wantsImport ? '/import' : '/dashboard')}>{wantsImport ? 'Open the import tool' : 'Open the dashboard'}<ArrowRight aria-hidden /></Button>
      {wantsImport && <Link className="link" to="/dashboard" style={{ textAlign: 'center' }}>Go to the dashboard instead</Link>}
    </AuthLayout>
  );
}
