import { describe, expect, it } from "vitest";
import type { Pose } from "@tensorflow-models/pose-detection";
import { buildGridValidationDefinition } from "../utils/gridValidation";

const makePose = (xOffset = 0): Pose =>
  ({
    keypoints: [
      { name: "left_shoulder", x: 10 + xOffset, y: 10, score: 1 },
      { name: "right_shoulder", x: 90 + xOffset, y: 10, score: 1 },
      { name: "left_hip", x: 20 + xOffset, y: 70, score: 1 },
      { name: "right_hip", x: 80 + xOffset, y: 70, score: 1 },
      { name: "left_wrist", x: 30 + xOffset, y: 30, score: 1 },
      { name: "right_wrist", x: 70 + xOffset, y: 30, score: 1 },
    ],
  }) as Pose;

describe("gridValidation", () => {
  it("builds compressed sequences and transition counts", () => {
    const points = [
      { timestamp: 0, poses: [makePose(0)] },
      { timestamp: 1, poses: [makePose(0)] },
      { timestamp: 2, poses: [makePose(10)] },
    ];

    const out = buildGridValidationDefinition(points, {
      rows: 3,
      cols: 3,
      keypoints: ["left_wrist", "right_wrist"],
    });

    expect(out.version).toBe(1);
    expect(out.rows).toBe(3);
    expect(out.cols).toBe(3);
    expect(out.source_frame_count).toBe(3);
    expect(out.cell_sequence_by_keypoint.left_wrist?.length).toBeGreaterThanOrEqual(1);
    expect(out.total_transitions_by_keypoint.left_wrist).toBe(
      Math.max(0, (out.cell_sequence_by_keypoint.left_wrist?.length ?? 0) - 1),
    );
  });

  it("enforces minimum grid size of 2x2", () => {
    const points = [{ timestamp: 0, poses: [makePose()] }];

    const out = buildGridValidationDefinition(points, {
      rows: 1,
      cols: 1,
      keypoints: ["left_wrist"],
    });

    expect(out.rows).toBe(2);
    expect(out.cols).toBe(2);
  });
});
