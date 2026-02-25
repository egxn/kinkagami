import { createContext } from "react";

import type { HandPoseDetector } from "../hooks/useHandPose";

export interface HandPoseContextType {
  videoRef: React.RefObject<HTMLVideoElement>;
  stream: MediaStream | null;
  detector: HandPoseDetector | null;
  cameraError: string | null;
  cameraReady: boolean;
  modelLoading: boolean;
  modelError: string | null;
  onStreamReady: (() => void) | null;
  streamReady: boolean;
}

const HandPoseContext = createContext<HandPoseContextType | undefined>(
  undefined,
);

export default HandPoseContext;
