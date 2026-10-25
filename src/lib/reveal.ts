/**
 * One shared IntersectionObserver for every below-the-fold block. Elements reveal once;
 * if the observer is missing or throws, they are revealed immediately so nothing stays hidden.
 */
let io: IntersectionObserver | null = null;
const pending = new WeakMap<Element, () => void>();

export function observeReveal(el: Element, onReveal: () => void): () => void {
  if (typeof IntersectionObserver === 'undefined') { onReveal(); return () => {}; }
  try {
    io ??= new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        pending.get(e.target)?.();
        pending.delete(e.target);
        io?.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.01 });
    pending.set(el, onReveal);
    io.observe(el);
  } catch {
    onReveal();
  }
  return () => { pending.delete(el); io?.unobserve(el); };
}

export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
