import { useRef, useEffect, useState } from "react";
import { logger } from "../utils/logger";
import type { CameraFlowType } from "../utils/appConfig";

interface CameraConfigOptions {
  flow: CameraFlowType;
  streamUrl: string;
}

const DEFAULT_CAMERA_CONFIG: CameraConfigOptions = {
  flow: "web",
  streamUrl: "http://localhost:8090/?action=stream",
};

export const useCamera = (
  externalVideoRef?: React.RefObject<HTMLVideoElement>,
  options?: Partial<CameraConfigOptions>,
) => {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const videoRef = externalVideoRef || internalVideoRef;
  const cameraConfig = {
    ...DEFAULT_CAMERA_CONFIG,
    ...(options ?? {}),
  };
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onStreamReady, setOnStreamReady] = useState<(() => void) | null>(null);
  const [streamReady, setStreamReady] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const streamRef = useRef<MediaStream | null>(null);

  // Keep the video element's srcObject in sync with the stream
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (stream) {
      if (video.srcObject !== stream) {
        video.srcObject = stream;
        video.play().catch(() => {});
      }
    } else {
      video.srcObject = null;
    }
  }, [stream, videoRef]);

  useEffect(() => {
    let mounted = true;
    let rafId: number | null = null;
    let captureCanvas: HTMLCanvasElement | null = null;
    let captureImage: HTMLImageElement | null = null;

    setIsReady(false);
    setStreamReady(false);
    setError(null);
    setStream(null);

    const cleanupCurrent = () => {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (captureImage) {
        captureImage.onload = null;
        captureImage.onerror = null;
        captureImage.src = "";
      }
      captureImage = null;
      captureCanvas = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };

    const initMjpeg = async () => {
      try {
        logger.log("useCamera", "Initializing MJPEG stream", {
          streamUrl: cameraConfig.streamUrl,
        });

        // Derive the snapshot URL from the stream URL
        // e.g. http://host:port/stream → http://host:port/snapshot
        const snapshotUrl = cameraConfig.streamUrl.replace(/\/stream\b/, "/snapshot");

        const img = new Image();
        img.crossOrigin = "anonymous";
        captureImage = img;

        const canvas = document.createElement("canvas");
        captureCanvas = canvas;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Unable to create canvas context for MJPEG stream");
        }

        let streamInitialized = false;

        const requestNextFrame = () => {
          if (!mounted || !captureImage) return;
          // Cache-busting query so the browser doesn't cache the snapshot
          captureImage.src = `${snapshotUrl}?_t=${Date.now()}`;
        };

        img.onload = () => {
          if (!mounted || !captureCanvas || !captureImage) return;

          const width = Math.max(1, captureImage.naturalWidth || 640);
          const height = Math.max(1, captureImage.naturalHeight || 480);
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
          }

          try {
            ctx.drawImage(captureImage, 0, 0, canvas.width, canvas.height);
          } catch {
            // image not decoded yet – skip
          }

          if (!streamInitialized) {
            const capturedStream = canvas.captureStream(20);
            streamRef.current = capturedStream;
            setStream(capturedStream);
            setIsReady(true);
            setStreamReady(true);
            setOnStreamReady(() => () => {
              logger.log("useCamera", "MJPEG stream ready callback triggered");
            });
            logger.log("useCamera", "MJPEG stream ready", {
              width,
              height,
            });
            streamInitialized = true;
          }

          // Poll at display refresh rate (capped ~30fps by rAF)
          rafId = requestAnimationFrame(requestNextFrame);
        };

        img.onerror = () => {
          if (!mounted) return;
          // Backend may not have a frame yet; retry after a short delay
          setTimeout(requestNextFrame, 500);
        };

        requestNextFrame();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        setError(`MJPEG stream failed: ${message}`);
        logger.error("useCamera", "MJPEG stream failed", message);
      }
    };

    const init = async () => {
      if (cameraConfig.flow === "streamUrl") {
        await initMjpeg();
        return;
      }

      try {
        logger.log("useCamera", "Requesting camera access...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 320,
            height: 240,
            frameRate: { ideal: 20, max: 20 },
            facingMode: "user",
          },
        });

        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        setStream(stream);
        setIsReady(true);
        setStreamReady(true);
        logger.log("useCamera", "Camera stream obtained successfully");

        // Set callback to be called when stream is ready
        setOnStreamReady(() => () => {
          logger.log("useCamera", "Stream ready callback triggered");
        });
      } catch (error) {
        setError(
          "Camera access failed: " +
          (error instanceof Error ? error.message : String(error)),
        );
        logger.log(
          "useCamera",
          "Camera access failed: " +
          (error instanceof Error ? error.message : String(error)),
        );
      }
    };

    init();

    return () => {
      mounted = false;
      cleanupCurrent();
    };
  }, [cameraConfig.flow, cameraConfig.streamUrl]);

  return {
    videoRef: videoRef as React.RefObject<HTMLVideoElement>,
    stream,
    isReady,
    error,
    onStreamReady,
    streamReady,
  };
};
