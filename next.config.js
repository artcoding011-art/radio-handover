/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'mammoth', 'xlsx'],
  },
}

module.exports = nextConfig
