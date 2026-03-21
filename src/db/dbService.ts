// @ts-expect-error PouchDB types
import PouchDB from "pouchdb/dist/pouchdb.js";
import type {
  Exercise,
  RecordingAngle,
  RecordingPoint,
  Routine,
  SimplifiedBodyPart,
} from "../types/exercise";

// Re-export types for backwards compatibility
export type { Exercise, RecordingAngle, RecordingPoint, Routine };
/** @deprecated Use Exercise instead */
export type ExerciseRecord = Exercise;

// Initialize databases
export const exercisesDB = new PouchDB("exercises");
export const routinesDB = new PouchDB("routines");

const exerciseJsonModules = import.meta.glob<{
  default: Record<string, unknown>;
}>("./exercises/*.json");

const routineJsonModules = import.meta.glob<{
  default: Record<string, unknown>;
}>("./routines/*.json");

let seedExercisesPromise: Promise<void> | null = null;
let seedRoutinesPromise: Promise<void> | null = null;

const mapExerciseJsonToDoc = (
  exerciseData: Record<string, unknown>,
): Omit<Exercise, "_id" | "_rev" | "updatedAt"> => ({
  exercise_id:
    typeof exerciseData.exercise_id === "string"
      ? exerciseData.exercise_id
      : undefined,
  name: typeof exerciseData.name === "string" ? exerciseData.name : undefined,
  description:
    typeof exerciseData.description === "string"
      ? exerciseData.description
      : undefined,
  muscle_groups: Array.isArray(exerciseData.muscle_groups)
    ? (exerciseData.muscle_groups as string[])
    : undefined,
  difficulty:
    typeof exerciseData.difficulty === "string"
      ? exerciseData.difficulty
      : undefined,
  instructions: Array.isArray(exerciseData.instructions)
    ? (exerciseData.instructions as string[])
    : undefined,
  signals: exerciseData.signals as Exercise["signals"],
  event_graph: exerciseData.event_graph as Exercise["event_graph"],
  grid_validation: exerciseData.grid_validation as Exercise["grid_validation"],
  time_constraints:
    exerciseData.time_constraints as Exercise["time_constraints"],
  completion: exerciseData.completion as Exercise["completion"],
  sets: typeof exerciseData.sets === "number" ? exerciseData.sets : undefined,
  reps: typeof exerciseData.reps === "number" ? exerciseData.reps : undefined,
  duration:
    typeof exerciseData.duration === "number"
      ? exerciseData.duration
      : undefined,
  recording_angles: Array.isArray(exerciseData.recording_angles)
    ? (exerciseData.recording_angles as RecordingAngle[])
    : [],
  recording_points: Array.isArray(exerciseData.recording_points)
    ? (exerciseData.recording_points as RecordingPoint[])
    : [],
  tutor_points: Array.isArray(exerciseData.tutor_points)
    ? (exerciseData.tutor_points as RecordingPoint[])
    : Array.isArray(exerciseData.tutorPoints)
      ? (exerciseData.tutorPoints as RecordingPoint[])
      : [],
  created_at: new Date().toISOString(),
});

const defaultRoutineStats: Routine["stats"] = {
  bodyParts: {
    nose: 0,
    ear: 0,
    shoulder: 0,
    elbow: 0,
    wrist: 0,
    hip: 0,
    knee: 0,
    ankle: 0,
  },
  muscleGroups: [],
};

