import { useRef, useEffect, useCallback } from 'react';
import * as poseDetection from '@tensorflow-models/pose-detection';
import { logger } from '../utils/logger';

interface UsePoseDetectionProps {
  detector: poseDetection.PoseDetector | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  modelLoading: boolean;
  streamReady: boolean;
  onPosesDetected: (poses: poseDetection.Pose[]) => void;
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
}: UsePoseDetectionProps) => {
  const detectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDetectingRef = useRef(false);
  const detectionStartedRef = useRef(false);

  // Cleanup function
  const cleanup = useCallback(() => {
    detectionStartedRef.current = false;
    if (detectionTimeoutRef.current) {
      clearTimeout(detectionTimeoutRef.current);
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
  }, []);

  // Perform pose estimation
  const estimatePoses = useCallback(async (video: HTMLVideoElement) => {
    if (!detector || video.videoWidth === 0 || video.videoHeight === 0) {
      return [];
    }

    try {
      return await detector.estimatePoses(video);
    } catch (err) {
      logger.error('usePoseDetection', 'Error during pose estimation:', err);
      return [];
    }
  }, [detector]);

  // Detection loop
  const startDetectionLoop = useCallback(() => {
    logger.log('usePoseDetection', 'Starting pose detection loop...');
    let frameCount = 0;
    let retryCount = 0;

    const detectLoop = async () => {
      if (isDetectingRef.current) return;

      isDetectingRef.current = true;
      try {
        frameCount++;
        const video = videoRef.current;
        
        if (!video) {
          logger.log('usePoseDetection', `Frame ${frameCount}: Video ref not available`);
          return;
        }

        if (video.videoWidth === 0 || video.videoHeight === 0) {
          logger.log('usePoseDetection', `Frame ${frameCount}: Video not ready for inference`);
          return;
        }

        const poses = await estimatePoses(video);

        if (poses.length > 0) {
          logger.log('usePoseDetection', `Frame ${frameCount}: Detected ${poses.length} pose(s)`);
          onPosesDetected(poses);
          retryCount = 0; // Reset retry count on success
        }
      } finally {
        isDetectingRef.current = false;
        detectionTimeoutRef.current = setTimeout(detectLoop, FRAME_INTERVAL);
      }
    };

    // Start detection loop
    detectLoop();

    // Setup retry mechanism
    const setupRetry = () => {
      retryTimeoutRef.current = setTimeout(() => {
        if (frameCount === 0 && retryCount < MAX_RETRIES) {
          retryCount++;
          logger.log('usePoseDetection', `Retry ${retryCount}/${MAX_RETRIES}: Restarting detection...`);

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
          logger.error('usePoseDetection', 'Max retries reached for pose detection');
        }
      }, RETRY_DELAY);
    };

    setupRetry();
  }, [videoRef, estimatePoses, onPosesDetected]);

  // Main detection effect
  useEffect(() => {
    logger.log('usePoseDetection', 'Pose detection effect triggered');

    detectionStartedRef.current = true;
    startDetectionLoop();

    return cleanup;
  }, [detector, modelLoading, streamReady, videoRef, startDetectionLoop, cleanup]);

  return { cleanup };
};
