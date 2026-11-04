export { usePoseInference } from "./usePoseInference";
export { useHandInference } from "./useHandInference";
export { resolveInferenceBackend } from "./resolveBackend";

// Providers — for consumers that need a specific backend directly
export { useMovenet } from "./providers/useMovenet";
export { useBlazePose } from "./providers/useBlazePose";
export { useLocalHandPose } from "./providers/useLocalHandPose";
export {
  usePythonPoseEstimator,
  usePythonHandEstimator,
} from "./providers/usePythonBackendModel";
export { pythonBackendClient } from "./providers/pythonBackendClient";

// Types
export type {
  InferenceResult,
  InferenceBackend,
  PoseEstimator,
  HandEstimator,
  ModelRuntimeState,
} from "./types";
export type { HandPoseDetector } from "./providers/useLocalHandPose";
