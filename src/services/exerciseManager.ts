import type { ExerciseDef } from "../types/exercise";

/**
 * Loads all exercises using Vite's import.meta.glob.
 * returns a list of contents of the json files
 */
export const loadAllExercises = (): ExerciseDef[] => {
  const modules = import.meta.glob("../db/exercises/*.json", { eager: true });
  // Handle both default export (if JSON imported as module) and direct content
  return Object.values(modules).map(
    (mod: any) => mod.default || mod,
  ) as ExerciseDef[];
};

/**
 * Validates the structure of an exercise definition.
 * Pure function.
 */
export const validateExercise = (
  exercise: ExerciseDef,
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!exercise.exercise_id) {
    errors.push("Missing exercise_id");
  }
  if (!exercise.name) {
    errors.push("Missing name");
  }
  if (!exercise.signals) {
    errors.push("Missing signals definition");
  }
  if (!exercise.event_graph) {
    errors.push("Missing event_graph");
  }

  if (exercise.event_graph) {
    if (!Array.isArray(exercise.event_graph.nodes)) {
      errors.push("event_graph.nodes must be an array");
    }
    if (!Array.isArray(exercise.event_graph.edges)) {
      errors.push("event_graph.edges must be an array");
    }
  }

  // TODO: Add deeper validation for graph integrity (dangling edges, etc.)

  return { valid: errors.length === 0, errors };
};

/**
 * Finds an exercise by ID from a list.
 * Pure function.
 */
export const getExerciseById = (
  exercises: ExerciseDef[],
  id: string,
): ExerciseDef | undefined => {
  return exercises.find((e) => e.exercise_id === id);
};
