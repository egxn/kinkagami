import { useRef, useEffect, useState } from "react";

import * as tf from "@tensorflow/tfjs";
import * as poseDetection from "@tensorflow-models/pose-detection";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-wasm";

import { logger } from "../utils/logger";

interface UseBlazePoseReturn {
  detector: poseDetection.PoseDetector | null;
  isLoading: boolean;
  error: string | null;
  status: string;
}

export const useBlazePose = (): UseBlazePoseReturn => {
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

        const loadStatus = "Loading BlazePose model...";
        if (mounted) setStatus(loadStatus);
        logger.log("useBlazePose", loadStatus);
        logger.log("useBlazePose", "BlazePose offline config", {
          runtime: "tfjs",
          modelType: "full",
          backend: tf.getBackend(),
        });

        const detectorCheck = await fetch("/models/blazepose/detector/model.json", {
          method: "HEAD",
        });
        if (!detectorCheck.ok) {
          throw new Error(
            `Missing BlazePose detector model at /models/blazepose/detector/model.json. ` +
              "Add detector files under /public/models/blazepose/detector/.",
          );
        }

        const landmarkCheck = await fetch("/models/blazepose/landmark/model.json", {
          method: "HEAD",
        });
        if (!landmarkCheck.ok) {
          throw new Error(
            `Missing BlazePose landmark model at /models/blazepose/landmark/model.json. ` +
              "Add landmark files under /public/models/blazepose/landmark/.",
          );
        }

        const loadedDetector = await poseDetection.createDetector(
          poseDetection.SupportedModels.BlazePose,
          {
            runtime: "tfjs",
            modelType: "full" as const,
            detectorModelUrl: "/models/blazepose/detector/model.json",
            landmarkModelUrl: "/models/blazepose/landmark/model.json",
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
          logger.warn("useBlazePose", "Warmup inference failed (non-fatal):", warmupErr);
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
  }, []);

  return {
    detector,
    isLoading,
    error,
    status,
  };
};
