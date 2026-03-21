import { useMemo, useRef } from "react";
import React from "react";
import { useCamera, useCameraSource } from "../hooks";
import { usePoseInference } from "../inference";
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
  const cameraSource = useCameraSource();

  const {
    stream,
    error: cameraError,
    isReady: cameraReady,
    onStreamReady,
    streamReady,
  } = useCamera(videoRef as React.RefObject<HTMLVideoElement>, cameraSource);
  const { detector, isLoading: modelLoading, error: modelError } =
    usePoseInference();

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
