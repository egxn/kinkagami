import type { Exercise, Routine } from "./types";

/**
 * Portable snapshot of a client's exercises and routines, used to move data
 * between clients (e.g. embedded -> web). Importers accept it as-is.
 */
export interface DataBundle {
  kgm_bundle: 1;
  exported_at: string;
  exercises: Exercise[];
  routines: Routine[];
}

const withoutRevision = <T extends object>(doc: T): T => {
  const { _rev: _ignored, ...rest } = doc as T & { _rev?: unknown };
  void _ignored;
  return rest as T;
};

/** Builds an export bundle. Storage revisions (`_rev`) are dropped. */
export const createDataBundle = (
  exercises: Exercise[],
  routines: Routine[],
  now: Date = new Date(),
): DataBundle => ({
  kgm_bundle: 1,
  exported_at: now.toISOString(),
  exercises: exercises.map(withoutRevision),
  routines: routines.map(withoutRevision),
});
