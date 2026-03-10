import { useRef, useEffect, useState } from "react";

import * as poseDetection from "@tensorflow-models/pose-detection";

import { useModelVersions } from "./useModelVersions";
import { logger } from "../utils/logger";

interface UseBlazePoseReturn {
  detector: poseDetection.PoseDetector | null;
  isLoading: boolean;
  error: string | null;
  status: string;
}

const BLAZEPOSE_MEDIAPIPE_SOLUTION_PATH = "/models/blazepose/mediapipe";

let sharedDetector: poseDetection.PoseDetector | null = null;
let sharedInitPromise: Promise<poseDetection.PoseDetector> | null = null;
let sharedInitConfigKey: string | null = null;
let sharedInitError: string | null = null;
let sharedStatus = "Initializing BlazePose...";
let activeConsumers = 0;

const assertAssetExists = async (assetPath: string) => {
  const check = await fetch(assetPath, { method: "HEAD" });
  if (!check.ok) {
    throw new Error(`Missing BlazePose MediaPipe asset at ${assetPath}`);
  }
};

const initializeSharedDetector = async (
  version: "lite" | "full" | "heavy",
): Promise<poseDetection.PoseDetector> => {
  const configKey = `blazepose:mediapipe:${version}`;

  if (sharedDetector && sharedInitConfigKey === configKey) {
    return sharedDetector;
  }

  if (sharedInitPromise && sharedInitConfigKey === configKey) {
    return sharedInitPromise;
  }

  if (sharedDetector && sharedInitConfigKey !== configKey) {
    try {
      sharedDetector.dispose();
    } catch {
      // noop
    }
    sharedDetector = null;
  }

  sharedInitConfigKey = configKey;
  sharedInitPromise = (async () => {
    try {
      sharedStatus = "Configuring BlazePose (MediaPipe runtime)...";
      logger.log("useBlazePose", sharedStatus);

      await assertAssetExists(
        `${BLAZEPOSE_MEDIAPIPE_SOLUTION_PATH}/pose_solution_wasm_bin.wasm`,
      );
      await assertAssetExists(
        `${BLAZEPOSE_MEDIAPIPE_SOLUTION_PATH}/pose_web.binarypb`,
      );
      await assertAssetExists(
        `${BLAZEPOSE_MEDIAPIPE_SOLUTION_PATH}/pose_landmark_${version}.tflite`,
      );

      const loadedDetector = await poseDetection.createDetector(
        poseDetection.SupportedModels.BlazePose,
        {
          runtime: "mediapipe",
          modelType: version,
          solutionPath: BLAZEPOSE_MEDIAPIPE_SOLUTION_PATH,
          enableSmoothing: true,
        },
      );

      sharedDetector = loadedDetector;
      sharedInitError = null;
      sharedStatus = "Model loaded successfully!";
      logger.log(
        "useBlazePose",
        "BlazePose loaded from local MediaPipe assets",
      );
      return loadedDetector;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sharedInitError = message;
      sharedStatus = `Error: ${message}`;
      logger.error("useBlazePose", "Error:", message);
      throw new Error(message);
    } finally {
      sharedInitPromise = null;
    }
  })();

  return sharedInitPromise;
};

export const useBlazePose = (): UseBlazePoseReturn => {
  const {
    config: { blazepose: blazeposeVersion },
  } = useModelVersions();
  const detectorRef = useRef<poseDetection.PoseDetector | null>(sharedDetector);
  const [detector, setDetector] = useState<poseDetection.PoseDetector | null>(
    sharedDetector,
  );
  const [isLoading, setIsLoading] = useState(
    !sharedDetector && !sharedInitError,
  );
  const [error, setError] = useState<string | null>(sharedInitError);
  const [status, setStatus] = useState(sharedStatus);

  useEffect(() => {
    let mounted = true;
    activeConsumers += 1;

    const loadModel = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setStatus(`Loading BlazePose model (${blazeposeVersion})...`);
        logger.log(
          "useBlazePose",
          `Loading BlazePose model (${blazeposeVersion})...`,
        );
        logger.log("useBlazePose", "BlazePose offline config", {
          runtime: "mediapipe",
          modelType: blazeposeVersion,
          solutionPath: BLAZEPOSE_MEDIAPIPE_SOLUTION_PATH,
        });

        const loadedDetector = await initializeSharedDetector(blazeposeVersion);
        if (!mounted) return;

        detectorRef.current = loadedDetector;
        setDetector(loadedDetector);
        const successStatus = "Model loaded successfully!";
        setStatus(successStatus);
        logger.log("useBlazePose", successStatus);
        logger.log("useBlazePose", "Detector instance ready", {
          hasDetector: !!loadedDetector,
          runtime: "mediapipe",
        });
        setIsLoading(false);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        const errorMessage =
          err instanceof Error ? err.message : "Error loading model";
        setError(errorMessage);
        setStatus(`Error: ${errorMessage}`);
        setIsLoading(false);
      }
    };

    loadModel();

    return () => {
      mounted = false;
      detectorRef.current = null;
      activeConsumers -= 1;

      if (activeConsumers <= 0 && sharedDetector && !sharedInitPromise) {
        logger.log("useBlazePose", "Disposing BlazePose detector");
        try {
          sharedDetector.dispose();
        } catch {
          // noop
        }
        sharedDetector = null;
        sharedInitConfigKey = null;
      }
      setDetector(null);
    };
  }, [blazeposeVersion]);

  return {
    detector,
    isLoading,
    error,
    status,
  };
};
