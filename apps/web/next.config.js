/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@financy/shared"],
  output: 'standalone',
};

module.exports = nextConfig;
