import NodePolyfillPlugin from 'node-polyfill-webpack-plugin';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  output: 'standalone',
  webpack: (config) => {
    config.plugins = config.plugins ?? [];
    config.plugins.push(new NodePolyfillPlugin({ includeAliases: ['crypto'] }));
    return config;
  },
};

export default nextConfig;

