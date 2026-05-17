import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === "pwa" &&
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["icons/*.png", "icons/*.svg"],
        manifest: {
          name: "Kinkagami",
          short_name: "Kinkagami",
          description: "AI-powered pose detection fitness trainer",
          theme_color: "#0a0a0a",
          background_color: "#0a0a0a",
          display: "standalone",
          orientation: "any",
          start_url: "/",
          icons: [
            {
              src: "icons/pwa-64x64.png",
              sizes: "64x64",
              type: "image/png",
            },
            {
              src: "icons/pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "icons/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "icons/maskable-icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          // Precache app shell — JS, CSS, HTML, fonts, WASM
          globPatterns: ["**/*.{js,css,html,ico,svg,png,woff2,wasm}"],
          // Exclude large ML model files from precache — cached at runtime on first use
          globIgnores: ["models/**"],
          // TF.js bundles exceed workbox's 2 MiB default limit
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          runtimeCaching: [
            {
              // Cache ML models with CacheFirst — large, rarely change
              urlPattern: ({ url }) => url.pathname.startsWith("/models/"),
              handler: "CacheFirst",
              options: {
                cacheName: "kgm-models-v1",
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
  ].filter(Boolean),
  define: {
    global: "globalThis",
  },
  build: {
    rollupOptions: {
      external: ["leveldown", "node-gyp-build"],
    },
  },
  server: {
    proxy: {
      "/api/videos": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/videos": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
}));
