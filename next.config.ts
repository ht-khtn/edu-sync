import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
    // Optimize image formats with AVIF and WebP support
    formats: ["image/avif", "image/webp"],
    // Minimum cache time for images (24 hours)
    minimumCacheTTL: 86400,
    // Disable static imports optimization to allow dynamic image loading
    disableStaticImages: false,
    // Device sizes for responsive images (breakpoints in px)
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    // Image sizes for srcSet generation
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};

export default nextConfig;