const mapRoutineJsonToDoc = (
  routineData: Record<string, unknown>,
): Omit<Routine, "_id" | "_rev" | "updatedAt"> => {
  const items = Array.isArray(routineData.items)
    ? routineData.items
        .map((item) => {
          const source = item as { exerciseId?: unknown; reps?: unknown };
          if (typeof source.exerciseId !== "string") return null;
          return {
            exerciseId: source.exerciseId,
            reps:
              typeof source.reps === "number" && source.reps > 0
                ? source.reps
                : 1,
          };
        })
        .filter(
          (item): item is { exerciseId: string; reps: number } => item != null,
        )
    : [];

  const exercises = Array.isArray(routineData.exercises)
    ? routineData.exercises.filter(
        (exerciseId): exerciseId is string => typeof exerciseId === "string",
      )
    : items.map((item) => item.exerciseId);

  const routineName =
    typeof routineData.name === "string"
      ? routineData.name
      : typeof routineData._id === "string"
        ? routineData._id
        : "Routine";

  const routineDescription =
    typeof routineData.description === "string"
      ? routineData.description
      : undefined;

  const sourceStats = routineData.stats as Routine["stats"] | undefined;
  const stats: Routine["stats"] = sourceStats
    ? {
        bodyParts: {
          nose: sourceStats.bodyParts?.nose ?? 0,
          ear: sourceStats.bodyParts?.ear ?? 0,
          shoulder: sourceStats.bodyParts?.shoulder ?? 0,
          elbow: sourceStats.bodyParts?.elbow ?? 0,
          wrist: sourceStats.bodyParts?.wrist ?? 0,
          hip: sourceStats.bodyParts?.hip ?? 0,
          knee: sourceStats.bodyParts?.knee ?? 0,
          ankle: sourceStats.bodyParts?.ankle ?? 0,
        },
        muscleGroups: Array.isArray(sourceStats.muscleGroups)
          ? sourceStats.muscleGroups
          : [],
      }
    : defaultRoutineStats;

  return {
    name: routineName,
    description: routineDescription,
    exercises,
    items,
    time:
      typeof routineData.time === "number" && routineData.time >= 0
        ? routineData.time
        : 0,
    stats,
    created_at:
      typeof routineData.created_at === "string"
        ? routineData.created_at
        : new Date().toISOString(),
  };
};

async function ensureSeedExercisesIfEmpty(): Promise<void> {
  if (seedExercisesPromise) {
    await seedExercisesPromise;
    return;
  }

  seedExercisesPromise = (async () => {
    const existing = await exercisesDB.allDocs({
      include_docs: false,
      limit: 1,
    });
    if (existing.rows.length > 0) return;

    const modulePaths = Object.keys(exerciseJsonModules).sort();
    if (modulePaths.length === 0) {
      // No bundled JSON seeds – DB starts empty, exercises can be added via scripts/db-seeds-load.mjs
      return;
    }

    for (const modulePath of modulePaths) {
      try {
        const module = await exerciseJsonModules[modulePath]();
        const exerciseData = module.default;
        if (!exerciseData || typeof exerciseData !== "object") continue;

        await addExercise(mapExerciseJsonToDoc(exerciseData));
      } catch (error) {
        console.error(`Error seeding exercise from ${modulePath}:`, error);
      }
    }
  })();

  try {
    await seedExercisesPromise;
  } finally {
    seedExercisesPromise = null;
  }
}

