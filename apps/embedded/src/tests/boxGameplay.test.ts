import { describe, expect, it } from "vitest";
import type { Pose } from "@tensorflow-models/pose-detection";
import {
  detectBlock,
  detectDodge,
  evaluateDefense,
  resolveRoundOutcome,
} from "../views/Play/Box/box_gameplay";

const createPose = (overrides: Record<string, { x: number; y: number }>): Pose => {
  const base = {
    nose: { x: 320, y: 120 },
    left_shoulder: { x: 280, y: 180 },
    right_shoulder: { x: 360, y: 180 },
    left_wrist: { x: 296, y: 150 },
    right_wrist: { x: 344, y: 150 },
    left_hip: { x: 295, y: 280 },
    right_hip: { x: 345, y: 280 },
  };

  const points = { ...base, ...overrides };

  return {
    keypoints: Object.entries(points).map(([name, value]) => ({
      name,
      score: 1,
      x: value.x,
      y: value.y,
    })),
    score: 1,
  };
};

describe("box_gameplay", () => {
  it("detects a tight block guard", () => {
    const pose = createPose({});
    expect(detectBlock(pose)).toBe(true);
  });

  it("detects left and right dodges from head offset", () => {
    const leftDodge = createPose({
      nose: { x: 292, y: 120 },
    });
    const rightDodge = createPose({
      nose: { x: 352, y: 120 },
    });

    expect(detectDodge(leftDodge)).toBe("dodgeLeft");
    expect(detectDodge(rightDodge)).toBe("dodgeRight");
  });

  it("keeps block-only attacks strict", () => {
    const dodgePose = createPose({
      nose: { x: 354, y: 120 },
      left_wrist: { x: 240, y: 230 },
      right_wrist: { x: 390, y: 230 },
    });

    const evaluation = evaluateDefense(dodgePose, "block");
    expect(evaluation.success).toBe(false);
    expect(evaluation.result).toBe("dodge failed");
    expect(evaluation.showDamageOverlay).toBe(true);
  });

  it("keeps dodge-only attacks strict", () => {
    const blockPose = createPose({});
    const evaluation = evaluateDefense(blockPose, "dodgeLeft");

    expect(evaluation.success).toBe(false);
    expect(evaluation.result).toBe("block failed");
    expect(evaluation.playerDamage).toBeGreaterThan(0);
  });

  it("resolves KO before time decisions", () => {
    expect(
      resolveRoundOutcome({
        playerHealth: 0,
        rivalHealth: 32,
        score: 440,
        secondsLeft: 12,
      }),
    ).toBe("playerKO");

    expect(
      resolveRoundOutcome({
        playerHealth: 24,
        rivalHealth: 0,
        score: 0,
        secondsLeft: 12,
      }),
    ).toBe("rivalKO");
  });

  it("resolves time-up rounds by health and score", () => {
    expect(
      resolveRoundOutcome({
        playerHealth: 70,
        rivalHealth: 42,
        score: 100,
        secondsLeft: 0,
      }),
    ).toBe("timeUpWin");

    expect(
      resolveRoundOutcome({
        playerHealth: 42,
        rivalHealth: 70,
        score: 400,
        secondsLeft: 0,
      }),
    ).toBe("timeUpLose");

    expect(
      resolveRoundOutcome({
        playerHealth: 60,
        rivalHealth: 60,
        score: 0,
        secondsLeft: 0,
      }),
    ).toBe("timeUpDraw");
  });
});