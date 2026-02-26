import { useCallback, useEffect, useRef, useState } from "react";
import type { Routine } from "../types/exercise";
import {
  addRoutine,
  deleteRoutine,
  getAllRoutines,
  routinesDB,
  updateRoutine,
} from "../db/dbService";
import { logger } from "../utils/logger";

const ROUTINES_LOAD_TIMEOUT_MS = 8000;

const toTimestamp = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Routine loading timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export interface UseRoutinesResult {
  routines: Routine[];
  loading: boolean;
  error: Error | null;
  addNewRoutine: (routine: Omit<Routine, "_id" | "_rev" | "updatedAt">) => Promise<void>;
  updateRoutineData: (id: string, updates: Partial<Routine>) => Promise<void>;
  deleteRoutineData: (id: string) => Promise<void>;
  refreshRoutines: () => Promise<void>;
}

/**
 * Hook for managing routines from PouchDB database
 */
export function useRoutines(): UseRoutinesResult {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refreshRoutines = useCallback(async () => {
    logger.log("useRoutines", "Loading routines from DB...");

    try {
      if (isMountedRef.current) {
        setLoading(true);
        setError(null);
      }
      const data = await withTimeout(getAllRoutines(), ROUTINES_LOAD_TIMEOUT_MS);
      // Newest first (resilient to legacy/corrupt date fields)
      data.sort(
        (a, b) =>
          Math.max(toTimestamp(b.created_at), toTimestamp(b.updatedAt)) -
          Math.max(toTimestamp(a.created_at), toTimestamp(a.updatedAt)),
      );
      if (isMountedRef.current) {
        setRoutines(data);
      }

      logger.log("useRoutines", "Routines loaded", {
        count: data.length,
        routines: data.map((routine) => ({
          id: routine._id ?? null,
          name: routine.name ?? "Sin nombre",
          created_at: routine.created_at ?? null,
          updatedAt: routine.updatedAt ?? null,
          exercisesCount: routine.items?.length ?? routine.exercises?.length ?? 0,
        })),
      });
    } catch (err) {
      logger.error("useRoutines", "Error loading routines", err);

      if (isMountedRef.current) {
        setRoutines([]);
        setError(err instanceof Error ? err : new Error("Unknown error"));
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    refreshRoutines();
  }, [refreshRoutines]);

  useEffect(() => {
    const changesFeed = routinesDB.changes({
      since: "now",
      live: true,
      include_docs: false,
    }) as {
      on: (event: string, handler: (...args: unknown[]) => void) => unknown;
      cancel: () => void;
    };

    changesFeed.on("change", () => {
      logger.log("useRoutines", "Detected routines DB change, refreshing...");
      void refreshRoutines();
    });

    changesFeed.on("error", (changeError: unknown) => {
      logger.error("useRoutines", "routinesDB changes feed error", changeError);
    });

    return () => {
      changesFeed.cancel();
    };
  }, [refreshRoutines]);

  useEffect(() => {
    logger.log("useRoutines", "Hook state updated", {
      loading,
      hasError: !!error,
      routinesCount: routines.length,
    });
  }, [routines, loading, error]);

  const addNewRoutine = useCallback(
    async (routine: Omit<Routine, "_id" | "_rev" | "updatedAt">) => {
      try {
        if (isMountedRef.current) {
          setError(null);
        }
        await addRoutine(routine);
        await refreshRoutines();
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        if (isMountedRef.current) {
          setError(error);
        }
        throw error;
      }
    },
    [refreshRoutines],
  );

  const updateRoutineData = useCallback(
    async (id: string, updates: Partial<Routine>) => {
      try {
        if (isMountedRef.current) {
          setError(null);
        }
        await updateRoutine(id, updates);
        await refreshRoutines();
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        if (isMountedRef.current) {
          setError(error);
        }
        throw error;
      }
    },
    [refreshRoutines],
  );

  const deleteRoutineData = useCallback(
    async (id: string) => {
      try {
        if (isMountedRef.current) {
          setError(null);
        }
        await deleteRoutine(id);
        await refreshRoutines();
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        if (isMountedRef.current) {
          setError(error);
        }
        throw error;
      }
    },
    [refreshRoutines],
  );

  return {
    routines,
    loading,
    error,
    addNewRoutine,
    updateRoutineData,
    deleteRoutineData,
    refreshRoutines,
  };
}
