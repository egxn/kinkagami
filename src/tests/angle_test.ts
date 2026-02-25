import type { Pose, Keypoint } from "@tensorflow-models/pose-detection";
import type { Exercise } from "../types/exercise";
import { calculateExerciseAngles } from "../utils/poseUtils";
import sample from "../db/exercises/00_sample.json";

// Helper to create a mock Keypoint
const kp = (name: string, x: number, y: number, score = 1.0): Keypoint => ({
  name,
  x,
  y,
  score,
});

// Mock Pose: Squat position (approximate)
// Knee angle should be around 90 degrees
// Hip angle should be around 90 degrees
// NOTE: This mock is defined for reference but the actual test uses squatKeypoints below

// Update: Actually, let's make the test robust.
// If I use the sample as is, it expects "hip".
// My mock pose provides "left_hip".
// The `geometry.ts` `findKeypoint` is exact match.
// So `calculateExerciseAngles` will fail to find "hip".
// For this unit test, I will dynamically patch the sample exercise to use 'left_' prefix
// so we verify the MATH logic. Symmetry handling is a separate task.

const exercise = JSON.parse(JSON.stringify(sample)) as Exercise;
// Patch signals to use left side
if (exercise.signals) {
  exercise.signals["knee_angle"].points = [
    "left_hip",
    "left_knee",
    "left_ankle",
  ];
  exercise.signals["hip_angle"].points = [
    "left_shoulder",
    "left_hip",
    "left_knee",
  ];
  exercise.signals["shoulder_angle"].points = [
    "left_elbow",
    "left_shoulder",
    "left_hip",
  ];
}

const squatKeypoints = [
  kp("left_shoulder", 100, 50),
  kp("left_hip", 100, 100), // Hip
  kp("left_knee", 100, 200), // Knee
  kp("left_ankle", 200, 200), // Ankle
  kp("left_elbow", 50, 50), // Elbow
];

const pose: Pose = { keypoints: squatKeypoints, score: 1 };

const angles = calculateExerciseAngles(pose, exercise);

console.log("Calculated Angles:", angles);

// Assertions
if (Math.abs(angles["knee_angle"] - 90) > 1) {
  throw new Error(`Knee angle wrong. Expected 90, got ${angles["knee_angle"]}`);
}

// Hip Angle: shoulder(100,50) -> hip(100,100) (Down)
// hip(100,100) -> knee(100,200) (Down)
// Angle should be 180 degrees (straight line vertical)
if (Math.abs(angles["hip_angle"] - 180) > 1) {
  throw new Error(`Hip angle wrong. Expected 180, got ${angles["hip_angle"]}`);
}

console.log("Test Passed!");
