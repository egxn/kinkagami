import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import { devServerOptions } from "../../setup/dev-https.mjs";
import { readEmbeddedData } from "./tools/embeddedData";

const here = path.dirname(fileURLToPath(import.meta.url));

const EMBEDDED_ROOT = path.resolve(here, "../embedded");

/** Model files live once, in the embedded app; web serves/copies what it uses. */
const MODELS_SRC = path.resolve(here, "../embedded/public/models/movenet");
const MODELS_URL_PREFIX = "/models/movenet";

const CONTENT_TYPES: Record<string, string> = {
  ".json": "application/json",
  ".bin": "application/octet-stream",
};

/**
 * Serves MoveNet weights from the embedded app in dev and copies them into
 * `dist/models/movenet` on build. When `external` is true (a CDN base URL is
 * configured) nothing is served or bundled: the app downloads from the CDN.
 */
function sharedMovenetModels(external: boolean): Plugin {
  let outDir = path.resolve(here, "dist");

  return {
    name: "kgm-shared-movenet-models",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      if (external) return;
      server.middlewares.use(MODELS_URL_PREFIX, (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? "/").split("?")[0]);
        const file = path.join(MODELS_SRC, rel);
        const outside = path.relative(MODELS_SRC, file);
        if (
          outside.startsWith("..") ||
          path.isAbsolute(outside) ||
          !fs.existsSync(file) ||
          !fs.statSync(file).isFile()
        ) {
          next();
          return;
        }
        res.setHeader(
          "Content-Type",
          CONTENT_TYPES[path.extname(file)] ?? "application/octet-stream",
        );
        fs.createReadStream(file).pipe(res);
      });
    },
    writeBundle() {
      if (external) return;
      fs.cpSync(MODELS_SRC, path.join(outDir, MODELS_URL_PREFIX), {
        recursive: true,
      });
    },
  };
}

/**
 * Dev only: exposes the embedded app's on-disk data (LevelDB + seed JSON) at
 * `/__kgm/embedded-data` so the web client can copy it into its own IndexedDB.
 */
function embeddedDataDev(): Plugin {
  return {
    name: "kgm-embedded-data-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__kgm/embedded-data", async (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        try {
          res.end(JSON.stringify(await readEmbeddedData(EMBEDDED_ROOT)));
        } catch (error) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(error) }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // .env.production sets the CDN for builds; dev stays local unless overridden
  // (VITE_KGM_MODELS_BASE_URL=... or `pnpm dev:web:cdn`).
  const env = loadEnv(mode, here, "VITE_");
  const external = Boolean(
    process.env.VITE_KGM_MODELS_BASE_URL || env.VITE_KGM_MODELS_BASE_URL,
  );

  return {
    server: { port: 5174, ...devServerOptions() },
    preview: { port: 4174, ...devServerOptions() },
    plugins: [
      react(),
      sharedMovenetModels(external),
      embeddedDataDev(),
      VitePWA({
        registerType: "autoUpdate",
        manifest: false,
        workbox: {
          // App shell only; weights are cached on demand (see ModelGate).
          globPatterns: ["**/*.{js,css,html,ico,svg,png,woff2}"],
          globIgnores: ["models/**"],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          clientsClaim: true,
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.includes("/models/"),
              handler: "CacheFirst",
              options: {
                // Must match MODEL_CACHE_NAME in src/models/modelCache.ts
                cacheName: "kgm-web-models-v1",
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
  };
});
