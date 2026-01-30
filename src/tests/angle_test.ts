import type { Pose, Keypoint } from "@tensorflow-models/pose-detection";
import type { ExerciseDef } from "../types/exercise";
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
const mockSquatPose: Pose = {
  keypoints: [
    kp("nose", 0, 0), // irrelevant
    kp("left_hip", 100, 100),
    kp("left_knee", 100, 200), // Knee at (100, 200)
    kp("left_ankle", 200, 200), // Leg bent 90 degrees? verify logic calculateAngle
    // calculateAngle(hip, knee, ankle)
    // hip(100, 100) -> knee(100, 200) vector is (0, 100) down
    // knee(100, 200) -> ankle(200, 200) vector is (100, 0) right
    // Angle between Down and Right is 90 degrees.

    // Right side keypoints (mirroredish or whatever, simplicity use left for now)
    // The sample uses generic names 'hip', 'knee' but MoveNet returns specific ones.
    // We need to map generic to specific if the signal def uses generic names?
    // WAIIIIT. The sample exercise uses 'hip', 'knee', 'ankle'.
    // BUT the MoveNet keypoints are 'left_hip', 'right_hip', etc.
    // The helper findKeypoint searches by exact name.
    // DOES findKeypoint handle mapping? NO.
    // The sample JSON needs to specify WHICH side? Or the engine handles symmetry?
    // ROADMAP 1.2 mentions: "Mirror detection (left/right symmetry)"
    // The sample JSON is currently generic: "points": ["hip", "knee", "ankle"]

    // For this test, I will modify the mock Exercise Definition to use 'left_hip', etc.
    // Or I should fix the findKeypoint logic to handle 'hip' -> 'left_hip'/'right_hip'.
    // Given the Phase 1.2 "Normalization", for now I'll just adapt the test to match strict names
    // or adapt the Sample Data.
    // Let's modify the sample object in memory for the test to use strict names.
  ] as Keypoint[],
  score: 1.0,
};

// Update: Actually, let's make the test robust.
// If I use the sample as is, it expects "hip".
// My mock pose provides "left_hip".
// The `geometry.ts` `findKeypoint` is exact match.
// So `calculateExerciseAngles` will fail to find "hip".
// For this unit test, I will dynamically patch the sample exercise to use 'left_' prefix
// so we verify the MATH logic. Symmetry handling is a separate task.

const exercise = JSON.parse(JSON.stringify(sample)) as ExerciseDef;
// Patch signals to use left side
exercise.signals["knee_angle"].points = ["left_hip", "left_knee", "left_ankle"];
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
