import type { NextConfig } from "next";
import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  // Disable in development to avoid caching issues during local dev
  disable: process.env.NODE_ENV === 'development',
})

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/month',
        destination: '/week',
        permanent: true,
      },
    ]
  },
};

export default withSerwist(nextConfig)
