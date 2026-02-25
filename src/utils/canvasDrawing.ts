import * as poseDetection from "@tensorflow-models/pose-detection";
import { logger } from "./logger";
import type { RecordingAngleEntry } from "./poseUtils";

// Color constants
const KEYPOINT_COLOR = "red";
const SKELETON_COLOR = "lime";
const ANGLE_COLOR = "#00BFFF"; // Deep Sky Blue for angles
const ANGLE_TEXT_COLOR = "#FFD700"; // Gold for angle values
const VISIBILITY_THRESHOLD = 0.1;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const normalizedScore = (score: number | undefined) =>
  isFiniteNumber(score) ? score : 1;

const isVisibleKeypoint = (kp: poseDetection.Keypoint) =>
  isFiniteNumber(kp.x) &&
  isFiniteNumber(kp.y) &&
  normalizedScore(kp.score) > VISIBILITY_THRESHOLD;

const getAdjacentPairsForPose = (keypointCount: number): [number, number][] => {
  const model =
    keypointCount > 20
      ? poseDetection.SupportedModels.BlazePose
      : poseDetection.SupportedModels.MoveNet;

  return poseDetection.util
    .getAdjacentPairs(model)
    .map(([i, j]) => [i, j] as [number, number]);
};

// Helper function to draw a single keypoint
export const drawKeypoint = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  color: string = KEYPOINT_COLOR,
) => {
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.font = "10px Arial";
  ctx.fillText(label, x + 10, y);
};

