import { useMemo, useRef } from "react";
import React from "react";
import { useCamera, useBlazePose } from "../hooks";
import BlazePoseContext from "./BlazePoseContext";

import type { ReactNode } from "react";
import type { BlazePoseContextType } from "./BlazePoseContext";

interface BlazePoseProviderProps {
  children: ReactNode;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}

export const BlazePoseProvider = ({
  children,
  videoRef: externalVideoRef,
}: BlazePoseProviderProps) => {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;

  const {
    stream,
    error: cameraError,
    isReady: cameraReady,
    onStreamReady,
    streamReady,
  } = useCamera(videoRef as React.RefObject<HTMLVideoElement>);
  const { detector, isLoading: modelLoading, error: modelError } = useBlazePose();

  const value = useMemo<BlazePoseContextType>(
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
    <BlazePoseContext.Provider value={value}>{children}</BlazePoseContext.Provider>
  );
};
