import type { Exercise, Routine } from "@kgm/core";
import { upsertExercises, upsertRoutines } from "./repositories";

export interface SyncResult {
  exercises: number;
  routines: number;
  seedFiles: number;
  leveldbDocs: number;
  leveldbError?: string;
}

interface EmbeddedDataResponse {
  exercises: Exercise[];
  routines: Routine[];
  sources: {
    seedFiles: number;
    leveldbDocs: number;
    leveldbError?: string;
  };
}

/**
 * Dev only. Copies the embedded app's data (served by the Vite dev server at
 * `/__kgm/embedded-data`) into the web client's local database. Idempotent:
 * documents are upserted by id.
 */
export async function syncEmbeddedData(): Promise<SyncResult> {
  const response = await fetch("/__kgm/embedded-data", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`No se pudo leer la data de embedded (${response.status})`);
  }

  const data = (await response.json()) as EmbeddedDataResponse;
  await upsertExercises(data.exercises);
  await upsertRoutines(data.routines);

  return {
    exercises: data.exercises.length,
    routines: data.routines.length,
    ...data.sources,
  };
}

export const describeSync = (result: SyncResult): string => {
  if (result.exercises === 0 && result.routines === 0) {
    return (
      "Embedded no tiene datos todavía (sin seeds en src/db/ ni documentos en su LevelDB). " +
      "Ejecuta `pnpm db:migrate` o importa JSON." +
      (result.leveldbError ? ` LevelDB: ${result.leveldbError}` : "")
    );
  }
  return `Copiados desde embedded: ${result.exercises} ejercicios, ${result.routines} rutinas.`;
};
