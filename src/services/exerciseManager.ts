import type { Exercise } from "../types/exercise";

/**
 * Loads all exercises using Vite's import.meta.glob.
 * returns a list of contents of the json files
 */
export const loadAllExercises = (): Exercise[] => {
  const modules = import.meta.glob("../db/exercises/*.json", { eager: true });
  // Handle both default export (if JSON imported as module) and direct content
  return Object.values(modules).map(
    (mod: unknown) => (mod as { default?: Exercise }).default || mod,
  ) as Exercise[];
};

/**
 * Validates the structure of an exercise definition.
 * Pure function.
 */
export const validateExercise = (
  exercise: Exercise,
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Required fields
  if (!exercise.created_at) {
    errors.push("Missing created_at");
  }

  // Validate event_graph structure if present
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
  exercises: Exercise[],
  id: string,
): Exercise | undefined => {
  return exercises.find((e) => e.exercise_id === id);
};
