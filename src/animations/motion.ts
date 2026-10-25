/**
 * Shared motion tokens. Durations are in seconds for the `motion` library and
 * mirror the CSS custom properties in theme/tokens.css.
 */
import type { Transition, Variants } from 'motion/react';

export const ease = [0.22, 0.8, 0.24, 1] as const;
export const easeInOut = [0.65, 0, 0.35, 1] as const;

export const dur = {
  micro: 0.15,
  hover: 0.17,
  menu: 0.2,
  route: 0.22,
  panel: 0.26,
  drawer: 0.3,
  tab: 0.28,
  section: 0.44,
  chart: 0.65,
} as const;
export const stagger = 0.04;

export const t = (d: number): Transition => ({ duration: d, ease });

/** A group of related items enters together: parent fades up, children follow on a short stagger. */
export const group: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.15, ease, staggerChildren: 0.055, delayChildren: 0.02 } },
};
export const item: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease } },
};

/** Major feature panel: edge resolves, the panel rises 14 px, blur clears. Used on a few panels per page, never on lists. */
export const glassItem: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.985, filter: 'blur(6px)' },
  show: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: { duration: 0.5, ease }, transitionEnd: { filter: 'none' } },
};

export const menu: Variants = {
  hidden: { opacity: 0, y: -6, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: dur.menu, ease } },
  exit: { opacity: 0, y: -4, scale: 0.985, pointerEvents: 'none', transition: { duration: 0.14, ease } },
};
