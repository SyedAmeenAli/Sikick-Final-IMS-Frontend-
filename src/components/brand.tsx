import logoDark from '@/assets/sikick-logo.svg';
import logoLight from '@/assets/sikick-logo-light.svg';
import siborgIcon from '@/assets/siborg-icon.svg';
import siborgGlyph from '@/assets/siborg-glyph.svg';
import siborgArtRaw from '@/assets/siborg-illustration.svg?raw';
import { useEffect, useRef } from 'react';

export function SikickLogo({ height = 26 }: { height?: number }) {
  return (
    <span className="logo" style={{ height }}>
      <img className="logo-l" src={logoDark} alt="Sikick" height={height} />
      <img className="logo-d" src={logoLight} alt="" aria-hidden height={height} />
    </span>
  );
}

export type SiBorgMood = 'idle' | 'listening' | 'thinking' | 'insight' | 'recommend' | 'error';

/** Everyday 2D identity. The ring changes with what SiBorg is doing, so state reads without text. */
export function SiBorgIcon({ size = 28, mood = 'idle' }: { size?: number; mood?: SiBorgMood }) {
  return (
    <span className="sib" data-mood={mood} style={{ width: size, height: size }}>
      <img src={siborgIcon} alt="" width={size} height={size} />
      <i className="sib-ring" aria-hidden />
    </span>
  );
}
export const SiBorgGlyph = ({ size = 40 }: { size?: number }) => <img src={siborgGlyph} alt="SiBorg" width={size} height={size * 0.95} style={{ width: size, height: 'auto' }} />;
/** The two eyes (glow and pill) are wrapped in one group so they can move on their own. The asset is our own file, not user input. */
const ART_MARKUP = siborgArtRaw.replace(/(<ellipse cx="114\.94"[^>]*\/><ellipse cx="137\.68"[^>]*\/><rect[^>]*\/><rect[^>]*\/>)/, '<g class="sib-eyes">$1</g>');

/**
 * Large moments only: hero of the SiBorg workspace, sign-in and empty states.
 * The eyes follow the pointer across the whole window (smoothly, a few pixels, so it reads as looking rather than sliding),
 * return to centre when the pointer leaves, and blink now and then. Reduced motion keeps them still and open.
 */
export function SiBorgArt({ width = 220, follow = true }: { width?: number; follow?: boolean }) {
  const host = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const eyes = host.current?.querySelector<SVGGElement>('.sib-eyes');
    if (!eyes || !follow || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const to = { x: 0, y: 0 }, at = { x: 0, y: 0 };
    let raf = 0, blink = 0;
    const tick = () => {
      at.x += (to.x - at.x) * 0.16; at.y += (to.y - at.y) * 0.16;
      eyes.style.transform = 'translate(' + at.x.toFixed(2) + 'px,' + at.y.toFixed(2) + 'px)';
      raf = Math.abs(to.x - at.x) + Math.abs(to.y - at.y) > 0.02 ? requestAnimationFrame(tick) : 0;
    };
    const aim = (x: number, y: number) => { to.x = x; to.y = y; if (!raf) raf = requestAnimationFrame(tick); };
    const move = (e: PointerEvent) => {
      const r = host.current!.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height * 0.48;
      // reach full turn at the far edge on either side, so left and right feel equally lively
      const dx = (e.clientX - cx) / Math.max(120, e.clientX < cx ? cx : window.innerWidth - cx);
      const dy = (e.clientY - cy) / Math.max(120, e.clientY < cy ? cy : window.innerHeight - cy);
      aim(Math.max(-1, Math.min(1, dx)) * 8, Math.max(-1, Math.min(1, dy)) * 6);
    };
    const leave = () => aim(0, 0);
    const scheduleBlink = () => {
      blink = window.setTimeout(() => {
        eyes.style.transformBox = 'fill-box'; eyes.style.transformOrigin = 'center';
        eyes.animate([{ scale: '1 1' }, { scale: '1 0.08' }, { scale: '1 1' }], { duration: 150, easing: 'ease-in-out' });
        scheduleBlink();
      }, 3200 + Math.random() * 3600);
    };
    window.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    scheduleBlink();
    return () => { window.removeEventListener('pointermove', move); document.documentElement.removeEventListener('pointerleave', leave); cancelAnimationFrame(raf); window.clearTimeout(blink); };
  }, [follow]);
  return <span ref={host} className="siborg-art" style={{ width }} dangerouslySetInnerHTML={{ __html: ART_MARKUP }} />;
}
