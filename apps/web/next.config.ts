import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@belmaster/shared', '@belmaster/db'],
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  poweredByHeader: false,
  // мултиплейърът минава през същия адрес като сайта (/socket.io → игровия сървър)
  skipTrailingSlashRedirect: true,
  async rewrites() {
    const game = process.env.GAME_INTERNAL_URL ?? 'http://localhost:4000';
    return [
      { source: '/socket.io', destination: `${game}/socket.io/` },
      { source: '/socket.io/:path*', destination: `${game}/socket.io/:path*` },
    ];
  },
  experimental: {
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default nextConfig;
