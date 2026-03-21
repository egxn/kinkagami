import type * as poseDetection from "@tensorflow-models/pose-detection";

export type BackendModelType = "movenet" | "blazepose" | "handpose";

export interface HandKeypoint {
  x: number;
  y: number;
  score?: number;
  name?: string;
  z?: number;
}

export interface HandPrediction {
  keypoints?: HandKeypoint[];
  score?: number;
  handedness?: string;
}

export interface PoseEstimatorInput {
  input?:
    | HTMLVideoElement
    | HTMLImageElement
    | HTMLCanvasElement
    | ImageBitmap
    | ImageData;
}

export type PoseEstimator = Pick<
  poseDetection.PoseDetector,
  "estimatePoses" | "dispose"
>;

export interface HandEstimator {
  estimateHands: (
    input?: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  ) => Promise<HandPrediction[]>;
  dispose?: () => void;
}

export interface ModelRuntimeState {
  isLoading: boolean;
  error: string | null;
  status: string;
}
