import logoDark from '@/assets/sikick-logo.svg';
import logoLight from '@/assets/sikick-logo-light.svg';
import siborgIcon from '@/assets/siborg-icon.svg';
import siborgGlyph from '@/assets/siborg-glyph.svg';
import siborgArt from '@/assets/siborg-illustration.svg';

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
/** Large moments only: hero of the SiBorg workspace and empty states. */
export const SiBorgArt = ({ width = 220 }: { width?: number }) => <img src={siborgArt} alt="SiBorg" style={{ width, height: 'auto' }} />;
