import { useAppConfig } from "../hooks/useAppConfig";
import { useLocalHandPose } from "./providers/useLocalHandPose";
import { usePythonHandEstimator } from "./providers/usePythonBackendModel";
import { resolveInferenceBackend } from "./resolveBackend";
import type { InferenceResult, HandEstimator } from "./types";

export const useHandInference = (): InferenceResult<HandEstimator> => {
  const { config } = useAppConfig();
  const backend = resolveInferenceBackend(config);

  const local = useLocalHandPose(backend === "browser");
  const python = usePythonHandEstimator({
    enabled: backend === "python",
    url: config.runtime.pythonWebSocketUrl,
    modelType: "handpose",
    version: config.models.handpose,
  });

  if (backend === "python") {
    return {
      detector: python.detector,
      isLoading: python.isLoading,
      error: python.error,
      status: python.status,
    };
  }

  return local;
};
