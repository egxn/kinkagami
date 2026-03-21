import { useAppConfig } from "./useAppConfig";
import type { CameraFlowType } from "../utils/appConfig";

export interface ResolvedCameraConfig {
  flow: CameraFlowType;
  streamUrl: string;
}

/**
 * Resolves the camera source based on the current runtime execution mode.
 *
 * When the Python backend owns the physical camera (execution === "python"),
 * the frontend must consume the MJPEG stream instead of accessing the webcam
 * directly. This hook centralises that decision so context providers don't
 * need to know about it.
 */
export const useCameraSource = (): ResolvedCameraConfig => {
  const { config } = useAppConfig();

  if (config.runtime.execution === "python") {
    return {
      flow: "streamUrl",
      streamUrl: config.runtime.pythonStreamUrl,
    };
  }

  return {
    flow: config.camera.source,
    streamUrl: config.camera.streamUrl,
  };
};