// Helper function to draw connections between keypoints
export const drawConnections = (
  ctx: CanvasRenderingContext2D,
  keypoints: poseDetection.Keypoint[],
  adjacentPairs: [number, number][],
  color: string = SKELETON_COLOR,
) => {
  adjacentPairs.forEach(([i, j]) => {
    const kp1 = keypoints[i];
    const kp2 = keypoints[j];

    if (isVisibleKeypoint(kp1) && isVisibleKeypoint(kp2)) {
      ctx.beginPath();
      ctx.moveTo(kp1.x, kp1.y);
      ctx.lineTo(kp2.x, kp2.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
};

// Helper function to draw angle arc and value
export const drawAngle = (
  ctx: CanvasRenderingContext2D,
  keypoints: poseDetection.Keypoint[],
  angleEntry: RecordingAngleEntry,
  scaleX: number,
  scaleY: number,
) => {
  const [p1Name, vertexName, p3Name] = angleEntry.points;

  const p1 = keypoints.find((kp) => kp.name === p1Name);
  const vertex = keypoints.find((kp) => kp.name === vertexName);
  const p3 = keypoints.find((kp) => kp.name === p3Name);

  if (!p1 || !vertex || !p3) return;
  if (
    !isVisibleKeypoint(p1) ||
    !isVisibleKeypoint(vertex) ||
    !isVisibleKeypoint(p3)
  )
    return;

  const vx = vertex.x * scaleX;
  const vy = vertex.y * scaleY;
  const p1x = p1.x * scaleX;
  const p1y = p1.y * scaleY;
  const p3x = p3.x * scaleX;
  const p3y = p3.y * scaleY;

  // Draw angle arc
  const arcRadius = 25;
  const startAngle = Math.atan2(p1y - vy, p1x - vx);
  const endAngle = Math.atan2(p3y - vy, p3x - vx);

  ctx.beginPath();
  ctx.arc(vx, vy, arcRadius, startAngle, endAngle);
  ctx.strokeStyle = ANGLE_COLOR;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw angle value text
  const textAngle = (startAngle + endAngle) / 2;
  const textX = vx + Math.cos(textAngle) * (arcRadius + 15);
  const textY = vy + Math.sin(textAngle) * (arcRadius + 15);

  ctx.fillStyle = ANGLE_TEXT_COLOR;
  ctx.font = "bold 12px Arial";
  ctx.fillText(`${angleEntry.value.toFixed(0)}°`, textX, textY);
};

// Main draw function for poses
export const drawPosesOnCanvas = (
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  poses: poseDetection.Pose[],
  options?: {
    opacity?: number;
    skeletonColor?: string;
    keypointColor?: string;
    fitMode?: "fill" | "cover" | "contain";
    renderWidth?: number;
    renderHeight?: number;
  },
) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const renderWidth = Math.max(
    1,
    Math.floor(options?.renderWidth ?? canvas.clientWidth ?? canvas.width),
  );
  const renderHeight = Math.max(
    1,
    Math.floor(options?.renderHeight ?? canvas.clientHeight ?? canvas.height),
  );

  ctx.clearRect(0, 0, renderWidth, renderHeight);

  const opacity = options?.opacity ?? 1;
  const skeletonColor = options?.skeletonColor ?? SKELETON_COLOR;
  const keypointColor = options?.keypointColor ?? KEYPOINT_COLOR;
  const fitMode = options?.fitMode ?? "fill";

  ctx.save();
  ctx.globalAlpha = opacity;

  let scaleX = renderWidth / video.videoWidth;
  let scaleY = renderHeight / video.videoHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (fitMode === "cover" || fitMode === "contain") {
    const uniformScale =
      fitMode === "cover"
        ? Math.max(scaleX, scaleY)
        : Math.min(scaleX, scaleY);
    scaleX = uniformScale;
    scaleY = uniformScale;
    offsetX = (renderWidth - video.videoWidth * uniformScale) / 2;
    offsetY = (renderHeight - video.videoHeight * uniformScale) / 2;
  }

  logger.log(
    "Canvas",
    `Video: ${video.videoWidth}x${video.videoHeight}, Render: ${renderWidth}x${renderHeight}, Fit: ${fitMode}`,
  );

  poses.forEach((pose) => {
    const visibleKeypoints = pose.keypoints.filter(isVisibleKeypoint);
    logger.log("Canvas", `Pose has ${visibleKeypoints.length} visible keypoints`);

    // Draw keypoints
    pose.keypoints.forEach((keypoint) => {
      if (isVisibleKeypoint(keypoint)) {
        const x = keypoint.x * scaleX + offsetX;
        const y = keypoint.y * scaleY + offsetY;
        drawKeypoint(ctx, x, y, keypoint.name || "", keypointColor);
      }
    });

    // Draw connections
    const adjacentKeyPoints = getAdjacentPairsForPose(pose.keypoints.length);

    const scaledKeypoints = pose.keypoints.map((kp) => ({
      ...kp,
      x: kp.x * scaleX + offsetX,
      y: kp.y * scaleY + offsetY,
    }));

    drawConnections(ctx, scaledKeypoints, adjacentKeyPoints, skeletonColor);
  });

  ctx.restore();
};

// Calculate bounding box for visible keypoints
const calculateBoundingBox = (poses: poseDetection.Pose[]) => {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  let hasVisiblePoints = false;

  poses.forEach((pose) => {
    pose.keypoints.forEach((kp) => {
      if (isVisibleKeypoint(kp)) {
        hasVisiblePoints = true;
        minX = Math.min(minX, kp.x);
        minY = Math.min(minY, kp.y);
        maxX = Math.max(maxX, kp.x);
        maxY = Math.max(maxY, kp.y);
      }
    });
  });

  if (!hasVisiblePoints) {
    return { minX: 0, minY: 0, maxX: 640, maxY: 480, width: 640, height: 480 };
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

// Draw poses from recorded data with auto-centering
export const drawRecordedPose = (
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  poses: poseDetection.Pose[],
  angles?: RecordingAngleEntry[],
  skeletonColor: string = SKELETON_COLOR,
  keypointColor: string = KEYPOINT_COLOR,
) => {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  if (poses.length === 0) return;

  // Calculate bounding box of visible keypoints
  const bbox = calculateBoundingBox(poses);

  // Add padding around the skeleton (20% of bounding box size)
  const paddingX = bbox.width * 0.2;
  const paddingY = bbox.height * 0.2;
  const contentWidth = bbox.width + paddingX * 2;
  const contentHeight = bbox.height + paddingY * 2;

  // Calculate scale to fit content in canvas while maintaining aspect ratio
  const scaleToFit = Math.min(
    canvasWidth / contentWidth,
    canvasHeight / contentHeight,
  );

  // Calculate offset to center the content
  const scaledContentWidth = contentWidth * scaleToFit;
  const scaledContentHeight = contentHeight * scaleToFit;
  const offsetX =
    (canvasWidth - scaledContentWidth) / 2 -
    (bbox.minX - paddingX) * scaleToFit;
  const offsetY =
    (canvasHeight - scaledContentHeight) / 2 -
    (bbox.minY - paddingY) * scaleToFit;

  poses.forEach((pose) => {
    // Draw connections first (behind keypoints)
    const adjacentKeyPoints = getAdjacentPairsForPose(pose.keypoints.length);

    const scaledKeypoints = pose.keypoints.map((kp) => ({
      ...kp,
      x: kp.x * scaleToFit + offsetX,
      y: kp.y * scaleToFit + offsetY,
    }));

    drawConnections(ctx, scaledKeypoints, adjacentKeyPoints, skeletonColor);

    // Draw keypoints
    pose.keypoints.forEach((keypoint) => {
      if (isVisibleKeypoint(keypoint)) {
        const x = keypoint.x * scaleToFit + offsetX;
        const y = keypoint.y * scaleToFit + offsetY;
        drawKeypoint(ctx, x, y, "", keypointColor);
      }
    });

    // Always draw angles if provided
    if (angles && angles.length > 0) {
      angles.forEach((angleEntry) => {
        drawAngleCentered(
          ctx,
          pose.keypoints,
          angleEntry,
          scaleToFit,
          offsetX,
          offsetY,
        );
      });
    }
  });
};

// Helper function to draw angle with centering transform
const drawAngleCentered = (
  ctx: CanvasRenderingContext2D,
  keypoints: poseDetection.Keypoint[],
  angleEntry: RecordingAngleEntry,
  scale: number,
  offsetX: number,
  offsetY: number,
) => {
  const [p1Name, vertexName, p3Name] = angleEntry.points;

  const p1 = keypoints.find((kp) => kp.name === p1Name);
  const vertex = keypoints.find((kp) => kp.name === vertexName);
  const p3 = keypoints.find((kp) => kp.name === p3Name);

  if (!p1 || !vertex || !p3) return;
  if (
    !isVisibleKeypoint(p1) ||
    !isVisibleKeypoint(vertex) ||
    !isVisibleKeypoint(p3)
  )
    return;

  const vx = vertex.x * scale + offsetX;
  const vy = vertex.y * scale + offsetY;
  const p1x = p1.x * scale + offsetX;
  const p1y = p1.y * scale + offsetY;
  const p3x = p3.x * scale + offsetX;
  const p3y = p3.y * scale + offsetY;

  // Draw angle arc
  const arcRadius = 25;
  const startAngle = Math.atan2(p1y - vy, p1x - vx);
  const endAngle = Math.atan2(p3y - vy, p3x - vx);

  ctx.beginPath();
  ctx.arc(vx, vy, arcRadius, startAngle, endAngle);
  ctx.strokeStyle = ANGLE_COLOR;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw angle value text
  const textAngle = (startAngle + endAngle) / 2;
  const textX = vx + Math.cos(textAngle) * (arcRadius + 15);
  const textY = vy + Math.sin(textAngle) * (arcRadius + 15);

  ctx.fillStyle = ANGLE_TEXT_COLOR;
  ctx.font = "bold 12px Arial";
  ctx.fillText(`${angleEntry.value.toFixed(0)}°`, textX, textY);
};
