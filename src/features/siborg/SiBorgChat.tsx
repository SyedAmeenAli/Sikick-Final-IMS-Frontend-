import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowUp } from 'lucide-react';
import { SiBorgIcon, type SiBorgMood } from '@/components/brand';
import { Button, Chip, Notice } from '@/components/ui/primitives';
import { dur, ease } from '@/animations/motion';
import { useCommands, useIms } from '@/services';
import { answer, PROMPTS, type Reply } from './brain';
import { playSiborgInsight, playSiborgListening, playSiborgRecommend, playSiborgUnavailable } from '@/lib/sound';

interface Msg { id: number; from: 'me' | 'ai'; text: string; reply?: Reply; proposalId?: string }

/** One chat used by the SiBorg workspace and by the assistant drawer, so the mark and its states stay the same everywhere. */
export function SiBorgChat({ compact, onMood }: { compact?: boolean; onMood?: (m: SiBorgMood) => void }) {
  const s = useIms();
  const cmd = useCommands();
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, from: 'ai', text: 'Hello. I can read your stock, orders and suppliers. Ask me something, or pick a question below.' }]);
  const [q, setQ] = useState('');
  const [mood, setMoodState] = useState<SiBorgMood>('idle');
  const setMood = (m: SiBorgMood) => { setMoodState(m); onMood?.(m); };
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [msgs, busy]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Sound follows the visible state, never a timer: thinking -> insight/error cues fire on the transition itself.
  const prevMood = useRef<SiBorgMood>('idle');
  const offersProposal = useRef(false);
  useEffect(() => {
    const was = prevMood.current;
    prevMood.current = mood;
    if (was === mood) return;
    if (mood === 'listening' && was === 'idle') playSiborgListening();
    else if (was === 'thinking' && mood === 'insight') { if (offersProposal.current) playSiborgRecommend(); else playSiborgInsight(); }
    else if (was === 'thinking' && mood === 'error') playSiborgUnavailable();
  }, [mood]);

  const ask = (text: string) => {
    if (!text.trim() || busy) return;
    const id = Date.now();
    setMsgs((m) => [...m, { id, from: 'me', text }]);
    setQ(''); setBusy(true); setMood('thinking');
    timer.current = window.setTimeout(() => {
      const reply = answer(s, text);
      let proposalId: string | undefined;
      offersProposal.current = !!reply.proposal;
      if (reply.proposal) { const r = cmd.proposeFromChat(reply.proposal); if (r.ok) proposalId = r.value; }
      setMsgs((m) => [...m, { id: id + 1, from: 'ai', text: reply.text, reply, proposalId }]);
      setBusy(false); setMood(reply.unsupported ? 'error' : 'insight');
      // an insight settles first, then the mark leans toward the proposal it is offering
      if (reply.proposal) timer.current = window.setTimeout(() => setMood('recommend'), 900);
      else timer.current = window.setTimeout(() => setMood('idle'), 2200);
    }, 850);
  };

  return (
    <div className="chat-wrap" data-compact={compact}>
      <div className="chat" role="log" aria-live="polite" aria-label="Conversation with SiBorg">
        {msgs.map((m) => (
          <motion.div key={m.id} className={'msg ' + (m.from === 'me' ? 'me' : '')} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: dur.panel, ease }}>
            {m.from === 'ai' && <SiBorgIcon size={30} mood={m.id === msgs[msgs.length - 1].id ? mood : 'idle'} />}
            <div style={{ minWidth: 0 }}>
              <div className="bubble">{m.text}
                {m.reply?.bullets && <ul style={{ margin: '8px 0 0', paddingLeft: 18, listStyle: 'disc' }}>{m.reply.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}
                {m.reply?.links && <div className="actions" style={{ marginTop: 10 }}>{m.reply.links.map((l) => <Link key={l.to} to={l.to} className="btn btn-sm">{l.label}</Link>)}</div>}
              </div>
              {m.reply?.proposal && (
                <motion.div className="proposal" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: dur.panel, ease, delay: 0.32 }}>
                  <span className="connector" aria-hidden />
                  <div className="proposal-head"><b>{m.reply.proposal.title}</b><Chip tone="wine">Proposal, not done</Chip></div>
                  <div style={{ padding: '12px 14px' }} className="stack">
                    <p>{m.reply.proposal.reasoning}</p>
                    {m.reply.proposal.actions.map((a) => <div key={a.label} className="stat-line" style={{ display: 'block' }}><b>{a.label}</b><div className="muted">{a.detail}</div></div>)}
                    <Notice tone="wine">Nothing happens until a manager approves it. {m.proposalId && <Link className="link" to={'/agent/proposals'}>Review it in Approvals</Link>}</Notice>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        ))}
        {busy && <div className="msg"><SiBorgIcon size={30} mood="thinking" /><div className="bubble muted">Looking at your records…</div></div>}
        <div ref={end} />
      </div>
      <div className="prompts" style={{ margin: '10px 0' }}>{PROMPTS.map((p) => <button key={p} type="button" className="prompt" onClick={() => ask(p)} disabled={busy}>{p}</button>)}</div>
      <form className="row" style={{ flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <input className="input" value={q} onChange={(e) => { setQ(e.target.value); setMood(e.target.value ? 'listening' : 'idle'); }} onFocus={() => !busy && setMood(q ? 'listening' : 'idle')} onBlur={() => !busy && setMood('idle')} placeholder="Ask about stock, sales or suppliers" aria-label="Ask SiBorg" />
        <Button variant="primary" type="submit" icon aria-label="Send" disabled={busy || !q.trim()}><ArrowUp /></Button>
      </form>
    </div>
  );
}
