import type { CSSProperties, ReactElement } from 'react';
import type { routing } from '@/i18n/routing';

type Locale = (typeof routing.locales)[number];

/**
 * Inline SVG flags for the 6 supported locales. Emoji regional-indicator
 * flags (🇺🇸 …) do NOT render as flags on Windows Chrome/Edge and many
 * Android browsers -- they fall back to two letters -- which is the "flags
 * missing / unclear" bug. These vector marks render identically everywhere,
 * stay razor sharp at any size, and take a crisp hairline border from the
 * wrapper. Deliberately simplified silhouettes (recognizable, not
 * heraldically exact) so each stays legible at ~16-24px.
 */

const VIEWBOX = '0 0 20 14';

function UsFlag() {
  const stripes = Array.from({ length: 7 }, (_, i) => (
    <rect key={i} x="0" y={i * 2} width="20" height="1" fill="#fff" />
  ));
  return (
    <g>
      <rect width="20" height="14" fill="#b22234" />
      {stripes}
      <rect width="9" height="7" fill="#3c3b6e" />
      <g fill="#fff">
        {[1.2, 3.6, 6, 8.4].map((x) =>
          [1.2, 3.4, 5.6].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="0.5" />),
        )}
      </g>
    </g>
  );
}

function KrFlag() {
  return (
    <g>
      <rect width="20" height="14" fill="#fff" />
      {/* taegeuk: full red disc, blue S-half carved by two 1.7r lobes -- no clipPath (ids would collide across instances) */}
      <circle cx="10" cy="7" r="3.4" fill="#c60c30" />
      <path
        d="M10 3.6a1.7 1.7 0 0 1 0 3.4 1.7 1.7 0 0 0 0 3.4 3.4 3.4 0 0 1 0-6.8Z"
        fill="#003478"
      />
      <g stroke="#000" strokeWidth="0.5" strokeLinecap="round">
        <line x1="3.4" y1="4.2" x2="5.1" y2="5.9" />
        <line x1="3.4" y1="9.8" x2="5.1" y2="8.1" />
        <line x1="16.6" y1="4.2" x2="14.9" y2="5.9" />
        <line x1="16.6" y1="9.8" x2="14.9" y2="8.1" />
      </g>
    </g>
  );
}

function EeFlag() {
  return (
    <g>
      <rect width="20" height="4.667" fill="#0072ce" />
      <rect y="4.667" width="20" height="4.666" fill="#000" />
      <rect y="9.333" width="20" height="4.667" fill="#fff" />
    </g>
  );
}

function JpFlag() {
  return (
    <g>
      <rect width="20" height="14" fill="#fff" />
      <circle cx="10" cy="7" r="4" fill="#bc002d" />
    </g>
  );
}

function CnFlag() {
  return (
    <g>
      <rect width="20" height="14" fill="#de2910" />
      <g fill="#ffde00">
        <circle cx="4" cy="4" r="2.2" />
        <circle cx="8" cy="1.8" r="0.7" />
        <circle cx="9.4" cy="3.6" r="0.7" />
        <circle cx="9.4" cy="6" r="0.7" />
        <circle cx="8" cy="7.6" r="0.7" />
      </g>
    </g>
  );
}

function EsFlag() {
  return (
    <g>
      <rect width="20" height="14" fill="#aa151b" />
      <rect y="3.5" width="20" height="7" fill="#f1bf00" />
    </g>
  );
}

const FLAGS: Record<Locale, () => ReactElement> = {
  en: UsFlag,
  ko: KrFlag,
  et: EeFlag,
  ja: JpFlag,
  zh: CnFlag,
  es: EsFlag,
};

export function FlagIcon({
  locale,
  size = 20,
  className = '',
}: {
  locale: Locale;
  size?: number;
  className?: string;
}) {
  const Flag = FLAGS[locale] ?? FLAGS.en;
  const style: CSSProperties = {
    width: size,
    height: Math.round((size * 14) / 20),
  };
  return (
    <span
      className={`inline-block shrink-0 overflow-hidden rounded-[2px] ring-1 ring-white/20 ${className}`}
      style={style}
      aria-hidden="true"
    >
      <svg viewBox={VIEWBOX} width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <Flag />
      </svg>
    </span>
  );
}
