import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@belmaster/shared', '@belmaster/db'],
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default nextConfig;
