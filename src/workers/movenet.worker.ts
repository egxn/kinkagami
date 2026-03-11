import * as tf from "@tensorflow/tfjs";
import * as poseDetection from "@tensorflow-models/pose-detection";
import "@tensorflow/tfjs-backend-webgl";
import "@tensorflow/tfjs-backend-wasm";
import { getMoveNetModelUrl } from "../utils/modelVersions";
import type {
  MoveNetWorkerRequest,
  MoveNetWorkerResponse,
  WorkerPose,
} from "./movenetMessages";

let detector: poseDetection.PoseDetector | null = null;

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<MoveNetWorkerRequest>) => void) | null;
  postMessage: (message: MoveNetWorkerResponse) => void;
};

const postError = (error: unknown, requestId?: number) => {
  const message = error instanceof Error ? error.message : String(error);
  workerScope.postMessage({ type: "error", error: message, requestId });
};

const toWorkerPoses = (poses: poseDetection.Pose[]): WorkerPose[] => {
  return (poses ?? []).map((pose) => ({
    score: pose.score,
    keypoints: (pose.keypoints ?? []).map((kp) => ({
      x: kp.x,
      y: kp.y,
      score: kp.score,
      name: kp.name,
    })),
  }));
};

const initializeDetector = async (version: "thunder" | "lightning", backend: "webgl" | "wasm") => {
  if (detector) {
    detector.dispose();
    detector = null;
  }

  try {
    await tf.setBackend(backend);
    await tf.ready();
  } catch {
    const fallback = backend === "webgl" ? "wasm" : "webgl";
    await tf.setBackend(fallback);
    await tf.ready();
  }

  const modelType =
    version === "thunder"
      ? poseDetection.movenet.modelType.SINGLEPOSE_THUNDER
      : poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING;

  detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    {
      modelType,
      modelUrl: getMoveNetModelUrl(version),
      enableSmoothing: true,
    },
  );
};

workerScope.onmessage = async (event: MessageEvent<MoveNetWorkerRequest>) => {
  const message = event.data;

  if (message.type === "dispose") {
    if (detector) {
      detector.dispose();
      detector = null;
    }
    return;
  }

  if (message.type === "init") {
    try {
      await initializeDetector(message.version, message.backend);
      workerScope.postMessage({ type: "ready" });
    } catch (error) {
      postError(error);
    }
    return;
  }

  if (message.type === "estimate") {
    const { requestId, imageBitmap } = message;

    if (!detector) {
      postError("MoveNet worker not initialized", requestId);
      imageBitmap.close();
      return;
    }

    try {
      const poses = await detector.estimatePoses(imageBitmap);
      workerScope.postMessage({
        type: "result",
        requestId,
        poses: toWorkerPoses(poses),
      });
    } catch (error) {
      postError(error, requestId);
    } finally {
      imageBitmap.close();
    }
  }
};