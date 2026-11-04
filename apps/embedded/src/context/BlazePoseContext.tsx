import { createContext } from "react";
import type { PoseEstimator } from "../types/inference";

export interface BlazePoseContextType {
  videoRef: React.RefObject<HTMLVideoElement>;
  stream: MediaStream | null;
  detector: PoseEstimator | null;
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
