import { createContext } from "react";
import type { Pose } from "@tensorflow-models/pose-detection";
import type { Exercise } from "../types/exercise";
import type { SessionComparatorSnapshot } from "../services/sessionComparator";

export interface SessionComparisonContextType {
  snapshot: SessionComparatorSnapshot;
  setExercise: (exercise: Exercise | null) => void;
  processPose: (pose: Pose) => void;
  reset: () => void;
}

export const EMPTY_SNAPSHOT: SessionComparatorSnapshot = {
  score: 0,
  matchedCount: 0,
  totalNodes: 0,
  currentNodeId: null,
  completion: 0,
  completed: false,
  activeSignals: {},
  gridScore: 0,
  gridProgress: 0,
  gridMatchedKeypoints: 0,
  gridTotalKeypoints: 0,
};

export const SessionComparisonContext =
  createContext<SessionComparisonContextType | null>(null);
