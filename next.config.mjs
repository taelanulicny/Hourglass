/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  images: { unoptimized: true },
  // Only use static export when building for Capacitor (not on Vercel)
  // Vercel needs serverless functions for API routes
  ...(process.env.BUILD_FOR_CAPACITOR === 'true' ? {
    output: 'export', // Static export for Capacitor
    distDir: 'out', // Output directory for static export
  } : {}),
};

export default nextConfig;
