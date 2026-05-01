import type { NextConfig } from "next";

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

export default nextConfig;
