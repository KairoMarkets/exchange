/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  // Remove standalone for Amplify - it hosts the full Next.js app
  webpack: (config) => {
    // Add explicit path aliases for Amplify build
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/utils': path.resolve(__dirname, './src/utils'),
    };
    
    config.resolve.fallback = {
      fs: false,
      net: false,
      tls: false,
    };
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
  images: {
    domains: ['ipfs.io', 'gateway.pinata.cloud'],
  },
  env: {
    NEXT_PUBLIC_SOLANA_NETWORK: process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet',
    NEXT_PUBLIC_RPC_ENDPOINT: process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.devnet.solana.com',
    NEXT_PUBLIC_KAIRO_DEVNET_ESCROW_WALLET: process.env.NEXT_PUBLIC_KAIRO_DEVNET_ESCROW_WALLET || '',
  },
};

module.exports = nextConfig;
