import { useRef, useEffect, useState } from "react";

import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-wasm";

import { useModelVersions } from "./useModelVersions";
import { logger } from "../utils/logger";
import {
  getHandPoseDetectorUrl,
  getHandPoseLandmarkUrl,
  type HandPoseVersion,
} from "../utils/modelVersions";

export interface HandPoseDetector {
  estimateHands: (
    input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  ) => Promise<unknown[]>;
  dispose: () => void;
}

interface UseHandPoseReturn {
  detector: HandPoseDetector | null;
  isLoading: boolean;
  error: string | null;
  status: string;
}

let sharedDetector: HandPoseDetector | null = null;
let sharedInitPromise: Promise<HandPoseDetector> | null = null;
let sharedInitConfigKey: string | null = null;
let sharedInitError: string | null = null;
let sharedStatus = "Initializing TensorFlow...";

const normalizeInitError = (errorMessage: string) => {
  if (errorMessage.includes("hand-pose-detection")) {
    return "Missing dependency: install @tensorflow-models/hand-pose-detection and restart dev server.";
  }

  return errorMessage;
};

const initializeSharedDetector = async (
  handposeVersion: HandPoseVersion,
): Promise<HandPoseDetector> => {
  const configKey = `handpose:${handposeVersion}`;

  if (sharedDetector && sharedInitConfigKey === configKey)
    return sharedDetector;
  if (sharedInitPromise && sharedInitConfigKey === configKey)
    return sharedInitPromise;

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
      sharedStatus = "Configuring TensorFlow.js...";
      logger.log("useHandPose", sharedStatus);

      const currentBackend = tf.getBackend();
      if (!currentBackend || currentBackend === "cpu") {
        try {
          await tf.setBackend("webgl");
          await tf.ready();
          logger.log("useHandPose", `${tf.getBackend()} backend is ready`);
        } catch {
          logger.log("useHandPose", "WebGL failed, falling back to WASM");
          await tf.setBackend("wasm");
          await tf.ready();
          logger.log(
            "useHandPose",
            `${tf.getBackend()} backend is ready (fallback)`,
          );
        }
      } else {
        await tf.ready();
        logger.log(
          "useHandPose",
          `${currentBackend} backend already configured`,
        );
      }

      sharedStatus = `Loading HandPose model (${handposeVersion})...`;
      logger.log("useHandPose", sharedStatus);

      const handPoseDetection =
        await import("@tensorflow-models/hand-pose-detection");

      const detectorUrl = getHandPoseDetectorUrl(handposeVersion);
      const landmarkUrl = getHandPoseLandmarkUrl(handposeVersion);

      const detectorCheck = await fetch(detectorUrl, { method: "HEAD" });
      if (!detectorCheck.ok) {
        throw new Error(`Missing HandPose detector model at ${detectorUrl}`);
      }

      const landmarkCheck = await fetch(landmarkUrl, { method: "HEAD" });
      if (!landmarkCheck.ok) {
        throw new Error(`Missing HandPose landmark model at ${landmarkUrl}`);
      }

      const loadedDetector = await handPoseDetection.createDetector(
        handPoseDetection.SupportedModels.MediaPipeHands,
        {
          runtime: "tfjs",
          modelType: handposeVersion,
          detectorModelUrl: detectorUrl,
          landmarkModelUrl: landmarkUrl,
        },
      );

      sharedDetector = loadedDetector as HandPoseDetector;
      sharedInitError = null;
      sharedStatus = "Model loaded successfully!";
      logger.log("useHandPose", sharedStatus);
      return sharedDetector;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error loading model";
      const normalizedError = normalizeInitError(message);
      sharedInitError = normalizedError;
      sharedStatus = `Error: ${normalizedError}`;
      logger.error("useHandPose", "Error:", message);
      throw new Error(normalizedError);
    } finally {
      sharedInitPromise = null;
    }
  })();

  return sharedInitPromise;
};

export const useHandPose = (): UseHandPoseReturn => {
  const detectorRef = useRef<HandPoseDetector | null>(sharedDetector);
  const {
    config: { handpose: handposeVersion },
  } = useModelVersions();
  const [detector, setDetector] = useState<HandPoseDetector | null>(
    sharedDetector,
  );
  const [isLoading, setIsLoading] = useState(
    !sharedDetector && !sharedInitError,
  );
  const [error, setError] = useState<string | null>(sharedInitError);
  const [status, setStatus] = useState(sharedStatus);

  useEffect(() => {
    let mounted = true;

    const loadModel = async () => {
      if (sharedDetector) {
        detectorRef.current = sharedDetector;
        setDetector(sharedDetector);
        setStatus(sharedStatus);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setStatus(sharedStatus);

      try {
        const loadedDetector = await initializeSharedDetector(handposeVersion);
        if (!mounted) return;

        detectorRef.current = loadedDetector;
        setDetector(loadedDetector);
        setStatus(sharedStatus);
        setError(null);
        setIsLoading(false);
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
      setDetector(null);
    };
  }, [handposeVersion]);

  return {
    detector,
    isLoading,
    error,
    status,
  };
};
