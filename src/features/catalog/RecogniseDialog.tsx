import { useEffect, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { Button, KV, Notice } from '@/components/ui/primitives';
import { Dialog } from '@/components/ui/Overlay';
import { SiBorgIcon } from '@/components/brand';

/** Product recognition from a photo. The local adapter returns a fixed example so the flow is reviewable; no image leaves the browser. */
export function RecogniseDialog({ open, onClose, onUse }: { open: boolean; onClose: () => void; onUse: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<'pick' | 'thinking' | 'done'>('pick');

  useEffect(() => { if (!open) { setUrl(null); setPhase('pick'); } }, [open]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => {
    if (phase !== 'thinking') return;
    const id = window.setTimeout(() => setPhase('done'), 1100);
    return () => window.clearTimeout(id);
  }, [phase]);

  return (
    <Dialog open={open} onClose={onClose} title="Recognise a product from a photo" footer={
      <><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={phase !== 'done'} onClick={onUse}>Use these details</Button></>}>
      <div className="stack">
        <Notice tone="wine" title="Prototype">The photo stays in your browser and the result below is an example. The live system sends it to the image-analysis endpoint and returns name, brand, style and quality tier for you to confirm.</Notice>
        {!url ? (
          <label className="drop" style={{ cursor: 'pointer', display: 'block' }}>
            <ImagePlus size={26} color="var(--wine)" aria-hidden /><div style={{ fontWeight: 600, marginTop: 6 }}>Choose a product photo</div><div className="muted">PNG or JPG</div>
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setUrl(URL.createObjectURL(f)); setPhase('thinking'); } }} />
          </label>
        ) : (
          <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 16 }}>
            <img src={url} alt="Selected product" style={{ width: 130, height: 130, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--line)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row" style={{ gap: 9, marginBottom: 10 }}><SiBorgIcon size={26} mood={phase === 'thinking' ? 'thinking' : 'insight'} /><b>{phase === 'thinking' ? 'SiBorg is looking at the photo…' : 'Suggested details'}</b></div>
              {phase === 'done' && <KV rows={[['Name', 'Steel bottle 1L'], ['Brand', 'Hearth'], ['Style', 'Insulated, matte finish'], ['Quality tier', 'Standard'], ['Category', 'Home']]} />}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
