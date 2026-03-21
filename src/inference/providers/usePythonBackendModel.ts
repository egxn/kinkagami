import { useEffect, useMemo, useState } from "react";
import type { Pose } from "@tensorflow-models/pose-detection";
import { pythonBackendClient } from "./pythonBackendClient";
import type {
  BackendModelType,
  HandEstimator,
  HandPrediction,
  ModelRuntimeState,
  PoseEstimator,
} from "../../types/inference";

interface UsePythonBackendModelOptions {
  enabled: boolean;
  url: string;
  modelType: BackendModelType;
  version: "lightning" | "thunder" | "lite" | "full" | "heavy";
}

const IDLE_STATE: ModelRuntimeState = {
  isLoading: false,
  error: null,
  status: "Idle",
};

export const usePythonPoseEstimator = ({
  enabled,
  url,
  modelType,
  version,
}: UsePythonBackendModelOptions): ModelRuntimeState & {
  detector: PoseEstimator | null;
} => {
  const [runtimeState, setRuntimeState] = useState<ModelRuntimeState>(IDLE_STATE);

  useEffect(() => {
    if (!enabled) {
      setRuntimeState(IDLE_STATE);
      return;
    }

    return pythonBackendClient.subscribe((state) => {
      const activeName = state.activeModel?.name;
      setRuntimeState({
        isLoading: state.isLoading,
        error: state.error,
        status: state.error
          ? `Error: ${state.error}`
          : state.isLoading
            ? "Connecting to Python backend..."
            : activeName
              ? `Python backend ready (${activeName})`
              : "Python backend idle",
      });
    });
  }, [enabled]);

  // Eagerly start the session so the backend opens the camera and begins
  // pushing MJPEG frames.  Without this the frontend stream never becomes
  // ready (deadlock: stream waits for frames, frames wait for session,
  // session waits for detection loop, loop waits for stream).
  // Uses requestModel/releaseModel so the client can arbitrate between
  // pose and hand models via a priority system.
  // Retries with exponential backoff only on connection errors.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const attempt = (delay: number) => {
      if (cancelled) return;
      pythonBackendClient.requestModel("pose", { url, modelType, version }).catch((err) => {
        if (cancelled) return;
        // Don't retry if the session was superseded by a higher-priority model
        // — that's expected behaviour from the priority system.
        if (err instanceof Error && err.message === "Session superseded") return;
        const next = Math.min(delay * 2, 10_000);
        timer = setTimeout(() => attempt(next), delay);
      });
    };

    attempt(1_000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      pythonBackendClient.releaseModel("pose");
    };
  }, [enabled, url, modelType, version]);

  const detector = useMemo<PoseEstimator | null>(() => {
    if (!enabled) return null;

    return {
      estimatePoses: async (): Promise<Pose[]> =>
        pythonBackendClient.estimatePoses({
          url,
          modelType,
          version,
        }),
      dispose: () => undefined,
    };
  }, [enabled, modelType, url, version]);

  return {
    detector,
    ...runtimeState,
  };
};

export const usePythonHandEstimator = ({
  enabled,
  url,
  modelType,
  version,
}: UsePythonBackendModelOptions): ModelRuntimeState & {
  detector: HandEstimator | null;
} => {
  const [runtimeState, setRuntimeState] = useState<ModelRuntimeState>(IDLE_STATE);

  useEffect(() => {
    if (!enabled) {
      setRuntimeState(IDLE_STATE);
      return;
    }

    return pythonBackendClient.subscribe((state) => {
      const activeName = state.activeModel?.name;
      setRuntimeState({
        isLoading: state.isLoading,
        error: state.error,
        status: state.error
          ? `Error: ${state.error}`
          : state.isLoading
            ? "Connecting to Python backend..."
            : activeName
              ? `Python backend ready (${activeName})`
              : "Python backend idle",
      });
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const attempt = (delay: number) => {
      if (cancelled) return;
      pythonBackendClient.requestModel("hand", { url, modelType, version }).catch((err) => {
        if (cancelled) return;
        if (err instanceof Error && err.message === "Session superseded") return;
        const next = Math.min(delay * 2, 10_000);
        timer = setTimeout(() => attempt(next), delay);
      });
    };

    attempt(1_000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      pythonBackendClient.releaseModel("hand");
    };
  }, [enabled, url, modelType, version]);

  const detector = useMemo<HandEstimator | null>(() => {
    if (!enabled) return null;

    return {
      estimateHands: async (): Promise<HandPrediction[]> =>
        pythonBackendClient.estimateHands({
          url,
          modelType,
          version,
        }),
      dispose: () => undefined,
    };
  }, [enabled, modelType, url, version]);

  return {
    detector,
    ...runtimeState,
  };
};
