import { useEffect, useRef } from 'react';
import { playPanelClose, playPanelOpen } from '@/lib/sound';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { SiBorgIcon } from '@/components/brand';
import { SiBorgChat } from '@/features/siborg/SiBorgChat';
import { dur, ease } from '@/animations/motion';
import { useCommands, useIms } from '@/services';

/** The persistent assistant. It enters from the right; the navigation drawer enters from the left. Hidden on the SiBorg page itself and on the POS till. */
export function Assistant() {
  const s = useIms();
  const cmd = useCommands();
  const loc = useLocation();
  const ref = useRef<HTMLElement>(null);
  const open = s.assistantOpen;
  const fab = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const setOpen = (v: boolean) => { if (v !== open) (v ? playPanelOpen : playPanelClose)(); cmd.setAssistantOpen(v); };
  const hide = loc.pathname === '/agent/chat' || loc.pathname === '/pos';

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', k);
    window.setTimeout(() => ref.current?.querySelector<HTMLElement>('input')?.focus({ preventScroll: true }), 120);
    return () => document.removeEventListener('keydown', k);
  }, [open, cmd]);
  // closing returns focus to the launcher
  useEffect(() => { if (wasOpen.current && !open) window.setTimeout(() => fab.current?.focus({ preventScroll: true }), 0); wasOpen.current = open; }, [open]);

  return createPortal(
    <>
      {!hide && !open && <button type="button" ref={fab} className="assistant-fab" aria-label="Ask SiBorg" aria-expanded={false} onClick={() => setOpen(true)}><SiBorgIcon size={40} /></button>}
      <AnimatePresence>
        {open && !hide && (
          <motion.aside key="a" ref={ref} className="assistant" role="complementary" aria-label="SiBorg assistant" initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ duration: dur.drawer, ease }}>
            <div className="assistant-head"><span className="row" style={{ gap: 10 }}><SiBorgIcon size={30} /><b>SiBorg</b></span><button type="button" className="icon-btn" aria-label="Close assistant" onClick={() => setOpen(false)}><X /></button></div>
            <div className="assistant-body"><SiBorgChat compact /></div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
}
