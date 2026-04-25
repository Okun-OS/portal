import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@okun/ui', '@okun/db', '@okun/trpc'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.clerk.com' },
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
    ],
  },
};

export default nextConfig;
