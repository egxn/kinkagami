import fs from "node:fs/promises";
import path from "node:path";
import PouchDB from "pouchdb";

const ROOT = process.cwd();
const EXERCISE_SEEDS_DIR = path.join(ROOT, "src", "db", "exercises");
const ROUTINE_SEEDS_DIR = path.join(ROOT, "src", "db", "routines");
const MANIFEST_PATH = path.join(ROOT, "setup", "seeds", "manifest.json");

const EXERCISES_DB_NAME = process.env.KGM_EXERCISES_DB_NAME ?? "exercises";
const ROUTINES_DB_NAME = process.env.KGM_ROUTINES_DB_NAME ?? "routines";

const slugify = (value) =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "seed";

const listJsonFiles = async (dir) => {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => path.join(dir, entry.name));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

const ensureCleanDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
  const files = await listJsonFiles(dir);
  await Promise.all(files.map((file) => fs.unlink(file)));
};

const writeJson = async (filePath, data) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
};

const toPortableExercise = (doc) => {
  const portable = { ...doc };
  delete portable._id;
  delete portable._rev;
  delete portable.updatedAt;

  if (!portable.exercise_id || typeof portable.exercise_id !== "string") {
    portable.exercise_id = String(doc._id ?? "exercise");
  }
  if (!portable.created_at) {
    portable.created_at = new Date().toISOString();
  }
  if (!Array.isArray(portable.recording_angles)) {
    portable.recording_angles = [];
  }
  if (!Array.isArray(portable.recording_points)) {
    portable.recording_points = [];
  }
  if (!Array.isArray(portable.tutor_points)) {
    portable.tutor_points = [];
  }

  return portable;
};

const toPortableRoutine = (doc, exerciseIdByDocId) => {
  const portable = { ...doc };
  delete portable._id;
  delete portable._rev;
  delete portable.updatedAt;

  const normalizeExerciseRef = (value) => {
    if (typeof value !== "string") return value;
    return exerciseIdByDocId.get(value) ?? value;
  };

  if (Array.isArray(portable.items)) {
    portable.items = portable.items.map((item) => ({
      ...item,
      exerciseId: normalizeExerciseRef(item?.exerciseId),
      reps: Math.max(1, Number(item?.reps ?? 1) || 1),
    }));
  }

  if (Array.isArray(portable.exercises)) {
    portable.exercises = portable.exercises.map((exerciseId) =>
      normalizeExerciseRef(exerciseId),
    );
  }

  if (!Array.isArray(portable.exercises)) {
    portable.exercises = Array.isArray(portable.items)
      ? portable.items.map((item) => item.exerciseId)
      : [];
  }

  if (!portable.items || !Array.isArray(portable.items)) {
    portable.items = portable.exercises.map((exerciseId) => ({
      exerciseId,
      reps: 1,
    }));
  }

  if (!portable.created_at) {
    portable.created_at = new Date().toISOString();
  }

  return portable;
};

const readDocs = async (dbName) => {
  const db = new PouchDB(dbName);
  try {
    const result = await db.allDocs({ include_docs: true });
    return result.rows
      .map((row) => row.doc)
      .filter((doc) => doc && !String(doc._id ?? "").startsWith("_design/"));
  } finally {
    await db.close();
  }
};

const main = async () => {
  const [exerciseDocs, routineDocs] = await Promise.all([
    readDocs(EXERCISES_DB_NAME),
    readDocs(ROUTINES_DB_NAME),
  ]);

  await Promise.all([ensureCleanDir(EXERCISE_SEEDS_DIR), ensureCleanDir(ROUTINE_SEEDS_DIR)]);

  const exerciseIdByDocId = new Map();
  for (const doc of exerciseDocs) {
    const portable = toPortableExercise(doc);
    exerciseIdByDocId.set(String(doc._id), String(portable.exercise_id));
  }

  for (let i = 0; i < exerciseDocs.length; i += 1) {
    const portable = toPortableExercise(exerciseDocs[i]);
    const baseName = `${String(i + 1).padStart(2, "0")}_${slugify(portable.exercise_id)}`;
    await writeJson(path.join(EXERCISE_SEEDS_DIR, `${baseName}.json`), portable);
  }

  for (let i = 0; i < routineDocs.length; i += 1) {
    const portable = toPortableRoutine(routineDocs[i], exerciseIdByDocId);
    const routineName = portable.name ?? routineDocs[i]._id ?? `routine-${i + 1}`;
    const baseName = `${String(i + 1).padStart(2, "0")}_${slugify(routineName)}`;
    await writeJson(path.join(ROUTINE_SEEDS_DIR, `${baseName}.json`), portable);
  }

  await writeJson(MANIFEST_PATH, {
    generatedAt: new Date().toISOString(),
    sourceDatabases: {
      exercises: EXERCISES_DB_NAME,
      routines: ROUTINES_DB_NAME,
    },
    counts: {
      exercises: exerciseDocs.length,
      routines: routineDocs.length,
    },
    output: {
      exercises: path.relative(ROOT, EXERCISE_SEEDS_DIR),
      routines: path.relative(ROOT, ROUTINE_SEEDS_DIR),
    },
  });

  console.log(
    `Seed generation completed: ${exerciseDocs.length} exercises, ${routineDocs.length} routines`,
  );
};

main().catch((error) => {
  console.error("Failed to generate seeds:", error);
  process.exit(1);
});