async function ensureSeedRoutinesIfEmpty(): Promise<void> {
  if (seedRoutinesPromise) {
    await seedRoutinesPromise;
    return;
  }

  seedRoutinesPromise = (async () => {
    const existing = await routinesDB.allDocs({
      include_docs: false,
      limit: 1,
    });
    if (existing.rows.length > 0) return;

    const modulePaths = Object.keys(routineJsonModules).sort();
    if (modulePaths.length === 0) {
      return;
    }

    for (const modulePath of modulePaths) {
      try {
        const module = await routineJsonModules[modulePath]();
        const routineData = module.default;
        if (!routineData || typeof routineData !== "object") continue;

        await addRoutine(mapRoutineJsonToDoc(routineData));
      } catch (error) {
        console.error(`Error seeding routine from ${modulePath}:`, error);
      }
    }
  })();

  try {
    await seedRoutinesPromise;
  } finally {
    seedRoutinesPromise = null;
  }
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
    // JSON import eliminado: exercises/*.json ya no existe
    throw new Error("Importación de exercises/*.json eliminada: el archivo ya no existe");
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
        const exercise: Omit<Exercise, "_id" | "_rev" | "updatedAt"> = {
          exercise_id: exerciseData.exercise_id,
          name: exerciseData.name,
          description: exerciseData.description,
          muscle_groups: exerciseData.muscle_groups,
          difficulty: exerciseData.difficulty,
          instructions: exerciseData.instructions,
          signals: exerciseData.signals,
          event_graph: exerciseData.event_graph,
          grid_validation: exerciseData.grid_validation,
          time_constraints: exerciseData.time_constraints,
          completion: exerciseData.completion,
          sets: exerciseData.sets,
          reps: exerciseData.reps,
          duration: exerciseData.duration,
          recording_angles: exerciseData.recording_angles ?? [],
          recording_points: exerciseData.recording_points ?? [],
          created_at: new Date().toISOString(),
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
  exercise: Omit<Exercise, "_id" | "_rev" | "updatedAt">,
) {
  const doc: Exercise = {
    ...exercise,
    recording_angles: exercise.recording_angles ?? [],
    recording_points: exercise.recording_points ?? [],
    tutor_points: exercise.tutor_points ?? [],
    created_at: exercise.created_at ?? new Date().toISOString(),
    updatedAt: Date.now(),
  };

  // Debug: Log what's being saved
  console.log("[addExercise] Saving exercise with fields:", Object.keys(doc));
  console.log(
    "[addExercise] Has signals:",
    !!doc.signals,
    doc.signals ? Object.keys(doc.signals).length : 0,
  );
  console.log(
    "[addExercise] Has event_graph:",
    !!doc.event_graph,
    doc.event_graph?.nodes?.length ?? 0,
    "nodes",
  );
  console.log(
    "[addExercise] Has time_constraints:",
    !!doc.time_constraints,
    doc.time_constraints?.length ?? 0,
  );
  console.log(
    "[addExercise] Has completion:",
    !!doc.completion,
    doc.completion?.terminal_nodes?.length ?? 0,
    "terminal nodes",
  );

  try {
    const result = await exercisesDB.post(doc);
    console.log("[addExercise] Saved successfully with id:", result.id);
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
    await ensureSeedExercisesIfEmpty();
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

/**
 * Get exercises by exercise_id
 */
export async function getExercisesByExerciseId(
  exerciseId: string,
): Promise<Exercise[]> {
  try {
    const allExercises = await getAllExercises();
    return allExercises.filter(
      (exercise) => exercise.exercise_id === exerciseId,
    );
  } catch (error) {
    console.error("Error getting exercises by exercise_id:", error);
    throw error;
  }
}

// ==================== Deprecated functions (use Exercise functions instead) ====================

/** @deprecated Use addExercise instead */
export const addExerciseRecord = addExercise;

/** @deprecated Use getAllExercises instead */
export const getAllExerciseRecords = getAllExercises;

/** @deprecated Use getExerciseById instead */
export const getExerciseRecordById = getExerciseById;

/** @deprecated Use getExercisesByExerciseId instead */
export const getExerciseRecordsByExerciseId = getExercisesByExerciseId;

/** @deprecated Use deleteExercise instead */
export const deleteExerciseRecord = deleteExercise;

/** @deprecated Use clearDatabase instead */
export const clearExerciseRecordsDatabase = clearDatabase;

// ==================== Routines functions ====================

/**
 * Map body parts to simplified versions (merge symmetric, exclude eyes)
 */
const BODY_PART_MAP: Record<string, SimplifiedBodyPart | null> = {
  nose: "nose",
  left_eye: null,
  right_eye: null,
  left_ear: "ear",
  right_ear: "ear",
  left_shoulder: "shoulder",
  right_shoulder: "shoulder",
  left_elbow: "elbow",
  right_elbow: "elbow",
  left_wrist: "wrist",
  right_wrist: "wrist",
  left_hip: "hip",
  right_hip: "hip",
  left_knee: "knee",
  right_knee: "knee",
  left_ankle: "ankle",
  right_ankle: "ankle",
};

/**
 * Calculate routine stats from exercises
 */
export function calculateRoutineStats(exercises: Exercise[]): {
  stats: Routine["stats"];
  totalTime: number;
} {
  const bodyPartCounts: Record<SimplifiedBodyPart, number> = {
    nose: 0,
    ear: 0,
    shoulder: 0,
    elbow: 0,
    wrist: 0,
    hip: 0,
    knee: 0,
    ankle: 0,
  };

  const muscleGroupsSet = new Set<string>();
  let totalTime = 0;

  for (const exercise of exercises) {
    // Count time
    totalTime += exercise.duration ?? 30; // default 30 seconds

    // Count muscle groups
    if (exercise.muscle_groups) {
      exercise.muscle_groups.forEach((mg) => muscleGroupsSet.add(mg));
    }

    // Count body parts from signals
    if (exercise.signals) {
      for (const signal of Object.values(exercise.signals)) {
        for (const point of signal.points) {
          const simplified = BODY_PART_MAP[point];
          if (simplified) {
            bodyPartCounts[simplified]++;
          }
        }
      }
    }
  }

  // Convert counts to percentages
  const totalParts = Object.values(bodyPartCounts).reduce((a, b) => a + b, 0);
  const bodyParts: Record<SimplifiedBodyPart, number> = {} as Record<
    SimplifiedBodyPart,
    number
  >;

  for (const [part, count] of Object.entries(bodyPartCounts)) {
    bodyParts[part as SimplifiedBodyPart] =
      totalParts > 0 ? Math.round((count / totalParts) * 100) : 0;
  }

  return {
    stats: {
      bodyParts,
      muscleGroups: Array.from(muscleGroupsSet),
    },
    totalTime,
  };
}

/**
 * Add a new routine to the database
 */
export async function addRoutine(
  routine: Omit<Routine, "_id" | "_rev" | "updatedAt">,
) {
  const doc: Routine = {
    ...routine,
    created_at: routine.created_at ?? new Date().toISOString(),
    updatedAt: Date.now(),
  };

  try {
    const result = await routinesDB.post(doc);
    console.log("[addRoutine] Saved successfully with id:", result.id);
    return { success: true, id: result.id, rev: result.rev };
  } catch (error) {
    console.error("Error adding routine:", error);
    throw error;
  }
}

/**
 * Get all routines
 */
export async function getAllRoutines(): Promise<Routine[]> {
  try {
    await ensureSeedRoutinesIfEmpty();
    const result = await routinesDB.allDocs({ include_docs: true });
    return (
      result.rows
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((row: any) => {
          const doc = row.doc as Routine;
          if (!doc) return doc;

          // Backwards compatibility: if `items` missing, derive from legacy `exercises`
          if (!doc.items && Array.isArray(doc.exercises)) {
            doc.items = doc.exercises.map((exerciseId) => ({
              exerciseId,
              reps: 1,
            }));
          }

          return doc;
        })
        .filter((doc: Routine | undefined): doc is Routine => !!doc)
    );
  } catch (error) {
    console.error("Error getting routines:", error);
    throw error;
  }
}

/**
 * Get a routine by ID
 */
export async function getRoutineById(id: string): Promise<Routine> {
  try {
    await ensureSeedRoutinesIfEmpty();
    const doc = (await routinesDB.get(id)) as Routine;

    if (doc && !doc.items && Array.isArray(doc.exercises)) {
      doc.items = doc.exercises.map((exerciseId) => ({
        exerciseId,
        reps: 1,
      }));
    }

    return doc;
  } catch (error) {
    console.error("Error getting routine:", error);
    throw error;
  }
}

/**
 * Update a routine
 */
export async function updateRoutine(id: string, updates: Partial<Routine>) {
  try {
    const doc = await routinesDB.get(id);
    const updated = {
      ...doc,
      ...updates,
      updatedAt: Date.now(),
    };
    const result = await routinesDB.put(updated);
    return { success: true, rev: result.rev };
  } catch (error) {
    console.error("Error updating routine:", error);
    throw error;
  }
}

/**
 * Delete a routine
 */
export async function deleteRoutine(id: string) {
  try {
    const doc = await routinesDB.get(id);
    await routinesDB.remove(doc);
    return { success: true };
  } catch (error) {
    console.error("Error deleting routine:", error);
    throw error;
  }
}

/**
 * Delete all routines from the routines database
 */
export async function clearRoutinesDatabase() {
  try {
    const all = await routinesDB.allDocs({ include_docs: true });
    const docsToDelete = all.rows
      .map((row: { doc?: unknown }) => row.doc)
      .filter(
        (doc: unknown): doc is { _id: string; _rev: string } =>
          !!doc &&
          typeof doc === "object" &&
          "_id" in doc &&
          "_rev" in doc &&
          typeof (doc as { _id?: unknown })._id === "string" &&
          typeof (doc as { _rev?: unknown })._rev === "string",
      )
      .map((doc: { _id: string; _rev: string }) => ({
        _id: doc._id,
        _rev: doc._rev,
        _deleted: true,
      }));

    if (docsToDelete.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    await routinesDB.bulkDocs(docsToDelete);
    return { success: true, deletedCount: docsToDelete.length };
  } catch (error) {
    console.error("Error clearing routines database:", error);
    throw error;
  }
}
