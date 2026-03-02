import { useCallback, useMemo, useRef, useState } from "react";
import type { Pose } from "@tensorflow-models/pose-detection";
import type { Exercise } from "../types/exercise";
import {
  createSessionComparator,
  type SessionComparator,
  type SessionComparatorSnapshot,
} from "../services/sessionComparator";
import { EMPTY_SNAPSHOT, SessionComparisonContext } from "./SessionComparisonContextDef";

export function SessionComparisonProvider({ children }: { children: React.ReactNode }) {
  const comparatorRef = useRef<SessionComparator | null>(null);
  const [snapshot, setSnapshot] = useState<SessionComparatorSnapshot>(EMPTY_SNAPSHOT);

  const setExercise = useCallback((exercise: Exercise | null) => {
    if (!exercise) {
      comparatorRef.current = null;
      setSnapshot(EMPTY_SNAPSHOT);
      return;
    }

    comparatorRef.current = createSessionComparator(exercise);
    setSnapshot(comparatorRef.current.getSnapshot());
  }, []);

  const processPose = useCallback((pose: Pose) => {
    const comparator = comparatorRef.current;
    if (!comparator) return;

    const next = comparator.update(pose, performance.now());
    setSnapshot(next);
  }, []);

  const reset = useCallback(() => {
    const comparator = comparatorRef.current;
    if (!comparator) {
      setSnapshot(EMPTY_SNAPSHOT);
      return;
    }

    setSnapshot(comparator.reset());
  }, []);

  const value = useMemo(
    () => ({
      snapshot,
      setExercise,
      processPose,
      reset,
    }),
    [snapshot, setExercise, processPose, reset],
  );

  return (
    <SessionComparisonContext.Provider value={value}>
      {children}
    </SessionComparisonContext.Provider>
  );
}
