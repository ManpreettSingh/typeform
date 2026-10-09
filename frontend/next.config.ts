import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The isolated test stack (scripts/e2e-stack.mjs) builds into its own folder so it can run next to your dev server.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    // The repo root has its own package-lock.json (dev scripts); pin the app root here.
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
