import type { NextConfig } from 'next';
import WebpackClientBoundaryPlugin from 'next-client-attr-webpack-plugin';

const nextConfig: NextConfig = {
  webpack(config) {
    config.plugins.push(new WebpackClientBoundaryPlugin());
    return config;
  },
};

export default nextConfig;
