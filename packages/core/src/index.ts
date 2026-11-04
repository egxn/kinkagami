// Pose primitives
export type { Keypoint, Pose } from "./pose/types";
export * from "./pose/geometry";
export * from "./pose/poseUtils";
export * from "./pose/keypointSmoother";

// Exercise model + data-driven validation
export * from "./exercise/types";
export * from "./exercise/generator";
export * from "./exercise/gridValidation";
export * from "./exercise/dataBundle";
export { validateExercise } from "./exercise/manager";

// Scoring
export * from "./scoring/sessionComparator";

// Trainer flow
export * from "./trainer/trainerSession";

// Config
export * from "./config/appConfig";

// Ports (implemented by each client)
export type * from "./ports/repositories";
export type * from "./ports/config";
export type * from "./ports/pose";
