/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

/**
 * Static export config tuned for Capacitor Android (webDir: "out").
 *
 * Constraints of `output: "export"`:
 * - No Image Optimization server → images.unoptimized
 * - No ISR / dynamic server routes
 * - trailingSlash helps file:// and Capacitor path resolution
 */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  poweredByHeader: false,
  reactStrictMode: true,

  // Required for static export (no Next image optimizer at runtime)
  images: {
    unoptimized: true,
  },

  // Drop noisy logs from the client bundle in production APK builds
  compiler: {
    removeConsole: isProd
      ? { exclude: ["error", "warn"] }
      : false,
  },

  // Tree-shake barrel imports (smaller client JS for mobile WebView)
  experimental: {
    optimizePackageImports: [
      "react-icons",
      "date-fns",
      "recharts",
      "framer-motion",
      "axios",
    ],
  },

  // Prefer fewer, more cacheable static assets in `out/`
  // (App Router static export still emits hashed chunks under _next/static)
  generateBuildId: async () => {
    // Stable-ish id from package version helps APK cache behavior across CI builds
    return process.env.BUILD_ID || "storybook-1.1.0";
  },

  // Fail the build if you accidentally import server-only APIs into a page
  // that cannot be statically rendered.
  typescript: {
    // Keep type errors visible during APK builds; set true only as last resort
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
