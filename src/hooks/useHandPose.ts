import { useRef, useEffect, useState } from "react";

import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-wasm";

import { logger } from "../utils/logger";

export interface HandPoseDetector {
  estimateHands: (input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement) => Promise<unknown[]>;
  dispose: () => void;
}

interface UseHandPoseReturn {
  detector: HandPoseDetector | null;
  isLoading: boolean;
  error: string | null;
  status: string;
}

export const useHandPose = (): UseHandPoseReturn => {
  const detectorRef = useRef<HandPoseDetector | null>(null);
  const [detector, setDetector] = useState<HandPoseDetector | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Initializing TensorFlow...");

  useEffect(() => {
    let mounted = true;

    const loadModel = async () => {
      try {
        const configStatus = "Configuring TensorFlow.js...";
        if (mounted) setStatus(configStatus);
        logger.log("useHandPose", configStatus);

        try {
          await tf.setBackend("webgl");
          await tf.ready();
          logger.log("useHandPose", tf.getBackend() + " backend is ready");
        } catch {
          logger.log("useHandPose", "WebGL failed, falling back to WASM");
          await tf.setBackend("wasm");
          await tf.ready();
          logger.log(
            "useHandPose",
            tf.getBackend() + " backend is ready (fallback)",
          );
        }

        const loadStatus = "Loading HandPose model...";
        if (mounted) setStatus(loadStatus);
        logger.log("useHandPose", loadStatus);

        const handPoseDetection = await import(
          "@tensorflow-models/hand-pose-detection"
        );

        const loadedDetector = await handPoseDetection.createDetector(
          handPoseDetection.SupportedModels.MediaPipeHands,
          {
            runtime: "tfjs",
            modelType: "lite",
          },
        );

        if (!mounted) {
          loadedDetector.dispose();
          return;
        }

        detectorRef.current = loadedDetector as HandPoseDetector;
        setDetector(loadedDetector as HandPoseDetector);
        const successStatus = "Model loaded successfully!";
        setStatus(successStatus);
        logger.log("useHandPose", successStatus);
        setIsLoading(false);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        const errorMessage = err instanceof Error ? err.message : "Error loading model";
        const normalizedError = errorMessage.includes("hand-pose-detection")
          ? "Missing dependency: install @tensorflow-models/hand-pose-detection and restart dev server."
          : errorMessage;
        logger.error("useHandPose", "Error:", errorMessage);
        setError(normalizedError);
        setStatus(`Error: ${normalizedError}`);
        setIsLoading(false);
      }
    };

    loadModel();

    return () => {
      mounted = false;
      if (detectorRef.current) {
        detectorRef.current.dispose();
        detectorRef.current = null;
      }
      setDetector(null);
    };
  }, []);

  return {
    detector,
    isLoading,
    error,
    status,
  };
};
