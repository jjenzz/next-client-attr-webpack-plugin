import type { NextConfig } from 'next';
import createClientAttrPlugin from 'next-client-attr-webpack-plugin';

const nextConfig: NextConfig = {
  eslint: {},
  webpack(config) {
    config.plugins.push(createClientAttrPlugin());
    return config;
  },
};

export default nextConfig;
