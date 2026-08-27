import type { CSSProperties, ReactElement } from 'react';

/**
 * Inline geometric SVG flags for the 6-language switcher.
 *
 * Emoji regional-indicator flags (🇺🇸 🇰🇷 …) DO NOT render on Windows -- the
 * system font ships no flag glyphs, so on PC they collapse to bare letter
 * pairs (or nothing), which is exactly why the language dropdown looked
 * broken there. These hand-drawn SVGs render identically on every OS and
 * browser, at any size, with no external asset request.
 */

type FlagIconProps = {
  locale: string;
  className?: string;
  style?: CSSProperties;
};

function starPoints(cx: number, cy: number, r: number, rotDeg = 0): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const angle = (Math.PI / 5) * i - Math.PI / 2 + (rotDeg * Math.PI) / 180;
    const radius = i % 2 === 0 ? r : r * 0.382;
    pts.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(' ');
}

function Star({ cx, cy, r, rot = 0, fill = '#FFDE00' }: { cx: number; cy: number; r: number; rot?: number; fill?: string }) {
  return <polygon points={starPoints(cx, cy, r, rot)} fill={fill} />;
}

/** One 3-bar trigram (☰ solid / ☷ broken combinations) for the Korean flag. */
function Trigram({ x, y, rot, pattern }: { x: number; y: number; rot: number; pattern: [boolean, boolean, boolean] }) {
  const width = 4.2;
  const barH = 0.8;
  const gap = 0.62;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`} fill="#000">
      {pattern.map((solid, i) => {
        const yy = (i - 1) * (barH + gap) - barH / 2;
        if (solid) {
          return <rect key={i} x={-width / 2} y={yy} width={width} height={barH} />;
        }
        const seg = width * 0.42;
        return (
          <g key={i}>
            <rect x={-width / 2} y={yy} width={seg} height={barH} />
            <rect x={width / 2 - seg} y={yy} width={seg} height={barH} />
          </g>
        );
      })}
    </g>
  );
}

const US_STRIPE = 16 / 13;

const FLAGS: Record<string, ReactElement> = {
  en: (
    <>
      <rect width="24" height="16" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <rect key={i} y={i * US_STRIPE} width="24" height={US_STRIPE} fill="#B22234" />
      ))}
      <rect width="10.4" height={7 * US_STRIPE} fill="#3C3B6E" />
      {Array.from({ length: 12 }).map((_, i) => {
        const col = i % 4;
        const row = Math.floor(i / 4);
        return <circle key={i} cx={1.6 + col * 2.5} cy={1.4 + row * 2.7} r="0.55" fill="#fff" />;
      })}
    </>
  ),
  ko: (
    <>
      <rect width="24" height="16" fill="#fff" />
      <g transform="rotate(-33.7 12 8)">
        <circle cx="12" cy="8" r="5" fill="#0047A0" />
        <path d="M12,3 A5,5 0 0,1 12,13 A2.5,2.5 0 0,1 12,8 A2.5,2.5 0 0,0 12,3 Z" fill="#CD2E3A" />
      </g>
      <Trigram x={5.4} y={4} rot={33.7} pattern={[true, true, true]} />
      <Trigram x={5.4} y={12} rot={-33.7} pattern={[true, false, true]} />
      <Trigram x={18.6} y={4} rot={-33.7} pattern={[false, true, false]} />
      <Trigram x={18.6} y={12} rot={33.7} pattern={[false, false, false]} />
    </>
  ),
  et: (
    <>
      <rect width="24" height="16" fill="#0072CE" />
      <rect y={16 / 3} width="24" height={16 / 3} fill="#000" />
      <rect y={(16 / 3) * 2} width="24" height={16 / 3} fill="#fff" />
    </>
  ),
  ja: (
    <>
      <rect width="24" height="16" fill="#fff" />
      <circle cx="12" cy="8" r="4.8" fill="#BC002D" />
    </>
  ),
  zh: (
    <>
      <rect width="24" height="16" fill="#DE2910" />
      <Star cx={4} cy={4.2} r={2.7} />
      <Star cx={8.3} cy={1.7} r={0.95} rot={22} />
      <Star cx={10} cy={3.5} r={0.95} rot={45} />
      <Star cx={10} cy={5.9} r={0.95} rot={-20} />
      <Star cx={8.3} cy={7.6} r={0.95} rot={12} />
    </>
  ),
  es: (
    <>
      <rect width="24" height="16" fill="#AA151B" />
      <rect y="4" width="24" height="8" fill="#F1BF00" />
    </>
  ),
};

export function FlagIcon({ locale, className, style }: FlagIconProps) {
  return (
    <svg
      viewBox="0 0 24 16"
      className={className}
      style={{ display: 'block', overflow: 'hidden', ...style }}
      role="img"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      {FLAGS[locale] ?? FLAGS.en}
    </svg>
  );
}
