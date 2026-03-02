import { useEffect, useCallback, memo, useState } from "react";
import * as poseDetection from "@tensorflow-models/pose-detection";
import { useLocation } from "react-router-dom";
import usePoseContext from "../../context/usePoseContext";
import { useHandPose, usePoseDetection } from "../../hooks";
import { logger } from "../../utils/logger";
import Skeleton from "../../components/Skeleton";

function Canvas() {
  const location = useLocation();
  const { videoRef, stream, detector, modelLoading, streamReady } =
    usePoseContext();
  const {
    detector: handDetector,
    isLoading: handModelLoading,
    error: handModelError,
  } = useHandPose();
  const [poses, setPoses] = useState<poseDetection.Pose[]>([]);

  const isSplashRoute =
    location.pathname === "/splash" || location.pathname.endsWith("/stack/splash");
  const isRoutinesRoute =
    location.pathname === "/stack/routines" || location.pathname.endsWith("/routines");
  const isExercisesRoute =
    location.pathname === "/stack/exercises" || location.pathname.endsWith("/exercises");
  const useHandPoseRoute = isSplashRoute || isRoutinesRoute || isExercisesRoute;

  const effectiveDetector = useHandPoseRoute ? null : detector;
  const effectiveModelLoading = useHandPoseRoute ? true : modelLoading;

  // Handle poses detected
  const handlePosesDetected = useCallback(
    (poses: poseDetection.Pose[]) => {
      const video = videoRef.current;
      if (!video) return;
      setPoses(poses);
    },
    [videoRef],
  );

  // Use pose detection hook
  usePoseDetection({
    detector: effectiveDetector,
    videoRef,
    modelLoading: effectiveModelLoading,
    streamReady,
    onPosesDetected: handlePosesDetected,
    debugTag: useHandPoseRoute ? "HandPosePreload/Canvas" : "MoveNet/Canvas",
  });

  useEffect(() => {
    if (!useHandPoseRoute) return;

    logger.log("Canvas", "HandPose route detected: using HandPose model in Canvas", {
      path: location.pathname,
      handModelLoading,
      hasHandDetector: !!handDetector,
      handModelError,
    });
  }, [
    useHandPoseRoute,
    location.pathname,
    handModelLoading,
    handDetector,
    handModelError,
  ]);

  // Initialize video stream
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;

    const playVideo = async () => {
      try {
        await video.play();
        logger.log("Canvas", "Video playback started");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          logger.log(
            "Canvas",
            "Video playback aborted - stream may not be ready yet",
          );
        } else {
          logger.error("Canvas", "Error playing video:", error);
        }
      }
    };

    if (video.readyState >= 2) {
      playVideo();
    } else {
      video.addEventListener("loadedmetadata", playVideo, { once: true });
    }

    return () => {
      video.removeEventListener("loadedmetadata", playVideo);
    };
  }, [stream, videoRef]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: "scaleX(-1)",
        border: "none",
        pointerEvents: "none",
      }}
    >
      <Skeleton
        variant="video"
        autoSize
        videoRef={videoRef}
        poses={useHandPoseRoute ? [] : poses}
        opacity={1}
        poseModel="movenet"
      />
    </div>
  );
}

export default memo(Canvas);
