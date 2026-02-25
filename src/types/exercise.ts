import type { Pose } from "@tensorflow-models/pose-detection";
import type { RecordingAngleEntry } from "../utils/poseUtils";

export type BodyPart =
  | "nose"
  | "left_eye"
  | "right_eye"
  | "left_ear"
  | "right_ear"
  | "left_shoulder"
  | "right_shoulder"
  | "left_elbow"
  | "right_elbow"
  | "left_wrist"
  | "right_wrist"
  | "left_hip"
  | "right_hip"
  | "left_knee"
  | "right_knee"
  | "left_ankle"
  | "right_ankle";

export interface SignalDef {
  type: "angle" | "distance" | "relative_position";
  points: BodyPart[];
}

export interface EventNode {
  id: string;
  type?: "uphill" | "downhill" | "sync"; // default implies simple check
  signal?: string; // key in signals map
  range?: [number, number]; // [min, max]
  hold_ms?: number;
  emit?: boolean; // if true, emits an event when active/completed
  requires?: string[]; // for sync nodes, list of node IDs to wait for
}

export interface EventEdge {
  from: string;
  to: string;
}

export interface EventGraph {
  nodes: EventNode[];
  edges: EventEdge[];
}

export interface TimeConstraint {
  id: string;
  from: string;
  to: string;
  min_ms?: number;
  max_ms?: number;
  severity: "soft" | "hard";
}

export interface CompletionCriteria {
  terminal_nodes: string[];
}

export interface RecordingPoint {
  timestamp: number;
  poses: Pose[];
}

export interface RecordingAngle {
  timestamp: number;
  angles: RecordingAngleEntry[];
}

/**
 * Unified Exercise type for both definitions and records
 */
export interface Exercise {
  _id?: string;
  _rev?: string;
  exercise_id?: string;
  name?: string;
  description?: string;
  muscle_groups?: string[];
  difficulty?: "beginner" | "intermedio" | "advanced" | string;
  instructions?: string[];
  signals?: Record<string, SignalDef>;
  event_graph?: EventGraph;
  time_constraints?: TimeConstraint[];
  completion?: CompletionCriteria;
  created_at: string;
  duration?: number;
  recording_angles: RecordingAngle[];
  recording_points: RecordingPoint[];
  reps?: number;
  sets?: number;
  updatedAt: number;
}

/** @deprecated Use Exercise instead */
export type ExerciseDef = Exercise;

/**
 * Simplified body parts for stats (excluding eyes and merging symmetric parts)
 */
export type SimplifiedBodyPart =
  | "nose"
  | "ear"
  | "shoulder"
  | "elbow"
  | "wrist"
  | "hip"
  | "knee"
  | "ankle";

/**
 * Stats for a routine showing percentage of body parts exercised
 */
export interface RoutineStats {
  /** Percentage of each body part being exercised (0-100) */
  bodyParts: Record<SimplifiedBodyPart, number>;
  /** Total unique muscle groups targeted */
  muscleGroups: string[];
}

/**
 * Routine item with per-exercise configuration
 */
export interface RoutineExerciseItem {
  exerciseId: string;
  reps: number;
}

/**
 * Routine containing a sequence of exercises
 */
export interface Routine {
  _id?: string;
  _rev?: string;
  name: string;
  description?: string;
  /** Array of exercise IDs (legacy/backwards compatibility) */
  exercises: string[];
  /** Items with per-exercise reps (preferred) */
  items?: RoutineExerciseItem[];
  /** Total estimated time in seconds */
  time: number;
  /** Stats about body parts exercised */
  stats: RoutineStats;
  created_at: string;
  updatedAt: number;
}
