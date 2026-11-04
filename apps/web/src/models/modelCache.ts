import type { MoveNetVersion } from "@kgm/core";

/** Must match the Workbox `cacheName` in vite.config.ts. */
export const MODEL_CACHE_NAME = "kgm-web-models-v1";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const getModelsBaseUrl = (): string => {
  const configured = import.meta.env.VITE_KGM_MODELS_BASE_URL as
    | string
    | undefined;
  return configured ? trimTrailingSlash(configured) : "/models";
};

export const getMoveNetModelUrl = (version: MoveNetVersion): string =>
  `${getModelsBaseUrl()}/movenet/${version}/model.json`;

interface WeightsManifestEntry {
  paths?: unknown;
}

/** Absolute-or-rooted URLs of every weight shard referenced by a model.json. */
export const extractShardUrls = (
  modelJsonUrl: string,
  modelJson: unknown,
): string[] => {
  const dir = modelJsonUrl.slice(0, modelJsonUrl.lastIndexOf("/") + 1);
  const manifest = (modelJson as { weightsManifest?: WeightsManifestEntry[] })
    ?.weightsManifest;
  if (!Array.isArray(manifest)) return [];

  const urls: string[] = [];
  for (const group of manifest) {
    if (!Array.isArray(group.paths)) continue;
    for (const path of group.paths) {
      if (typeof path === "string") urls.push(`${dir}${path}`);
    }
  }
  return urls;
};

export interface DownloadProgress {
  /** 0–1 across all files. */
  ratio: number;
  fileIndex: number;
  fileCount: number;
  loadedBytes: number;
}

/** Overall ratio from completed files plus the in-flight file's ratio. */
export const computeProgressRatio = (
  completedFiles: number,
  fileCount: number,
  currentFileRatio: number,
): number => {
  if (fileCount <= 0) return 1;
  const clamped = Math.min(1, Math.max(0, currentFileRatio));
  return Math.min(1, (completedFiles + clamped) / fileCount);
};

export const isModelCacheSupported = (): boolean =>
  typeof caches !== "undefined";

/** True when model.json and all its shards are already in the model cache. */
export async function isModelCached(modelJsonUrl: string): Promise<boolean> {
  if (!isModelCacheSupported()) return false;
  const cache = await caches.open(MODEL_CACHE_NAME);
  const cachedJson = await cache.match(modelJsonUrl);
  if (!cachedJson) return false;

  const shards = extractShardUrls(modelJsonUrl, await cachedJson.json());
  if (shards.length === 0) return false;
  const hits = await Promise.all(shards.map((url) => cache.match(url)));
  return hits.every(Boolean);
}

async function fetchWithProgress(
  url: string,
  onChunk: (loaded: number, total: number | null) => void,
  signal?: AbortSignal,
): Promise<Response> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`No se pudo descargar ${url} (${response.status})`);
  }

  const lengthHeader = response.headers.get("content-length");
  const total = lengthHeader ? Number(lengthHeader) : null;

  if (!response.body) {
    const blob = await response.blob();
    onChunk(blob.size, blob.size);
    return new Response(blob, { headers: response.headers });
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value as Uint8Array<ArrayBuffer>);
    loaded += value.byteLength;
    onChunk(loaded, total);
  }
  return new Response(new Blob(chunks), { headers: response.headers });
}

/**
 * Downloads model.json and every shard into the model cache (the same cache
 * the service worker serves from), reporting progress. Resolves immediately
 * when everything is already cached.
 */
export async function downloadModel(
  modelJsonUrl: string,
  onProgress: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!isModelCacheSupported()) return;
  if (await isModelCached(modelJsonUrl)) return;

  const cache = await caches.open(MODEL_CACHE_NAME);

  const jsonResponse = await fetchWithProgress(modelJsonUrl, () => {}, signal);
  const modelJson = await jsonResponse.clone().json();
  const shardUrls = extractShardUrls(modelJsonUrl, modelJson);
  const fileCount = shardUrls.length + 1;

  await cache.put(modelJsonUrl, jsonResponse);
  let loadedBytes = 0;
  onProgress({
    ratio: computeProgressRatio(1, fileCount, 0),
    fileIndex: 1,
    fileCount,
    loadedBytes,
  });

  for (let i = 0; i < shardUrls.length; i += 1) {
    const url = shardUrls[i];
    let fileLoaded = 0;
    const response = await fetchWithProgress(
      url,
      (loaded, total) => {
        fileLoaded = loaded;
        onProgress({
          ratio: computeProgressRatio(
            i + 1,
            fileCount,
            total ? loaded / total : 0,
          ),
          fileIndex: i + 2,
          fileCount,
          loadedBytes: loadedBytes + loaded,
        });
      },
      signal,
    );
    await cache.put(url, response);
    loadedBytes += fileLoaded;
  }

  onProgress({ ratio: 1, fileIndex: fileCount, fileCount, loadedBytes });
}
