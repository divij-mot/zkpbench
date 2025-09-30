/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Disable ESLint during builds (errors won't block deployment)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Also ignore TypeScript errors during builds if needed
    ignoreBuildErrors: false,
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', '*.vercel.app']
    }
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Handle WASM files for bb.js
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true
    };

    // Handle .wasm files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async'
    });

    // Handle Node.js modules that need to run on client side
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };
    
    // Suppress optional dependencies that aren't needed for web
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
      'pino-pretty': false,
    };

    // Ignore optional dependency warnings
    config.ignoreWarnings = [
      { module: /node_modules\/@metamask\/sdk/ },
      { module: /node_modules\/@walletconnect/ },
      { module: /node_modules\/pino/ },
    ];

    // Add polyfills for browser APIs that wallet libraries expect
    if (isServer) {
      config.plugins.push(
        new webpack.DefinePlugin({
          'global.indexedDB': 'undefined',
        })
      );
    }

    return config;
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID || '84532',
    NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org',
  },

  // Headers for WASM and API calls
  async headers() {
    return [
      {
        // Apply strict COEP/COOP only to the prove page where WASM is used
        source: '/prove',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp'
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin'
          }
        ]
      },
      {
        // All other pages use permissive headers for wallet compatibility
        source: '/((?!prove).*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups'
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;