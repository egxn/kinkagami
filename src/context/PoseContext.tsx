import { createContext } from "react";
import type { PoseEstimator } from "../types/inference";

export interface PoseContextType {
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

const PoseContext = createContext<PoseContextType | undefined>(undefined);

export default PoseContext;
