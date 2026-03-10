import { useRef, useEffect, useState } from "react";

import * as tf from "@tensorflow/tfjs";
import * as poseDetection from "@tensorflow-models/pose-detection";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-wasm";

import { useModelVersions } from "./useModelVersions";
import { logger } from "../utils/logger";
import { getMoveNetModelUrl } from "../utils/modelVersions";
import { getAppConfig } from "../utils/appConfig";
import type {
  MoveNetWorkerRequest,
  MoveNetWorkerResponse,
  WorkerPose,
} from "../workers/movenetMessages";

interface UseMovenetReturn {
  detector: poseDetection.PoseDetector | null;
  isLoading: boolean;
  error: string | null;
  status: string;
}

type PendingEstimate = {
  resolve: (poses: poseDetection.Pose[]) => void;
  reject: (error: Error) => void;
};

const workerPoseToPose = (pose: WorkerPose): poseDetection.Pose => ({
  score: pose.score,
  keypoints: (pose.keypoints ?? []).map((keypoint) => ({
    x: keypoint.x,
    y: keypoint.y,
    score: keypoint.score,
    name: keypoint.name,
  })),
});

const createWorkerBackedDetector = (
  worker: Worker,
): poseDetection.PoseDetector => {
  const pending = new Map<number, PendingEstimate>();
  let requestId = 0;
  let disposed = false;

  const rejectAllPending = (reason: string) => {
    const error = new Error(reason);
    for (const [, request] of pending) {
      request.reject(error);
    }
    pending.clear();
  };

  worker.onmessage = (event: MessageEvent<MoveNetWorkerResponse>) => {
    const message = event.data;

    if (message.type === "result") {
      const request = pending.get(message.requestId);
      if (!request) return;
      pending.delete(message.requestId);
      request.resolve((message.poses ?? []).map(workerPoseToPose));
      return;
    }

    if (message.type === "error" && typeof message.requestId === "number") {
      const request = pending.get(message.requestId);
      if (!request) return;
      pending.delete(message.requestId);
      request.reject(new Error(message.error));
      return;
    }

    if (message.type === "error") {
      rejectAllPending(message.error);
    }
  };

  const estimatePoses = async (
    input:
      | HTMLVideoElement
      | HTMLImageElement
      | HTMLCanvasElement
      | ImageBitmap
      | ImageData,
  ) => {
    if (disposed) {
      return [] as poseDetection.Pose[];
    }

    let imageBitmap: ImageBitmap;
    if (input instanceof ImageBitmap) {
      imageBitmap = input;
    } else {
      imageBitmap = await createImageBitmap(input);
    }

    return new Promise<poseDetection.Pose[]>((resolve, reject) => {
      requestId += 1;
      const id = requestId;

      pending.set(id, {
        resolve,
        reject,
      });

      const message: MoveNetWorkerRequest = {
        type: "estimate",
        requestId: id,
        imageBitmap,
      };

      worker.postMessage(message, [imageBitmap]);
    });
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    rejectAllPending("MoveNet detector disposed");
    worker.postMessage({ type: "dispose" } satisfies MoveNetWorkerRequest);
    worker.terminate();
  };

  return {
    estimatePoses,
    dispose,
  } as unknown as poseDetection.PoseDetector;
};

const initializeMainThreadDetector = async (
  movenetVersion: "thunder" | "lightning",
) => {
  try {
    await tf.setBackend("webgl");
    await tf.ready();
    logger.log("useMovenet", tf.getBackend() + " backend is ready");
  } catch {
    logger.log("useMovenet", "WebGL failed, falling back to WASM");
    await tf.setBackend("wasm");
    await tf.ready();
    logger.log(
      "useMovenet",
      tf.getBackend() + " backend is ready (fallback)",
    );
  }

  const modelType =
    movenetVersion === "thunder"
      ? poseDetection.movenet.modelType.SINGLEPOSE_THUNDER
      : poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING;

  return poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
    modelType,
    modelUrl: getMoveNetModelUrl(movenetVersion),
    enableSmoothing: true,
  });
};

export const useMovenet = (): UseMovenetReturn => {
  const {
    config: { movenet: movenetVersion },
  } = useModelVersions();
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const [detector, setDetector] = useState<poseDetection.PoseDetector | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Initializing TensorFlow...");

  useEffect(() => {
    let mounted = true;

    const loadModel = async () => {
      try {
        const configStatus = "Configuring TensorFlow.js...";
        if (mounted) setStatus(configStatus);
        logger.log("useMovenet", configStatus);

        const loadStatus = `Loading MoveNet model (${movenetVersion})...`;
        if (mounted) setStatus(loadStatus);
        logger.log("useMovenet", loadStatus);

        let detector: poseDetection.PoseDetector | null = null;
        const appConfig = getAppConfig();
        const workersEnabled = appConfig.runtime.execution === "workers";

        const workerCapable =
          workersEnabled &&
          typeof Worker !== "undefined" &&
          typeof createImageBitmap === "function";

        if (workerCapable) {
          try {
            const worker = new Worker(
              new URL("../workers/movenet.worker.ts", import.meta.url),
              { type: "module" },
            );

            const ready = await new Promise<void>((resolve, reject) => {
              const onReadyOrError = (
                event: MessageEvent<MoveNetWorkerResponse>,
              ) => {
                const message = event.data;
                if (message.type === "ready") {
                  worker.removeEventListener("message", onReadyOrError);
                  resolve();
                  return;
                }

                if (
                  message.type === "error" &&
                  typeof message.requestId !== "number"
                ) {
                  worker.removeEventListener("message", onReadyOrError);
                  reject(new Error(message.error));
                }
              };

              worker.addEventListener("message", onReadyOrError);
              worker.postMessage({
                type: "init",
                version: movenetVersion,
              } satisfies MoveNetWorkerRequest);
            });

            void ready;
            detector = createWorkerBackedDetector(worker);
            logger.log("useMovenet", "MoveNet running in worker thread");
          } catch (workerError) {
            logger.warn(
              "useMovenet",
              "MoveNet worker unavailable, falling back to main thread",
              workerError,
            );
            detector = await initializeMainThreadDetector(movenetVersion);
          }
        } else {
          detector = await initializeMainThreadDetector(movenetVersion);
        }

        if (!mounted) {
          detector?.dispose();
          return;
        }

        detectorRef.current = detector;
        setDetector(detector);
        const successStatus = "Model loaded successfully!";
        setStatus(successStatus);
        logger.log("useMovenet", successStatus);
        setIsLoading(false);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        const errorMessage =
          err instanceof Error ? err.message : "Error loading model";
        logger.error("useMovenet", "Error:", errorMessage);
        setError(errorMessage);
        setStatus(`Error: ${errorMessage}`);
        setIsLoading(false);
      }
    };

    loadModel();

    // Cleanup
    return () => {
      mounted = false;
      if (detectorRef.current) {
        detectorRef.current.dispose();
        detectorRef.current = null;
      }
      setDetector(null);
    };
  }, [movenetVersion]);

  return {
    detector,
    isLoading,
    error,
    status,
  };
};
