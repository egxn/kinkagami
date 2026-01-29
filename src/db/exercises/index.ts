/**
 * Índice de ejercicios disponibles en src/db/exercises/
 * 
 * Este archivo mantiene una lista de todos los ejercicios JSON disponibles
 * y facilita su importación en la aplicación.
 * 
 * Agregar nuevos ejercicios:
 * 1. Crear archivo JSON en src/db/exercises/XX_nombre.json
 * 2. Agregar el nombre del archivo a la lista EXERCISE_FILES
 * 3. El ejercicio será cargable automáticamente
 */

/**
 * Lista de archivos de ejercicios disponibles (sin extensión .json)
 */
export const EXERCISE_FILES = [
  '00_sample', // Sentadilla con elevación de brazos
  // Agregar más ejercicios aquí
  // '01_pushups',
  // '02_squats_advanced',
  // etc.
] as const;

/**
 * Tipo que representa un nombre de archivo de ejercicio
 */
export type ExerciseFileName = typeof EXERCISE_FILES[number];

/**
 * Verificar si un nombre de archivo es válido
 */
export function isValidExerciseFile(fileName: string): fileName is ExerciseFileName {
  return EXERCISE_FILES.includes(fileName as ExerciseFileName);
}

/**
 * Obtener la lista completa de nombres de archivos disponibles
 */
export function getAvailableExerciseFiles(): readonly string[] {
  return EXERCISE_FILES;
}
