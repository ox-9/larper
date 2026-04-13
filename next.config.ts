import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GitHub Pages: static export + base path
  output: "export",
  basePath: "/larper",
  images: { unoptimized: true },

  // Optimize package imports to reduce bundle size
  experimental: {
    optimizePackageImports: [
      "@google/generative-ai",
      "@anthropic-ai/sdk",
      "openai",
      "exceljs",
    ],
  },

  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Compression
  compress: true,
};

export default nextConfig;