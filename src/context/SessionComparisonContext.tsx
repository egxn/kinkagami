import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Pose } from "@tensorflow-models/pose-detection";
import type { Exercise } from "../types/exercise";
import {
  createSessionComparator,
  type SessionComparator,
  type SessionComparatorSnapshot,
} from "../services/sessionComparator";
import {
  EMPTY_SNAPSHOT,
  SessionComparisonContext,
} from "./SessionComparisonContextDef";
import { logger } from "../utils/logger";
import type {
  SessionComparatorWorkerRequest,
  SessionComparatorWorkerResponse,
  WorkerPose,
} from "../workers/sessionComparatorMessages";

export function SessionComparisonProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const LOG_TAG = "SessionComparisonProvider";
  const comparatorRef = useRef<SessionComparator | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const workerEnabledRef = useRef(false);
  const currentExerciseRef = useRef<Exercise | null>(null);
  const [snapshot, setSnapshot] =
    useState<SessionComparatorSnapshot>(EMPTY_SNAPSHOT);

  const toWorkerPose = useCallback((pose: Pose): WorkerPose => {
    const keypoints = (pose.keypoints ?? []).map((keypoint) => ({
      x: keypoint.x,
      y: keypoint.y,
      score: keypoint.score,
      name: keypoint.name,
    }));

    return {
      keypoints,
      score: pose.score,
    };
  }, []);

  const ensureMainThreadComparator = useCallback(() => {
    const exercise = currentExerciseRef.current;
    if (!exercise) {
      comparatorRef.current = null;
      setSnapshot(EMPTY_SNAPSHOT);
      return;
    }

    comparatorRef.current = createSessionComparator(exercise);
    setSnapshot(comparatorRef.current.getSnapshot());
  }, []);

  const postToWorker = useCallback(
    (message: SessionComparatorWorkerRequest) => {
      if (!workerEnabledRef.current || !workerRef.current) {
        return false;
      }

      workerRef.current.postMessage(message);
      return true;
    },
    [],
  );

  const enableWorker = useCallback(() => {
    if (workerRef.current || typeof Worker === "undefined") {
      return;
    }

    try {
      const worker = new Worker(
        new URL("../workers/sessionComparator.worker.ts", import.meta.url),
        { type: "module" },
      );

      worker.onmessage = (
        event: MessageEvent<SessionComparatorWorkerResponse>,
      ) => {
        const message = event.data;
        if (message.type === "snapshot") {
          setSnapshot(message.snapshot);
          return;
        }

        logger.warn(LOG_TAG, "Worker error response, using main thread", {
          error: message.error,
        });
        workerEnabledRef.current = false;
        worker.terminate();
        workerRef.current = null;
        ensureMainThreadComparator();
      };

      worker.onerror = (event) => {
        logger.error(LOG_TAG, "Worker runtime error, using main thread", event);
        workerEnabledRef.current = false;
        worker.terminate();
        workerRef.current = null;
        ensureMainThreadComparator();
      };

      workerRef.current = worker;
      workerEnabledRef.current = true;
      comparatorRef.current = null;
    } catch (error) {
      logger.warn(LOG_TAG, "Worker unavailable, using main thread comparator", {
        error,
      });
      workerEnabledRef.current = false;
      workerRef.current = null;
    }
  }, [LOG_TAG, ensureMainThreadComparator]);

  useEffect(() => {
    enableWorker();

    return () => {
      workerEnabledRef.current = false;
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [enableWorker]);

  const setExercise = useCallback((exercise: Exercise | null) => {
    currentExerciseRef.current = exercise;

    if (!exercise) {
      comparatorRef.current = null;
      setSnapshot(EMPTY_SNAPSHOT);
      void postToWorker({ type: "setExercise", exercise: null });
      return;
    }

    if (postToWorker({ type: "setExercise", exercise })) {
      return;
    }

    comparatorRef.current = createSessionComparator(exercise);
    setSnapshot(comparatorRef.current.getSnapshot());
  }, [postToWorker]);

  const processPose = useCallback((pose: Pose) => {
    if (postToWorker({
      type: "processPose",
      pose: toWorkerPose(pose),
      nowMs: performance.now(),
    })) {
      return;
    }

    const comparator = comparatorRef.current;
    if (!comparator) return;

    const next = comparator.update(pose, performance.now());
    setSnapshot(next);
  }, [postToWorker, toWorkerPose]);

  const reset = useCallback(() => {
    if (postToWorker({ type: "reset" })) {
      return;
    }

    const comparator = comparatorRef.current;
    if (!comparator) {
      setSnapshot(EMPTY_SNAPSHOT);
      return;
    }

    setSnapshot(comparator.reset());
  }, [postToWorker]);

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
