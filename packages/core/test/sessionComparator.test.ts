import { describe, expect, it } from "vitest";
import {
  createSessionComparator,
  selectScorePercent,
} from "../src/scoring/sessionComparator";
import type { Exercise } from "../src/exercise/types";
import type { Pose } from "../src/pose/types";

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
        hand_pos: {
          type: "relative_position",
          points: ["left_wrist", "left_hip"],
        },
      },
      event_graph: {
        nodes: [
          { id: "n1", type: "uphill", signal: "hand_pos", range: [10, 50] },
        ],
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
        hand_pos: {
          type: "relative_position",
          points: ["left_wrist", "left_hip"],
        },
      },
      event_graph: {
        nodes: [
          { id: "n1", type: "downhill", signal: "hand_pos", range: [10, 50] },
        ],
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

  const baseExercise = (extra: Partial<Exercise>): Exercise => ({
    created_at: new Date().toISOString(),
    updatedAt: Date.now(),
    recording_angles: [],
    recording_points: [],
    ...extra,
  });

  it("a long frame stall does not satisfy the hold instantly", () => {
    const exercise = baseExercise({
      signals: {
        elbow_angle: {
          type: "angle",
          points: ["left_shoulder", "left_elbow", "left_wrist"],
        },
      },
      event_graph: {
        nodes: [
          { id: "n1", signal: "elbow_angle", range: [170, 190], hold_ms: 1000 },
        ],
        edges: [],
      },
      completion: { terminal_nodes: ["n1"] },
    });
    const comparator = createSessionComparator(exercise);
    comparator.update(makePoseAt180(), 0);
    const snap = comparator.update(makePoseAt180(), 60_000);
    expect(snap.matchedCount).toBe(0);
  });

  it("qualityScore averages centering over the hold, not one frame", () => {
    const exercise = baseExercise({
      signals: {
        elbow_angle: {
          type: "angle",
          points: ["left_shoulder", "left_elbow", "left_wrist"],
        },
      },
      event_graph: {
        nodes: [
          { id: "n1", signal: "elbow_angle", range: [160, 200], hold_ms: 200 },
        ],
        edges: [],
      },
      completion: { terminal_nodes: ["n1"] },
    });
    const comparator = createSessionComparator(exercise);
    // Tick at the range edge first, finish perfectly centered.
    const edgePose = {
      keypoints: [
        { name: "left_shoulder", x: 0, y: 0, score: 1 },
        { name: "left_elbow", x: 1, y: 0, score: 1 },
        {
          name: "left_wrist",
          x: 1 - Math.cos((160 * Math.PI) / 180),
          y: Math.sin((160 * Math.PI) / 180),
          score: 1,
        },
      ],
    } as Pose;
    comparator.update(edgePose, 0);
    comparator.update(edgePose, 100);
    const snap = comparator.update(makePoseAt180(), 200);
    expect(snap.completed).toBe(true);
    expect(snap.qualityScore).toBeLessThan(100);
  });

  describe("grid progress", () => {
    const gridExercise = baseExercise({
      grid_validation: {
        version: 1,
        rows: 3,
        cols: 3,
        keypoints: ["left_wrist"],
        min_confidence: 0.2,
        source_frame_count: 0,
        cell_sequence_by_keypoint: { left_wrist: [0, 4, 8] },
        total_transitions_by_keypoint: { left_wrist: 2 },
      },
    });

    // Three anchor keypoints define the bbox (0..90 x 0..90); wrist moves.
    const poseWithWrist = (x: number, y: number): Pose =>
      ({
        keypoints: [
          { name: "nose", x: 0, y: 0, score: 1 },
          { name: "right_ankle", x: 90, y: 90, score: 1 },
          { name: "right_hip", x: 45, y: 45, score: 1 },
          { name: "left_wrist", x, y, score: 1 },
        ],
      }) as Pose;

    // cell centers for a 3x3 grid over 0..90
    const C0 = [5, 5] as const;
    const C1 = [45, 5] as const;
    const C4 = [45, 45] as const;
    const C8 = [85, 85] as const;

    it("tolerates a jitter cell in the middle of the sequence", () => {
      const comparator = createSessionComparator(gridExercise);
      let t = 0;
      let snap = comparator.getSnapshot();
      for (const [x, y] of [C0, C1, C4, C8]) {
        // C1 is the stray cell; a strict prefix match would stall at 1/3
        snap = comparator.update(poseWithWrist(x, y), (t += 33));
      }
      expect(snap.gridMatchedKeypoints).toBe(1);
    });

    it("first update is not smoothed against a zero sentinel", () => {
      const comparator = createSessionComparator(gridExercise);
      const snap = comparator.update(poseWithWrist(...C0), 0);
      expect(snap.gridProgress).toBeCloseTo(1 / 3, 5);
    });
  });

  describe("tempo and overall score", () => {
    const signals: Exercise["signals"] = {
      elbow_angle: {
        type: "angle",
        points: ["left_shoulder", "left_elbow", "left_wrist"],
      },
    };
    const makePoseAt90 = (): Pose =>
      ({
        keypoints: [
          { name: "left_shoulder", x: 0, y: 0, score: 1 },
          { name: "left_elbow", x: 1, y: 0, score: 1 },
          { name: "left_wrist", x: 1, y: 1, score: 1 },
        ],
      }) as Pose;

    const twoNodes = (constraint: Exercise["time_constraints"]): Exercise =>
      baseExercise({
        signals,
        event_graph: {
          nodes: [
            { id: "a", signal: "elbow_angle", range: [160, 200], hold_ms: 100 },
            { id: "b", signal: "elbow_angle", range: [80, 100], hold_ms: 100 },
          ],
          edges: [{ from: "a", to: "b" }],
        },
        completion: { terminal_nodes: ["b"] },
        time_constraints: constraint,
      });

    // Node `a` matches at ~100ms. The user then stays at 180° for `gapMs`
    // before moving to 90° and holding for node `b`.
    const run = (exercise: Exercise, gapMs: number) => {
      const c = createSessionComparator(exercise);
      const STEP = 50;
      let t = 0;
      for (; t <= 100; t += STEP) c.update(makePoseAt180(), t);
      for (const end = t + gapMs; t < end; t += STEP) {
        c.update(makePoseAt180(), t);
      }
      for (const end = t + 600; t < end; t += STEP) {
        c.update(makePoseAt90(), t);
      }
      return c.getSnapshot();
    };

    const window = (
      max_ms: number,
      severity: "soft" | "hard",
    ): Exercise["time_constraints"] => [
      { id: "t", from: "a", to: "b", min_ms: 0, max_ms, severity },
    ];

    it("reports no tempo data without time_constraints", () => {
      const snap = run(twoNodes(undefined), 300);
      expect(snap.completed).toBe(true);
      expect(snap.tempoTotal).toBe(0);
      expect(snap.tempoScore).toBe(0);
    });

    it("scores a transition inside the window as 100", () => {
      const snap = run(twoNodes(window(3000, "soft")), 300);
      expect(snap.tempoTotal).toBe(1);
      expect(snap.tempoResolved).toBe(1);
      expect(snap.tempoScore).toBe(100);
    });

    it("decays soft constraints and zeroes hard ones outside the window", () => {
      const soft = run(twoNodes(window(400, "soft")), 400);
      expect(soft.tempoScore).toBeGreaterThan(0);
      expect(soft.tempoScore).toBeLessThan(100);
      expect(run(twoNodes(window(400, "hard")), 400).tempoScore).toBe(0);
    });

    it("overallScore stays >= 80 on a completed rep, and rewards accuracy", () => {
      const good = run(twoNodes(window(3000, "soft")), 300);
      const bad = run(twoNodes(window(100, "hard")), 300);
      expect(bad.completed).toBe(true);
      expect(bad.tempoScore).toBe(0);
      expect(bad.overallScore).toBeGreaterThanOrEqual(80);
      expect(good.overallScore).toBeGreaterThan(bad.overallScore);
    });

    it("overallScore blends FSM and grid progress and reset clears it", () => {
      const ex: Exercise = {
        ...twoNodes(undefined),
        grid_validation: {
          version: 1,
          rows: 3,
          cols: 3,
          keypoints: ["left_wrist"],
          min_confidence: 0.2,
          source_frame_count: 0,
          cell_sequence_by_keypoint: { left_wrist: [0, 4, 8] },
          total_transitions_by_keypoint: { left_wrist: 2 },
        },
      };
      const c = createSessionComparator(ex);
      const STEP = 50;
      let t = 0;
      for (; t <= 100; t += STEP) c.update(makePoseAt180(), t);
      for (const end = t + 600; t < end; t += STEP) {
        c.update(makePoseAt90(), t);
      }
      const snap = c.getSnapshot();
      expect(snap.progressScore).toBe(100);
      // Grid never progressed (<3 valid keypoints), so overall < FSM-only.
      expect(snap.overallScore).toBeLessThan(100);
      expect(c.reset().overallScore).toBe(0);
    });
  });

  it("selectScorePercent picks the score for each evaluation type", () => {
    const comparator = createSessionComparator(baseExercise({}));
    const snap = {
      ...comparator.getSnapshot(),
      progressScore: 40,
      gridScore: 55,
      overallScore: 70,
    };
    expect(selectScorePercent(snap, "fsm")).toBe(40);
    expect(selectScorePercent(snap, "grid")).toBe(55);
    expect(selectScorePercent(snap, "hybrid")).toBe(70);
    expect(
      selectScorePercent({ ...snap, gridScore: Number.NaN, gridProgress: 0.3 }, "grid"),
    ).toBe(30);
  });
});
