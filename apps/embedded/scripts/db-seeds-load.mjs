import fs from "node:fs/promises";
import path from "node:path";
import PouchDB from "pouchdb";
import leveldown from "leveldown";

const ROOT = process.cwd();
const EXERCISE_SEEDS_DIR = path.join(ROOT, "src", "db", "exercises");
const ROUTINE_SEEDS_DIR = path.join(ROOT, "src", "db", "routines");

const EXERCISES_DB_NAME = process.env.KGM_EXERCISES_DB_NAME ?? "exercises";
const ROUTINES_DB_NAME = process.env.KGM_ROUTINES_DB_NAME ?? "routines";
const RESET_BEFORE_LOAD = process.env.KGM_SEEDS_RESET === "1";

const listJsonFiles = async (dir) => {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => path.join(dir, entry.name))
      .sort((a, b) => a.localeCompare(b));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

const readJson = async (filePath) => JSON.parse(await fs.readFile(filePath, "utf8"));

const deriveExerciseDocId = (exercise) => {
  if (typeof exercise.exercise_id === "string" && exercise.exercise_id.trim()) {
    return `exercise:${exercise.exercise_id.trim()}`;
  }
  return `exercise:seed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const deriveRoutineDocId = (routine, index) => {
  if (typeof routine.name === "string" && routine.name.trim()) {
    return `routine:${routine.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  }
  return `routine:seed-${index + 1}`;
};

const removeAllDocs = async (db) => {
  const all = await db.allDocs();
  if (all.rows.length === 0) return;

  await db.bulkDocs(
    all.rows.map((row) => ({
      _id: row.id,
      _rev: row.value.rev,
      _deleted: true,
    })),
  );
};

const loadExercises = async () => {
  const files = await listJsonFiles(EXERCISE_SEEDS_DIR);
  const docs = [];

  for (const file of files) {
    const payload = await readJson(file);
    const { _id, _rev, ...rest } = payload;
    void _id;
    void _rev;

    docs.push({
      ...rest,
      _id: deriveExerciseDocId(payload),
      created_at:
        typeof payload.created_at === "string"
          ? payload.created_at
          : new Date().toISOString(),
      recording_angles: Array.isArray(payload.recording_angles)
        ? payload.recording_angles
        : [],
      recording_points: Array.isArray(payload.recording_points)
        ? payload.recording_points
        : [],
      tutor_points: Array.isArray(payload.tutor_points) ? payload.tutor_points : [],
      updatedAt: Date.now(),
    });
  }

  const db = new PouchDB(EXERCISES_DB_NAME, { db: leveldown });
  try {
    if (RESET_BEFORE_LOAD) {
      await removeAllDocs(db);
    }
    if (docs.length > 0) {
      await db.bulkDocs(docs);
    }
  } finally {
    await db.close();
  }

  return docs.length;
};

const loadRoutines = async () => {
  const files = await listJsonFiles(ROUTINE_SEEDS_DIR);
  const docs = [];

  for (let i = 0; i < files.length; i += 1) {
    const payload = await readJson(files[i]);
    const { _id, _rev, ...rest } = payload;
    void _id;
    void _rev;

    const exercises = Array.isArray(payload.exercises)
      ? payload.exercises.filter((value) => typeof value === "string")
      : [];
    const items = Array.isArray(payload.items)
      ? payload.items.map((item) => ({
          exerciseId: String(item?.exerciseId ?? ""),
          reps: Math.max(1, Number(item?.reps ?? 1) || 1),
        }))
      : exercises.map((exerciseId) => ({ exerciseId, reps: 1 }));

    docs.push({
      ...rest,
      _id: deriveRoutineDocId(payload, i),
      exercises,
      items,
      created_at:
        typeof payload.created_at === "string"
          ? payload.created_at
          : new Date().toISOString(),
      updatedAt: Date.now(),
    });
  }

  const db = new PouchDB(ROUTINES_DB_NAME, { db: leveldown });
  try {
    if (RESET_BEFORE_LOAD) {
      await removeAllDocs(db);
    }
    if (docs.length > 0) {
      await db.bulkDocs(docs);
    }
  } finally {
    await db.close();
  }

  return docs.length;
};

const main = async () => {
  const [exerciseCount, routineCount] = await Promise.all([
    loadExercises(),
    loadRoutines(),
  ]);

  console.log(
    `Seed load completed into local PouchDB (${EXERCISES_DB_NAME}, ${ROUTINES_DB_NAME}): ${exerciseCount} exercises, ${routineCount} routines`,
  );
};

main().catch((error) => {
  console.error("Failed to load seeds:", error);
  process.exit(1);
});
