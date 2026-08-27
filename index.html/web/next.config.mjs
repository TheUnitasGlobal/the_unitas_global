import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Fixes "Cannot find module './vendor-chunks/three.js'" -- three.js and
  // its React Three Fiber wrappers ship ESM that Next's default webpack
  // config leaves untranspiled/unbundled as external node_modules code,
  // which can produce a broken vendor-chunk reference. transpilePackages
  // forces Next's compiler to bundle them properly instead. @react-three/drei
  // is included alongside @react-three/fiber since it's the same
  // ecosystem and hits the same resolution path (see components/canvas/).
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],

  // Low-Memory Armor -- tuned for a low-spec dev machine, verified against
  // the installed Next.js 14.2.x (via Context7, not assumed from memory:
  // experimental.webpackMemoryOptimizations exists but is Next.js >= 15
  // only, so it is deliberately NOT used here).
  experimental: {
    // Runs the Webpack compiler in a separate worker process during builds,
    // trading a bit of build time for a smaller main-process heap. Next
    // enables this by default in 14.1+ *only* when there's no custom
    // `webpack()` function -- adding one below opts back out of that
    // default, so it's set explicitly to keep it on.
    webpackBuildWorker: true,
  },
  // Dev-server page cache: dispose compiled pages sooner and keep fewer of
  // them resident (defaults are 60s / 5 pages) so switching between the 11
  // module routes during development doesn't accumulate compiled output for
  // routes you're no longer looking at.
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  // Caps the in-memory ISR/data cache (default 50MB) -- this app has no
  // heavy per-route cached payloads, so a smaller ceiling costs nothing.
  cacheMaxMemorySize: 25 * 1024 * 1024,
  webpack: (config, { dev }) => {
    // In-memory webpack cache trades RAM for faster incremental rebuilds;
    // worth it in dev, not worth it for a one-shot production build.
    if (config.cache && !dev) {
      config.cache = Object.freeze({ type: 'memory' });
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
