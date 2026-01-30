// @ts-ignore
import PouchDB from "pouchdb/dist/pouchdb.js";
import type { RecordingAngleEntry } from "../utils/poseUtils";
import type { Pose } from "@tensorflow-models/pose-detection";

// Initialize databases
export const exercisesDB = new PouchDB("exercises");
export const exercisesRecordsDB = new PouchDB("exercises_records");

export interface Exercise {
  _id?: string;
  _rev?: string;
  name: string;
  description: string;
  sets?: number;
  reps?: number;
  duration?: number;
  createdAt: number;
  updatedAt: number;
}

export interface RecordingPoint {
  timestamp: number;
  poses: Pose[];
}

export interface RecordingAngle {
  timestamp: number;
  angles: RecordingAngleEntry[];
}

export interface ExerciseRecord {
  _id?: string;
  _rev?: string;
  exercise_id: string;
  name: string;
  description: string;
  muscle_groups: string[];
  difficulty: string;
  instructions: string[];
  recording_points: RecordingPoint[];
  recording_angles: RecordingAngle[];
  created_at: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Load an exercise from JSON located in src/db/exercises/
 *
 * Loading strategy:
 * - JSON files are imported dynamically using import()
 * - Exercises are loaded into PouchDB on initialization
 * - The DB acts as a local cache
 *
 * @example
 * // Import a specific exercise
 * const exercise = await loadExerciseFromJSON('00_sample');
 *
 * @param exerciseFileName - File name without extension (e.g., '00_sample')
 */
export async function loadExerciseFromJSON(exerciseFileName: string) {
  try {
    // Use Vite's glob import pattern to load JSON dynamically
    const module = await import(`./exercises/${exerciseFileName}.json`);
    const exerciseData = module.default;

    console.log(`Exercise loaded: ${exerciseData.exercise_id}`);
    return exerciseData;
  } catch (error) {
    console.error(`Error loading exercise ${exerciseFileName}:`, error);
    throw error;
  }
}

/**
 * Import all exercises from src/db/exercises/ to PouchDB
 * Note: Vite needs special configuration in vite.config.ts to import JSONs
 *
 * Alternative: Configure vite.config.ts with:
 * ```ts
 * import { defineConfig } from 'vite'
 * import react from '@vitejs/plugin-react-swc'
 *
 * export default defineConfig({
 *   plugins: [react()],
 *   ssr: {
 *     external: ['pouchdb']
 *   }
 * })
 * ```
 */
export async function importExercisesFromJSON(exerciseFileNames: string[]) {
  const results = {
    success: 0,
    failed: 0,
    errors: [] as { fileName: string; error: string }[],
  };

  try {
    for (const fileName of exerciseFileNames) {
      try {
        const exerciseData = await loadExerciseFromJSON(fileName);
        const exercise: Omit<Exercise, "_id" | "_rev"> = {
          name: exerciseData.name || "Unnamed exercise",
          description: exerciseData.description || "",
          sets: exerciseData.sets,
          reps: exerciseData.reps,
          duration: exerciseData.duration,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await addExercise(exercise);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          fileName,
          error: error instanceof Error ? error.message : String(error),
        });
        console.error(`✗ Error importing ${fileName}:`, error);
      }
    }

    console.log(
      `✓ Import completed: ${results.success} successful, ${results.failed} failed`,
    );

    if (results.errors.length > 0) {
      console.warn("Import errors:", results.errors);
    }

    return results;
  } catch (error) {
    console.error("Error importing exercises from JSON:", error);
    throw error;
  }
}

/**
 * Add a new exercise to the database
 */
