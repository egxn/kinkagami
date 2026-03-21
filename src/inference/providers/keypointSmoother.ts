/**
 * Exponential moving average smoother for pose keypoints.
 *
 * Mirrors the `enableSmoothing: true` behaviour built into TF.js
 * MoveNet / BlazePose detectors, but applied to results from the
 * Python backend which does not include temporal smoothing.
 */
import type { Keypoint, Pose } from "@tensorflow-models/pose-detection";

/** Higher = more smoothing (slower response).  0.5–0.7 is typical. */
const DEFAULT_ALPHA = 0.6;

export class KeypointSmoother {
  private prev: Keypoint[][] = [];
  private readonly alpha: number;

  constructor(alpha = DEFAULT_ALPHA) {
    this.alpha = alpha;
  }

  smooth(poses: Pose[]): Pose[] {
    return poses.map((pose, poseIdx) => {
      const prevKps = this.prev[poseIdx];
      if (!prevKps || prevKps.length !== pose.keypoints.length) {
        // First frame or structure changed — seed without smoothing
        this.prev[poseIdx] = pose.keypoints.map((kp) => ({ ...kp }));
        return pose;
      }

      const smoothed = pose.keypoints.map((kp, i) => {
        const pk = prevKps[i];
        const a = this.alpha;
        const x = a * pk.x + (1 - a) * kp.x;
        const y = a * pk.y + (1 - a) * kp.y;
        const score =
          kp.score !== undefined && pk.score !== undefined
            ? a * pk.score + (1 - a) * kp.score
            : kp.score;
        return { ...kp, x, y, score };
      });

      this.prev[poseIdx] = smoothed.map((kp) => ({ ...kp }));
      return { ...pose, keypoints: smoothed };
    });
  }

  reset(): void {
    this.prev = [];
  }
}
