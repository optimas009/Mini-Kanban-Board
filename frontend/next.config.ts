import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle with only the modules actually
  // imported, so the production image does not need node_modules at all.
  // Local `next dev` and `next start` are unaffected.
  output: 'standalone',
};

export default nextConfig;
