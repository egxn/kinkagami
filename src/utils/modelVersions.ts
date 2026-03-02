export type MoveNetVersion = "lightning" | "thunder";
export type BlazePoseVersion = "lite" | "full" | "heavy";
export type HandPoseVersion = "lite" | "full";

export interface ModelVersionsConfig {
  movenet: MoveNetVersion;
  blazepose: BlazePoseVersion;
  handpose: HandPoseVersion;
}

export const MODEL_VERSIONS_STORAGE_KEY = "kgm-model-versions-v1";
export const MODEL_VERSIONS_EVENT = "kgm-model-versions-changed";

export const DEFAULT_MODEL_VERSIONS: ModelVersionsConfig = {
  movenet: "lightning",
  blazepose: "lite",
  handpose: "lite",
};

const isMoveNetVersion = (value: unknown): value is MoveNetVersion =>
  value === "lightning" || value === "thunder";

const isBlazePoseVersion = (value: unknown): value is BlazePoseVersion =>
  value === "lite" || value === "full" || value === "heavy";

const isHandPoseVersion = (value: unknown): value is HandPoseVersion =>
  value === "lite" || value === "full";

const sanitizeConfig = (value: unknown): ModelVersionsConfig => {
  if (!value || typeof value !== "object") return DEFAULT_MODEL_VERSIONS;

  const source = value as Partial<ModelVersionsConfig>;
  return {
    movenet: isMoveNetVersion(source.movenet)
      ? source.movenet
      : DEFAULT_MODEL_VERSIONS.movenet,
    blazepose: isBlazePoseVersion(source.blazepose)
      ? source.blazepose
      : DEFAULT_MODEL_VERSIONS.blazepose,
    handpose: isHandPoseVersion(source.handpose)
      ? source.handpose
      : DEFAULT_MODEL_VERSIONS.handpose,
  };
};

export const getModelVersionsConfig = (): ModelVersionsConfig => {
  if (typeof window === "undefined") return DEFAULT_MODEL_VERSIONS;

  try {
    const raw = window.localStorage.getItem(MODEL_VERSIONS_STORAGE_KEY);
    if (!raw) return DEFAULT_MODEL_VERSIONS;
    return sanitizeConfig(JSON.parse(raw));
  } catch {
    return DEFAULT_MODEL_VERSIONS;
  }
};

export const saveModelVersionsConfig = (
  updates: Partial<ModelVersionsConfig>,
): ModelVersionsConfig => {
  const current = getModelVersionsConfig();
  const next = sanitizeConfig({ ...current, ...updates });

  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      MODEL_VERSIONS_STORAGE_KEY,
      JSON.stringify(next),
    );
    window.dispatchEvent(
      new CustomEvent<ModelVersionsConfig>(MODEL_VERSIONS_EVENT, {
        detail: next,
      }),
    );
  }

  return next;
};

export const getMoveNetModelUrl = (version: MoveNetVersion) =>
  `/models/movenet/${version}/model.json`;

export const getBlazePoseDetectorUrl = () =>
  "/models/blazepose/detector/model.json";

export const getBlazePoseLandmarkUrl = (version: BlazePoseVersion) =>
  `/models/blazepose/landmark-${version}/model.json`;

export const getHandPoseDetectorUrl = (version: HandPoseVersion) =>
  `/models/handpose/detector-${version}/model.json`;

export const getHandPoseLandmarkUrl = (version: HandPoseVersion) =>
  `/models/handpose/landmark-${version}/model.json`;
