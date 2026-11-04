import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@belmaster/shared', '@belmaster/db'],
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default nextConfig;
