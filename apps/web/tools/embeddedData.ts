import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

/**
 * Dev-only: reads the data the embedded app owns on disk so the web client can
 * copy it into its own IndexedDB. Two sources, merged by id (seed files win):
 *   1. LevelDB databases `exercises/` and `routines/` (written by `pnpm db:migrate`)
 *   2. Seed JSON files in `src/db/exercises/` and `src/db/routines/`
 */
export interface EmbeddedData {
  exercises: Record<string, unknown>[];
  routines: Record<string, unknown>[];
  sources: {
    seedFiles: number;
    leveldbDocs: number;
    /** Set when the LevelDB could not be read (data from seed files is still returned). */
    leveldbError?: string;
  };
}

type Doc = Record<string, unknown>;

const isDoc = (value: unknown): value is Doc =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const docKey = (doc: Doc): string | null => {
  const id = doc._id ?? doc.exercise_id;
  return typeof id === "string" && id ? id : null;
};

function readJsonDir(dir: string): { docs: Doc[]; files: number } {
  if (!fs.existsSync(dir)) return { docs: [], files: 0 };
  const docs: Doc[] = [];
  let files = 0;
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith(".json")) continue;
    files += 1;
    try {
      const parsed: unknown = JSON.parse(
        fs.readFileSync(path.join(dir, name), "utf8"),
      );
      for (const item of Array.isArray(parsed) ? parsed : [parsed]) {
        if (isDoc(item)) docs.push(item);
      }
    } catch {
      // Malformed seed file: skip it, keep the rest.
    }
  }
  return { docs, files };
}

async function readLevelDb(dbDir: string, modulesFrom: string): Promise<Doc[]> {
  if (!fs.existsSync(path.join(dbDir, "CURRENT"))) return [];

  // LevelDB takes an exclusive lock; read a snapshot copy so a running
  // embedded script/dev server never conflicts (and we never modify its data).
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kgm-leveldb-"));
  const copy = path.join(tmp, path.basename(dbDir));
  try {
    fs.cpSync(dbDir, copy, { recursive: true });
    fs.rmSync(path.join(copy, "LOCK"), { force: true });

    // Resolve pouchdb/leveldown from the embedded app so web needs no native deps.
    const requireFromEmbedded = createRequire(modulesFrom);
    const PouchDB = requireFromEmbedded("pouchdb");
    const leveldown = requireFromEmbedded("leveldown");

    const db = new PouchDB(copy, { adapter: "leveldb", db: leveldown });
    try {
      const result = await db.allDocs({ include_docs: true });
      return (result.rows as { id: string; doc?: Doc }[])
        .filter((row) => row.doc && !row.id.startsWith("_design/"))
        .map((row) => row.doc as Doc);
    } finally {
      await db.close();
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const merge = (...lists: Doc[][]): Doc[] => {
  const byKey = new Map<string, Doc>();
  const anonymous: Doc[] = [];
  for (const list of lists) {
    for (const raw of list) {
      const { _rev: _ignored, ...doc } = raw;
      void _ignored;
      const key = docKey(doc);
      if (key) byKey.set(key, doc);
      else anonymous.push(doc);
    }
  }
  return [...byKey.values(), ...anonymous];
};

export async function readEmbeddedData(
  embeddedRoot: string,
  options: { modulesFrom?: string } = {},
): Promise<EmbeddedData> {
  const modulesFrom =
    options.modulesFrom ?? path.join(embeddedRoot, "package.json");

  const seedExercises = readJsonDir(
    path.join(embeddedRoot, "src/db/exercises"),
  );
  const seedRoutines = readJsonDir(path.join(embeddedRoot, "src/db/routines"));

  let dbExercises: Doc[] = [];
  let dbRoutines: Doc[] = [];
  let leveldbError: string | undefined;
  try {
    dbExercises = await readLevelDb(
      path.join(embeddedRoot, "exercises"),
      modulesFrom,
    );
    dbRoutines = await readLevelDb(
      path.join(embeddedRoot, "routines"),
      modulesFrom,
    );
  } catch (error) {
    leveldbError = error instanceof Error ? error.message : String(error);
  }

  return {
    exercises: merge(dbExercises, seedExercises.docs),
    routines: merge(dbRoutines, seedRoutines.docs),
    sources: {
      seedFiles: seedExercises.files + seedRoutines.files,
      leveldbDocs: dbExercises.length + dbRoutines.length,
      ...(leveldbError ? { leveldbError } : {}),
    },
  };
}
