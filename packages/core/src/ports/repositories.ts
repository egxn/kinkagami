import type { Exercise, Routine } from "../exercise/types";

export type NewExercise = Omit<Exercise, "_id" | "_rev" | "updatedAt">;
export type NewRoutine = Omit<Routine, "_id" | "_rev" | "updatedAt">;

export interface ClearResult {
  success: boolean;
  deletedCount: number;
}

/** Unsubscribe function returned by `subscribe`. */
export type Unsubscribe = () => void;

/**
 * Persistence ports. Clients provide adapters (PouchDB on web/embedded,
 * SQLite/AsyncStorage on mobile); `core` and shared logic only see these.
 */
export interface ExerciseRepository {
  getAll(): Promise<Exercise[]>;
  /** Rejects when the exercise does not exist. */
  getById(id: string): Promise<Exercise>;
  add(exercise: NewExercise): Promise<unknown>;
  update(id: string, updates: Partial<Exercise>): Promise<unknown>;
  remove(id: string): Promise<unknown>;
}

export interface RoutineRepository {
  getAll(): Promise<Routine[]>;
  getById(id: string): Promise<Routine>;
  add(routine: NewRoutine): Promise<unknown>;
  update(id: string, updates: Partial<Routine>): Promise<unknown>;
  remove(id: string): Promise<unknown>;
  /** Removes every routine. */
  clear(): Promise<ClearResult>;
  /** Notifies when the stored routines change (optional for simple stores). */
  subscribe?(
    onChange: () => void,
    onError?: (error: unknown) => void,
  ): Unsubscribe;
}
