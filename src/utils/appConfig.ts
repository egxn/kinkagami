import defaultAppConfig from "../config/defaultAppConfig.json";
import {
  saveModelVersionsConfig,
  type BlazePoseVersion,
  type HandPoseVersion,
  type MoveNetVersion,
} from "./modelVersions";

export type PoseModelType = "movenet" | "blazepose";
export type CameraFlowType = "web" | "streamUrl";
export type RuntimeExecutionType = "workers" | "site";
export type EvaluationType = "fsm" | "grid";

export interface AppConfig {
  models: {
    poseModel: PoseModelType;
    movenet: MoveNetVersion;
    blazepose: BlazePoseVersion;
    handpose: HandPoseVersion;
  };
  camera: {
    flow: CameraFlowType;
    source: CameraFlowType;
    streamUrl: string;
  };
  runtime: {
    execution: RuntimeExecutionType;
  };
  evaluation: {
    type: EvaluationType;
  };
}

export const APP_CONFIG_STORAGE_KEY = "kgm-app-config-v1";
export const APP_CONFIG_EVENT = "kgm-app-config-changed";

export const DEFAULT_APP_CONFIG: AppConfig = defaultAppConfig as AppConfig;

const isPoseModelType = (value: unknown): value is PoseModelType =>
  value === "movenet" || value === "blazepose";

const isMoveNetVersion = (value: unknown): value is MoveNetVersion =>
  value === "lightning" || value === "thunder";

const isBlazePoseVersion = (value: unknown): value is BlazePoseVersion =>
  value === "lite" || value === "full" || value === "heavy";

const isHandPoseVersion = (value: unknown): value is HandPoseVersion =>
  value === "lite" || value === "full";

const isCameraFlowType = (value: unknown): value is CameraFlowType =>
  value === "web" || value === "streamUrl";

const normalizeStreamUrl = (value: unknown): string => {
  if (typeof value !== "string") return DEFAULT_APP_CONFIG.camera.streamUrl;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_APP_CONFIG.camera.streamUrl;
};

const isRuntimeExecutionType = (
  value: unknown,
): value is RuntimeExecutionType => value === "workers" || value === "site";

const isEvaluationType = (value: unknown): value is EvaluationType =>
  value === "fsm" || value === "grid";

export const sanitizeAppConfig = (value: unknown): AppConfig => {
  if (!value || typeof value !== "object") return DEFAULT_APP_CONFIG;

  const source = value as Partial<AppConfig>;
  const sourceModels =
    (source.models as Partial<AppConfig["models"]> | undefined) ?? {};
  const sourceCamera =
    (source.camera as
      | (Partial<AppConfig["camera"]> & { flow?: unknown; source?: unknown })
      | undefined) ?? {};
  const sourceRuntime =
    (source.runtime as Partial<AppConfig["runtime"]> | undefined) ?? {};
  const sourceEvaluation =
    (source.evaluation as Partial<AppConfig["evaluation"]> | undefined) ?? {};

  const sourceFieldRaw = (sourceCamera as { source?: unknown }).source;
  const flowFieldRaw = (sourceCamera as { flow?: unknown }).flow;

  const rawCameraSource =
    sourceFieldRaw === "mjpeg"
      ? "streamUrl"
      : isCameraFlowType(sourceFieldRaw)
        ? sourceFieldRaw
        : flowFieldRaw === "mjpeg"
          ? "streamUrl"
          : isCameraFlowType(flowFieldRaw)
            ? flowFieldRaw
            : DEFAULT_APP_CONFIG.camera.source;

  return {
    models: {
      poseModel: isPoseModelType(sourceModels.poseModel)
        ? sourceModels.poseModel
        : DEFAULT_APP_CONFIG.models.poseModel,
      movenet: isMoveNetVersion(sourceModels.movenet)
        ? sourceModels.movenet
        : DEFAULT_APP_CONFIG.models.movenet,
      blazepose: isBlazePoseVersion(sourceModels.blazepose)
        ? sourceModels.blazepose
        : DEFAULT_APP_CONFIG.models.blazepose,
      handpose: isHandPoseVersion(sourceModels.handpose)
        ? sourceModels.handpose
        : DEFAULT_APP_CONFIG.models.handpose,
    },
    camera: {
      flow: rawCameraSource,
      source: rawCameraSource,
      streamUrl: normalizeStreamUrl(sourceCamera.streamUrl),
    },
    runtime: {
      execution: isRuntimeExecutionType(sourceRuntime.execution)
        ? sourceRuntime.execution
        : DEFAULT_APP_CONFIG.runtime.execution,
    },
    evaluation: {
      type: isEvaluationType(sourceEvaluation.type)
        ? sourceEvaluation.type
        : DEFAULT_APP_CONFIG.evaluation.type,
    },
  };
};

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
    window.localStorage.setItem(APP_CONFIG_STORAGE_KEY, JSON.stringify(sanitized));
  }

  syncModelVersionsFromAppConfig(sanitized);
  emitAppConfigEvent(sanitized);
  return sanitized;
};

export const updateAppConfig = (
  updates: Partial<AppConfig>,
): AppConfig => {
  const current = getAppConfig();
  const merged: AppConfig = sanitizeAppConfig({
    ...current,
    ...updates,
    models: {
      ...current.models,
      ...(updates.models ?? {}),
    },
    camera: {
      ...current.camera,
      ...(updates.camera ?? {}),
    },
    runtime: {
      ...current.runtime,
      ...(updates.runtime ?? {}),
    },
    evaluation: {
      ...current.evaluation,
      ...(updates.evaluation ?? {}),
    },
  });

  return saveAppConfig(merged);
};

export const ensureAppConfigInStorage = (): AppConfig => {
  if (typeof window === "undefined") return DEFAULT_APP_CONFIG;

  const raw = window.localStorage.getItem(APP_CONFIG_STORAGE_KEY);
  if (!raw) {
    return saveAppConfig(DEFAULT_APP_CONFIG);
  }

  const config = getAppConfig();
  return saveAppConfig(config);
};