import { useEffect, useCallback, memo, useState } from "react";
import * as poseDetection from "@tensorflow-models/pose-detection";
import usePoseContext from "../../context/usePoseContext";
import { usePoseDetection } from "../../hooks/usePoseDetection";
import { logger } from "../../utils/logger";
import Skeleton from "../../components/Skeleton";

function Canvas() {
  const { videoRef, stream, detector, modelLoading, streamReady } =
    usePoseContext();
  const [poses, setPoses] = useState<poseDetection.Pose[]>([]);

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
    detector,
    videoRef,
    modelLoading,
    streamReady,
    onPosesDetected: handlePosesDetected,
    debugTag: "MoveNet/Canvas",
  });

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
        poses={poses}
        opacity={1}
        colors={{ skeleton: "lime", keypoints: "red" }}
      />
    </div>
  );
}

export default memo(Canvas);
