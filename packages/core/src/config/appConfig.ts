export type MoveNetVersion = "lightning" | "thunder";
export type BlazePoseVersion = "lite" | "full" | "heavy";
export type HandPoseVersion = "lite" | "full";

export type PoseModelType = "movenet" | "blazepose";
export type CameraFlowType = "web" | "streamUrl";
export type RuntimeExecutionType = "workers" | "site" | "python";
export type EvaluationType = "fsm" | "grid" | "hybrid";
export type TFBackendType = "webgl" | "wasm";

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
    backend: TFBackendType;
    pythonWebSocketUrl: string;
    pythonStreamUrl: string;
  };
  evaluation: {
    type: EvaluationType;
  };
}

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

const isTFBackendType = (value: unknown): value is TFBackendType =>
  value === "webgl" || value === "wasm";

export const isRuntimeExecutionType = (
  value: unknown,
): value is RuntimeExecutionType =>
  value === "workers" || value === "site" || value === "python";

const isEvaluationType = (value: unknown): value is EvaluationType =>
  value === "fsm" || value === "grid" || value === "hybrid";

const nonEmptyStringOr = (value: unknown, fallback: string): string => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

/**
 * Builds a sanitizer bound to a set of defaults. Defaults are injected (not
 * imported) because each deployment/client ships its own defaults.
 */
export const createAppConfigSanitizer =
  (defaults: AppConfig) =>
  (value: unknown): AppConfig => {
    if (!value || typeof value !== "object") return defaults;

    const source = value as Partial<AppConfig>;
    const sourceModels = (source.models ?? {}) as Partial<AppConfig["models"]>;
    const sourceCamera = (source.camera ?? {}) as Partial<AppConfig["camera"]>;
    const sourceRuntime = (source.runtime ?? {}) as Partial<
      AppConfig["runtime"]
    >;
    const sourceEvaluation = (source.evaluation ?? {}) as Partial<
      AppConfig["evaluation"]
    >;

    // Legacy values: "mjpeg" was renamed "streamUrl".
    const sourceFieldRaw = (sourceCamera as { source?: unknown }).source;
    const flowFieldRaw = (sourceCamera as { flow?: unknown }).flow;

    const rawCameraSource: CameraFlowType =
      sourceFieldRaw === "mjpeg"
        ? "streamUrl"
        : isCameraFlowType(sourceFieldRaw)
          ? sourceFieldRaw
          : flowFieldRaw === "mjpeg"
            ? "streamUrl"
            : isCameraFlowType(flowFieldRaw)
              ? flowFieldRaw
              : defaults.camera.source;

    return {
      models: {
        poseModel: isPoseModelType(sourceModels.poseModel)
          ? sourceModels.poseModel
          : defaults.models.poseModel,
        movenet: isMoveNetVersion(sourceModels.movenet)
          ? sourceModels.movenet
          : defaults.models.movenet,
        blazepose: isBlazePoseVersion(sourceModels.blazepose)
          ? sourceModels.blazepose
          : defaults.models.blazepose,
        handpose: isHandPoseVersion(sourceModels.handpose)
          ? sourceModels.handpose
          : defaults.models.handpose,
      },
      camera: {
        flow: rawCameraSource,
        source: rawCameraSource,
        streamUrl: nonEmptyStringOr(
          sourceCamera.streamUrl,
          defaults.camera.streamUrl,
        ),
      },
      runtime: {
        execution: isRuntimeExecutionType(sourceRuntime.execution)
          ? sourceRuntime.execution
          : defaults.runtime.execution,
        backend: isTFBackendType(sourceRuntime.backend)
          ? sourceRuntime.backend
          : defaults.runtime.backend,
        pythonWebSocketUrl: nonEmptyStringOr(
          sourceRuntime.pythonWebSocketUrl,
          defaults.runtime.pythonWebSocketUrl,
        ),
        pythonStreamUrl: nonEmptyStringOr(
          sourceRuntime.pythonStreamUrl,
          defaults.runtime.pythonStreamUrl,
        ),
      },
      evaluation: {
        type: isEvaluationType(sourceEvaluation.type)
          ? sourceEvaluation.type
          : defaults.evaluation.type,
      },
    };
  };

/** Shallow-per-section merge of a partial update into a full config. */
export const mergeAppConfig = (
  current: AppConfig,
  updates: Partial<AppConfig>,
): AppConfig => ({
  ...current,
  ...updates,
  models: { ...current.models, ...(updates.models ?? {}) },
  camera: { ...current.camera, ...(updates.camera ?? {}) },
  runtime: { ...current.runtime, ...(updates.runtime ?? {}) },
  evaluation: { ...current.evaluation, ...(updates.evaluation ?? {}) },
});
