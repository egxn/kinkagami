import type { Pose } from "@tensorflow-models/pose-detection";
import type {
  BodyPart,
  GridValidationDefinition,
  RecordingPoint,
} from "../types/exercise";
import { findKeypoint } from "./geometry";

export const DEFAULT_GRID_ROWS = 3;
export const DEFAULT_GRID_COLS = 3;
export const DEFAULT_GRID_MIN_CONFIDENCE = 0.3;

const DEFAULT_GRID_KEYPOINTS: BodyPart[] = [
  "left_wrist",
  "right_wrist",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const toCellIndex = (
  xNorm: number,
  yNorm: number,
  cols: number,
  rows: number,
): number => {
  const col = clamp(Math.floor(xNorm * cols), 0, cols - 1);
  const row = clamp(Math.floor(yNorm * rows), 0, rows - 1);
  return row * cols + col;
};

const getPoseBounds = (pose: Pose, minConfidence: number) => {
  const valid = (pose.keypoints ?? []).filter(
    (kp) =>
      Number.isFinite(kp.x) &&
      Number.isFinite(kp.y) &&
      (typeof kp.score !== "number" || kp.score >= minConfidence),
  );

  if (valid.length < 3) return null;

  const xs = valid.map((kp) => kp.x);
  const ys = valid.map((kp) => kp.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const width = maxX - minX;
  const height = maxY - minY;

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1
  ) {
    return null;
  }

  return { minX, minY, width, height };
};

const appendCompressedCell = (
  sequenceByKeypoint: Record<string, number[]>,
  keypoint: string,
  cellIndex: number,
) => {
  const sequence = sequenceByKeypoint[keypoint] ?? [];
  const lastCell = sequence.length > 0 ? sequence[sequence.length - 1] : null;
  if (lastCell === cellIndex) {
    sequenceByKeypoint[keypoint] = sequence;
    return;
  }

  sequence.push(cellIndex);
  sequenceByKeypoint[keypoint] = sequence;
};

export interface BuildGridValidationOptions {
  rows?: number;
  cols?: number;
  keypoints?: BodyPart[];
  minConfidence?: number;
}

export function buildGridValidationDefinition(
  points: RecordingPoint[],
  options?: BuildGridValidationOptions,
): GridValidationDefinition {
  const rows = Math.max(2, Math.floor(options?.rows ?? DEFAULT_GRID_ROWS));
  const cols = Math.max(2, Math.floor(options?.cols ?? DEFAULT_GRID_COLS));
  const minConfidence = options?.minConfidence ?? DEFAULT_GRID_MIN_CONFIDENCE;
  const keypoints = options?.keypoints?.length
    ? options.keypoints
    : DEFAULT_GRID_KEYPOINTS;

  const cellSequenceByKeypoint: Record<string, number[]> = {};

  for (const frame of points) {
    const pose = frame.poses?.[0];
    if (!pose) continue;

    const bounds = getPoseBounds(pose, minConfidence);
    if (!bounds) continue;

    for (const keypointName of keypoints) {
      const kp = findKeypoint(pose.keypoints ?? [], keypointName);
      const score = kp?.score ?? 1;
      if (
        !kp ||
        !Number.isFinite(kp.x) ||
        !Number.isFinite(kp.y) ||
        score < minConfidence
      ) {
        continue;
      }

      const xNorm = clamp((kp.x - bounds.minX) / bounds.width, 0, 0.999999);
      const yNorm = clamp((kp.y - bounds.minY) / bounds.height, 0, 0.999999);
      const cellIndex = toCellIndex(xNorm, yNorm, cols, rows);
      appendCompressedCell(cellSequenceByKeypoint, keypointName, cellIndex);
    }
  }

  const totalTransitionsByKeypoint: Record<string, number> = {};
  for (const keypointName of keypoints) {
    const sequence = cellSequenceByKeypoint[keypointName] ?? [];
    totalTransitionsByKeypoint[keypointName] = Math.max(0, sequence.length - 1);
  }

  return {
    version: 1,
    rows,
    cols,
    keypoints,
    min_confidence: minConfidence,
    source_frame_count: points.length,
    cell_sequence_by_keypoint: cellSequenceByKeypoint,
    total_transitions_by_keypoint: totalTransitionsByKeypoint,
  };
}
