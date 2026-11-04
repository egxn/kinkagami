import {
  createAppConfigSanitizer,
  mergeAppConfig,
  type AppConfig,
  type ConfigStore,
} from "@kgm/core";

const STORAGE_KEY = "kgm-web-config-v1";

/** Defaults for the online web client (browser inference, device camera). */
export const WEB_DEFAULT_CONFIG: AppConfig = {
  models: {
    poseModel: "movenet",
    movenet: "lightning",
    blazepose: "lite",
    handpose: "lite",
  },
  camera: {
    flow: "web",
    source: "web",
    streamUrl: "http://localhost:8090/?action=stream",
  },
  runtime: {
    execution: "site",
    backend: "webgl",
    pythonWebSocketUrl: "ws://127.0.0.1:8765",
    pythonStreamUrl: "http://localhost:8090/stream",
  },
  evaluation: { type: "hybrid" },
};

const sanitize = createAppConfigSanitizer(WEB_DEFAULT_CONFIG);

const read = (): AppConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : WEB_DEFAULT_CONFIG;
  } catch {
    return WEB_DEFAULT_CONFIG;
  }
};

// `get` must return a stable reference between changes (useSyncExternalStore).
let cached: AppConfig | null = null;
const listeners = new Set<(config: AppConfig) => void>();

const emit = (config: AppConfig) => {
  for (const listener of listeners) listener(config);
};

/** localStorage-backed `ConfigStore` for the web client. */
export const configStore: ConfigStore = {
  get: () => (cached ??= read()),
  save: (next) => {
    cached = sanitize(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
    emit(cached);
    return cached;
  },
  update: (updates) =>
    configStore.save(mergeAppConfig(configStore.get(), updates)),
  subscribe: (onChange) => {
    listeners.add(onChange);

    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== STORAGE_KEY) return;
      cached = read();
      onChange(cached);
    };
    window.addEventListener("storage", onStorage);

    return () => {
      listeners.delete(onChange);
      window.removeEventListener("storage", onStorage);
    };
  },
};
