import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: config => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding')
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    }
    // Ignore phosphor-icons webcomponents to prevent chunk loading errors
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];
    config.module.rules.push({
      test: /node_modules\/@phosphor-icons\/webcomponents/,
      use: 'null-loader'
    });
    return config
  },
  transpilePackages: ['@reown/appkit', '@reown/appkit-adapter-ethers']
};

export default nextConfig;
