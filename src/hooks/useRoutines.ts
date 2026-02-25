import { useCallback, useEffect, useState } from "react";
import type { Routine } from "../types/exercise";
import {
  addRoutine,
  deleteRoutine,
  getAllRoutines,
  updateRoutine,
} from "../db/dbService";

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

  const refreshRoutines = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllRoutines();
      // Newest first
      data.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
      setRoutines(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshRoutines();
  }, [refreshRoutines]);

  const addNewRoutine = useCallback(
    async (routine: Omit<Routine, "_id" | "_rev" | "updatedAt">) => {
      try {
        setError(null);
        await addRoutine(routine);
        await refreshRoutines();
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        throw error;
      }
    },
    [refreshRoutines],
  );

  const updateRoutineData = useCallback(
    async (id: string, updates: Partial<Routine>) => {
      try {
        setError(null);
        await updateRoutine(id, updates);
        await refreshRoutines();
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        throw error;
      }
    },
    [refreshRoutines],
  );

  const deleteRoutineData = useCallback(
    async (id: string) => {
      try {
        setError(null);
        await deleteRoutine(id);
        await refreshRoutines();
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
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
