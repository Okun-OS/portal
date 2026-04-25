import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@okun/ui', '@okun/db', '@okun/trpc'],
  experimental: {
    serverActions: {
      allowedOrigins: [
        '*.app.github.dev',
        '*.github.dev',
        'localhost:3001',
      ],
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.clerk.com' },
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '*.app.github.dev' },
    ],
  },
};

export default nextConfig;
