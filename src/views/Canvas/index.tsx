import { useRef, useEffect, useCallback, memo } from "react";
import * as poseDetection from "@tensorflow-models/pose-detection";
import usePoseContext from "../../context/usePoseContext";
import { usePoseDetection } from "../../hooks/usePoseDetection";
import { drawPosesOnCanvas } from "../../utils/canvasDrawing";
import { logger } from "../../utils/logger";

function Canvas() {
  const { videoRef, stream, detector, modelLoading, streamReady } =
    usePoseContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Handle poses detected
  const handlePosesDetected = useCallback(
    (poses: poseDetection.Pose[]) => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;
      drawPosesOnCanvas(canvas, video, poses);
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

  // Sync canvas dimensions with window
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateCanvasDimensions = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      logger.log(
        "Canvas",
        `Canvas dimensions: ${canvas.width}x${canvas.height}`,
      );
    };

    updateCanvasDimensions();
    window.addEventListener("resize", updateCanvasDimensions);

    return () => {
      window.removeEventListener("resize", updateCanvasDimensions);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        transform: "scaleX(-1)",
        border: "none",
        pointerEvents: "none",
      }}
    />
  );
}

export default memo(Canvas);
