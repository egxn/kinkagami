import { useRef, useEffect, useCallback } from "react";
import * as poseDetection from "@tensorflow-models/pose-detection";
import { logger } from "../utils/logger";

interface UsePoseDetectionProps {
  detector: poseDetection.PoseDetector | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  modelLoading: boolean;
  streamReady: boolean;
  onPosesDetected: (poses: poseDetection.Pose[]) => void;
  debugTag?: string;
  debugVerbose?: boolean;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 segundos
const FRAME_INTERVAL = 30; // ~33fps

export const usePoseDetection = ({
  detector,
  videoRef,
  modelLoading,
  streamReady,
  onPosesDetected,
  debugTag = "usePoseDetection",
  debugVerbose = false,
}: UsePoseDetectionProps) => {
  const detectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDetectingRef = useRef(false);
  const detectionStartedRef = useRef(false);
  const loopIdRef = useRef(0);

  // Cleanup function
  const cleanup = useCallback(() => {
    loopIdRef.current += 1;
    detectionStartedRef.current = false;
    if (detectionTimeoutRef.current) {
      clearTimeout(detectionTimeoutRef.current);
      detectionTimeoutRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    isDetectingRef.current = false;
  }, []);

  // Perform pose estimation
  const estimatePoses = useCallback(
    async (video: HTMLVideoElement) => {
      if (!detector || video.videoWidth === 0 || video.videoHeight === 0) {
        return [];
      }

      // Sync HTML attributes so the library's getImageSize reads real dimensions
      if (video.width !== video.videoWidth) video.width = video.videoWidth;
      if (video.height !== video.videoHeight) video.height = video.videoHeight;

      try {
        return await detector.estimatePoses(video);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const isDisposedTensorError = message.includes("Tensor is disposed");
        if (!isDisposedTensorError) {
          logger.error(debugTag, "Error during pose estimation:", err);
        } else {
          logger.warn(
            debugTag,
            "estimatePoses skipped: detector/tensor already disposed",
          );
        }
        return [];
      }
    },
    [detector, debugTag],
  );

  // Detection loop
  const startDetectionLoop = useCallback(() => {
    if (!detector || modelLoading || !streamReady) {
      logger.log(
        debugTag,
        "Skipping detection loop: detector or stream not ready",
        {
          hasDetector: !!detector,
          modelLoading,
          streamReady,
        },
      );
      return;
    }

    const loopId = ++loopIdRef.current;
    logger.log(debugTag, "Starting pose detection loop...", {
      loopId,
      hasDetector: !!detector,
    });
    let frameCount = 0;
    let retryCount = 0;
    let emptyPoseFrames = 0;

    const detectLoop = async () => {
      if (loopId !== loopIdRef.current) return;
      if (isDetectingRef.current) return;

      isDetectingRef.current = true;
      try {
        frameCount++;
        const video = videoRef.current;

        if (!video) {
          logger.log(debugTag, `Frame ${frameCount}: Video ref not available`);
          return;
        }

        if (video.videoWidth === 0 || video.videoHeight === 0) {
          if (frameCount % 30 === 0) {
            logger.log(
              debugTag,
              `Frame ${frameCount}: Video not ready for inference`,
              {
                readyState: video.readyState,
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
                paused: video.paused,
              },
            );
          }
          return;
        }

        const poses = await estimatePoses(video);
        if (loopId !== loopIdRef.current) return;

        if (poses.length > 0) {
          const firstPose = poses[0];
          const firstPoseScore = firstPose?.score;
          const keypoints = firstPose?.keypoints ?? [];
          const visibleKeypoints = keypoints.filter((kp) => {
            const score = kp.score;
            const safeScore =
              typeof score === "number" && Number.isFinite(score) ? score : 1;
            return (
              Number.isFinite(kp.x) && Number.isFinite(kp.y) && safeScore > 0.1
            );
          }).length;
          const safeFirstPoseScore =
            typeof firstPoseScore === "number" &&
            Number.isFinite(firstPoseScore)
              ? firstPoseScore
              : null;
          logger.log(
            debugTag,
            `Frame ${frameCount}: Detected ${poses.length} pose(s)`,
            {
              firstPoseScore: safeFirstPoseScore,
              visibleKeypoints,
            },
          );

          if (debugVerbose && frameCount % 30 === 0 && firstPose) {
            const validCoords = keypoints.filter(
              (kp) => Number.isFinite(kp.x) && Number.isFinite(kp.y),
            ).length;
            const nanCoords = keypoints.filter(
              (kp) => !Number.isFinite(kp.x) || !Number.isFinite(kp.y),
            ).length;
            const finiteScores = keypoints.filter(
              (kp) => typeof kp.score === "number" && Number.isFinite(kp.score),
            ).length;
            const nanScores = keypoints.filter(
              (kp) =>
                typeof kp.score === "number" && !Number.isFinite(kp.score),
            ).length;
            const undefinedScores = keypoints.length - finiteScores - nanScores;
            const sample = keypoints.slice(0, 5).map((kp) => ({
              name: kp.name ?? "unknown",
              x: Number.isFinite(kp.x) ? Number(kp.x.toFixed(2)) : kp.x,
              y: Number.isFinite(kp.y) ? Number(kp.y.toFixed(2)) : kp.y,
              score:
                typeof kp.score === "number" && Number.isFinite(kp.score)
                  ? Number(kp.score.toFixed(4))
                  : kp.score,
            }));

            logger.warn(debugTag, `Frame ${frameCount}: Raw pose diagnostics`, {
              poseCount: poses.length,
              keypoints: keypoints.length,
              validCoords,
              nanCoords,
              finiteScores,
              nanScores,
              undefinedScores,
              videoReadyState: video.readyState,
              videoPaused: video.paused,
              videoCurrentTime: Number(video.currentTime.toFixed(3)),
              sample,
            });
          }

          onPosesDetected(poses);
          retryCount = 0; // Reset retry count on success
          emptyPoseFrames = 0;
        } else {
          emptyPoseFrames++;
          if (emptyPoseFrames % 30 === 0) {
            logger.warn(
              debugTag,
              `No poses detected for ${emptyPoseFrames} frames`,
              {
                loopId,
                frameCount,
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
                readyState: video.readyState,
              },
            );
          }
        }
      } finally {
        isDetectingRef.current = false;
        if (loopId === loopIdRef.current) {
          detectionTimeoutRef.current = setTimeout(detectLoop, FRAME_INTERVAL);
        }
      }
    };

    // Start detection loop
    detectLoop();

    // Setup retry mechanism
    const setupRetry = () => {
      retryTimeoutRef.current = setTimeout(() => {
        if (loopId !== loopIdRef.current) return;
        if (frameCount === 0 && retryCount < MAX_RETRIES) {
          retryCount++;
          logger.log(
            debugTag,
            `Retry ${retryCount}/${MAX_RETRIES}: Restarting detection...`,
          );

          // Clear detection loop
          if (detectionTimeoutRef.current) {
            clearTimeout(detectionTimeoutRef.current);
          }

          // Reset and restart
          frameCount = 0;
          isDetectingRef.current = false;
          detectLoop();
          setupRetry();
        } else if (retryCount >= MAX_RETRIES) {
          logger.error(debugTag, "Max retries reached for pose detection");
        }
      }, RETRY_DELAY);
    };

    setupRetry();
  }, [
    detector,
    modelLoading,
    streamReady,
    videoRef,
    estimatePoses,
    onPosesDetected,
    debugTag,
    debugVerbose,
  ]);

  // Main detection effect
  useEffect(() => {
    logger.log(debugTag, "Pose detection effect triggered", {
      hasDetector: !!detector,
      modelLoading,
      streamReady,
    });

    if (!detector || modelLoading || !streamReady) {
      cleanup();
      return;
    }

    detectionStartedRef.current = true;
    startDetectionLoop();

    return cleanup;
  }, [
    detector,
    modelLoading,
    streamReady,
    videoRef,
    startDetectionLoop,
    cleanup,
    debugTag,
    debugVerbose,
  ]);

  return { cleanup };
};
