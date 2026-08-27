import { ImageResponse } from 'next/og';

/**
 * Edge runtime, not Node -- @vercel/og's Node implementation resolves its
 * bundled font/wasm assets via `path.join(import.meta.url, ...)`, which
 * mangles the `file://` URL on Windows (backslashes replace `/`, producing
 * an invalid URL `fileURLToPath` rejects) and breaks `next build`'s static
 * prerender of this route. The edge implementation inlines those assets
 * instead of resolving them from disk, so it doesn't hit that bug.
 */
export const runtime = 'edge';

export const alt = 'UNITAS';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Simplified re-render of public/assets/svg/unitas-mark.svg -- Satori (the
 * renderer behind ImageResponse) does not support SVG <filter>/feGaussianBlur,
 * so the blur/glow filters on the source mark are dropped here in favor of
 * plain opacity fills that read the same at OG-card size.
 */
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#030305',
        }}
      >
        <svg width="150" height="150" viewBox="0 0 200 200">
          <circle cx="100" cy="94" r="80" fill="#d4af37" opacity="0.16" />
          <polygon points="100,8 100,28 153.7,59" fill="#e8c765" />
          <polygon points="100,8 153.7,59 153.7,121" fill="#d4af37" />
          <polygon points="100,8 153.7,121 100,152" fill="#a8842a" />
          <polygon points="100,8 100,152 46.3,121" fill="#8a6a1f" />
          <polygon points="100,8 46.3,121 46.3,59" fill="#b8912e" />
          <polygon points="100,8 46.3,59 100,28" fill="#f5d98a" />
          <polygon points="100,172 100,152 153.7,121" fill="#7a5c1a" />
          <polygon points="100,172 153.7,121 153.7,59" fill="#58400f" />
          <polygon points="100,172 153.7,59 100,28" fill="#6b5015" />
          <polygon points="100,172 100,28 46.3,59" fill="#8a6a1f" />
          <polygon points="100,172 46.3,59 46.3,121" fill="#a8842a" />
          <polygon points="100,172 46.3,121 100,152" fill="#b8912e" />
          <polygon
            points="100,28 153.7,59 153.7,121 100,152 46.3,121 46.3,59"
            fill="none"
            stroke="#00f3ff"
            strokeWidth="1.4"
          />
          <circle cx="100" cy="90" r="27" fill="#00f3ff" opacity="0.55" />
          <circle cx="100" cy="90" r="27" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.6" />
        </svg>
        <div
          style={{
            marginTop: 40,
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: 14,
            color: '#f2e6c2',
            display: 'flex',
          }}
        >
          UNITAS
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 26,
            letterSpacing: 4,
            color: 'rgba(226,232,240,0.7)',
            display: 'flex',
          }}
        >
          THE UNITAS GLOBAL OÜ
        </div>
      </div>
    ),
    { ...size }
  );
}
