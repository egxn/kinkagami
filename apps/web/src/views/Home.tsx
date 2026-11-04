import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { EvaluationType, MoveNetVersion, Routine } from "@kgm/core";
import { RoutineCard } from "@kgm/ui";
import { describeSync, syncEmbeddedData } from "../platform/devSync";
import { classifyDocuments } from "../platform/importJson";
import {
  exerciseRepository,
  routineRepository,
  upsertExercises,
  upsertRoutines,
} from "../platform/repositories";
import { useConfig } from "../platform/useConfig";

// Dev only: auto-copy embedded's data once per page load when the web DB is empty.
let autoSyncAttempted = false;

export default function Home() {
  const { config, patch } = useConfig();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    setRoutines(await routineRepository.getAll());
  }, []);

  const runSync = useCallback(async () => {
    try {
      setMessage(describeSync(await syncEmbeddedData()));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const all = await routineRepository.getAll();
      if (!cancelled) setRoutines(all);
    };
    void load();

    if (import.meta.env.DEV && !autoSyncAttempted) {
      autoSyncAttempted = true;
      void (async () => {
        const [exercises, routines] = await Promise.all([
          exerciseRepository.getAll(),
          routineRepository.getAll(),
        ]);
        if (exercises.length === 0 && routines.length === 0) await runSync();
      })();
    }
    const unsubscribe = routineRepository.subscribe?.(() => void load());
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [runSync]);

  const onImport = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    let exercises = 0;
    let routinesCount = 0;
    let skipped = 0;

    for (const file of Array.from(files)) {
      try {
        const parsed = classifyDocuments(JSON.parse(await file.text()));
        await upsertExercises(parsed.exercises);
        await upsertRoutines(parsed.routines);
        exercises += parsed.exercises.length;
        routinesCount += parsed.routines.length;
        skipped += parsed.skipped;
      } catch {
        skipped += 1;
      }
    }

    setMessage(
      `Importados: ${exercises} ejercicios, ${routinesCount} rutinas` +
        (skipped ? ` (${skipped} omitidos)` : ""),
    );
    if (fileInput.current) fileInput.current.value = "";
    await refresh();
  };

  return (
    <main className="home">
      <h1>Kinkagami</h1>

      <section>
        <h2>Rutinas</h2>
        {routines.length === 0 ? (
          <p className="muted">
            Aún no hay rutinas. Importa archivos JSON de ejercicios y rutinas
            exportados desde la app embebida.
          </p>
        ) : (
          <div className="routine-grid">
            {routines.map((routine) => (
              <Link
                key={routine._id}
                className="routine-link"
                to={`/trainer/${encodeURIComponent(routine._id ?? "")}`}
              >
                <RoutineCard routine={routine} />
              </Link>
            ))}
          </div>
        )}

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          multiple
          onChange={(e) => void onImport(e.target.files)}
        />
        {import.meta.env.DEV && (
          <button onClick={() => void runSync()}>
            Copiar datos de embedded (dev)
          </button>
        )}
        {message && <p className="muted">{message}</p>}
      </section>

      <section>
        <h2>Ajustes</h2>
        <label>
          Modelo MoveNet{" "}
          <select
            value={config.models.movenet}
            onChange={(e) =>
              patch({
                models: {
                  ...config.models,
                  movenet: e.target.value as MoveNetVersion,
                },
              })
            }
          >
            <option value="lightning">lightning (rápido)</option>
            <option value="thunder">thunder (preciso)</option>
          </select>
        </label>
        <label>
          Evaluación{" "}
          <select
            value={config.evaluation.type}
            onChange={(e) =>
              patch({ evaluation: { type: e.target.value as EvaluationType } })
            }
          >
            <option value="fsm">fsm</option>
            <option value="grid">grid</option>
            <option value="hybrid">hybrid</option>
          </select>
        </label>
      </section>
    </main>
  );
}
