import type { Pose } from "@tensorflow-models/pose-detection";
import type { BoxDefenseHint } from "./box_gear";

export interface DefenseEvaluation {
  success: boolean;
  result: string;
  defenseType: "block" | "dodge" | null;
  scoreDelta: number;
  rivalDamage: number;
  playerDamage: number;
  comboDelta: number;
  resetCombo: boolean;
  showDamageOverlay: boolean;
}

export type BoxRoundOutcome =
  | "active"
  | "playerKO"
  | "rivalKO"
  | "timeUpWin"
  | "timeUpLose"
  | "timeUpDraw";

const findKeypoint = (pose: Pose | null, name: string) =>
  pose?.keypoints.find(
    (keypoint) =>
      keypoint.name === name &&
      Number.isFinite(keypoint.x) &&
      Number.isFinite(keypoint.y) &&
      ((keypoint.score ?? 1) > 0.2),
  );

export const getDefensePrompt = (hint: BoxDefenseHint | null) => {
  if (hint === "block") return "block";
  if (hint === "dodgeLeft") return "dodge left";
  if (hint === "dodgeRight") return "dodge right";
  return "ready";
};

export const detectBlock = (pose: Pose | null) => {
  const nose = findKeypoint(pose, "nose");
  const leftWrist = findKeypoint(pose, "left_wrist");
  const rightWrist = findKeypoint(pose, "right_wrist");
  const leftShoulder = findKeypoint(pose, "left_shoulder");
  const rightShoulder = findKeypoint(pose, "right_shoulder");

  if (!nose || !leftWrist || !rightWrist || !leftShoulder || !rightShoulder) {
    return false;
  }

  const shoulderLine = (leftShoulder.y + rightShoulder.y) / 2;
  const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);

  return (
    leftWrist.y < shoulderLine + 16 &&
    rightWrist.y < shoulderLine + 16 &&
    Math.abs(leftWrist.x - nose.x) < shoulderWidth * 0.7 &&
    Math.abs(rightWrist.x - nose.x) < shoulderWidth * 0.7
  );
};

export const detectDodge = (pose: Pose | null) => {
  const nose = findKeypoint(pose, "nose");
  const leftHip = findKeypoint(pose, "left_hip");
  const rightHip = findKeypoint(pose, "right_hip");
  const leftShoulder = findKeypoint(pose, "left_shoulder");
  const rightShoulder = findKeypoint(pose, "right_shoulder");

  if (!nose || !leftHip || !rightHip || !leftShoulder || !rightShoulder) {
    return null;
  }

  const hipCenterX = (leftHip.x + rightHip.x) / 2;
  const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
  const offset = nose.x - hipCenterX;
  const threshold = Math.max(18, shoulderWidth * 0.18);

  if (offset <= -threshold) return "dodgeLeft" as const;
  if (offset >= threshold) return "dodgeRight" as const;
  return null;
};

export const evaluateDefense = (
  pose: Pose | null,
  hint: BoxDefenseHint | null,
): DefenseEvaluation => {
  const isBlocking = detectBlock(pose);
  const dodge = detectDodge(pose);

  if (hint === "block") {
    if (isBlocking) {
      return {
        success: true,
        result: "blocked",
        defenseType: "block",
        scoreDelta: 120,
        rivalDamage: 6,
        playerDamage: 0,
        comboDelta: 1,
        resetCombo: false,
        showDamageOverlay: false,
      };
    }

    return {
      success: false,
      result: dodge ? "dodge failed" : "hit",
      defenseType: dodge ? "dodge" : null,
      scoreDelta: 0,
      rivalDamage: 0,
      playerDamage: 12,
      comboDelta: 0,
      resetCombo: true,
      showDamageOverlay: true,
    };
  }

  if (hint === "dodgeLeft" || hint === "dodgeRight") {
    if (dodge === hint) {
      return {
        success: true,
        result: `dodged ${hint === "dodgeLeft" ? "left" : "right"}`,
        defenseType: "dodge",
        scoreDelta: 220,
        rivalDamage: 10,
        playerDamage: 0,
        comboDelta: 1,
        resetCombo: false,
        showDamageOverlay: false,
      };
    }

    return {
      success: false,
      result: isBlocking ? "block failed" : dodge ? "dodged wrong way" : "hit",
      defenseType: isBlocking ? "block" : dodge ? "dodge" : null,
      scoreDelta: 0,
      rivalDamage: 0,
      playerDamage: 16,
      comboDelta: 0,
      resetCombo: true,
      showDamageOverlay: true,
    };
  }

  return {
    success: false,
    result: "idle",
    defenseType: null,
    scoreDelta: 0,
    rivalDamage: 0,
    playerDamage: 0,
    comboDelta: 0,
    resetCombo: false,
    showDamageOverlay: false,
  };
};

export const resolveRoundOutcome = ({
  playerHealth,
  rivalHealth,
  secondsLeft,
  score,
}: {
  playerHealth: number;
  rivalHealth: number;
  secondsLeft: number;
  score: number;
}): BoxRoundOutcome => {
  if (playerHealth <= 0) {
    return "playerKO";
  }

  if (rivalHealth <= 0) {
    return "rivalKO";
  }

  if (secondsLeft > 0) {
    return "active";
  }

  if (playerHealth > rivalHealth) {
    return "timeUpWin";
  }

  if (playerHealth < rivalHealth) {
    return "timeUpLose";
  }

  if (score > 0) {
    return "timeUpWin";
  }

  if (score < 0) {
    return "timeUpLose";
  }

  return "timeUpDraw";
};