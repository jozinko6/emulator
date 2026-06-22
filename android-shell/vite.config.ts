import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = resolve(__dirname, "..");

/**
 * Vite config pre Android shell.
 *
 * Tento config sa spúšťa z `android-shell/` (cwd = android-shell).
 * Výstup ide do `dist/` (relatívne k cwd = android-shell/dist/).
 *
 * Alias `@/` smeruje na projectRoot/src (zdieľané moduly),
 * `@shell/` na android-shell/src.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(projectRoot, "src"),
      "@shell": resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "state-vendor": ["zustand"],
          "archive-vendor": ["fflate", "libarchive.js"],
          "idb-vendor": ["idb"],
        },
      },
    },
  },
  define: {
    "process.env.NEXT_PUBLIC_ENABLE_PS2": JSON.stringify("false"),
    "process.env.NEXT_PUBLIC_APP_NAME": JSON.stringify("Jaňo še chce bavkac"),
    "process.env.NEXT_PUBLIC_ANDROID_DOWNLOAD_ENABLED": JSON.stringify("false"),
    "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(""),
    "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": JSON.stringify(""),
    "process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID": JSON.stringify(""),
    "process.env.NEXT_PUBLIC_GOOGLE_API_KEY": JSON.stringify(""),
    "process.env.NEXT_PUBLIC_GOOGLE_APP_ID": JSON.stringify(""),
  },
  server: {
    port: 5173,
    host: true,
  },
});
