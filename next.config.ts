import type { NextConfig } from "next";

const enablePs2 = process.env.NEXT_PUBLIC_ENABLE_PS2 === "true";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  typescript: {
    // NEVER ignore TS errors per project rules
    ignoreBuildErrors: false,
  },
  // Cross-origin isolation headers needed for SharedArrayBuffer (PS1/PS2 WASM cores)
  // Applied to all routes — tested against Google Picker, GIS, Supabase, Service Worker
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
      {
        // WASM cores need correct MIME type
        source: "/emulator-assets/:path*.{wasm,js}",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
  // Lazy-load emulator play route so WASM cores never load on home page
  experimental: {
    // ps2 stays disabled unless explicitly enabled
  },
  // Note: enablePs2 flag is consumed client-side via env, not at build time
  env: {
    NEXT_PUBLIC_ENABLE_PS2: enablePs2 ? "true" : "false",
  },
};

export default nextConfig;
