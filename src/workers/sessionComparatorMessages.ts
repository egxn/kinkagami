import type { Exercise } from "../types/exercise";
import type { SessionComparatorSnapshot } from "../services/sessionComparator";

export interface WorkerPoseKeypoint {
  x: number;
  y: number;
  score?: number;
  name?: string;
}

export interface WorkerPose {
  keypoints: WorkerPoseKeypoint[];
  score?: number;
}

export type SessionComparatorWorkerRequest =
  | {
      type: "setExercise";
      exercise: Exercise | null;
    }
  | {
      type: "processPose";
      pose: WorkerPose;
      nowMs: number;
    }
  | {
      type: "reset";
    };

export type SessionComparatorWorkerResponse =
  | {
      type: "snapshot";
      snapshot: SessionComparatorSnapshot;
    }
  | {
      type: "error";
      error: string;
    };
