import { useMemo, useRef } from "react";
import React from "react";
import { useCamera, useMovenet } from "../hooks";
import PoseContext from "./PoseContext";

import type { ReactNode } from "react";
import type { PoseContextType } from "./PoseContext";

interface PoseProviderProps {
  children: ReactNode;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
}

export const PoseProvider = ({ children, videoRef: externalVideoRef }: PoseProviderProps) => {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const onStreamReadyRef = useRef<(() => void) | null>(null);
  
  const { stream, error: cameraError, isReady: cameraReady, onStreamReady, streamReady } = useCamera(videoRef as React.RefObject<HTMLVideoElement>);
  const { detector, isLoading: modelLoading, error: modelError } = useMovenet();

  // Update the ref when onStreamReady changes
  React.useEffect(() => {
    onStreamReadyRef.current = onStreamReady;
  }, [onStreamReady]);

  const value = useMemo<PoseContextType>(
    () => ({
      videoRef: videoRef as React.RefObject<HTMLVideoElement>,
      stream,
      detector,
      cameraError,
      cameraReady,
      modelLoading,
      modelError,
      onStreamReady: onStreamReadyRef.current,
      streamReady,
    }),
    [videoRef, stream, detector, cameraError, cameraReady, modelLoading, modelError, streamReady],
  );

  return <PoseContext.Provider value={value}>{children}</PoseContext.Provider>;
};
