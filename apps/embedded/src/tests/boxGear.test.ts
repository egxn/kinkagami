import { describe, expect, it } from "vitest";
import {
  createBoxRivalExercise,
  createBoxRivalPattern,
  getBoxRivalColors,
} from "../views/Play/Box/box_gear";

const getKeypointX = (
  exercise: ReturnType<typeof createBoxRivalExercise>,
  frameIndex: number,
  keypointName: string,
) =>
  exercise.recording_points[frameIndex]?.poses[0]?.keypoints.find(
    (keypoint) => keypoint.name === keypointName,
  )?.x ?? 0;

describe("box_gear", () => {
  it("creates a dynamic exercise with recording points and angles", () => {
    const exercise = createBoxRivalExercise("beginner", {
      seed: 7,
      totalPunches: 3,
    });

    expect(exercise.difficulty).toBe("beginner");
    expect(exercise.recording_points.length).toBeGreaterThan(0);
    expect(exercise.recording_points.length).toBe(exercise.recording_angles.length);
    expect(exercise.recording_points[0]?.poses[0]?.keypoints.length).toBe(17);
    expect(exercise.event_graph?.nodes.length ?? 0).toBeGreaterThan(0);
    expect(exercise.signals && Object.keys(exercise.signals).length).toBeGreaterThan(0);
  });

  it("supports round duration and rival physique variants", () => {
    const featherweight = createBoxRivalExercise("beginner", {
      punchSequence: ["jab"],
      rivalPhysique: "featherweight",
      roundDurationSeconds: 10,
      seed: 2,
    });
    const heavyweight = createBoxRivalExercise("beginner", {
      punchSequence: ["jab"],
      rivalPhysique: "heavyweight",
      roundDurationSeconds: 10,
      seed: 2,
    });

    expect(featherweight.duration).toBeCloseTo(10, 0);
    expect(heavyweight.duration).toBeCloseTo(10, 0);

    const featherShoulders =
      getKeypointX(featherweight, 0, "right_shoulder") -
      getKeypointX(featherweight, 0, "left_shoulder");
    const heavyShoulders =
      getKeypointX(heavyweight, 0, "right_shoulder") -
      getKeypointX(heavyweight, 0, "left_shoulder");

    expect(heavyShoulders).toBeGreaterThan(featherShoulders);
  });

  it("adds a telegraph before the punch launch", () => {
    const exercise = createBoxRivalExercise("beginner", {
      punchSequence: ["jab"],
      rivalPhysique: "middleweight",
      roundDurationSeconds: 6,
      seed: 1,
    });

    const guardX = getKeypointX(exercise, 0, "left_wrist");
    const telegraphX = getKeypointX(exercise, 10, "left_wrist");
    const punchX = getKeypointX(exercise, 16, "left_wrist");

    expect(telegraphX).toBeLessThan(guardX);
    expect(punchX).toBeGreaterThan(guardX);
  });

  it("returns rival colors by palette", () => {
    expect(getBoxRivalColors("cyber")).toEqual({
      skeleton: "#7df9ff",
      keypoints: "#ff4fd8",
    });
  });

  it("creates a timeline with telegraph and impact metadata", () => {
    const pattern = createBoxRivalPattern("beginner", {
      punchSequence: ["jab"],
      roundDurationSeconds: 6,
      seed: 1,
    });

    expect(pattern.timeline.length).toBe(pattern.exercise.recording_points.length);
    expect(pattern.timeline.some((frame) => frame.phase === "telegraph")).toBe(true);
    expect(pattern.timeline.some((frame) => frame.impact)).toBe(true);
    expect(pattern.timeline.find((frame) => frame.impact)?.defenseHint).toBe("block");
  });
});