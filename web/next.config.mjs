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
};

export default withNextIntl(nextConfig);
