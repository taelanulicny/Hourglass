/** @type {import('next').NextConfig} */
const nextConfig = {
  // Do NOT set output: 'export' when using API routes
  // Let Netlify plugin build serverless functions
  trailingSlash: true,
  images: {
    unoptimized: true
  }
};

export default nextConfig;
