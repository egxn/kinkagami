import { createContext } from "react";
import * as poseDetection from "@tensorflow-models/pose-detection";

export interface BlazePoseContextType {
  videoRef: React.RefObject<HTMLVideoElement>;
  stream: MediaStream | null;
  detector: poseDetection.PoseDetector | null;
  cameraError: string | null;
  cameraReady: boolean;
  modelLoading: boolean;
  modelError: string | null;
  onStreamReady: (() => void) | null;
  streamReady: boolean;
}

const BlazePoseContext = createContext<BlazePoseContextType | undefined>(
  undefined,
);

export default BlazePoseContext;
