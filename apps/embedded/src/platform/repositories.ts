import type { ExerciseRepository, RoutineRepository } from "@kgm/core";
import {
  addExercise,
  addRoutine,
  clearRoutinesDatabase,
  deleteExercise,
  deleteRoutine,
  getAllExercises,
  getAllRoutines,
  getExerciseById,
  getRoutineById,
  routinesDB,
  updateExercise,
  updateRoutine,
} from "../db/dbService";

/**
 * PouchDB-backed (IndexedDB in browsers) implementation of the core
 * persistence ports. Part of the embedded/PWA composition root: shared logic
 * depends on the `@kgm/core` ports, and only `src/platform/*` binds them to
 * concrete browser implementations (other clients ship their own).
 */
export const exerciseRepository: ExerciseRepository = {
  getAll: () => getAllExercises(),
  getById: (id) => getExerciseById(id),
  add: (exercise) => addExercise(exercise),
  update: (id, updates) => updateExercise(id, updates),
  remove: (id) => deleteExercise(id),
};

type ChangesFeed = {
  on: (event: string, handler: (...args: unknown[]) => void) => unknown;
  cancel: () => void;
};

export const routineRepository: RoutineRepository = {
  getAll: () => getAllRoutines(),
  getById: (id) => getRoutineById(id),
  add: (routine) => addRoutine(routine),
  update: (id, updates) => updateRoutine(id, updates),
  remove: (id) => deleteRoutine(id),
  clear: () => clearRoutinesDatabase(),
  subscribe: (onChange, onError) => {
    const feed = routinesDB.changes({
      since: "now",
      live: true,
      include_docs: false,
    }) as unknown as ChangesFeed;

    feed.on("change", () => onChange());
    feed.on("error", (error: unknown) => onError?.(error));

    return () => feed.cancel();
  },
};
