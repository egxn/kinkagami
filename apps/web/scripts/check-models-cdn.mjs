// Verifies the configured models CDN actually serves every MoveNet file the web
// app needs, with CORS enabled. Usage: pnpm check:models-cdn [baseUrl]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function readBaseUrl() {
  const arg = process.argv[2] ?? process.env.VITE_KGM_MODELS_BASE_URL;
  if (arg) return arg;
  const file = path.resolve(here, "../.env.production");
  const match = fs
    .readFileSync(file, "utf8")
    .match(/^VITE_KGM_MODELS_BASE_URL=(.+)$/m);
  if (!match) throw new Error("No VITE_KGM_MODELS_BASE_URL configured");
  return match[1].trim();
}

const base = readBaseUrl().replace(/\/+$/, "");
let failures = 0;

async function check(url) {
  try {
    const res = await fetch(url, {
      headers: { Origin: "https://example.com" },
    });
    const cors = res.headers.get("access-control-allow-origin");
    const ok = res.ok && cors;
    console.log(
      `${ok ? "OK  " : "FAIL"} ${res.status} cors=${cors ?? "none"} ${url}`,
    );
    if (!ok) failures += 1;
    return res.ok ? res : null;
  } catch (error) {
    console.log(`FAIL ${url} (${error.message})`);
    failures += 1;
    return null;
  }
}

console.log(`Checking models CDN: ${base}\n`);
for (const version of ["lightning", "thunder"]) {
  const modelUrl = `${base}/movenet/${version}/model.json`;
  const res = await check(modelUrl);
  if (!res) continue;
  const manifest = (await res.json()).weightsManifest ?? [];
  for (const group of manifest) {
    for (const shard of group.paths ?? []) {
      await check(`${base}/movenet/${version}/${shard}`);
    }
  }
}

if (failures > 0) {
  console.error(
    `\n${failures} file(s) failed. Push the models to the CDN source (or fix the URL) before deploying.`,
  );
  process.exit(1);
}
console.log("\nAll model files reachable.");
