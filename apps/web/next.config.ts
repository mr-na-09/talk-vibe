import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: process.env.GITHUB_PAGES === "true" ? "/talk-vibe" : "",
  images: {
    unoptimized: true,
  },
  cacheComponents: process.env.GITHUB_PAGES !== "true",
  partialPrefetching: process.env.GITHUB_PAGES !== "true",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
