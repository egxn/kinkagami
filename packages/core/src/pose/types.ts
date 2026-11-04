/**
 * Minimal, platform-agnostic pose types.
 *
 * Structurally compatible with `@tensorflow-models/pose-detection`'s `Pose` and
 * `Keypoint`, so TF.js results can be passed to core directly, while core keeps
 * zero dependency on TF.js (or the DOM) and can run on web, embedded or native.
 */
export interface Keypoint {
  x: number;
  y: number;
  z?: number;
  score?: number;
  name?: string;
}

export interface Pose {
  keypoints: Keypoint[];
  keypoints3D?: Keypoint[];
  score?: number;
}
