import { type Exercise, type SessionComparatorSnapshot } from "@kgm/core";

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
