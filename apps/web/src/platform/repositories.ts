import PouchDB from "pouchdb-browser";
import type {
  ClearResult,
  Exercise,
  ExerciseRepository,
  Routine,
  RoutineRepository,
} from "@kgm/core";

type Doc = Record<string, unknown> & { _id?: string; _rev?: string };

const exercisesDB = new PouchDB<Doc>("kgm-web-exercises");
const routinesDB = new PouchDB<Doc>("kgm-web-routines");

const isDesignDoc = (id: string) => id.startsWith("_design/");

function createStore<T extends Doc>(db: PouchDB.Database<Doc>) {
  const getAll = async (): Promise<T[]> => {
    const result = await db.allDocs({ include_docs: true });
    return result.rows
      .filter((row) => !isDesignDoc(row.id) && row.doc)
      .map((row) => row.doc as unknown as T);
  };

  return {
    getAll,
    getById: async (id: string): Promise<T> =>
      (await db.get(id)) as unknown as T,
    add: (doc: Omit<T, "_id" | "_rev" | "updatedAt">) =>
      db.post({ ...doc, updatedAt: Date.now() } as Doc),
    update: async (id: string, updates: Partial<T>) => {
      const current = await db.get(id);
      return db.put({
        ...current,
        ...updates,
        _id: current._id,
        _rev: current._rev,
        updatedAt: Date.now(),
      } as Doc);
    },
    remove: async (id: string) => db.remove(await db.get(id)),
    clear: async (): Promise<ClearResult> => {
      const docs = await getAll();
      const result = await db.bulkDocs(
        docs.map((doc) => ({
          _id: doc._id as string,
          _rev: doc._rev as string,
          _deleted: true,
        })),
      );
      return {
        success: true,
        deletedCount: result.filter((r) => "ok" in r && r.ok).length,
      };
    },
    /** Inserts or replaces by `_id`, keeping the revision chain intact. */
    upsert: async (doc: T): Promise<string> => {
      const { _rev: _ignored, ...rest } = doc;
      void _ignored;
      const id =
        (rest._id as string | undefined) ??
        (typeof rest.exercise_id === "string" ? rest.exercise_id : undefined) ??
        crypto.randomUUID();
      let rev: string | undefined;
      try {
        rev = (await db.get(id))._rev;
      } catch {
        rev = undefined;
      }
      await db.put({
        ...rest,
        _id: id,
        ...(rev ? { _rev: rev } : {}),
        updatedAt: Date.now(),
      });
      return id;
    },
  };
}

const exerciseStore = createStore<Exercise & Doc>(exercisesDB);
const routineStore = createStore<Routine & Doc>(routinesDB);

export const exerciseRepository: ExerciseRepository = {
  getAll: exerciseStore.getAll,
  getById: exerciseStore.getById,
  add: exerciseStore.add,
  update: exerciseStore.update,
  remove: exerciseStore.remove,
};

export const routineRepository: RoutineRepository = {
  getAll: routineStore.getAll,
  getById: routineStore.getById,
  add: routineStore.add,
  update: routineStore.update,
  remove: routineStore.remove,
  clear: routineStore.clear,
  subscribe: (onChange, onError) => {
    const feed = routinesDB.changes({ since: "now", live: true });
    feed.on("change", () => onChange());
    feed.on("error", (error: unknown) => onError?.(error));
    return () => feed.cancel();
  },
};

export const upsertExercises = (docs: Exercise[]) =>
  Promise.all(docs.map((doc) => exerciseStore.upsert(doc as Exercise & Doc)));

export const upsertRoutines = (docs: Routine[]) =>
  Promise.all(docs.map((doc) => routineStore.upsert(doc as Routine & Doc)));
