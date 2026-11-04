import {
  createAppConfigSanitizer,
  isRuntimeExecutionType,
  mergeAppConfig,
  type AppConfig,
} from "@kgm/core";
import defaultAppConfig from "../config/defaultAppConfig.json";
import { saveModelVersionsConfig } from "./modelVersions";

export type {
  AppConfig,
  CameraFlowType,
  EvaluationType,
  PoseModelType,
  RuntimeExecutionType,
  TFBackendType,
} from "@kgm/core";

export const APP_CONFIG_STORAGE_KEY = "kgm-app-config-v1";
export const APP_CONFIG_EVENT = "kgm-app-config-changed";

export const DEFAULT_APP_CONFIG: AppConfig = defaultAppConfig as AppConfig;

const getBootstrapConfigOverrides = (): Partial<AppConfig> => {
  if (typeof import.meta === "undefined") return {};

  const runtimeExecution = import.meta.env.VITE_KGM_RUNTIME_EXECUTION;
  const pythonWebSocketUrl = import.meta.env.VITE_KGM_PYTHON_WS_URL;
  const pythonStreamUrl = import.meta.env.VITE_KGM_PYTHON_STREAM_URL;

  const runtime: Partial<AppConfig["runtime"]> = {};
  if (isRuntimeExecutionType(runtimeExecution)) {
    runtime.execution = runtimeExecution;
  }
  if (typeof pythonWebSocketUrl === "string" && pythonWebSocketUrl.trim()) {
    runtime.pythonWebSocketUrl = pythonWebSocketUrl.trim();
  }
  if (typeof pythonStreamUrl === "string" && pythonStreamUrl.trim()) {
    runtime.pythonStreamUrl = pythonStreamUrl.trim();
  }

  return Object.keys(runtime).length > 0
    ? ({ runtime } as Partial<AppConfig>)
    : {};
};

export const sanitizeAppConfig = createAppConfigSanitizer(DEFAULT_APP_CONFIG);

const syncModelVersionsFromAppConfig = (config: AppConfig) => {
  saveModelVersionsConfig({
    movenet: config.models.movenet,
    blazepose: config.models.blazepose,
    handpose: config.models.handpose,
  });
};

const emitAppConfigEvent = (config: AppConfig) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<AppConfig>(APP_CONFIG_EVENT, {
      detail: config,
    }),
  );
};

export const getAppConfig = (): AppConfig => {
  if (typeof window === "undefined") return DEFAULT_APP_CONFIG;

  try {
    const raw = window.localStorage.getItem(APP_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_APP_CONFIG;
    return sanitizeAppConfig(JSON.parse(raw));
  } catch {
    return DEFAULT_APP_CONFIG;
  }
};

export const saveAppConfig = (next: AppConfig): AppConfig => {
  const sanitized = sanitizeAppConfig(next);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      APP_CONFIG_STORAGE_KEY,
      JSON.stringify(sanitized),
    );
  }

  syncModelVersionsFromAppConfig(sanitized);
  emitAppConfigEvent(sanitized);
  return sanitized;
};

export const updateAppConfig = (updates: Partial<AppConfig>): AppConfig =>
  saveAppConfig(sanitizeAppConfig(mergeAppConfig(getAppConfig(), updates)));

export const ensureAppConfigInStorage = (): AppConfig => {
  if (typeof window === "undefined") return DEFAULT_APP_CONFIG;

  const raw = window.localStorage.getItem(APP_CONFIG_STORAGE_KEY);
  if (!raw) {
    const bootstrapOverrides = getBootstrapConfigOverrides();
    return saveAppConfig(
      sanitizeAppConfig({
        ...DEFAULT_APP_CONFIG,
        ...bootstrapOverrides,
        runtime: {
          ...DEFAULT_APP_CONFIG.runtime,
          ...(bootstrapOverrides.runtime ?? {}),
        },
      }),
    );
  }

  const config = getAppConfig();
  return saveAppConfig(config);
};
