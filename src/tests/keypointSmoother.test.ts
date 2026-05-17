import { describe, expect, it } from "vitest";
import type { Pose } from "@tensorflow-models/pose-detection";
import { KeypointSmoother } from "../inference/providers/keypointSmoother";

const kp = (name: string, x: number, y: number, score = 1) => ({
  name,
  x,
  y,
  score,
});

const singleKpPose = (x: number, y: number, score = 1): Pose =>
  ({ keypoints: [kp("left_shoulder", x, y, score)] }) as Pose;

describe("KeypointSmoother", () => {
  it("returns same pose reference on first frame (seeding, no smoothing)", () => {
    const smoother = new KeypointSmoother(0.6);
    const pose = singleKpPose(10, 20);
    const [result] = smoother.smooth([pose]);
    expect(result).toBe(pose);
  });

  it("applies EMA on subsequent frames (alpha=0.6)", () => {
    const smoother = new KeypointSmoother(0.6);
    smoother.smooth([singleKpPose(0, 0)]);
    // x = 0.6 * prev(0) + 0.4 * curr(10) = 4
    const [result] = smoother.smooth([singleKpPose(10, 10)]);
    expect(result.keypoints[0].x).toBeCloseTo(4, 5);
    expect(result.keypoints[0].y).toBeCloseTo(4, 5);
  });

  it("smoothes keypoint score when both frames supply one", () => {
    const smoother = new KeypointSmoother(0.6);
    smoother.smooth([singleKpPose(0, 0, 1)]);
    // score = 0.6 * 1 + 0.4 * 0 = 0.6
    const [result] = smoother.smooth([singleKpPose(10, 10, 0)]);
    expect(result.keypoints[0].score).toBeCloseTo(0.6, 5);
  });

  it("reset causes next call to re-seed without smoothing", () => {
    const smoother = new KeypointSmoother(0.6);
    smoother.smooth([singleKpPose(0, 0)]);
    smoother.reset();
    const pose = singleKpPose(10, 10);
    const [result] = smoother.smooth([pose]);
    expect(result).toBe(pose);
  });

  it("re-seeds when keypoint count changes between frames", () => {
    const smoother = new KeypointSmoother(0.6);
    smoother.smooth([singleKpPose(0, 0)]);
    const twoKpPose: Pose = ({
      keypoints: [kp("left_shoulder", 5, 5), kp("right_shoulder", 10, 5)],
    }) as Pose;
    const [result] = smoother.smooth([twoKpPose]);
    expect(result).toBe(twoKpPose);
  });

  it("accumulates EMA over multiple frames", () => {
    const smoother = new KeypointSmoother(0.6);
    smoother.smooth([singleKpPose(0, 0)]);
    const [r1] = smoother.smooth([singleKpPose(10, 0)]); // x=4
    const [r2] = smoother.smooth([singleKpPose(10, 0)]); // x=0.6*4+0.4*10=6.4
    expect(r1.keypoints[0].x).toBeCloseTo(4, 5);
    expect(r2.keypoints[0].x).toBeCloseTo(6.4, 5);
  });
});
