import { useRef, useEffect, useState } from "react";

import * as tf from "@tensorflow/tfjs";
import * as poseDetection from "@tensorflow-models/pose-detection";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-wasm";

import { logger } from "../utils/logger";

interface UseMovenetReturn {
  detector: poseDetection.PoseDetector | null;
  isLoading: boolean;
  error: string | null;
  status: string;
}

export const useMovenet = (): UseMovenetReturn => {
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

        // Try WebGL first, fallback to WASM for Chromium compatibility
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

        const loadStatus = "Loading MoveNet model...";
        if (mounted) setStatus(loadStatus);
        logger.log("useMovenet", loadStatus);

        const detector = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet,
          {
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
            modelUrl: "/models/movenet/model.json",
            enableSmoothing: true,
            
          },
        );

        if (!mounted) {
          detector.dispose();
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
  }, []);

  return {
    detector,
    isLoading,
    error,
    status,
  };
};
