import { describe, expect, it } from "vitest";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import { calculateAngle, findKeypoint } from "../utils/geometry";

describe("geometry utils", () => {
  it("calculateAngle returns ~90 degrees for right angle", () => {
    const angle = calculateAngle({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(angle).toBeCloseTo(90, 4);
  });

  it("calculateAngle normalizes values over 180", () => {
    const angle = calculateAngle({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 0.5, y: -0.8660254 });
    expect(angle).toBeGreaterThan(0);
    expect(angle).toBeLessThanOrEqual(180);
  });

  it("findKeypoint returns keypoint by name", () => {
    const keypoints: Keypoint[] = [
      { name: "left_shoulder", x: 10, y: 20, score: 1 },
      { name: "left_elbow", x: 15, y: 25, score: 1 },
    ] as Keypoint[];

    expect(findKeypoint(keypoints, "left_elbow")?.x).toBe(15);
    expect(findKeypoint(keypoints, "right_elbow")).toBeUndefined();
  });
});
