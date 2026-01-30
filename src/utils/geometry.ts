import type { Keypoint } from "@tensorflow-models/pose-detection";

/**
 * Calculates the angle (in degrees) at point B (the vertex),
 * formed by the line segments AB and BC.
 */
export const calculateAngle = (
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number => {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);

  if (angle > 180.0) {
    angle = 360.0 - angle;
  }

  return angle;
};

/**
 * Helper to find a keypoint by name from a list of keypoints.
 */
export const findKeypoint = (
  keypoints: Keypoint[],
  name: string,
): Keypoint | undefined => {
  return keypoints.find((kp) => kp.name === name);
};
