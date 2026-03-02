import { describe, expect, it } from "vitest";
import { createSessionComparator } from "../services/sessionComparator";
import type { Exercise } from "../types/exercise";
import type { Pose } from "@tensorflow-models/pose-detection";

const makePoseAt180 = (): Pose =>
  ({
    keypoints: [
      { name: "left_shoulder", x: 0, y: 0, score: 1 },
      { name: "left_elbow", x: 1, y: 0, score: 1 },
      { name: "left_wrist", x: 2, y: 0, score: 1 },
    ],
  }) as Pose;

describe("sessionComparator", () => {
  it("matches node after default hold window (non-immediate)", () => {
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
      event_graph: {
        nodes: [
          {
            id: "n1",
            signal: "elbow_angle",
            range: [170, 190],
          },
        ],
        edges: [],
      },
      completion: {
        terminal_nodes: ["n1"],
      },
    };

    const comparator = createSessionComparator(exercise);
    const pose = makePoseAt180();

    const snap1 = comparator.update(pose, 0);
    expect(snap1.matchedCount).toBe(0);

    const snap2 = comparator.update(pose, 250);
    expect(snap2.matchedCount).toBe(1);
    expect(snap2.completed).toBe(true);
  });
});
