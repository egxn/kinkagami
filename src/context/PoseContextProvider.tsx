import { useMemo, useRef } from "react";
import React from "react";
import { useAppConfig, useCamera, useMovenet } from "../hooks";
import PoseContext from "./PoseContext";

import type { ReactNode } from "react";
import type { PoseContextType } from "./PoseContext";

interface PoseProviderProps {
  children: ReactNode;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}

export const PoseProvider = ({
  children,
  videoRef: externalVideoRef,
}: PoseProviderProps) => {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const { config: appConfig } = useAppConfig();

  const {
    stream,
    error: cameraError,
    isReady: cameraReady,
    onStreamReady,
    streamReady,
  } = useCamera(videoRef as React.RefObject<HTMLVideoElement>, {
    flow: appConfig.camera.source,
    streamUrl: appConfig.camera.streamUrl,
  });
  const { detector, isLoading: modelLoading, error: modelError } = useMovenet();

  const value = useMemo<PoseContextType>(
    () => ({
      videoRef: videoRef as React.RefObject<HTMLVideoElement>,
      stream,
      detector,
      cameraError,
      cameraReady,
      modelLoading,
      modelError,
      onStreamReady,
      streamReady,
    }),
    [
      videoRef,
      stream,
      detector,
      cameraError,
      cameraReady,
      modelLoading,
      modelError,
      onStreamReady,
      streamReady,
    ],
  );

  return <PoseContext.Provider value={value}>{children}</PoseContext.Provider>;
};
