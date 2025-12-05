/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  images: { unoptimized: true },
  output: 'export', // Static export for Capacitor
  distDir: 'out', // Output directory for static export
};

export default nextConfig;
