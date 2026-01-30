import type { Pose } from "@tensorflow-models/pose-detection";
import type { ExerciseDef } from "../types/exercise";
import { calculateAngle, findKeypoint } from "./geometry";

export interface AngleResult {
  name: string;
  value: number;
}

export interface AngleDefinition {
  name: string;
  points: [string, string, string]; // [point A, vertex B, point C]
}

/**
 * All body angles (excluding face points).
 * Each angle is defined by 3 points: [A, B (vertex), C]
 * The angle is measured at the vertex point B.
 */
export const BODY_ANGLES: AngleDefinition[] = [
  // Left side angles
  { name: "left_elbow_angle", points: ["left_shoulder", "left_elbow", "left_wrist"] },
  { name: "left_shoulder_angle", points: ["left_elbow", "left_shoulder", "left_hip"] },
  { name: "left_hip_angle", points: ["left_shoulder", "left_hip", "left_knee"] },
  { name: "left_knee_angle", points: ["left_hip", "left_knee", "left_ankle"] },
  
  // Right side angles
  { name: "right_elbow_angle", points: ["right_shoulder", "right_elbow", "right_wrist"] },
  { name: "right_shoulder_angle", points: ["right_elbow", "right_shoulder", "right_hip"] },
  { name: "right_hip_angle", points: ["right_shoulder", "right_hip", "right_knee"] },
  { name: "right_knee_angle", points: ["right_hip", "right_knee", "right_ankle"] },
  
  // Cross-body / torso angles
  { name: "torso_inclination", points: ["left_shoulder", "left_hip", "left_knee"] },
  { name: "shoulder_alignment", points: ["left_elbow", "left_shoulder", "right_shoulder"] },
  { name: "hip_alignment", points: ["left_knee", "left_hip", "right_hip"] },
];

export interface RecordingAngleEntry {
  name: string;
  points: [string, string, string];
  value: number;
}

/**
 * Calculates all body angles for a given pose.
 * Returns an array of angle entries with name, points, and value.
 */
export const calculateAllBodyAngles = (
  pose: Pose,
  minConfidence = 0.3,
): RecordingAngleEntry[] => {
  const results: RecordingAngleEntry[] = [];

  if (!pose.keypoints) return results;

  for (const angleDef of BODY_ANGLES) {
    const [p1Name, p2Name, p3Name] = angleDef.points;
    const p1 = findKeypoint(pose.keypoints, p1Name);
    const p2 = findKeypoint(pose.keypoints, p2Name);
    const p3 = findKeypoint(pose.keypoints, p3Name);

    // Check if all needed keypoints are found and confident enough
    if (
      p1 &&
      p2 &&
      p3 &&
      (p1.score ?? 1) >= minConfidence &&
      (p2.score ?? 1) >= minConfidence &&
      (p3.score ?? 1) >= minConfidence
    ) {
      const angle = calculateAngle(p1, p2, p3);
      results.push({
        name: angleDef.name,
        points: angleDef.points,
        value: Math.round(angle * 100) / 100, // Round to 2 decimals
      });
    }
  }

  return results;
};

/**
 * Calculates all angles defined in the exercise for the given pose.
 * Returns a map of signal name -> angle value.
 */
export const calculateExerciseAngles = (
  pose: Pose,
  exercise: ExerciseDef,
  minConfidence = 0.5,
): Record<string, number> => {
  const results: Record<string, number> = {};

  if (!pose.keypoints) return results;

  for (const [signalName, signalDef] of Object.entries(exercise.signals)) {
    if (signalDef.type === "angle") {
      const pointNames = signalDef.points;
      if (pointNames.length !== 3) continue;

      const p1 = findKeypoint(pose.keypoints, pointNames[0]);
      const p2 = findKeypoint(pose.keypoints, pointNames[1]);
      const p3 = findKeypoint(pose.keypoints, pointNames[2]);

      // Check if all needed keypoints are found and confident enough
      if (
        p1 &&
        p2 &&
        p3 &&
        (p1.score ?? 1) >= minConfidence &&
        (p2.score ?? 1) >= minConfidence &&
        (p3.score ?? 1) >= minConfidence
      ) {
        const angle = calculateAngle(p1, p2, p3);
        results[signalName] = angle;
      }
    }
  }

  return results;
};
