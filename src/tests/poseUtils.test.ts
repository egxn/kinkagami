import { describe, expect, it } from "vitest";
import type { Pose } from "@tensorflow-models/pose-detection";
import type { Exercise } from "../types/exercise";
import { calculateAllBodyAngles, calculateExerciseAngles } from "../utils/poseUtils";

const makePose = (): Pose =>
  ({
    keypoints: [
      { name: "left_shoulder", x: 0, y: 0, score: 1 },
      { name: "left_elbow", x: 1, y: 0, score: 1 },
      { name: "left_wrist", x: 1, y: 1, score: 1 },
      { name: "left_hip", x: 0, y: 1, score: 1 },
      { name: "left_knee", x: 0, y: 2, score: 1 },
      { name: "left_ankle", x: 0, y: 3, score: 1 },
      { name: "right_shoulder", x: 2, y: 0, score: 1 },
      { name: "right_elbow", x: 3, y: 0, score: 1 },
      { name: "right_wrist", x: 3, y: 1, score: 1 },
      { name: "right_hip", x: 2, y: 1, score: 1 },
      { name: "right_knee", x: 2, y: 2, score: 1 },
      { name: "right_ankle", x: 2, y: 3, score: 1 },
    ],
  }) as Pose;

describe("poseUtils", () => {
  it("calculateAllBodyAngles returns non-empty list when keypoints exist", () => {
    const out = calculateAllBodyAngles(makePose());
    expect(out.length).toBeGreaterThan(0);
    expect(out.some((entry) => entry.name === "left_elbow_angle")).toBe(true);
  });

  it("calculateExerciseAngles computes only angle signals", () => {
    const exercise: Exercise = {
      created_at: new Date().toISOString(),
      updatedAt: Date.now(),
      recording_angles: [],
      recording_points: [],
      signals: {
        elbow_angle: {
          type: "angle",
          points: ["left_shoulder", "left_elbow", "left_wrist"],
        },
        wrist_distance: {
          type: "distance",
          points: ["left_wrist", "right_wrist"],
        },
      },
    };

    const out = calculateExerciseAngles(makePose(), exercise);
    expect(Object.keys(out)).toEqual(["elbow_angle"]);
    expect(out.elbow_angle).toBeTypeOf("number");
  });

  it("returns empty map when pose has no keypoints", () => {
    const exercise: Exercise = {
      created_at: new Date().toISOString(),
      updatedAt: Date.now(),
      recording_angles: [],
      recording_points: [],
      signals: {
        elbow_angle: {
          type: "angle",
          points: ["left_shoulder", "left_elbow", "left_wrist"],
        },
      },
    };

    const out = calculateExerciseAngles({ keypoints: [] } as Pose, exercise);
    expect(out).toEqual({});
  });
});
