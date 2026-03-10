/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Type checking done in CI, not during build
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}
module.exports = nextConfig
