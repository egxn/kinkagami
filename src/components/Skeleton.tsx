import { useEffect, useMemo, useRef, useState } from "react";
import type { Pose } from "@tensorflow-models/pose-detection";
import type { RecordingAngleEntry } from "../utils/poseUtils";
import { drawPosesOnCanvas, drawRecordedPose } from "../utils/canvasDrawing";
import type { Exercise } from "../types/exercise";
import "./Skeleton.scss";

export type SkeletonVariant = "centered" | "video";

export interface SkeletonColors {
  skeleton?: string;
  keypoints?: string;
}

export interface SkeletonProps {
  className?: string;
  variant?: SkeletonVariant;

  /** When `autoSize` is true, the canvas will match the wrapper size. */
  autoSize?: boolean;

  /** Explicit canvas size (ignored if `autoSize` is true). */
  width?: number;
  height?: number;

  /** For `variant="video"`, pass the video element ref used for scaling. */
  videoRef?: React.RefObject<HTMLVideoElement | null>;

  /**
   * Source A: Provide poses directly (live or recorded).
   * - Required for `variant="video"`
   * - Optional for `variant="centered"` if using `exercise`
   */
  poses?: Pose[];

  /** Optional angles to render (only used by `variant="centered"`). */
  angles?: RecordingAngleEntry[];

  /**
   * Source B: Provide an exercise from DB; Skeleton will pick a frame and render its poses/angles.
   * Only used by `variant="centered"`.
   */
  exercise?: Exercise;
  frameIndex?: number;

  opacity?: number;
  colors?: SkeletonColors;
}

const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 480;

export default function Skeleton({
  className,
  variant = "centered",
  autoSize = false,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  videoRef,
  poses,
  angles,
  exercise,
  frameIndex,
  opacity = 1,
  colors,
}: SkeletonProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [measuredSize, setMeasuredSize] = useState<{ w: number; h: number }>();

  const size = useMemo(() => {
    if (autoSize) {
      return {
        w: Math.max(1, measuredSize?.w ?? width),
        h: Math.max(1, measuredSize?.h ?? height),
      };
    }
    return { w: Math.max(1, width), h: Math.max(1, height) };
  }, [autoSize, measuredSize?.w, measuredSize?.h, width, height]);

  // ResizeObserver for auto sizing
  useEffect(() => {
    if (!autoSize) return;
    const el = wrapperRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setMeasuredSize({ w: Math.round(rect.width), h: Math.round(rect.height) });
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [autoSize]);

  // Draw whenever inputs change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayW = size.w;
    const displayH = size.h;

    // Keep canvas crisp on HiDPI
    const backingW = Math.max(1, Math.floor(displayW * dpr));
    const backingH = Math.max(1, Math.floor(displayH * dpr));

    if (canvas.width !== backingW) canvas.width = backingW;
    if (canvas.height !== backingH) canvas.height = backingH;

    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;

    // Draw into backing store coordinates
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const skeletonColor = colors?.skeleton;
    const keypointColor = colors?.keypoints;

    if (variant === "video") {
      const video = videoRef?.current ?? null;
      if (!video) {
        ctx.clearRect(0, 0, displayW, displayH);
        return;
      }

      const livePoses = poses ?? [];

      drawPosesOnCanvas(canvas, video, livePoses, {
        opacity,
        skeletonColor,
        keypointColor,
        fitMode: "cover",
        renderWidth: displayW,
        renderHeight: displayH,
      });
      return;
    }

    const centeredFrameIndex = Math.max(0, frameIndex ?? 0);
    const centeredPoses =
      exercise?.recording_points?.[centeredFrameIndex]?.poses ?? poses ?? [];
    const centeredAngles =
      exercise?.recording_angles?.[centeredFrameIndex]?.angles ?? angles;

    // centered (recorded-like) render
    ctx.save();
    ctx.globalAlpha = opacity;
    drawRecordedPose(
      ctx,
      displayW,
      displayH,
      centeredPoses,
      centeredAngles,
      skeletonColor,
      keypointColor,
    );
    ctx.restore();
  }, [
    angles,
    colors?.keypoints,
    colors?.skeleton,
    exercise,
    frameIndex,
    opacity,
    poses,
    size.h,
    size.w,
    variant,
    videoRef,
  ]);

  return (
    <div ref={wrapperRef} className={`skeleton ${className ?? ""}`.trim()}>
      <canvas ref={canvasRef} className="skeleton__canvas" />
    </div>
  );
}
