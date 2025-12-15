import fs from "fs";
import path from "path";
import type { NextConfig } from "next";
import packageJson from "./package.json" assert { type: "json" };

function readGeneratedVersion(): string | null {
  const generatedPath = path.join(__dirname, "configs", "generated", "version.json");
  if (!fs.existsSync(generatedPath)) return null;
  try {
    const raw = fs.readFileSync(generatedPath, "utf8");
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? null;
  } catch {
    return null;
  }
}

function resolveAppVersion(): string {
  // Prefer generated version (created by scripts/inject-version.cjs)
  const generated = readGeneratedVersion();
  if (generated) return generated;

  const pkgVersion = (packageJson as { version?: string }).version ?? "0.0.0";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const shortSha = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT || "").slice(0, 7);
  return [pkgVersion, date, shortSha].filter(Boolean).join("-");
}

const APP_VERSION = resolveAppVersion();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
  },
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
