import * as tf from "@tensorflow/tfjs";
import * as poseDetection from "@tensorflow-models/pose-detection";
import type { MoveNetVersion } from "@kgm/core";
import { getMoveNetModelUrl } from "../models/modelCache";

export type { PoseDetector } from "@tensorflow-models/pose-detection";

/** WebGL first (fast), CPU as a last resort. WASM is not shipped on web. */
async function ensureBackend(): Promise<void> {
  try {
    await tf.setBackend("webgl");
    await tf.ready();
  } catch {
    await tf.setBackend("cpu");
    await tf.ready();
  }
}

export async function createMovenetDetector(
  version: MoveNetVersion,
): Promise<poseDetection.PoseDetector> {
  await ensureBackend();
  return poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
    modelType:
      version === "thunder"
        ? poseDetection.movenet.modelType.SINGLEPOSE_THUNDER
        : poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    modelUrl: getMoveNetModelUrl(version),
    enableSmoothing: true,
  });
}
