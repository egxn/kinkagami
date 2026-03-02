import { useRef, useEffect, useState } from "react";

import * as tf from "@tensorflow/tfjs";
import * as poseDetection from "@tensorflow-models/pose-detection";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-wasm";

import { useModelVersions } from "./useModelVersions";
import { logger } from "../utils/logger";
import {
  getBlazePoseDetectorUrl,
  getBlazePoseLandmarkUrl,
} from "../utils/modelVersions";

interface UseBlazePoseReturn {
  detector: poseDetection.PoseDetector | null;
  isLoading: boolean;
  error: string | null;
  status: string;
}

export const useBlazePose = (): UseBlazePoseReturn => {
  const {
    config: { blazepose: blazeposeVersion },
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
        logger.log("useBlazePose", configStatus);

        try {
          await tf.setBackend("webgl");
          await tf.ready();
          logger.log("useBlazePose", tf.getBackend() + " backend is ready");
        } catch {
          logger.log("useBlazePose", "WebGL failed, falling back to WASM");
          await tf.setBackend("wasm");
          await tf.ready();
          logger.log(
            "useBlazePose",
            tf.getBackend() + " backend is ready (fallback)",
          );
        }

        const loadStatus = `Loading BlazePose model (${blazeposeVersion})...`;
        if (mounted) setStatus(loadStatus);
        logger.log("useBlazePose", loadStatus);
        logger.log("useBlazePose", "BlazePose offline config", {
          runtime: "tfjs",
          modelType: blazeposeVersion,
          backend: tf.getBackend(),
        });

        const detectorUrl = getBlazePoseDetectorUrl();
        const landmarkUrl = getBlazePoseLandmarkUrl(blazeposeVersion);

        const detectorCheck = await fetch(detectorUrl, {
          method: "HEAD",
        });
        if (!detectorCheck.ok) {
          throw new Error(
            `Missing BlazePose detector model at ${detectorUrl}. ` +
              "Add detector files under /public/models/blazepose/detector/.",
          );
        }

        const landmarkCheck = await fetch(landmarkUrl, {
          method: "HEAD",
        });
        if (!landmarkCheck.ok) {
          throw new Error(
            `Missing BlazePose landmark model at ${landmarkUrl}. ` +
              "Add landmark files under /public/models/blazepose/.",
          );
        }

        const loadedDetector = await poseDetection.createDetector(
          poseDetection.SupportedModels.BlazePose,
          {
            runtime: "tfjs",
            modelType: blazeposeVersion,
            detectorModelUrl: detectorUrl,
            landmarkModelUrl: landmarkUrl,
            enableSmoothing: true,
          },
        );
        logger.log("useBlazePose", "BlazePose loaded from offline models");

        if (!mounted) {
          loadedDetector.dispose();
          return;
        }

        // Warmup inference: compile WebGL shaders ahead of real detection
        if (mounted) setStatus("Warming up model...");
        logger.log("useBlazePose", "Running warmup inference...");
        try {
          const warmupTensor = tf.zeros([1, 1, 3]) as tf.Tensor3D;
          await loadedDetector.estimatePoses(warmupTensor);
          warmupTensor.dispose();
          logger.log("useBlazePose", "Warmup inference completed");
        } catch (warmupErr) {
          // Warmup error is non-fatal; shaders compile on first real frame
          logger.warn(
            "useBlazePose",
            "Warmup inference failed (non-fatal):",
            warmupErr,
          );
        }

        if (!mounted) {
          loadedDetector.dispose();
          return;
        }

        detectorRef.current = loadedDetector;
        setDetector(loadedDetector);
        const successStatus = "Model loaded successfully!";
        setStatus(successStatus);
        logger.log("useBlazePose", successStatus);
        logger.log("useBlazePose", "Detector instance ready", {
          hasDetector: !!loadedDetector,
          backend: tf.getBackend(),
        });
        setIsLoading(false);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        const errorMessage =
          err instanceof Error ? err.message : "Error loading model";
        logger.error("useBlazePose", "Error:", errorMessage);
        setError(errorMessage);
        setStatus(`Error: ${errorMessage}`);
        setIsLoading(false);
      }
    };

    loadModel();

    return () => {
      mounted = false;
      if (detectorRef.current) {
        logger.log("useBlazePose", "Disposing BlazePose detector");
        detectorRef.current.dispose();
        detectorRef.current = null;
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
