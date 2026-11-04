import { createContext } from "react";
import type { Pose } from "@tensorflow-models/pose-detection";
import { type Exercise, type SessionComparatorSnapshot } from "@kgm/core";

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
  holdProgress: 0,
  progressScore: 0,
  qualityScore: 0,
  tempoScore: 0,
  tempoResolved: 0,
  tempoTotal: 0,
  accuracyScore: 0,
  overallScore: 0,
};

export const SessionComparisonContext =
  createContext<SessionComparisonContextType | null>(null);
