import { useMemo, useRef } from "react";
import React from "react";
import { useCamera, useCameraSource, useHandPose } from "../hooks";
import HandPoseContext from "./HandPoseContext";

import type { ReactNode } from "react";
import type { HandPoseContextType } from "./HandPoseContext";

interface HandPoseProviderProps {
  children: ReactNode;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}

export const HandPoseProvider = ({
  children,
  videoRef: externalVideoRef,
}: HandPoseProviderProps) => {
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
  const {
    detector,
    isLoading: modelLoading,
    error: modelError,
  } = useHandPose();

  const value = useMemo<HandPoseContextType>(
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

  return (
    <HandPoseContext.Provider value={value}>
      {children}
    </HandPoseContext.Provider>
  );
};
