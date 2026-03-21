import { useAppConfig } from "../hooks/useAppConfig";
import { useBlazePose } from "./providers/useBlazePose";
import { useMovenet } from "./providers/useMovenet";
import { usePythonPoseEstimator } from "./providers/usePythonBackendModel";
import { resolveInferenceBackend } from "./resolveBackend";
import type { InferenceResult, PoseEstimator } from "./types";

export const usePoseInference = (): InferenceResult<PoseEstimator> => {
  const { config } = useAppConfig();
  const backend = resolveInferenceBackend(config);
  const poseModel = config.models.poseModel;

  const movenet = useMovenet(backend === "browser" && poseModel === "movenet");
  const blazepose = useBlazePose(
    backend === "browser" && poseModel === "blazepose",
  );
  const pythonPose = usePythonPoseEstimator({
    enabled: backend === "python",
    url: config.runtime.pythonWebSocketUrl,
    modelType: poseModel,
    version:
      poseModel === "movenet"
        ? config.models.movenet
        : config.models.blazepose,
  });

  if (backend === "python") return pythonPose;
  return poseModel === "movenet" ? movenet : blazepose;
};
