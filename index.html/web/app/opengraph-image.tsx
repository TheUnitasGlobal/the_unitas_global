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
 * renderer behind ImageResponse) does not support SVG <filter>/feGaussianBlur
 * or gradients, so the blur/glow filters and the deepVoid/triBg/holoGlobe
 * gradients on the source mark are flattened here to plain fills that read
 * the same at OG-card size. Secondary embellishments (the dashed hex ring,
 * the U-signature lightning bolt, the globe's highlight rings) are dropped
 * for the same reason the previous jewel-hexagon version dropped its glass
 * highlight ellipse -- fine detail that doesn't survive card scale anyway.
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
        <svg width="150" height="150" viewBox="174 64 152 152">
          <circle cx="250" cy="140" r="62" fill="#d4af37" opacity="0.14" />
          <g transform="translate(0, -40)">
            <polygon points="205,145 250,115 250,145 225,160" fill="#FFE47A" />
            <polygon points="250,115 295,145 275,160 250,145" fill="#E8C359" />
            <polygon points="205,215 205,145 225,160 225,200" fill="#C69A2B" />
            <polygon points="295,145 295,215 275,200 275,160" fill="#9A7017" />
            <polygon points="250,245 205,215 225,200 250,215" fill="#704D07" />
            <polygon points="295,215 250,245 250,215 275,200" fill="#4D3300" />
            <polygon points="225,160 250,145 275,160 275,200 250,215 225,200" fill="#011616" />
            <polygon points="250,154 278,206 222,206" fill="#001616" stroke="#00FFFF" strokeWidth="2.5" />
            <circle cx="250" cy="180" r="12.5" fill="#00e5e5" opacity="0.85" />
            <circle cx="250" cy="180" r="12.5" fill="none" stroke="#ffffff" strokeWidth="0.7" opacity="0.6" />
          </g>
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