export async function addExercise(
  exercise: Omit<Exercise, "_id" | "_rev" | "createdAt" | "updatedAt">,
) {
  const doc: Exercise = {
    ...exercise,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  try {
    const result = await exercisesDB.post(doc);
    return { success: true, id: result.id, rev: result.rev };
  } catch (error) {
    console.error("Error adding exercise:", error);
    throw error;
  }
}

/**
 * Get all exercises
 */
export async function getAllExercises(): Promise<Exercise[]> {
  try {
    const result = await exercisesDB.allDocs({ include_docs: true });
    return (
      result.rows
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((row: any) => row.doc as Exercise)
        .filter((doc: Exercise | undefined): doc is Exercise => !!doc)
    );
  } catch (error) {
    console.error("Error getting exercises:", error);
    throw error;
  }
}

/**
 * Get an exercise by ID
 */
export async function getExerciseById(id: string): Promise<Exercise> {
  try {
    const doc = await exercisesDB.get(id);
    return doc as Exercise;
  } catch (error) {
    console.error("Error getting exercise:", error);
    throw error;
  }
}

/**
 * Update an exercise
 */
export async function updateExercise(id: string, updates: Partial<Exercise>) {
  try {
    const doc = await exercisesDB.get(id);
    const updated = {
      ...doc,
      ...updates,
      updatedAt: Date.now(),
    };
    const result = await exercisesDB.put(updated);
    return { success: true, rev: result.rev };
  } catch (error) {
    console.error("Error updating exercise:", error);
    throw error;
  }
}

/**
 * Delete an exercise
 */
export async function deleteExercise(id: string) {
  try {
    const doc = await exercisesDB.get(id);
    await exercisesDB.remove(doc);
    return { success: true };
  } catch (error) {
    console.error("Error deleting exercise:", error);
    throw error;
  }
}

/**
 * Sync with a remote server
 */
export async function syncWithRemote(remoteUrl: string) {
  try {
    const remoteDB = new PouchDB(remoteUrl);
    const result = await exercisesDB.sync(remoteDB, {
      live: false,
      retry: false,
    });
    return result;
  } catch (error) {
    console.error("Error syncing with remote:", error);
    throw error;
  }
}

/**
 * Clear the database (delete all documents)
 */
export async function clearDatabase() {
  try {
    const result = await exercisesDB.destroy();
    return result;
  } catch (error) {
    console.error("Error clearing database:", error);
    throw error;
  }
}

// ==================== exercises_records ====================

/**
 * Add a new exercise record to the database
 */
export async function addExerciseRecord(
  record: Omit<ExerciseRecord, "_id" | "_rev" | "createdAt" | "updatedAt">,
) {
  const doc: ExerciseRecord = {
    ...record,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  try {
    const result = await exercisesRecordsDB.post(doc);
    return { success: true, id: result.id, rev: result.rev };
  } catch (error) {
    console.error("Error adding exercise record:", error);
    throw error;
  }
}

/**
 * Get all exercise records
 */
export async function getAllExerciseRecords(): Promise<ExerciseRecord[]> {
  try {
    const result = await exercisesRecordsDB.allDocs({ include_docs: true });
    return (
      result.rows
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((row: any) => row.doc as ExerciseRecord)
        .filter(
          (doc: ExerciseRecord | undefined): doc is ExerciseRecord => !!doc,
        )
    );
  } catch (error) {
    console.error("Error getting exercise records:", error);
    throw error;
  }
}

/**
 * Get an exercise record by ID
 */
export async function getExerciseRecordById(
  id: string,
): Promise<ExerciseRecord> {
  try {
    const doc = await exercisesRecordsDB.get(id);
    return doc as ExerciseRecord;
  } catch (error) {
    console.error("Error getting exercise record:", error);
    throw error;
  }
}

/**
 * Get exercise records by exercise_id
 */
export async function getExerciseRecordsByExerciseId(
  exerciseId: string,
): Promise<ExerciseRecord[]> {
  try {
    const allRecords = await getAllExerciseRecords();
    return allRecords.filter((record) => record.exercise_id === exerciseId);
  } catch (error) {
    console.error("Error getting exercise records by exercise_id:", error);
    throw error;
  }
}

/**
 * Delete an exercise record
 */
export async function deleteExerciseRecord(id: string) {
  try {
    const doc = await exercisesRecordsDB.get(id);
    await exercisesRecordsDB.remove(doc);
    return { success: true };
  } catch (error) {
    console.error("Error deleting exercise record:", error);
    throw error;
  }
}

/**
 * Clear the exercise records database
 */
export async function clearExerciseRecordsDatabase() {
  try {
    const result = await exercisesRecordsDB.destroy();
    return result;
  } catch (error) {
    console.error("Error clearing exercise records database:", error);
    throw error;
  }
}
