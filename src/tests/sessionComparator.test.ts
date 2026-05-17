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

  it("reset clears matched state and returns zeroed snapshot", () => {
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
        nodes: [{ id: "n1", signal: "elbow_angle", range: [170, 190] }],
        edges: [],
      },
      completion: { terminal_nodes: ["n1"] },
    };

    const comparator = createSessionComparator(exercise);
    comparator.update(makePoseAt180(), 0);
    comparator.update(makePoseAt180(), 250);
    expect(comparator.getSnapshot().matchedCount).toBe(1);

    const resetSnap = comparator.reset();
    expect(resetSnap.matchedCount).toBe(0);
    expect(resetSnap.score).toBe(0);
    expect(resetSnap.completed).toBe(false);
  });

  it("uphill node only accumulates hold when signal is increasing", () => {
    const exercise: Exercise = {
      created_at: new Date().toISOString(),
      updatedAt: Date.now(),
      recording_angles: [],
      recording_points: [],
      signals: {
        hand_pos: { type: "relative_position", points: ["left_wrist", "left_hip"] },
      },
      event_graph: {
        nodes: [{ id: "n1", type: "uphill", signal: "hand_pos", range: [10, 50] }],
        edges: [],
      },
      completion: { terminal_nodes: ["n1"] },
    };

    const makePose = (wristY: number): Pose =>
      ({
        keypoints: [
          { name: "left_wrist", x: 0, y: wristY, score: 1 },
          { name: "left_hip", x: 0, y: 0, score: 1 },
        ],
      }) as Pose;

    // Decreasing: wristY 30 → 20 (relative_position = wristY - 0)
    const dec = createSessionComparator(exercise);
    dec.update(makePose(30), 0);
    const decSnap = dec.update(makePose(20), 250);
    expect(decSnap.matchedCount).toBe(0);

    // Increasing: wristY 20 → 30
    const inc = createSessionComparator(exercise);
    inc.update(makePose(20), 0);
    const incSnap = inc.update(makePose(30), 250);
    expect(incSnap.matchedCount).toBe(1);
    expect(incSnap.completed).toBe(true);
  });

  it("downhill node only accumulates hold when signal is decreasing", () => {
    const exercise: Exercise = {
      created_at: new Date().toISOString(),
      updatedAt: Date.now(),
      recording_angles: [],
      recording_points: [],
      signals: {
        hand_pos: { type: "relative_position", points: ["left_wrist", "left_hip"] },
      },
      event_graph: {
        nodes: [{ id: "n1", type: "downhill", signal: "hand_pos", range: [10, 50] }],
        edges: [],
      },
      completion: { terminal_nodes: ["n1"] },
    };

    const makePose = (wristY: number): Pose =>
      ({
        keypoints: [
          { name: "left_wrist", x: 0, y: wristY, score: 1 },
          { name: "left_hip", x: 0, y: 0, score: 1 },
        ],
      }) as Pose;

    // Increasing: should not match downhill
    const inc = createSessionComparator(exercise);
    inc.update(makePose(20), 0);
    const incSnap = inc.update(makePose(30), 250);
    expect(incSnap.matchedCount).toBe(0);

    // Decreasing: should match
    const dec = createSessionComparator(exercise);
    dec.update(makePose(30), 0);
    const decSnap = dec.update(makePose(20), 250);
    expect(decSnap.matchedCount).toBe(1);
    expect(decSnap.completed).toBe(true);
  });

  it("progressScore reaches 100 when exercise completes", () => {
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
        nodes: [{ id: "n1", signal: "elbow_angle", range: [170, 190] }],
        edges: [],
      },
      completion: { terminal_nodes: ["n1"] },
    };

    const comparator = createSessionComparator(exercise);
    comparator.update(makePoseAt180(), 0);
    const snap = comparator.update(makePoseAt180(), 250);
    expect(snap.completed).toBe(true);
    expect(snap.progressScore).toBe(100);
  });

  it("progressScore is continuous between 0 and 100 during hold accumulation", () => {
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
        nodes: [{ id: "n1", signal: "elbow_angle", range: [170, 190] }],
        edges: [],
      },
      completion: { terminal_nodes: ["n1"] },
    };

    const comparator = createSessionComparator(exercise);
    const snap0 = comparator.update(makePoseAt180(), 0);
    // Hold hasn't started yet (deltaMs = 0)
    expect(snap0.progressScore).toBe(0);
    expect(snap0.holdProgress).toBe(0);

    const snap1 = comparator.update(makePoseAt180(), 90);
    // Partial hold: 90ms into 180ms default hold → holdProgress ~0.5
    expect(snap1.holdProgress).toBeGreaterThan(0);
    expect(snap1.holdProgress).toBeLessThan(1);
    expect(snap1.progressScore).toBeGreaterThan(0);
    expect(snap1.progressScore).toBeLessThan(100);
  });

  it("qualityScore is 100 when signal is perfectly centered in range", () => {
    // Range [160, 200] → center = 180, elbow at 180° = perfect centering
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
        nodes: [{ id: "n1", signal: "elbow_angle", range: [160, 200] }],
        edges: [],
      },
      completion: { terminal_nodes: ["n1"] },
    };

    const comparator = createSessionComparator(exercise);
    comparator.update(makePoseAt180(), 0);
    const snap = comparator.update(makePoseAt180(), 250);
    expect(snap.completed).toBe(true);
    expect(snap.qualityScore).toBe(100);
  });

  it("reset clears progressScore and qualityScore to 0", () => {
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
        nodes: [{ id: "n1", signal: "elbow_angle", range: [170, 190] }],
        edges: [],
      },
      completion: { terminal_nodes: ["n1"] },
    };

    const comparator = createSessionComparator(exercise);
    comparator.update(makePoseAt180(), 0);
    comparator.update(makePoseAt180(), 250);
    expect(comparator.getSnapshot().progressScore).toBe(100);
    expect(comparator.getSnapshot().qualityScore).toBeGreaterThan(0);

    const resetSnap = comparator.reset();
    expect(resetSnap.progressScore).toBe(0);
    expect(resetSnap.qualityScore).toBe(0);
    expect(resetSnap.holdProgress).toBe(0);
  });
});
