/**
 * Index of available exercises in src/db/exercises/
 *
 * This file maintains a list of all available JSON exercises
 * and facilitates their import in the application.
 *
 * Adding new exercises:
 * 1. Create JSON file in src/db/exercises/XX_name.json
 * 2. Add the file name to the EXERCISE_FILES list
 * 3. The exercise will be automatically loadable
 */

/**
 * List of available exercise files (without .json extension)
 */
export const EXERCISE_FILES = [
  "00_sample", // Squat with arm raise
  // Add more exercises here
  // '01_pushups',
  // '02_squats_advanced',
  // etc.
] as const;

/**
 * Type representing an exercise file name
 */
export type ExerciseFileName = (typeof EXERCISE_FILES)[number];

/**
 * Check if a file name is valid
 */
export function isValidExerciseFile(
  fileName: string,
): fileName is ExerciseFileName {
  return EXERCISE_FILES.includes(fileName as ExerciseFileName);
}

/**
 * Get the complete list of available file names
 */
export function getAvailableExerciseFiles(): readonly string[] {
  return EXERCISE_FILES;
}
