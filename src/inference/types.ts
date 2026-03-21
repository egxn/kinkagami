import type {
  ModelRuntimeState,
  PoseEstimator,
  HandEstimator,
} from "../types/inference";

export type { PoseEstimator, HandEstimator, ModelRuntimeState };

export type InferenceResult<T> = ModelRuntimeState & { detector: T | null };

export type InferenceBackend = "browser" | "python";
